import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeIcon } from '../../components/SafeIcon';
import { employeeService, userService, companyService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { useNavigation } from '@react-navigation/native';

interface Employee {
  _id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
}

interface UserPermissions {
  _id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'funcionario';
  funcionario?: Employee;
  permissoes: {
    produtos: boolean;
    funcionarios: boolean;
    clientes: boolean;
    vendas: boolean;
    relatorios: boolean;
    configuracoes: boolean;
  };
  ativo: boolean;
}

export default function AdminConfiguracoesScreen() {
  const { isAdmin, user } = useAuth() as any;
  const [users, setUsers] = useState<UserPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPermissions | null>(null);
  
  // States para Cadastro de Empresa
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [companyData, setCompanyData] = useState<any>({});
  const [loadingCompany, setLoadingCompany] = useState(false);

  const navigation = useNavigation();

  useEffect(() => {
    if (!isAdmin()) {
      Alert.alert('Acesso Negado', 'Apenas administradores podem acessar as configurações');
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAll();
      // Ajuste: getAll agora retorna um array diretamente; manter compatibilidade caso venha com .data
      setUsers(Array.isArray(response) ? response : (response?.data ?? []));
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      Alert.alert('Erro', 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const loadCompany = async () => {
    try {
      setLoadingCompany(true);
      const response = await companyService.get();
      setCompanyData(response.data || {});
      setCompanyModalVisible(true);
    } catch (error) {
      console.error('Erro ao carregar empresa:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados da empresa');
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleSaveCompany = async () => {
    try {
      setLoadingCompany(true);
      await companyService.save(companyData);
      Alert.alert('Sucesso', 'Dados da empresa salvos com sucesso!');
      setCompanyModalVisible(false);
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      Alert.alert('Erro', 'Não foi possível salvar os dados da empresa');
    } finally {
      setLoadingCompany(false);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
        Alert.alert('CEP Inválido', 'O CEP deve conter 8 dígitos.');
        return;
    }

    try {
        setLoadingCompany(true);
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
        const data = await response.json();

        if (response.ok) {
            setCompanyData((prev: any) => ({
                ...prev,
                logradouro: data.street || prev.logradouro,
                bairro: data.neighborhood || prev.bairro,
                cidade: data.city || prev.cidade,
                uf: data.state || prev.uf,
                //ibge: data.ibge || prev.ibge, // BrasilAPI nem sempre retorna ibge na v2, mas se retornar ok
            }));
            Alert.alert('Sucesso', 'Endereço encontrado!');
        } else {
            Alert.alert('Erro', 'CEP não encontrado.');
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        Alert.alert('Erro', 'Falha ao buscar CEP. Verifique sua conexão.');
    } finally {
        setLoadingCompany(false);
    }
  };

  const handleEditPermissions = (userToEdit: UserPermissions) => {
    setSelectedUser({ ...userToEdit });
    setModalVisible(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      await userService.updatePermissions(selectedUser._id, selectedUser.permissoes);
      
      // Atualizar lista local
      setUsers(users.map(u => u._id === selectedUser._id ? selectedUser : u));
      
      Alert.alert('Sucesso', 'Permissões atualizadas com sucesso');
      setModalVisible(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      Alert.alert('Erro', 'Erro ao salvar permissões');
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await userService.updateStatus(userId, !currentStatus);
      
      setUsers(users.map(u => 
        u._id === userId ? { ...u, ativo: !currentStatus } : u
      ));
      
      Alert.alert('Sucesso', `Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error: any) {
      console.error('Erro ao alterar status do usuário:', error);
      Alert.alert('Erro', 'Erro ao alterar status do usuário');
    }
  };

  const updatePermission = (permission: keyof UserPermissions['permissoes'], value: boolean) => {
    if (!selectedUser) return;
    
    setSelectedUser({
      ...selectedUser,
      permissoes: {
        ...selectedUser.permissoes,
        [permission]: value,
      },
    });
  };

  const renderUserCard = (userItem: UserPermissions) => (
    <View key={userItem._id} style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userItem.nome}</Text>
          <Text style={styles.userEmail}>{userItem.email}</Text>
          <Text style={styles.userType}>
            {userItem.tipo === 'admin' ? 'Administrador' : 'Funcionário'}
          </Text>
        </View>
        
        <View style={styles.userActions}>
          <Switch
            value={userItem.ativo}
            onValueChange={(value) => toggleUserStatus(userItem._id, userItem.ativo)}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
          />
          
          {userItem.tipo === 'funcionario' && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPermissions(userItem)}
            >
              <SafeIcon name="settings" size={24} color="#2196F3" fallbackText="⚙️" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {userItem.tipo === 'funcionario' && (
        <View style={styles.permissionsPreview}>
          <Text style={styles.permissionsTitle}>Permissões:</Text>
          <View style={styles.permissionsList}>
            {Object.entries(userItem.permissoes).map(([key, value]) => (
              <View key={key} style={styles.permissionItem}>
                <SafeIcon 
                  name={value ? "checkmark-circle" : "close-circle"} 
                  size={16} 
                  color={value ? "#4CAF50" : "#f44336"} 
                  fallbackText={value ? "✓" : "×"}
                />
                <Text style={[styles.permissionText, { color: value ? "#4CAF50" : "#f44336" }]}>
                  {getPermissionLabel(key)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const getPermissionLabel = (permission: string) => {
    const labels: { [key: string]: string } = {
      produtos: 'Produtos',
      funcionarios: 'Funcionários',
      clientes: 'Clientes',
      vendas: 'Vendas',
      relatorios: 'Relatórios',
      configuracoes: 'Configurações',
    };
    return labels[permission] || permission;
  };

  const getPermissionIcon = (permission: string) => {
    const icons: { [key: string]: string } = {
      produtos: 'cube',
      funcionarios: 'people',
      clientes: 'person',
      vendas: 'card',
      relatorios: 'bar-chart',
      configuracoes: 'settings',
    };
    return icons[permission] || 'help';
  };

  if (!isAdmin()) {
    return (
      <View style={styles.accessDenied}>
        <SafeIcon name="lock-closed" size={64} color="#ccc" fallbackText="🔒" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Apenas administradores podem acessar as configurações
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Configurações" />
      <ScrollView style={styles.content}>
        {/* Seção de Informações do Sistema */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações do Sistema</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <SafeIcon name="person-circle" size={24} color="#2196F3" fallbackText="👤" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Usuário Logado</Text>
                <Text style={styles.infoValue}>{user?.nome || user?.email}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <SafeIcon name="shield-checkmark" size={24} color="#4CAF50" fallbackText="✓" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Nível de Acesso</Text>
                <Text style={styles.infoValue}>Administrador</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <SafeIcon name="time" size={24} color="#FF9800" fallbackText="⏱" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Último Login</Text>
                <Text style={styles.infoValue}>
                  {user?.ultimoLogin ? new Date(user.ultimoLogin).toLocaleString('pt-BR') : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Seção de Gerenciamento de Usuários */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gerenciamento de Usuários</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Carregando usuários...</Text>
            </View>
          ) : (
            users.map(renderUserCard)
          )}
        </View>

        {/* Seção de Configurações Gerais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações Gerais</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={loadCompany}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="business" size={24} color="#2196F3" fallbackText="🏢" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Dados da Empresa</Text>
                  <Text style={styles.settingDescription}>
                    CNPJ, Endereço, Faturamento e NFC-e
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="notifications" size={24} color="#2196F3" fallbackText="🔔" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Notificações</Text>
                  <Text style={styles.settingDescription}>
                    Configurar notificações do sistema
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="cloud-upload" size={24} color="#4CAF50" fallbackText="⤴︎" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Backup</Text>
                  <Text style={styles.settingDescription}>
                    Configurar backup automático
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingContent}>
                <SafeIcon name="shield" size={24} color="#FF9800" fallbackText="🛡" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Segurança</Text>
                  <Text style={styles.settingDescription}>
                    Configurações de segurança
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => navigation.navigate('TestScreen' as never)}
            >
              <View style={styles.settingContent}>
                <SafeIcon name="flask" size={24} color="#9C27B0" fallbackText="🧪" />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Testes e Diagnóstico</Text>
                  <Text style={styles.settingDescription}>
                    Executar testes e verificar logs do sistema
                  </Text>
                </View>
              </View>
              <SafeIcon name="chevron-forward" size={20} color="#ccc" fallbackText="›" />
            </TouchableOpacity>
          </View>
        </View>


      </ScrollView>

      {/* Modal de Edição de Permissões */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar Permissões</Text>
            <TouchableOpacity onPress={handleSavePermissions}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          {selectedUser && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.userInfoModal}>
                <Text style={styles.modalUserName}>{selectedUser.nome}</Text>
                <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
              </View>

              <Text style={styles.permissionsHeader}>Permissões de Acesso</Text>
              
              {Object.entries(selectedUser.permissoes).map(([key, value]) => (
                <View key={key} style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <SafeIcon 
                      name={getPermissionIcon(key) as any} 
                      size={24} 
                      color="#2196F3" 
                      fallbackText="✓" 
                    />
                    <View style={styles.permissionDetails}>
                      <Text style={styles.permissionLabel}>
                        {getPermissionLabel(key)}
                      </Text>
                      <Text style={styles.permissionDescription}>
                        {getPermissionDescription(key)}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(newValue) => updatePermission(key as keyof UserPermissions['permissoes'], newValue)}
                    trackColor={{ false: '#ccc', true: '#2196F3' }}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modal de Cadastro de Empresa */}
      <Modal
        visible={companyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCompanyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
           <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCompanyModalVisible(false)}>
              <Text style={styles.cancelButton}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Dados da Empresa</Text>
            <TouchableOpacity onPress={handleSaveCompany}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.sectionHeader}>1. Identificação</Text>
            <SimpleInput label="Razão Social *" value={companyData.razaoSocial} onChangeText={(t: string) => setCompanyData({...companyData, razaoSocial: t})} />
            <SimpleInput label="Nome Fantasia *" value={companyData.nomeFantasia} onChangeText={(t: string) => setCompanyData({...companyData, nomeFantasia: t})} />
            <SimpleInput label="CNPJ *" value={companyData.cnpj} onChangeText={(t: string) => setCompanyData({...companyData, cnpj: t})} keyboardType="numeric" />
            <SimpleInput label="Inscrição Estadual" value={companyData.inscricaoEstadual} onChangeText={(t: string) => setCompanyData({...companyData, inscricaoEstadual: t})} placeholder="Isento se vazio" />
            <SimpleInput label="Inscrição Municipal" value={companyData.inscricaoMunicipal} onChangeText={(t: string) => setCompanyData({...companyData, inscricaoMunicipal: t})} />

            <Text style={styles.sectionHeader}>2. Endereço Fiscal</Text>
            <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>CEP</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput 
                            style={styles.inputField}
                            value={companyData.cep} 
                            onChangeText={(t) => setCompanyData({...companyData, cep: t})} 
                            keyboardType="numeric"
                            placeholder="00000-000"
                            maxLength={9}
                        />
                    </View>
                    <TouchableOpacity 
                        style={{ backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 8 }}
                        onPress={() => fetchAddressByCep(companyData.cep || '')}
                    >
                         <SafeIcon name="search" size={20} color="#fff" fallbackText="🔍" />
                    </TouchableOpacity>
                </View>
            </View>
            <SimpleInput label="Logradouro" value={companyData.logradouro} onChangeText={(t: string) => setCompanyData({...companyData, logradouro: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Número" value={companyData.numero} onChangeText={(t: string) => setCompanyData({...companyData, numero: t})} /></View>
                <View style={{flex: 2}}><SimpleInput label="Bairro" value={companyData.bairro} onChangeText={(t: string) => setCompanyData({...companyData, bairro: t})} /></View>
            </View>
            <SimpleInput label="Complemento" value={companyData.complemento} onChangeText={(t: string) => setCompanyData({...companyData, complemento: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 2}}><SimpleInput label="Cidade" value={companyData.cidade} onChangeText={(t: string) => setCompanyData({...companyData, cidade: t})} /></View>
                <View style={{flex: 1}}><SimpleInput label="UF" value={companyData.uf} onChangeText={(t: string) => setCompanyData({...companyData, uf: t})} maxLength={2} /></View>
            </View>
            <SimpleInput label="Cód. Município IBGE" value={companyData.ibge} onChangeText={(t: string) => setCompanyData({...companyData, ibge: t})} keyboardType="numeric" />

            <Text style={styles.sectionHeader}>3. Contato</Text>
            <SimpleInput label="Telefone Principal" value={companyData.telefone} onChangeText={(t: string) => setCompanyData({...companyData, telefone: t})} keyboardType="phone-pad" />
            <SimpleInput label="Email Principal" value={companyData.email} onChangeText={(t: string) => setCompanyData({...companyData, email: t})} keyboardType="email-address" />
            <SimpleInput label="WhatsApp (Opcional)" value={companyData.whatsapp} onChangeText={(t: string) => setCompanyData({...companyData, whatsapp: t})} keyboardType="phone-pad" />

            <Text style={styles.sectionHeader}>4. Dados Fiscais (NFC-e)</Text>
            <Text style={styles.inputLabel}>Regime Tributário</Text>
             <View style={styles.radioGroup}>
                {['simples_nacional', 'lucro_presumido', 'lucro_real'].map(opt => (
                    <TouchableOpacity key={opt} style={[styles.radioBtn, companyData.regimeTributario === opt && styles.radioBtnSelected]} onPress={() => setCompanyData({...companyData, regimeTributario: opt})}>
                        <Text style={[styles.radioText, companyData.regimeTributario === opt && styles.radioTextSelected]}>{opt.replace('_', ' ').toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <SimpleInput label="CNAE Principal" value={companyData.cnae} onChangeText={(t: string) => setCompanyData({...companyData, cnae: t})} />
            <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Contribuinte ICMS?</Text>
                <Switch value={companyData.contribuinteIcms !== false} onValueChange={(v) => setCompanyData({...companyData, contribuinteIcms: v})} />
            </View>
            <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Ambiente de Produção? (NFC-e)</Text>
                <Switch trackColor={{false: '#FF9800', true: '#4CAF50'}} value={companyData.ambienteFiscal === 'producao'} onValueChange={(v) => setCompanyData({...companyData, ambienteFiscal: v ? 'producao' : 'homologacao'})} />
            </View>
            <Text style={{fontSize: 12, color: '#666', marginBottom: 10, textAlign: 'right'}}>{companyData.ambienteFiscal === 'producao' ? 'PRODUÇÃO (Válido)' : 'HOMOLOGAÇÃO (Teste)'}</Text>


            <Text style={styles.sectionHeader}>5. Emissão e Impressão</Text>
            <SimpleInput label="Nome Fantasia na Impressão" value={companyData.nomeImpressao} onChangeText={(t: string) => setCompanyData({...companyData, nomeImpressao: t})} />
            <SimpleInput label="Mensagem Rodapé NFC-e" value={companyData.mensagemRodape} onChangeText={(t: string) => setCompanyData({...companyData, mensagemRodape: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Série NFC-e" value={String(companyData.serieNfce || '1')} onChangeText={(t: string) => setCompanyData({...companyData, serieNfce: t})} keyboardType="numeric" /></View>
                <View style={{flex: 1}}><SimpleInput label="Nº Inicial" value={String(companyData.numeroInicialNfce || '1')} onChangeText={(t: string) => setCompanyData({...companyData, numeroInicialNfce: t})} keyboardType="numeric" /></View>
            </View>

            <Text style={styles.sectionHeader}>6. Responsável Legal</Text>
            <SimpleInput label="Nome Completo" value={companyData.respNome} onChangeText={(t: string) => setCompanyData({...companyData, respNome: t})} />
            <SimpleInput label="CPF" value={companyData.respCpf} onChangeText={(t: string) => setCompanyData({...companyData, respCpf: t})} />
            <SimpleInput label="Cargo" value={companyData.respCargo} onChangeText={(t: string) => setCompanyData({...companyData, respCargo: t})} />
            <SimpleInput label="Email Pessoal" value={companyData.respEmail} onChangeText={(t: string) => setCompanyData({...companyData, respEmail: t})} />

            <Text style={styles.sectionHeader}>7. Cobrança e Manutenção</Text>
            <SimpleInput label="Plano Contratado" value={companyData.plano} onChangeText={(t: string) => setCompanyData({...companyData, plano: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Valor Mensal" value={String(companyData.valorMensalidade || '')} onChangeText={(t: string) => setCompanyData({...companyData, valorMensalidade: t})} keyboardType="numeric" /></View>
                <View style={{flex: 1}}><SimpleInput label="Dia Vencimento" value={String(companyData.diaVencimento || '')} onChangeText={(t: string) => setCompanyData({...companyData, diaVencimento: t})} keyboardType="numeric" /></View>
            </View>
            <SimpleInput label="Data Início Cobrança" value={companyData.dataInicioCobranca ? new Date(companyData.dataInicioCobranca).toLocaleDateString('pt-BR') : ''} onChangeText={() => {}} placeholder="DD/MM/AAAA" editable={false} />
            <Text style={styles.inputLabel}>Forma de Pagamento</Text>
             <View style={styles.radioGroup}>
                {['pix', 'boleto', 'cartao'].map(opt => (
                    <TouchableOpacity key={opt} style={[styles.radioBtn, companyData.formaCobranca === opt && styles.radioBtnSelected]} onPress={() => setCompanyData({...companyData, formaCobranca: opt})}>
                        <Text style={[styles.radioText, companyData.formaCobranca === opt && styles.radioTextSelected]}>{opt.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <SimpleInput label="Email para Cobrança" value={companyData.emailCobranca} onChangeText={(t: string) => setCompanyData({...companyData, emailCobranca: t})} keyboardType="email-address" />

            <Text style={styles.sectionHeader}>8. Dados Bancários</Text>
            <SimpleInput label="Banco" value={companyData.banco} onChangeText={(t: string) => setCompanyData({...companyData, banco: t})} />
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}><SimpleInput label="Agência" value={companyData.agencia} onChangeText={(t: string) => setCompanyData({...companyData, agencia: t})} /></View>
                <View style={{flex: 1}}><SimpleInput label="Conta" value={companyData.conta} onChangeText={(t: string) => setCompanyData({...companyData, conta: t})} /></View>
            </View>
            <SimpleInput label="Chave PIX" value={companyData.chavePix} onChangeText={(t: string) => setCompanyData({...companyData, chavePix: t})} />

            <Text style={styles.sectionHeader}>9. Controle (Interno)</Text>
             <View style={styles.infoRow}>
               <SafeIcon name="calendar" size={20} color="#666" fallbackText="📅" />
               <Text style={{marginLeft: 10}}>Cadastro: {companyData.dataCadastro ? new Date(companyData.dataCadastro).toLocaleDateString('pt-BR') : 'Hoje'}</Text>
             </View>
             <SimpleInput label="Observações Internas" value={companyData.observacoes} onChangeText={(t: string) => setCompanyData({...companyData, observacoes: t})} multiline numberOfLines={3} style={[styles.inputField, {height: 80}]} />

             <View style={{height: 100}} /> 
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const getPermissionDescription = (permission: string) => {
  const descriptions: { [key: string]: string } = {
    produtos: 'Gerenciar produtos, categorias e estoque',
    funcionarios: 'Gerenciar funcionários e suas informações',
    clientes: 'Gerenciar clientes e seus dados',
    vendas: 'Realizar vendas e gerenciar pedidos',
    relatorios: 'Visualizar relatórios e estatísticas',
    configuracoes: 'Acessar configurações do sistema',
  };
  return descriptions[permission] || '';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  userType: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    marginLeft: 12,
    padding: 8,
  },
  permissionsPreview: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 12,
    marginLeft: 4,
  },
  settingsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  userInfoModal: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 16,
    color: '#666',
  },
  permissionsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
  },
  // Novos estilos para formulário
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  inputField: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  radioBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  radioBtnSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  radioText: {
    color: '#666',
    fontSize: 12,
  },
  radioTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

// Componente auxiliar simples para Input
const SimpleInput = ({ label, value, onChangeText, ...props }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput 
      style={styles.inputField}
      value={value || ''}
      onChangeText={onChangeText}
      placeholderTextColor="#999"
      {...props}
    />
  </View>
);
// Precisamos garantir que TextInput venha do escopo certo, mas como não posso mexer nos imports do topo facilmente agora, 
// vou usar o TextInput global do React Native que já deve estar importado ou será necessário adicionar.
// Vou assumir que TextInput está importado ou vou adicionar ele no topo.
// ESPERE: `TextInput` NÃO está importado no topo do arquivo original pelo que vejo nas linhas 1-12.
// Preciso adicionar TextInput nos imports.