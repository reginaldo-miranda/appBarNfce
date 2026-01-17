import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { setorImpressaoService, printerService } from '../../src/services/api';

type ModoEnvio = 'impressora' | 'whatsapp';

interface SetorFormData {
  nome: string;
  descricao: string;
  modoEnvio: ModoEnvio;
  whatsappDestino: string;
  ativo: boolean;
}

export default function CadastroSetorScreen() {
  const { hasPermission } = useAuth() as any;
  const { id } = useLocalSearchParams();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [formData, setFormData] = useState<SetorFormData>({ nome: '', descricao: '', modoEnvio: 'impressora', whatsappDestino: '', ativo: true });
  const [printers, setPrinters] = useState<{ id: string; nome: string }[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => { if (isEditing && id) loadRecord(id as string); }, [isEditing, id]);
  useEffect(() => { loadPrinters(); }, []);

  const loadRecord = async (recordId: string) => {
    setLoadingRecord(true);
    try {
      // Estratégia mais robusta: Carregar todos e filtrar localmente
      const response = await setorImpressaoService.list();
      const body = response?.data;
      const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
      
      const s = list.find((item: any) => String(item.id) === String(recordId));

      if (s) {
        setFormData({ 
            nome: s.nome, 
            descricao: s.descricao || '', 
            modoEnvio: (s.modoEnvio || 'impressora'), 
            whatsappDestino: s.whatsappDestino || '', 
            ativo: s.ativo ?? true 
        });
        setSelectedPrinterId(s.printerId ? String(s.printerId) : '');
      } else {
         Alert.alert('Erro', 'Setor não encontrado.');
         router.back();
      }
    } catch (error) {
      console.error('Erro ao carregar setor:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do setor.');
      try {
        router.back();
      } catch {
        // silencioso
      }
    } finally { setLoadingRecord(false); }
  };

  const loadPrinters = async () => {
    try {
      const resp = await printerService.list();
      const data = Array.isArray(resp?.data) ? resp.data : [];
      setPrinters(data.map((p: any) => ({ id: String(p.id ?? p._id), nome: p.nome })));
    } catch (error) {
      setPrinters([]);
    }
  };

  if (!hasPermission('produtos')) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color="#666" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>Você não tem permissão para acessar esta tela</Text>
      </View>
    );
  }

  if (loadingRecord) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Carregando...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.accessDenied}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.accessDeniedSubtext}>Carregando dados do setor...</Text>
        </View>
      </View>
    );
  }

  const handleSave = async () => {
    if (!formData.nome.trim()) { Alert.alert('Erro', 'Nome do setor é obrigatório'); return; }
    if (formData.modoEnvio === 'whatsapp' && !formData.whatsappDestino.trim()) { Alert.alert('Erro', 'Informe o número/contato do WhatsApp'); return; }
    try {
      setLoading(true);
      try {
        const existingResp = await setorImpressaoService.getAll();
        const list = Array.isArray(existingResp?.data?.data) ? existingResp.data.data : (Array.isArray(existingResp?.data) ? existingResp.data : []);
        const exists = list.some((it: any) => String(it?.nome || '').trim().toLowerCase() === formData.nome.trim().toLowerCase() && (!isEditing || String(it?.id) !== String(id)));
        if (!isEditing && exists) {
          setLoading(false);
          Alert.alert('Erro', 'Já existe um setor com este nome');
          return;
        }
      } catch {}
      const payload = { nome: formData.nome.trim(), descricao: formData.descricao.trim(), modoEnvio: formData.modoEnvio, whatsappDestino: formData.whatsappDestino.trim(), printerId: selectedPrinterId ? Number(selectedPrinterId) : undefined, ativo: formData.ativo };
      if (isEditing && id) {
        await setorImpressaoService.update(id as string, payload);
        setSaveSuccess(true);
        Alert.alert('Sucesso', 'Setor atualizado com sucesso!');
        setTimeout(() => {
          setSaveSuccess(false);
          try {
            router.replace('/setores/listagem' as any);
          } catch {}
        }, 800);
      } else {
        await setorImpressaoService.create(payload);
        setSaveSuccess(true);
        Alert.alert('Sucesso', 'Setor de impressão gravado com sucesso!');
        setTimeout(() => {
            setSaveSuccess(false);
            setFormData({ nome: '', descricao: '', modoEnvio: 'impressora', whatsappDestino: '', ativo: true });
            setSelectedPrinterId('');
            try {
                // Navegar de volta para a lista para forçar refresh
                 router.replace('/setores/listagem' as any);
            } catch {}
        }, 1000);
      }
    } catch (error) {
      try {
        const msg = (error as any)?.response?.data?.error || (error as any)?.message || 'Erro ao salvar setor. Verifique sua conexão e tente novamente.';
        Alert.alert('Erro', msg);
      } catch {
        Alert.alert('Erro', 'Erro ao salvar setor. Verifique sua conexão e tente novamente.');
      }
    } finally { setLoading(false); }
  };

  const updateFormData = (field: keyof SetorFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value })); };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar Setor' : 'Cadastrar Setor'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.formGroup}><Text style={styles.label}>Nome *</Text><TextInput style={styles.input} value={formData.nome} onChangeText={(text) => updateFormData('nome', text)} placeholder="Ex: Comandas, Mesas, Balcão" placeholderTextColor="#999" /></View>
          <View style={styles.formGroup}><Text style={styles.label}>Descrição</Text><TextInput style={[styles.input, styles.textArea]} value={formData.descricao} onChangeText={(text) => updateFormData('descricao', text)} placeholder="Descrição opcional" placeholderTextColor="#999" multiline numberOfLines={3} textAlignVertical="top" /></View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Modo de Envio *</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity style={[styles.modeBtn, formData.modoEnvio === 'impressora' && styles.modeBtnActive]} onPress={() => updateFormData('modoEnvio', 'impressora')}>
                <Ionicons name="print" size={18} color={formData.modoEnvio === 'impressora' ? '#fff' : '#666'} />
                <Text style={[styles.modeText, formData.modoEnvio === 'impressora' && styles.modeTextActive]}>Impressora</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, formData.modoEnvio === 'whatsapp' && styles.modeBtnActive]} onPress={() => updateFormData('modoEnvio', 'whatsapp')}>
                <Ionicons name="logo-whatsapp" size={18} color={formData.modoEnvio === 'whatsapp' ? '#fff' : '#666'} />
                <Text style={[styles.modeText, formData.modoEnvio === 'whatsapp' && styles.modeTextActive]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
          {formData.modoEnvio === 'impressora' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Impressora</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {printers.map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => setSelectedPrinterId(p.id)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: selectedPrinterId === p.id ? '#2196F3' : '#ddd', backgroundColor: selectedPrinterId === p.id ? '#E3F2FD' : '#fff', marginRight: 8, marginBottom: 8 }}>
                    <Text style={{ color: selectedPrinterId === p.id ? '#2196F3' : '#333' }}>{p.nome}</Text>
                  </TouchableOpacity>
                ))}
                {printers.length === 0 && (
                  <Text style={{ color: '#666' }}>Nenhuma impressora cadastrada</Text>
                )}
              </View>
            </View>
          )}
          {formData.modoEnvio === 'whatsapp' && (
            <View style={styles.formGroup}><Text style={styles.label}>Destino WhatsApp *</Text><TextInput style={styles.input} value={formData.whatsappDestino} onChangeText={(text) => updateFormData('whatsappDestino', text)} placeholder="Ex: +55 11 99999-9999" placeholderTextColor="#999" /></View>
          )}
          <View style={styles.formGroup}>
            <View style={styles.switchContainer}>
              <View style={styles.switchInfo}><Text style={styles.label}>Setor Ativo</Text><Text style={styles.switchDescription}>Setores ativos aparecem na seleção de produtos</Text></View>
              <Switch value={formData.ativo} onValueChange={(value) => updateFormData('ativo', value)} trackColor={{ false: '#ccc', true: '#4CAF50' }} thumbColor={formData.ativo ? '#fff' : '#f4f3f4'} />
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveButton, loading && styles.saveButtonDisabled]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : (<><Ionicons name="save" size={20} color="#fff" /><Text style={styles.saveButtonText}>{isEditing ? 'Atualizar Setor' : 'Salvar Setor'}</Text></>)}
        </TouchableOpacity>
      </View>
      {saveSuccess && (
        <View style={{ position: 'absolute', top: 16, alignSelf: 'center', backgroundColor: '#E8F5E9', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#A5D6A7' }}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <Text style={{ color: '#2E7D32', marginLeft: 8 }}>Setor de impressão gravado com sucesso!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#2196F3', flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginRight: 40 },
  content: { flex: 1 },
  form: { padding: 20 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff', color: '#333' },
  textArea: { height: 80, textAlignVertical: 'top' },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  switchInfo: { flex: 1, marginRight: 16 },
  switchDescription: { fontSize: 14, color: '#666', marginTop: 4 },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  saveButton: { backgroundColor: '#4CAF50', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 8 },
  saveButtonDisabled: { backgroundColor: '#ccc' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  modeRow: { flexDirection: 'row' },
  modeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginRight: 8 },
  modeBtnActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  modeText: { marginLeft: 8, color: '#666', fontWeight: '600' },
  modeTextActive: { color: '#fff' },
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#f5f5f5' },
  accessDeniedText: { fontSize: 24, fontWeight: 'bold', color: '#666', marginTop: 16 },
  accessDeniedSubtext: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 8 },
});