import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Dimensions, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { variationTypeService, productService } from '../services/api';
import { computeVariationPrice } from '../utils/variation';

import { Product, VariationType, ProductSize } from '../types/index';

const { width: screenWidth } = Dimensions.get('window');

interface VariationSelectorModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (payload: { tipoId?: number; tipoNome?: string; regraPreco?: 'mais_caro'|'media'|'fixo'; maxOpcoes?: number; opcoes: Array<{ productId: number }>; precoFixo?: number }) => void;

  onConfirmWhole?: () => void;
  selectedSize?: ProductSize | null;
}

export default function VariationSelectorModal({ visible, product, onClose, onConfirm, onConfirmWhole, selectedSize }: VariationSelectorModalProps) {
  const [tipos, setTipos] = useState<VariationType[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<VariationType | null>(null);
  const [optionsProducts, setOptionsProducts] = useState<Product[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedOpcoes, setSelectedOpcoes] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');
  const [fractionsMap, setFractionsMap] = useState<Record<number, number>>({});

  useEffect(() => {
    if (visible) {
      loadTipos();
      setSelectedTipo(null);
      setSelectedOpcoes([]);
      setOptionsProducts([]);
    }
  }, [visible]);

  useEffect(() => {
    if (selectedTipo) loadOptionsProducts(selectedTipo);
    setFractionsMap({});
  }, [selectedTipo]);

  const loadTipos = async () => {
    try {
      setLoadingTipos(true);
      let resp;
      const catId = Number(product?.categoriaId || 0);
      if (Number.isInteger(catId) && catId > 0) resp = await variationTypeService.byCategoryId(catId);
      else resp = await variationTypeService.list();
      const arr = Array.isArray(resp?.data) ? resp.data : [];
      setTipos(arr as any);
      if (arr.length === 1) {
        setSelectedTipo(arr[0] as any);
      }
    } catch (e) {
      setTipos([]);
    } finally {
      setLoadingTipos(false);
    }
  };

  const loadOptionsProducts = async (tipo: VariationType) => {
    try {
      setLoadingOptions(true);
      const r = await productService.getAll();
      const all = Array.isArray(r?.data) ? r.data : [];
      const ids = Array.isArray(tipo?.categoriasIds) ? tipo.categoriasIds.map(Number) : [];
      const filtered = ids.length > 0
        ? all.filter((p: any) => {
            const catId = Number(p?.categoriaId || p?.categoria || 0);
            return Number.isInteger(catId) && ids.includes(catId);
          })
        : all;
      const normalized = filtered.filter((p: any) => !!p?.ativo && !!p?.disponivel).map((p: any) => ({
        _id: String(p?._id ?? p?.id ?? ''),
        nome: p?.nome ?? p?.nomeProduto ?? 'Produto',
        descricao: p?.descricao ?? '',
        precoVenda: Number(p?.precoVenda ?? p?.preco ?? 0),
        categoria: p?.categoria ?? '',
        categoriaId: p?.categoriaId ?? undefined,
        ativo: !!p?.ativo,
        disponivel: !!p?.disponivel,
        tamanhos: p?.tamanhos || [], 
      }));
      setOptionsProducts(normalized as any);
    } catch (e) {
      setOptionsProducts([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const toggleOpcao = (pid: number) => {
    setSelectedOpcoes((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      const arr = Array.from(next);
      const max = Number(selectedTipo?.maxOpcoes || 1);
      if (arr.length > max) arr.splice(0, arr.length - max);
      const defFrac = max > 1 ? (1 / max) : 1;
      const nf: Record<number, number> = { ...fractionsMap };
      for (const id of arr) {
        if (!nf[id]) nf[id] = defFrac;
      }
      Object.keys(nf).forEach(k => { if (!arr.includes(Number(k))) delete nf[Number(k)]; });
      setFractionsMap(nf);
      return arr;
    });
  };

  const precoCalculado = useMemo(() => {
    try {
      const rule = String(selectedTipo?.regraPreco || 'mais_caro') as 'mais_caro'|'media'|'fixo';
      const chosen = optionsProducts.filter((p) => selectedOpcoes.includes(parseInt(String((p as any)?._id ?? (p as any)?.id ?? 0), 10)));
      const precos = chosen.map((p) => {
        if (selectedSize && Array.isArray(p.tamanhos)) {
          const match = p.tamanhos.find(t => t.nome === selectedSize.nome);
          if (match) return Number(match.preco);
        }
        return Number(p.precoVenda || 0);
      });
      const max = Number(selectedTipo?.maxOpcoes || 1);
      const frac = precos.map((_, idx) => {
        const p = chosen[idx];
        const id = parseInt(String((p as any)?._id ?? (p as any)?.id ?? 0), 10);
        const f = fractionsMap[id];
        if (Number.isFinite(f) && f > 0) return f;
        return max > 1 ? (1 / max) : 1;
      });
      // Base price needs to consider selected size too if it's the base product
      let basePrice = Number(product?.precoVenda || 0);
      if (selectedSize) {
         // Pass explicit size cost as base? Or use product's size price.
         // Usually `product` here is the one triggered from sale screen.
         basePrice = Number(selectedSize.preco);
      }
      return computeVariationPrice(rule, basePrice, precos, selectedTipo?.precoFixo ?? undefined, frac);
    } catch {
      return Number(selectedSize ? selectedSize.preco : (product?.precoVenda || 0));
    }
  }, [selectedTipo, selectedOpcoes, optionsProducts, product, fractionsMap, selectedSize]);

  const displayedOptions = useMemo(() => {
    const arr = Array.isArray(optionsProducts) ? optionsProducts : [];
    const q = String(searchText || '').toLowerCase().trim();
    if (!q) return arr;
    return arr.filter((p) => String(p?.nome || '').toLowerCase().includes(q));
  }, [optionsProducts, searchText]);

  const canConfirm = useMemo(() => {
    if (!selectedTipo) return false;
    const max = Number(selectedTipo?.maxOpcoes || 1);
    if (selectedOpcoes.length === 0 || selectedOpcoes.length > max) return false;
    if (max > 1 && selectedOpcoes.length !== max) return false;
    const fracs = selectedOpcoes.map((id) => {
      const f = fractionsMap[id];
      return Number.isFinite(f) && f > 0 ? f : (max > 1 ? (1 / max) : 1);
    });
    const sum = fracs.reduce((acc, n) => acc + n, 0);
    if (Math.abs(sum - 1) > 0.001) return false;
    return true;
  }, [selectedTipo, selectedOpcoes, fractionsMap]);

  const handleConfirm = () => {
    if (!selectedTipo) return;
    const max = Number(selectedTipo?.maxOpcoes || 1);
    if (selectedOpcoes.length === 0 || selectedOpcoes.length > max) return;
    if (max > 1 && selectedOpcoes.length !== max) return;
    const fracs = selectedOpcoes.map((id) => {
      const f = fractionsMap[id];
      return Number.isFinite(f) && f > 0 ? f : (max > 1 ? (1 / max) : 1);
    });
    const sum = fracs.reduce((acc, n) => acc + n, 0);
    if (Math.abs(sum - 1) > 0.001) return;
    const payload = {
      tipoId: selectedTipo?.id,
      regraPreco: selectedTipo?.regraPreco,
      maxOpcoes: selectedTipo?.maxOpcoes,
      opcoes: selectedOpcoes.map((id, idx) => ({ productId: id, fracao: fracs[idx] })),
      precoFixo: selectedTipo?.precoFixo ?? undefined,
    } as any;
    onConfirm(payload);
  };

  const renderTipo = ({ item }: { item: VariationType }) => (
    <TouchableOpacity
      style={[styles.tipoCard, selectedTipo?.id === item.id && styles.tipoCardSelected]}
      onPress={() => { setSelectedTipo(item); setSelectedOpcoes([]); }}
    >
      <View style={styles.tipoInfo}>
        <Text style={styles.tipoNome}>{item.nome}</Text>
        <Text style={styles.tipoDesc}>Até {item.maxOpcoes} opção(ões) • Regra: {item.regraPreco}</Text>
      </View>
      {selectedTipo?.id === item.id && (
        <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );

  const renderOpcao = ({ item }: { item: Product }) => {
    const id = parseInt(String((item as any)?._id ?? (item as any)?.id ?? 0), 10);
    const checked = selectedOpcoes.includes(id);
    const max = Number(selectedTipo?.maxOpcoes || 1);
    const frac = fractionsMap[id] ?? (max > 1 ? (1 / max) : 1);
    
    // Determine displayed price for this option
    let displayPrice = Number(item.precoVenda || 0);
    if (selectedSize && Array.isArray(item.tamanhos)) {
      const match = item.tamanhos.find(t => t.nome === selectedSize.nome);
      if (match) displayPrice = Number(match.preco);
    }

    return (
      <TouchableOpacity style={[styles.opcaoRow, checked && styles.opcaoRowSelected]} onPress={() => toggleOpcao(id)}>
        <View style={styles.opcaoLeft}>
          <Text style={styles.opcaoNome} numberOfLines={1}>{item.nome}</Text>
          {!!item.descricao && <Text style={styles.opcaoDesc} numberOfLines={2}>{item.descricao}</Text>}
        </View>
        <View style={styles.opcaoRight}>
          <Text style={styles.opcaoPreco}>R$ {displayPrice.toFixed(2)}</Text>
          {checked && (
            <View style={styles.fracSelector}>
              {max === 2 ? (
                <>
                  <TouchableOpacity style={[styles.fracOption, frac === 0.5 && styles.fracOptionActive]} onPress={() => setFractionsMap(prev => ({ ...prev, [id]: 0.5 }))}>
                    <Text style={[styles.fracOptionText, frac === 0.5 && styles.fracOptionTextActive]}>½</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.fracOption, frac === 1 && styles.fracOptionActive]} onPress={() => setFractionsMap(prev => ({ ...prev, [id]: 1 }))}>
                    <Text style={[styles.fracOptionText, frac === 1 && styles.fracOptionTextActive]}>1</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.fracBadge}>{max === 1 ? 'Inteiro' : `1/${max}`}</Text>
              )}
            </View>
          )}
          <Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={checked ? '#4CAF50' : '#999'} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Selecionar Variação</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.productBar}>
          <Text style={styles.productName}>{product?.nome || 'Produto'}</Text>
          <Text style={styles.productBasePrice}>Base: R$ {Number(product?.precoVenda || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {selectedTipo ? `Selecionados: ${selectedOpcoes.length}/${Number(selectedTipo?.maxOpcoes || 0)}` : 'Selecione um tipo'}
          </Text>
          <Text style={styles.summaryValue}>R$ {precoCalculado.toFixed(2)}</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Variação</Text>
            {loadingTipos ? (
              <View style={styles.loadingBox}><ActivityIndicator size="small" color="#2196F3" /><Text style={styles.loadingText}>Carregando tipos...</Text></View>
            ) : (
              <FlatList 
                data={tipos} 
                renderItem={renderTipo} 
                keyExtractor={(it) => String(it.id)} 
                scrollEnabled={false}
                showsVerticalScrollIndicator={false} 
              />
            )}
          </View>

          {selectedTipo && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seleção de Sabores ({selectedOpcoes.length}/{selectedTipo.maxOpcoes})</Text>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar opções..."
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholderTextColor="#999"
                />
              </View>
              {loadingOptions ? (
                <View style={styles.loadingBox}><ActivityIndicator size="small" color="#2196F3" /><Text style={styles.loadingText}>Carregando opções...</Text></View>
              ) : (
                <FlatList
                  data={displayedOptions}
                  renderItem={renderOpcao}
                  keyExtractor={(it, idx) => String((it as any)?._id ?? (it as any)?.id ?? idx)}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 8 }}
                />
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Preço calculado:</Text>
            <Text style={styles.totalValue}>R$ {precoCalculado.toFixed(2)}</Text>
          </View>
          <View style={styles.footerButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
            {onConfirmWhole && (
              <TouchableOpacity style={styles.wholeButton} onPress={onConfirmWhole}>
                <Ionicons name="pricetag-outline" size={16} color="#2196F3" style={{ marginRight: 4 }} />
                <Text style={styles.wholeButtonText}>Inteiro</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.confirmButton, (!canConfirm) && styles.confirmButtonDisabled]} onPress={handleConfirm} disabled={!canConfirm}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  closeButton: { padding: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  productBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  productName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  productBasePrice: { fontSize: 14, color: '#666', marginTop: 2 },
  summaryBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryText: { fontSize: 13, color: '#666' },
  summaryValue: { fontSize: 15, fontWeight: 'bold', color: '#2196F3' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, color: '#333' },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { fontSize: 14, color: '#666' },
  tipoCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginVertical: 4, borderWidth: 1, borderColor: '#eee' },
  tipoCardSelected: { borderColor: '#4CAF50' },
  tipoInfo: { flex: 1, marginRight: 8 },
  tipoNome: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  tipoDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  opcaoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 8, marginVertical: 3, borderWidth: 1, borderColor: '#eee' },
  opcaoRowSelected: { borderColor: '#4CAF50' },
  opcaoLeft: { flex: 1, marginRight: 8 },
  opcaoNome: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  opcaoDesc: { fontSize: 12, color: '#666' },
  opcaoRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  opcaoPreco: { fontSize: 14, fontWeight: 'bold', color: '#2196F3' },
  fracBadge: { fontSize: 12, color: '#666' },
  fracSelector: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fracOption: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  fracOptionActive: { borderColor: '#4CAF50', backgroundColor: '#e8f5e9' },
  fracOptionText: { fontSize: 12, color: '#666' },
  fracOptionTextActive: { color: '#2e7d32', fontWeight: '600' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#ddd', backgroundColor: '#fff' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 14, color: '#666' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#2196F3' },
  footerButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  cancelButtonText: { color: '#333', fontSize: 14 },
  wholeButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#2196F3', borderRadius: 8, backgroundColor: '#e3f2fd' },
  wholeButtonText: { color: '#2196F3', fontSize: 14, fontWeight: 'bold' },
  confirmButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#4CAF50', borderRadius: 8 },
  confirmButtonDisabled: { backgroundColor: '#a5d6a7' },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});