import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  RefreshControl,
  ActivityIndicator,
  Vibration,
  Animated
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useSetorSync } from '../hooks/useSetorSync';
import { imprimirPedidoSetor } from '../utils/printSetor';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Áudio para notificações
const playNotificationSound = () => {
  // Em React Native, você pode usar expo-av para sons reais
  // Por enquanto, usaremos vibração
  Vibration.vibrate([0, 200, 100, 200]);
};

export default function TabletCozinhaScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setorId, setSetorId] = useState(null);
  const [setorNome, setSetorNome] = useState('Cozinha');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [fadeAnim] = useState(new Animated.Value(1));
  const [config, setConfig] = useState({
    somNotificacao: true,
    vibracao: true,
    modoExibicao: 'tablet'
  });

  // Sincronização em tempo real
  const handleUpdate = (updateData) => {
    console.log('Atualização recebida:', updateData);
    
    // Feedback visual e sonoro
    if (config.somNotificacao) {
      playNotificationSound();
    }
    
    // Animação de fade para nova chegada
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
    
    // Recarregar lista quando houver atualização
    if (setorId) {
      buscarItensDoSetor(setorId);
    }
    
    setLastUpdate(new Date());
  };

  const { connected } = useSetorSync(setorId, handleUpdate);

  // Carregar configurações
  const loadConfig = async () => {
    try {
      const savedConfig = await AsyncStorage.getItem('@barapp:tablet_config');
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  // Buscar ID do setor cozinha
  const buscarSetorCozinha = async () => {
    try {
      const response = await apiService.request({
        method: 'GET',
        url: '/setor-impressao/list'
      });

      if (response.data?.success) {
        const setores = response.data.data;
        const cozinha = setores.find(s => 
          s.nome.toLowerCase().includes('cozinha') || 
          s.nome.toLowerCase().includes('cozinha')
        );
        
        if (cozinha) {
          setSetorId(cozinha.id);
          setSetorNome(cozinha.nome);
          return cozinha.id;
        } else {
          // Se não encontrar "cozinha", procurar por nomes similares
          const similar = setores.find(s => 
            s.nome.toLowerCase().includes('preparo') ||
            s.nome.toLowerCase().includes('preparacao') ||
            s.nome.toLowerCase().includes('preparação')
          );
          if (similar) {
            setSetorId(similar.id);
            setSetorNome(similar.nome);
            return similar.id;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar setor cozinha:', error);
      return null;
    }
  };

  // Buscar itens do setor
  const buscarItensDoSetor = async (idSetor) => {
    if (!idSetor) return;
    
    try {
      setLoading(true);
      const response = await apiService.request({
        method: 'GET',
        url: `/setor-impressao-queue/${idSetor}/queue?status=pendente`
      });

      if (response.data?.success) {
        const novosItens = response.data.data;
        
        // Verificar se há itens novos
        const itensNovos = novosItens.filter(novo => 
          !items.some(existente => existente.id === novo.id)
        );
        
        if (itensNovos.length > 0 && items.length > 0) {
          // Notificar sobre novos itens
          Alert.alert(
            'Novos Pedidos!',
            `${itensNovos.length} novo(s) pedido(s) recebido(s)`,
            [{ text: 'OK' }]
          );
        }
        
        setItems(novosItens);
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      Alert.alert('Erro', 'Não foi possível carregar os pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Marcar item como pronto
  const marcarComoPronto = async (item) => {
    try {
      const response = await apiService.request({
        method: 'PATCH',
        url: `/setor-impressao-queue/sale/${item.saleId}/item/${item.id}/status`,
        data: {
          status: 'pronto'
        }
      });

      if (response.data?.success) {
        // Feedback visual
        Alert.alert(
          '✅ Sucesso!',
          'Item marcado como pronto e enviado para o garçom',
          [{ text: 'OK' }]
        );
        
        // Remover item da lista com animação
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }).start(() => {
          setItems(prevItems => prevItems.filter(i => i.id !== item.id));
          fadeAnim.setValue(1);
        });
      }
    } catch (error) {
      console.error('Erro ao marcar item como pronto:', error);
      Alert.alert('❌ Erro', 'Não foi possível marcar o item como pronto');
    }
  };

  // Função para imprimir todos os pedidos atuais
  const imprimirPedidos = async () => {
    if (items.length === 0) {
      Alert.alert('📄 Aviso', 'Não há pedidos para imprimir');
      return;
    }

    try {
      const resultado = await imprimirPedidoSetor(items, setorNome);
      if (resultado.success) {
        Alert.alert('🖨️ Sucesso', 'Pedidos preparados para impressão');
      } else {
        Alert.alert('❌ Erro', resultado.message);
      }
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      Alert.alert('❌ Erro', 'Não foi possível preparar os pedidos para impressão');
    }
  };

  // Agrupar itens por mesa
  const agruparPorMesa = (items) => {
    const agrupado = {};
    items.forEach(item => {
      if (!agrupado[item.mesa]) {
        agrupado[item.mesa] = [];
      }
      agrupado[item.mesa].push(item);
    });
    return agrupado;
  };

  // Atualizar quando a tela entrar em foco
  useFocusEffect(
    useCallback(() => {
      loadConfig();
      
      const carregarDados = async () => {
        const idSetor = await buscarSetorCozinha();
        if (idSetor) {
          await buscarItensDoSetor(idSetor);
        } else {
          Alert.alert('⚠️ Aviso', 'Setor "Cozinha" não encontrado. Verifique o cadastro de setores.');
          setLoading(false);
        }
      };
      
      carregarDados();
      
      // Atualizar a cada 30 segundos
      const interval = setInterval(() => {
        if (setorId) {
          buscarItensDoSetor(setorId);
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }, [setorId])
  );

  const mesasAgrupadas = agruparPorMesa(items);

  const renderItem = ({ item }) => (
    <Animated.View style={[styles.itemContainer, { opacity: fadeAnim }]}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>
          {item.quantidade}x {item.produto}
        </Text>
        <Text style={styles.itemDetail}>👤 Responsável: {item.responsavel}</Text>
        <Text style={styles.itemDetail}>👨‍🍳 Funcionário: {item.funcionario}</Text>
        <Text style={styles.itemDetail}>
          ⏰ Horário: {new Date(item.horario).toLocaleTimeString('pt-BR')}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.readyButton}
        onPress={() => marcarComoPronto(item)}
      >
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
        <Text style={styles.readyButtonText}>Pronto</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderMesa = ({ item: mesa }) => {
    const mesaItems = mesasAgrupadas[mesa];
    return (
      <View style={styles.mesaContainer}>
        <View style={styles.mesaHeader}>
          <Text style={styles.mesaTitle}>{mesa}</Text>
          <Text style={styles.mesaItemsCount}>{mesaItems.length} item(s)</Text>
        </View>
        <FlatList
          data={mesaItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Carregando pedidos...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Nenhum pedido pendente</Text>
          <Text style={styles.emptySubtext}>Os pedidos aparecerão aqui quando forem realizados</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => buscarItensDoSetor(setorId)}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.refreshButtonText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Ionicons name="restaurant" size={32} color="#4CAF50" />
          <TouchableOpacity style={styles.printButton} onPress={imprimirPedidos}>
            <Ionicons name="print" size={20} color="#fff" />
            <Text style={styles.printButtonText}>Imprimir</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Cozinha</Text>
        <Text style={styles.headerSubtitle}>{items.length} pedido(s) pendente(s)</Text>
        <View style={[styles.connectionStatus, connected ? styles.connected : styles.disconnected]}>
          <Ionicons name={connected ? 'wifi' : 'wifi-off'} size={16} color="#fff" />
          <Text style={styles.connectionText}>
            {connected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
        <Text style={styles.lastUpdateText}>
          Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
        </Text>
      </View>
      
      <FlatList
        data={Object.keys(mesasAgrupadas)}
        renderItem={renderMesa}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => buscarItensDoSetor(setorId)}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  printButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  printButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connected: {
    backgroundColor: '#4CAF50',
  },
  disconnected: {
    backgroundColor: '#f44336',
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '600',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 18,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 24,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  listContainer: {
    padding: 15,
  },
  mesaContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  mesaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  mesaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mesaItemsCount: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
    marginRight: 15,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  itemDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  readyButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  readyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
});