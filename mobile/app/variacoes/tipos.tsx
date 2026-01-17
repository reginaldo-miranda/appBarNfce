import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { variationTypeService, categoryService } from '../../src/services/api';

interface CategoriaOpt { id: string; nome: string }
interface VariationTypeRec {
  id: number;
  nome: string;
  maxOpcoes: number;
  regraPreco: 'mais_caro'|'media'|'fixo';
  precoFixo?: number | null;
  categoriasIds?: number[];
}

export default function VariationTypesScreen() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<VariationTypeRec[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<VariationTypeRec | null>(null);
  const [nome, setNome] = useState('');
  const [regraPreco, setRegraPreco] = useState<'mais_caro'|'media'|'fixo'>('mais_caro');
  const [maxOpcoes, setMaxOpcoes] = useState('2');
  const [precoFixo, setPrecoFixo] = useState('');
  const [categorias, setCategorias] = useState<CategoriaOpt[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedFilterCat, setSelectedFilterCat] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const r = await variationTypeService.list();
      const arr = Array.isArray(r?.data) ? r.data : [];
      setItems(arr as any);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCats = async () => {
    try {
      const c = await categoryService.getAll();
      const list = Array.isArray(c) ? c : (Array.isArray((c as any)?.data) ? (c as any).data : []);
      setCategorias(list.map((x: any) => ({ id: String(x.id ?? x._id), nome: x.nome })));
    } catch {
      setCategorias([]);
    }
  };

  useEffect(() => { loadAll(); loadCats(); }, []);

  const filteredItems = useMemo(() => {
    let arr = items;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      arr = arr.filter((it) => String(it.nome || '').toLowerCase().includes(q));
    }
    if (!selectedFilterCat) return arr;
    const cid = Number(selectedFilterCat);
    return arr.filter((it) => {
      const ids = Array.isArray(it.categoriasIds) ? it.categoriasIds : [];
      if (ids.length === 0) return true;
      return ids.includes(cid);
    });
  }, [items, selectedFilterCat, searchText]);

  const catName = (id: number) => {
    const c = categorias.find((x) => String(x.id) === String(id));
    return c?.nome || `Cat #${id}`;
  };

  const allCount = useMemo(() => items.length, [items]);
  const countForCat = (idStr: string) => {
    const cid = Number(idStr);
    let count = 0;
    for (const it of items) {
      const ids = Array.isArray(it.categoriasIds) ? it.categoriasIds : [];
      if (ids.length === 0 || ids.includes(cid)) count++;
    }
    return count;
  };

  const resetForm = () => {
    setEditing(null);
    setNome('');
    setRegraPreco('mais_caro');
    setMaxOpcoes('2');
    setPrecoFixo('');
    setSelectedCats([]);
  };

  const openCreate = () => { resetForm(); setModalVisible(true); };
  const openEdit = (rec: VariationTypeRec) => {
    setEditing(rec);
    setNome(String(rec.nome || ''));
    setRegraPreco(rec.regraPreco || 'mais_caro');
    setMaxOpcoes(String(rec.maxOpcoes || 1));
    setPrecoFixo(rec.precoFixo != null ? String(rec.precoFixo) : '');
    setSelectedCats((rec.categoriasIds || []).map((n) => String(n)));
    setModalVisible(true);
  };

  const handleToggleCat = (id: string) => {
    setSelectedCats((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    const payload: any = {
      nome: nome.trim(),
      maxOpcoes: parseInt(maxOpcoes) || 1,
      regraPreco,
      categoriasIds: selectedCats.map((id) => Number(id)).filter((n) => Number.isInteger(n) && n > 0),
    };
    if (regraPreco === 'fixo') payload.precoFixo = parseFloat(precoFixo || '0') || 0;
    try {
      if (editing) {
        await variationTypeService.update(editing.id, payload);
        Alert.alert('Sucesso', 'Tipo de variação atualizado com sucesso');
      } else {
        await variationTypeService.create(payload);
        Alert.alert('Sucesso', 'Tipo de variação criado com sucesso');
      }
      setModalVisible(false);
      await loadAll();
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível salvar o tipo de variação');
    }
  };

  const handleDelete = async (rec: VariationTypeRec) => {
    Alert.alert('Confirmar', 'Deseja excluir este tipo de variação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          await variationTypeService.delete(rec.id);
          Alert.alert('Sucesso', 'Tipo de variação excluído com sucesso');
          await loadAll();
        } catch {
          Alert.alert('Erro', 'Não foi possível excluir');
        }
      } }
    ]);
  };

  const renderItem = ({ item }: { item: VariationTypeRec }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.nome}</Text>
        <Text style={styles.itemSub}>Regra: {item.regraPreco} • Máx: {item.maxOpcoes}{item.regraPreco === 'fixo' && item.precoFixo != null ? ` • Fixo: R$ ${(Number(item.precoFixo)||0).toFixed(2)}` : ''}</Text>
        {!!item.categoriasIds && item.categoriasIds.length > 0 && (
          <View style={styles.chips}>
            {item.categoriasIds.map((cid) => (
              <View key={cid} style={styles.chip}><Text style={styles.chipText}>{catName(cid)}</Text></View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2196F3' }]} onPress={() => openEdit(item)}>
          <Ionicons name="pencil" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#d32f2f' }]} onPress={() => handleDelete(item)}>
          <Ionicons name="trash" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const canSave = useMemo(() => {
    if (!nome.trim()) return false;
    const m = parseInt(maxOpcoes) || 0;
    if (m <= 0) return false;
    if (regraPreco === 'fixo' && (!precoFixo || isNaN(parseFloat(precoFixo)))) return false;
    return true;
  }, [nome, maxOpcoes, regraPreco, precoFixo]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#2196F3" /></TouchableOpacity>
        <Text style={styles.title}>Tipos de Variação</Text>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color="#2196F3" /><Text style={styles.loadingText}>Carregando...</Text></View>
      ) : (
        <>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar tipo de variação..."
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#999"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersBar} contentContainerStyle={styles.filtersContent}>
            <TouchableOpacity onPress={() => setSelectedFilterCat('')} style={[styles.filterChip, !selectedFilterCat && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, !selectedFilterCat && styles.filterChipTextActive]}>Todas ({allCount})</Text>
            </TouchableOpacity>
            {categorias.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => setSelectedFilterCat(c.id)} style={[styles.filterChip, selectedFilterCat === c.id && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, selectedFilterCat === c.id && styles.filterChipTextActive]}>{c.nome} ({countForCat(c.id)})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FlatList data={filteredItems} renderItem={renderItem} keyExtractor={(it) => String(it.id)} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.loadingBox}><Text style={styles.loadingText}>Nenhum tipo para este filtro</Text></View>} />
        </>
      )}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? 'Editar Tipo' : 'Novo Tipo'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={!canSave}><Text style={[styles.save, !canSave && { opacity: 0.5 }]}>{editing ? 'Salvar' : 'Criar'}</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.group}><Text style={styles.label}>Nome</Text><TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex.: Pizza 2 Sabores" /></View>
            <View style={styles.row}>
              <View style={[styles.group, styles.half]}><Text style={styles.label}>Regra de Preço</Text><View style={styles.pickerBox}><Picker selectedValue={regraPreco} onValueChange={(v) => setRegraPreco(v as any)} style={styles.picker}><Picker.Item label="Mais caro" value="mais_caro" /><Picker.Item label="Média" value="media" /><Picker.Item label="Fixo" value="fixo" /></Picker></View></View>
              <View style={[styles.group, styles.half]}><Text style={styles.label}>Máx. Opções</Text><TextInput style={styles.input} value={maxOpcoes} onChangeText={setMaxOpcoes} keyboardType="numeric" placeholder="2" /></View>
            </View>
            {regraPreco === 'fixo' && (<View style={styles.group}><Text style={styles.label}>Preço Fixo (R$)</Text><TextInput style={styles.input} value={precoFixo} onChangeText={setPrecoFixo} keyboardType="numeric" placeholder="0,00" /></View>)}
            <View style={styles.group}><Text style={styles.label}>Categorias permitidas</Text><View style={styles.chips}>{categorias.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.chip, selectedCats.includes(c.id) && styles.chipSelected]} onPress={() => handleToggleCat(c.id)}>
                <Text style={[styles.chipText, selectedCats.includes(c.id) && styles.chipTextSelected]}>{c.nome}</Text>
              </TouchableOpacity>
            ))}</View></View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backBtn: { padding: 8, marginRight: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#333' },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  createText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16 },
  loadingText: { marginLeft: 8, color: '#666' },
  list: { padding: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  searchInput: { flex: 1, color: '#333' },
  filtersBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  filtersContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', marginRight: 8 },
  filterChipActive: { borderColor: '#2196F3', backgroundColor: '#e3f2fd' },
  filterChipText: { color: '#555', fontSize: 12 },
  filterChipTextActive: { color: '#2196F3', fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  itemInfo: { flex: 1, marginRight: 8 },
  itemTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  itemSub: { fontSize: 12, color: '#666', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff' },
  chipSelected: { borderColor: '#2196F3', backgroundColor: '#e3f2fd' },
  chipText: { color: '#555', fontSize: 12 },
  chipTextSelected: { color: '#2196F3', fontWeight: '600' },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  cancel: { color: '#666', fontSize: 14 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  save: { color: '#2196F3', fontSize: 14, fontWeight: 'bold' },
  modalContent: { padding: 12 },
  group: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 6, padding: 10, backgroundColor: '#fff', color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { width: '48%' },
  pickerBox: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 6, backgroundColor: '#fff' },
  picker: { height: 40 },
});