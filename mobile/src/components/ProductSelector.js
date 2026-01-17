import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productService, categoryService } from '../services/api';

const ProductSelector = ({ 
  visible, 
  onClose, 
  onProductSelect, 
  title = 'Selecionar Produto',
  showQuantitySelector = true 
}) => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [categories, setCategories] = useState([
    { key: '', label: 'Todas', icon: '🍽️' }
  ]);

  useEffect(() => {
    if (visible) {
      // Reset filters when modal opens
      setSearchText('');
      setSelectedCategory('');
      loadProducts();
      loadCategories();
    }
  }, [visible]);

  useEffect(() => {
    if (products && products.length > 0) {
      filterProducts();
    } else if (products && products.length === 0) {
      setFilteredProducts([]);
    }
  }, [products, searchText, selectedCategory]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      console.log('Loading products...');
      const response = await productService.getAll();
      console.log('Raw products response:', response.data?.length || 0, 'products');
      
      const activeProducts = response.data.filter(product => product.ativo && product.disponivel);
      console.log('Active products:', activeProducts.length);
      
      // Normalizar campos com fallbacks seguros
      const normalizedProducts = activeProducts.map((p) => ({
        ...p,
        nome: p?.nome ?? p?.nomeProduto ?? p?.produto?.nome ?? p?.name ?? 'Produto',
        descricao: p?.descricao ?? p?.productDescription ?? p?.desc ?? '',
        grupo: p?.grupo ?? p?.categoria ?? p?.category ?? 'Outros',
        categoriaId: p?.categoriaId ?? undefined,
        categoria: p?.categoria ?? '',
      }));
      
      setProducts(normalizedProducts);
      setFilteredProducts(normalizedProducts);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os produtos');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      let used = [];
      try {
        const resp = await productService.getUsedCategories();
        used = Array.isArray(resp?.data) ? resp.data : [];
      } catch (e) {
        used = [];
      }
      const data = used.length > 0 ? used : await categoryService.getAll();
      const categoryFilters = [
        { key: '', label: 'Todas', icon: '🍽️' },
        ...data.map((categoria) => ({
          key: String(categoria.id ?? categoria._id ?? categoria.label ?? categoria.nome),
          label: String(categoria.label ?? categoria.nome ?? ''),
          icon: '📦'
        }))
      ];
      setCategories(categoryFilters);
    } catch (error) {
      setCategories([{ key: '', label: 'Todas', icon: '🍽️' }]);
    }
  };



  const filterProducts = () => {
    console.log('=== FILTERING PRODUCTS ===');
    console.log('Total products:', products.length);
    console.log('Selected category:', selectedCategory);
    console.log('Search text:', searchText);
    
    if (!products || products.length === 0) {
      console.log('No products to filter');
      setFilteredProducts([]);
      return;
    }
    
    let filtered = [...products];
    console.log('Starting with', filtered.length, 'products');

    if (selectedCategory && selectedCategory !== '') {
      const beforeFilter = filtered.length;
      const selIsNumeric = /^\d+$/.test(String(selectedCategory));
      if (selIsNumeric) {
        const selId = Number(selectedCategory);
        const selectedFilterObj = categories.find(c => String(c.key) === String(selectedCategory));
        const selNameLower = String(selectedFilterObj?.label ?? '').toLowerCase();
        filtered = filtered.filter(product => {
          const byId = Number(product?.categoriaId ?? 0) === selId;
          if (byId) return true;
          const catLower = String(product?.categoria ?? '').toLowerCase();
          const tipoLower = String(product?.tipo ?? '').toLowerCase();
          const grupoLower = String(product?.grupo ?? '').toLowerCase();
          if (selNameLower && (catLower === selNameLower || tipoLower === selNameLower || grupoLower === selNameLower)) return true;
          if (catLower.includes(',')) {
            const parts = catLower.split(',').map(s => s.trim());
            return selNameLower ? parts.includes(selNameLower) : false;
          }
          return false;
        });
      } else {
        const selLower = String(selectedCategory).toLowerCase();
        filtered = filtered.filter(product => {
          const catLower = String(product?.categoria ?? '').toLowerCase();
          const tipoLower = String(product?.tipo ?? '').toLowerCase();
          const grupoLower = String(product?.grupo ?? '').toLowerCase();
          if (catLower === selLower || tipoLower === selLower || grupoLower === selLower) return true;
          if (catLower.includes(',')) {
            const parts = catLower.split(',').map(s => s.trim());
            return parts.includes(selLower);
          }
          return false;
        });
      }
      console.log(`Category filter: ${beforeFilter} -> ${filtered.length} products`);
    }

    // Filtrar por texto de busca (com fallbacks seguros)
    if (searchText && searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      const beforeFilter = filtered.length;
      filtered = filtered.filter(product => {
        const nameLower = String(product?.nome ?? product?.nomeProduto ?? product?.produto?.nome ?? product?.name ?? '').toLowerCase();
        const descLower = String(product?.descricao ?? product?.productDescription ?? product?.desc ?? '').toLowerCase();
        return nameLower.includes(searchLower) || descLower.includes(searchLower);
      });
      console.log(`Search filter: ${beforeFilter} -> ${filtered.length} products`);
    }

    console.log('Final filtered products:', filtered.length);
    console.log('=== END FILTERING ===');
    setFilteredProducts(filtered);
  };

  const handleProductPress = (product) => {
    if (showQuantitySelector) {
      setSelectedProduct(product);
      setQuantity(1);
    } else {
      onProductSelect(product, 1);
      handleClose();
    }
  };

  const handleConfirmSelection = () => {
    if (selectedProduct && quantity > 0) {
      onProductSelect(selectedProduct, quantity);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedProduct(null);
    setQuantity(1);
    setSearchText('');
    setSelectedCategory('todos');
    onClose();
  };

  const adjustQuantity = (delta) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
    }
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryButton,
        selectedCategory === item.key && styles.categoryButtonActive
      ]}
      onPress={() => setSelectedCategory(item.key)}
    >
      <Text style={styles.categoryIcon}>{item.icon}</Text>
      <Text style={[
        styles.categoryText,
        selectedCategory === item.key && styles.categoryTextActive
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item }) => (
    <TouchableOpacity
      style={styles.productRow}
      onPress={() => handleProductPress(item)}
    >
      <View style={styles.productLeftSection}>
        <Text style={styles.productPrice}>R$ {Number(item?.precoVenda || 0).toFixed(2)}</Text>
        <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.chevronIcon} />
      </View>
      <View style={styles.productRightSection}>
        <Text style={styles.productName} numberOfLines={2}>{String(item?.nome ?? item?.nomeProduto ?? item?.produto?.nome ?? item?.name ?? 'Produto')}</Text>
        {Boolean(item?.descricao ?? item?.productDescription ?? item?.desc) && (
          <Text style={styles.productDescription} numberOfLines={1}>{String(item?.descricao ?? item?.productDescription ?? item?.desc)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produtos..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Categories */}
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesList}
          contentContainerStyle={styles.categoriesContent}
        />

        {/* Products */}
        <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => String(item?.id ?? item?._id ?? '')}
          style={styles.productsList}
          contentContainerStyle={styles.productsContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="basket-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {loading ? 'Carregando produtos...' : 'Nenhum produto encontrado'}
              </Text>
            </View>
          }
        />

        {/* Quantity Selector Overlay */}
        {selectedProduct && (
          <TouchableWithoutFeedback onPress={() => setSelectedProduct(null)}>
            <View style={styles.quantityModalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.quantityModal}>
                  <Text style={styles.quantityModalTitle}>Adicionar Produto</Text>
                  
                  <View style={styles.selectedProductInfo}>
                    <Text style={styles.selectedProductName}>{selectedProduct.nome}</Text>
                    <Text style={styles.selectedProductPrice}>
                      R$ {selectedProduct.precoVenda.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.quantityContainer}>
                    <Text style={styles.quantityLabel}>Quantidade:</Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => adjustQuantity(-1)}
                      >
                        <Ionicons name="remove" size={20} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.quantityValue}>{quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => adjustQuantity(1)}
                      >
                        <Ionicons name="add" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.totalPrice}>
                    Total: R$ {(selectedProduct.precoVenda * quantity).toFixed(2)}
                  </Text>

                  <View style={styles.quantityModalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={() => setSelectedProduct(null)}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={handleConfirmSelection}
                    >
                      <Text style={styles.confirmButtonText}>Adicionar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  categoriesList: {
    maxHeight: 60,
  },
  categoriesContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 80,
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  categoryText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  productsList: {
    flex: 1,
  },
  productsContent: {
    paddingVertical: 4,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
  },
  productRightSection: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  productDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginRight: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  quantityModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  quantityModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 300,
  },
  quantityModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  selectedProductInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  selectedProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  selectedProductPrice: {
    fontSize: 14,
    color: '#2196F3',
  },
  quantityContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    minWidth: 30,
    textAlign: 'center',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  quantityModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ProductSelector;