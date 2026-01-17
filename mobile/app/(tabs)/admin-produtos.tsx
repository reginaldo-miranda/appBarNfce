import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { SafeIcon } from '../../components/SafeIcon';
import { productService, categoryService, typeService, unidadeMedidaService, setorImpressaoService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import SearchAndFilter from '../../src/components/SearchAndFilter';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus';
import { testApiConnection, getCurrentBaseUrl } from '../../src/services/api';

const { width } = Dimensions.get('window');

interface Product {
  _id: string;
  nome: string;
  descricao: string;
  precoCusto: number;
  precoVenda: number;
  categoria: string;
  tipo: string;
  grupo: string;
  unidade: string;
  ativo: boolean;
  quantidade: number;
  disponivel: boolean;
}

interface Categoria {
  _id: string;
  id?: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

interface Tipo {
  _id: string;
  id?: string;
  nome: string;
  ativo: boolean;
}

interface UnidadeMedida {
  _id: string;
  id?: string;
  nome: string;
  sigla: string;
  ativo: boolean;
}

interface SetorImpressao {
  id: string;
  nome: string;
  modoEnvio: 'impressora' | 'whatsapp';
}

export default function AdminProdutosScreen() {
  const { hasPermission } = useAuth() as any;
  const [products, setProducts] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'nome' | 'categoria' | 'preco'>('nome');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [dbTarget, setDbTarget] = useState('');
  const [apiHost, setApiHost] = useState('');
  const [setores, setSetores] = useState<SetorImpressao[]>([]);
  const [selectedSetores, setSelectedSetores] = useState<string[] | null>(null);

  // Filtros para o SearchAndFilter
  const categoryFilters = [
    { key: '', label: 'Todas' },
    ...categorias.map(categoria => ({ key: categoria.nome, label: categoria.nome }))
  ];

  const statusFilters = [
    { key: '', label: 'Todos' },
    { key: 'ativo', label: 'Ativos' },
    { key: 'inativo', label: 'Inativos' }
  ];

  const handleFilterChange = (filterKey: string) => {
    if (statusFilters.some(filter => filter.key === filterKey)) {
      // É um filtro de status
      if (filterKey === '') {
        setFilterActive(null);
      } else if (filterKey === 'ativo') {
        setFilterActive(true);
      } else if (filterKey === 'inativo') {
        setFilterActive(false);
      }
    } else {
      // É um filtro de categoria
      setSelectedCategory(filterKey);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    precoCusto: '',
    precoVenda: '',
    categoria: '',
    tipo: '',
    grupo: '',
    unidade: 'un',
    ativo: true,
    quantidade: '0',
    disponivel: true,
  });

  useEffect(() => {
    if (!hasPermission('produtos')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela');
      return;
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    const off = events.on('dbTargetChanged', () => {
      loadInitialData();
    });
    return () => { off && off(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const base = getCurrentBaseUrl();
        const res = await testApiConnection(base, undefined);
        if (res?.ok) {
          const host = new URL(base).hostname;
          setApiHost(host);
          setDbTarget(String(res?.data?.dbTarget || ''));
        }
      } catch {}
    })();
  }, []);

  // Alternância de base deve ocorrer apenas na tela de Login conforme requisitos.

  const loadInitialData = async () => {
    await Promise.all([
      loadProducts(),
      loadCategorias(),
      loadTipos(),
      loadUnidades(),
      loadSetores()
    ]);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await productService.getAll();
      setProducts(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      Alert.alert('Erro', 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const loadCategorias = async () => {
    try {
      console.log('🔍 Carregando categorias...');
      const response = await categoryService.getAll();
      console.log('📋 Categorias carregadas:', response.data);
      console.log('📊 Número de categorias:', response.data.length);
      setCategorias(response.data);
    } catch (error: any) {
      console.error('❌ Erro ao carregar categorias:', error);
      Alert.alert('Erro', 'Erro ao carregar categorias');
    }
  };

  const loadTipos = async () => {
    try {
      const tipos = await typeService.getAll();
      setTipos(tipos);
    } catch (error: any) {
      console.error('Erro ao carregar tipos:', error);
    }
  };

  const loadUnidades = async () => {
    try {
      const unidades = await unidadeMedidaService.getAll();
      setUnidades(unidades);
    } catch (error: any) {
      console.error('Erro ao carregar unidades:', error);
    }
  };

  const loadSetores = async () => {
    try {
      const body = await setorImpressaoService.getAll();
      const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
      const mapped: SetorImpressao[] = list.map((s: any) => ({ id: String(s.id ?? s._id), nome: s.nome, modoEnvio: String(s.modoEnvio || 'impressora') as any }));
      setSetores(mapped);
    } catch (error: any) {
    }
  };

  const handleSaveProduct = async () => {
    console.log('🔄 Iniciando salvamento do produto...');
    console.log('📋 Dados do formulário COMPLETOS:', JSON.stringify(formData, null, 2));
    console.log('🏷️ Categoria selecionada:', formData.categoria);
    console.log('🔍 Tipo da categoria:', typeof formData.categoria);
    console.log('📏 Tamanho da categoria:', formData.categoria?.length);
    console.log('🎯 Categoria é vazia?', formData.categoria === '');
    console.log('🎯 Categoria é null?', formData.categoria === null);
    console.log('🎯 Categoria é undefined?', formData.categoria === undefined);

    if (!formData.nome || !formData.precoVenda || !formData.categoria) {
      console.log('❌ Validação falhou:');
      console.log('  - Nome:', !!formData.nome);
      console.log('  - Preço:', !!formData.precoVenda);
      console.log('  - Categoria:', !!formData.categoria);
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const productData: any = {
        nome: formData.nome,
        descricao: formData.descricao,
        precoCusto: parseFloat(formData.precoCusto),
        precoVenda: parseFloat(formData.precoVenda),
        categoria: formData.categoria,
        tipo: formData.tipo,
        grupo: formData.grupo,
        unidade: formData.unidade,
        ativo: formData.ativo,
        quantidade: parseInt(formData.quantidade) || 0,
        disponivel: formData.disponivel
      };

      if (selectedSetores !== null) {
        productData.setoresImpressaoIds = selectedSetores.map((id) => Number(id));
      } else {
        console.warn('[WARN] Salvando produto (Admin) sem atualizar setores (dados não carregados)');
      }

      console.log('📦 Dados do produto ANTES do envio:', JSON.stringify(productData, null, 2));
      console.log('🏷️ Categoria FINAL antes do envio:', productData.categoria);

      let response;
      if (editingProduct) {
        console.log('🔄 Atualizando produto existente...');
        response = await productService.update(editingProduct._id, productData);
      } else {
        console.log('🆕 Criando novo produto...');
        response = await productService.create(productData);
      }

      console.log('✅ Resposta do servidor:', response);
      Alert.alert('Sucesso', editingProduct ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!');
      loadInitialData(); // Refresh completo dos dados
      // resetForm(); // Comentado temporariamente para debug
    } catch (error: any) {
      console.error('❌ Erro ao salvar produto:', error);
      console.error('❌ Detalhes do erro:', error.response?.data);
      Alert.alert('Erro', 'Erro ao salvar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = async (product: Product) => {
    setFormData({
      nome: product.nome,
      descricao: product.descricao,
      precoCusto: product.precoCusto.toString(),
      precoVenda: product.precoVenda.toString(),
      categoria: product.categoria,
      tipo: product.tipo,
      grupo: product.grupo,
      unidade: product.unidade,
      ativo: product.ativo,
      quantidade: product.quantidade.toString(),
      disponivel: product.disponivel,
    });
    setEditingProduct(product);
    setSelectedSetores(null); // Initialize as null to state "loading/unknown"
    try {
      const resp = await productService.getById(product._id);
      const sids = Array.isArray(resp?.data?.setoresImpressaoIds) ? resp.data.setoresImpressaoIds.map((n: any) => String(n)) : [];
      setSelectedSetores(sids);
    } catch {
      console.warn('[WARN] Falha ao carregar detalhes do produto (setores) para edição em Admin');
      // Mantém null, indicando falha
    }
    setModalVisible(true);
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o produto "${product.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.delete(product._id);
              Alert.alert('Sucesso', 'Produto excluído com sucesso');
              loadInitialData(); // Refresh completo dos dados
            } catch (error: any) {
              console.error('Erro ao excluir produto:', error);
              Alert.alert('Erro', 'Erro ao excluir produto');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      precoCusto: '',
      precoVenda: '',
      categoria: '',
      tipo: '',
      grupo: '',
      unidade: 'un',
      ativo: true,
      quantidade: '0',
      disponivel: true,
    });
    setEditingProduct(null);
    setSelectedSetores([]);
  };

  const getFilteredAndSortedProducts = () => {
    const q = String(searchText || '').toLowerCase();
    let filtered = products.filter(product => {
      const nome = String(product?.nome || '').toLowerCase();
      const categoria = String(product?.categoria || '').toLowerCase();
      const descricao = String(product?.descricao || '').toLowerCase();

      const matchesSearch = nome.includes(q) || categoria.includes(q) || descricao.includes(q);

      const matchesCategory = !selectedCategory || product.categoria === selectedCategory;
      const matchesActive = filterActive === null || product.ativo === filterActive;

      return matchesSearch && matchesCategory && matchesActive;
    });

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'nome':
          return a.nome.localeCompare(b.nome);
        case 'categoria':
          return a.categoria.localeCompare(b.categoria);
        case 'preco':
          return a.precoVenda - b.precoVenda;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={[
        styles.productCard,
        viewMode === 'grid' ? styles.gridCard : styles.listCard
      ]}
      onPress={() => handleEditProduct(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.nome}</Text>
          <Text style={styles.productCategory}>{item.categoria}</Text>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditProduct(item)}
          >
            <SafeIcon name="pencil" size={18} color="#2196F3" fallbackText="✎" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteProduct(item)}
          >
            <SafeIcon name="trash" size={18} color="#f44336" fallbackText="🗑" />
          </TouchableOpacity>
        </View>
      </View>
      
      {viewMode === 'list' && (
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.descricao}
        </Text>
      )}
      
      <View style={styles.priceContainer}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Custo:</Text>
          <Text style={styles.priceValue}>R$ {item.precoCusto.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Venda:</Text>
          <Text style={[styles.priceValue, styles.sellPrice]}>R$ {item.precoVenda.toFixed(2)}</Text>
        </View>
      </View>
      
      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, { backgroundColor: item.ativo ? '#E8F5E8' : '#FFEBEE' }]}>
          <Text style={[styles.statusText, { color: item.ativo ? '#4CAF50' : '#f44336' }]}>
            {item.ativo ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.disponivel ? '#E3F2FD' : '#FFF3E0' }]}>
          <Text style={[styles.statusText, { color: item.disponivel ? '#2196F3' : '#FF9800' }]}>
            {item.disponivel ? 'Disponível' : 'Indisponível'}
          </Text>
        </View>
        
        {/* Margem de Lucro */}
        <View style={styles.marginContainer}>
          <Text style={styles.marginLabel}>Margem:</Text>
          <Text style={[
            styles.marginValue,
            item.precoVenda > item.precoCusto ? styles.marginPositive : styles.marginNegative
          ]}>
            {item.precoCusto > 0 ? 
              `${(((item.precoVenda - item.precoCusto) / item.precoCusto) * 100).toFixed(1)}%` : 
              'N/A'
            }
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={{ fontSize: 12, color: '#666' }}>Base: {dbTarget ? dbTarget.toUpperCase() : 'N/A'} • API: {apiHost || 'N/A'}</Text>
      </View>
      {/* Barra de busca e filtros */}
      <View style={styles.searchSection}>
        <View style={{ flex: 1 }}>
          <SearchAndFilter
            searchText={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder="Buscar produtos, categorias..."
            filters={[...categoryFilters, ...statusFilters]}
            selectedFilter={selectedCategory || (filterActive === null ? '' : filterActive ? 'ativo' : 'inativo')}
            onFilterChange={handleFilterChange}
            showFilters={true}
          />
        </View>
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <SafeIcon name="add" size={24} color="#fff" fallbackText="+" />
        </TouchableOpacity>
      </View>

      {/* Controles de visualização */}
      <View style={styles.controlsSection}>
        
        <View style={styles.viewControls}>
          {/* Ordenação */}
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => {
              const sortOptions = ['nome', 'categoria', 'preco'] as const;
              const currentIndex = sortOptions.indexOf(sortBy);
              const nextIndex = (currentIndex + 1) % sortOptions.length;
              setSortBy(sortOptions[nextIndex]);
            }}
          >
            <SafeIcon name="swap-vertical" size={18} color="#666" fallbackText="↕" />
            <Text style={styles.sortText}>
              {sortBy === 'nome' ? 'Nome' : sortBy === 'categoria' ? 'Categoria' : 'Preço'}
            </Text>
          </TouchableOpacity>
          
          {/* Modo de visualização */}
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('grid')}
            >
              <SafeIcon name="grid" size={18} color={viewMode === 'grid' ? '#2196F3' : '#666'} fallbackText="▦" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <SafeIcon name="list" size={18} color={viewMode === 'list' ? '#2196F3' : '#666'} fallbackText="≡" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Estatísticas rápidas */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{products.filter(p => p.ativo).length}</Text>
          <Text style={styles.statLabel}>Ativos</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{products.filter(p => p.disponivel).length}</Text>
          <Text style={styles.statLabel}>Disponíveis</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{new Set(products.map(p => p.categoria)).size}</Text>
          <Text style={styles.statLabel}>Categorias</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{filteredProducts.length}</Text>
          <Text style={styles.statLabel}>Exibidos</Text>
        </View>
      </View>
    </View>
  );

  if (!hasPermission('produtos')) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.accessDenied}>
          <SafeIcon name="lock-closed" size={64} color="#ccc" fallbackText="🔒" />
          <Text style={styles.accessDeniedText}>Acesso Negado</Text>
          <Text style={styles.accessDeniedSubtext}>
            Você não tem permissão para gerenciar produtos
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando produtos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredProducts = getFilteredAndSortedProducts();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenIdentifier screenName="Admin - Produtos" />
      <View style={styles.container}>
        <FlatList
          data={filteredProducts}
          renderItem={renderProductCard}
          keyExtractor={(item) => (item._id ? String(item._id) : String((item as any).id))}
          ListHeaderComponent={renderHeader}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode} // Force re-render when view mode changes
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadInitialData}
              colors={['#2196F3']}
              tintColor="#2196F3"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <SafeIcon name="cube-outline" size={64} color="#ccc" fallbackText="📦" />
              <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
              <Text style={styles.emptySubtext}>Tente ajustar filtros ou adicione um novo produto</Text>
            </View>
          }
        />

        {/* Modal de criação/edição */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaView style={styles.modalContainer}>
            <KeyboardAvoidingView
              style={styles.modalContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
              enabled
            >
              <ScrollView
                style={styles.modalContent}
                contentContainerStyle={styles.scrollContent}
                bounces={false}
                alwaysBounceVertical={false}
                scrollEventThrottle={16}
                nestedScrollEnabled={true}
              >
                {/* Header do modal */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelButton}>Cancelar</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>
                    {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                  </Text>
                  <TouchableOpacity onPress={handleSaveProduct}>
                    <Text style={styles.saveButton}>Salvar</Text>
                  </TouchableOpacity>
                </View>

                {/* Formulário */}
                <View style={styles.formContainer}>
                  {/* Nome */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Nome do Produto *</Text>
                    <TextInput
                      style={[
                        styles.input,
                        !formData.nome && styles.inputError
                      ]}
                      value={formData.nome}
                      onChangeText={(value) => setFormData({ ...formData, nome: value })}
                      placeholder="Digite o nome do produto"
                      placeholderTextColor="#999"
                    />
                    {!formData.nome && (
                      <Text style={styles.errorText}>Nome é obrigatório</Text>
                    )}
                  </View>

                  {/* Descrição */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Descrição</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.descricao}
                      onChangeText={(value) => setFormData({ ...formData, descricao: value })}
                      placeholder="Descrição do produto"
                      placeholderTextColor="#999"
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Preços */}
                  <View style={styles.row}>
                    <View style={[styles.formGroup, styles.halfWidth]}>
                      <Text style={styles.label}>Preço de Custo</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.precoCusto}
                        onChangeText={(value) => setFormData({ ...formData, precoCusto: value })}
                        placeholder="0,00"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.formGroup, styles.halfWidth]}>
                      <Text style={styles.label}>Preço de Venda *</Text>
                      <TextInput
                        style={[
                          styles.input,
                          !formData.precoVenda && styles.inputError
                        ]}
                        value={formData.precoVenda}
                        onChangeText={(value) => setFormData({ ...formData, precoVenda: value })}
                        placeholder="0,00"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                      />
                      {!formData.precoVenda && (
                        <Text style={styles.errorText}>Preço é obrigatório</Text>
                      )}
                    </View>
                  </View>

                  {/* Categoria */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Categoria *</Text>
                    <View style={[
                      styles.selectContainer,
                      !formData.categoria && styles.selectContainerError
                    ]}>
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryScrollContent}
                      >
                        {(() => {
                          console.log('🔍 Renderizando categorias. Total:', categorias.length);
                          console.log('📋 Lista de categorias:', categorias);
                          console.log('🏷️ Categoria atual selecionada:', formData.categoria);
                          return categorias.map((categoria) => (
                            <TouchableOpacity
                              key={categoria.id ?? categoria._id}
                              style={[
                                styles.selectButton,
                                formData.categoria === categoria.nome && styles.selectButtonActive
                              ]}
                              onPress={() => {
                                console.log('🎯 Categoria selecionada:', categoria.nome);
                                console.log('📋 Categoria objeto completo:', categoria);
                                console.log('🔄 Estado anterior do formData:', formData);
                                setFormData({ ...formData, categoria: categoria.nome });
                                console.log('✅ Nova categoria definida:', categoria.nome);
                              }}
                            >
                              <Text style={[
                                styles.selectButtonText,
                                formData.categoria === categoria.nome && styles.selectButtonTextActive
                              ]}>
                                {categoria.nome}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Tipo e Unidade */}
                  <View style={styles.row}>
                    <View style={[styles.formGroup, styles.halfWidth]}>
                      <Text style={styles.label}>Tipo</Text>
                      <View style={styles.selectContainer}>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.categoryScrollContent}
                        >
                          {tipos.map((tipo) => (
                            <TouchableOpacity
                              key={tipo.id ?? tipo._id}
                              style={[
                                styles.selectButton,
                                formData.tipo === tipo.nome && styles.selectButtonActive
                              ]}
                              onPress={() => setFormData({ ...formData, tipo: tipo.nome })}
                            >
                              <Text style={[
                                styles.selectButtonText,
                                formData.tipo === tipo.nome && styles.selectButtonTextActive
                              ]}>
                                {tipo.nome}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    
                    <View style={[styles.formGroup, styles.halfWidth]}>
                      <Text style={styles.label}>Unidade</Text>
                      <View style={styles.selectContainer}>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.categoryScrollContent}
                        >
                          {(() => {
                          console.log('🔍 Renderizando unidades. Total:', unidades.length);
                          console.log('📋 Lista de unidades:', unidades);
                          console.log('🏷️ Unidade atual selecionada:', formData.unidade);
                          return unidades.map((unidade) => (
                            <TouchableOpacity
                              key={unidade.id ?? unidade._id}
                              style={[
                                styles.selectButton,
                                formData.unidade === unidade.sigla && styles.selectButtonActive
                              ]}
                              onPress={() => {
                                console.log('🎯 Unidade selecionada:', unidade.sigla);
                                console.log('📋 Unidade objeto completo:', unidade);
                                console.log('🔄 Estado anterior do formData:', formData);
                                setFormData({ ...formData, unidade: unidade.sigla });
                                console.log('✅ Nova unidade definida:', unidade.sigla);
                              }}
                            >
                              <Text style={[
                                styles.selectButtonText,
                                formData.unidade === unidade.sigla && styles.selectButtonTextActive
                              ]}>
                                {unidade.sigla}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
                        </ScrollView>
                      </View>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Setores de Impressão</Text>
                    <View style={styles.selectContainer}>
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryScrollContent}
                      >
                        {setores.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={[
                              styles.selectButton,
                              (selectedSetores || []).includes(String(s.id)) && styles.selectButtonActive
                            ]}
                            onPress={() => {
                              const id = String(s.id);
                              setSelectedSetores((prev) => {
                                const current = prev || [];
                                return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
                              });
                            }}
                          >
                            <Text style={[
                              styles.selectButtonText,
                              (selectedSetores || []).includes(String(s.id)) && styles.selectButtonTextActive
                            ]}>
                              {s.nome}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Quantidade */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Quantidade em Estoque</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.quantidade}
                      onChangeText={(value) => setFormData({ ...formData, quantidade: value })}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Switches */}
                  <View style={styles.switchContainer}>
                    <View style={styles.switchRow}>
                      <Text style={styles.label}>Produto Ativo</Text>
                      <Switch
                        value={formData.ativo}
                        onValueChange={(value) => setFormData({ ...formData, ativo: value })}
                        trackColor={{ false: '#ddd', true: '#2196F3' }}
                        thumbColor={formData.ativo ? '#fff' : '#f4f3f4'}
                      />
                    </View>
                    <View style={styles.switchRow}>
                      <Text style={styles.label}>Disponível para Venda</Text>
                      <Switch
                        value={formData.disponivel}
                        onValueChange={(value) => setFormData({ ...formData, disponivel: value })}
                        trackColor={{ false: '#ddd', true: '#2196F3' }}
                        thumbColor={formData.disponivel ? '#fff' : '#f4f3f4'}
                      />
                    </View>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingBottom: 16,
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },

  addButton: {
    backgroundColor: '#2196F3',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  controlsSection: {
    paddingHorizontal: 16,
  },

  viewControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sortText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gridCard: {
    width: (width - 48) / 2,
    marginHorizontal: 4,
  },
  listCard: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  productActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  priceContainer: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  sellPrice: {
    color: '#2196F3',
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 0.48,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
    borderWidth: 2,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  selectContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
    minHeight: 48,
    justifyContent: 'center',
  },
  selectContainerError: {
    borderColor: '#f44336',
    borderWidth: 2,
  },
  categoryScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 60,
    alignItems: 'center',
  },
  selectButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  selectButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  selectButtonTextActive: {
    color: '#fff',
  },
  categoryContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  switchContainer: {
    marginTop: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  marginContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  marginLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  marginValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  marginPositive: {
    color: '#4CAF50',
  },
  marginNegative: {
    color: '#f44336',
  },
});