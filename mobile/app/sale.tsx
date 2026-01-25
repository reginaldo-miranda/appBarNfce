
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Platform,

  Linking,
  Switch,
  ScrollView,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline } from '../src/components/NativeMaps';
import { GooglePlacesAutocomplete } from '../src/components/GooglePlacesAutocompleteWrapper';
import Constants from 'expo-constants';
import api, { saleService, mesaService, comandaService, getWsUrl, authService, API_URL, companyService, customerService, employeeService } from '../src/services/api';
import DeliveryDetailsModal from '../src/components/DeliveryDetailsModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, getSecureItem } from '../src/services/storage';
import AddProductToTable from '../src/components/AddProductToTable';
import ScreenIdentifier from '../src/components/ScreenIdentifier';
import SaleItemsModal from '../src/components/SaleItemsModal';

import VariationSelectorModal from '../src/components/VariationSelectorModal';
import SizeSelectorModal from '../src/components/SizeSelectorModal';
import { Product, CartItem, Sale, PaymentMethod, ProductSize } from '../src/types/index';
import { useAuth } from '../src/contexts/AuthContext';
import { events } from '../src/utils/eventBus';
import PaymentSplitModal from '../src/components/PaymentSplitModal';
import ImpressaoNfceModal from '../src/components/ImpressaoNfceModal';
import NfceService from '../src/services/NfceService';
import PixModal from '../src/components/PixModal';
import PaymentPromptModal from '../src/components/PaymentPromptModal';





export default function SaleScreen() {
  const params = useLocalSearchParams();
  const { mesaId, vendaId, viewMode } = params;
  // Inferir tipo se não vier explícito, mas tiver mesaId
  const tipo = params.tipo || (mesaId ? 'mesa' : undefined);

  const { user } = useAuth() as any;
  // const { confirmRemove } = useConfirmation();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  // Modal states
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [isViewMode, setIsViewMode] = useState(false);
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [mesa, setMesa] = useState<any>(null);
  const [comanda, setComanda] = useState<any>(null);
  const [itemsModalVisible, setItemsModalVisible] = useState(false);
  const isPhone = Dimensions.get('window').width < 768;
  const [initialItemsModalShown, setInitialItemsModalShown] = useState(false);
  const latestReqRef = useRef<Map<string, number>>(new Map());
  
  const handleEmitNfce = async (saleIdToEmit: string) => {
    console.log('[DEBUG] handleEmitNfce CALLED. ID:', saleIdToEmit);
    setNfceModalVisible(true);
    setNfceStatus('loading');
    setNfceMessage('Transmitindo para SEFAZ...');
    try {
      const res = await NfceService.emitir(saleIdToEmit); 
      console.log('[DEBUG] Resposta Emitir NFC-e:', res);

      // Verificação robusta de status (API retorna 'AUTORIZADO' ou 'REJEITADO')
      const statusRaw = (res.status || '').toUpperCase();
      const isAuth = statusRaw === 'AUTORIZADO' || statusRaw === 'AUTORIZADA';

      if (res.success || isAuth) {
        console.log('[DEBUG] NFC-e SUCCESS detected. Preparing Alert.');
        setNfceStatus('success');
        setNfceMessage('NFC-e emitida com sucesso!');
        setNfceData(res);
        // Explicit success alert for delivery/general flow as requested
        // Moved into ImpressaoNfceModal for better visibility
        console.log('[DEBUG] NFC-e Success. Modal updated.');
      } else {
        console.log('[DEBUG] NFC-e FAILED.', res);
        setNfceStatus('error');
        // Prioritize 'motivo' from DB/Sefaz, then 'message', then 'error'
        const reason = res.motivo || res.message || res.error || 'Erro: Nota Rejeitada pela SEFAZ.';
        setNfceMessage(reason);
      }
    } catch (e: any) {
      console.error('Erro NFC-e:', e);
      setNfceStatus('error');
      setNfceMessage(typeof e === 'string' ? e : (e.message || 'Falha de comunicação.'));
    }
  };

  // Estados para variação
  const [variationVisible, setVariationVisible] = useState(false);
  const [variationProduct, setVariationProduct] = useState<Product | null>(null);

  // Estados para tamanhos
  const [sizeModalVisible, setSizeModalVisible] = useState(false);
  const [sizeProduct, setSizeProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);

  const [splitModalVisible, setSplitModalVisible] = useState(false);

  // Delivery States
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [companyConfig, setCompanyConfig] = useState<any>(null);
  const [showDeliveryMap, setShowDeliveryMap] = useState(false);
  
  // Client & Employee States
  const [clients, setClients] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  const [selectedEntregador, setSelectedEntregador] = useState<any | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  const [registerLoading, setRegisterLoading] = useState(false);
  
  // NFC-e
  const [nfceModalVisible, setNfceModalVisible] = useState(false);
  const [nfceStatus, setNfceStatus] = useState<'loading'|'success'|'error'|'idle'>('idle');
  const [nfceMessage, setNfceMessage] = useState('');
  const [nfceData, setNfceData] = useState<any>(null);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({ nome: '', fone: '', endereco: '', cidade: '', estado: '' });

  // Payment Prompt Modal State
  const [paymentPromptVisible, setPaymentPromptVisible] = useState(false);
  const [pixModalVisible, setPixModalVisible] = useState(false);


  // API Key for Maps
  const [googleMapsKey, setGoogleMapsKey] = useState(Constants.expoConfig?.android?.config?.googleMaps?.apiKey || Constants.expoConfig?.ios?.config?.googleMapsApiKey || '');

  useEffect(() => {
     // Load Google Maps Key from Storage (User Config) override
     (async () => {
         try {
             // 1. Try Storage
             const storedKey = await getSecureItem(STORAGE_KEYS.GOOGLE_MAPS_KEY);
             if (storedKey) {
                 console.log('[DEBUG] Loaded Google Key from Storage:', storedKey);
                 setGoogleMapsKey(storedKey);
             } else {
                 console.log('[DEBUG] No custom Google Key in Storage. Using default.');
             }
         } catch(e) { console.error('Error loading google key', e); }
     })();
     console.log('[DEBUG] Component Mount. Google Key:', googleMapsKey ? 'PRESENT' : 'MISSING', googleMapsKey);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const storedMapKey = await getSecureItem(STORAGE_KEYS.GOOGLE_MAPS_KEY);
        if (storedMapKey && mounted) setGoogleMapsKey(storedMapKey);

        const existingToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!existingToken) {
          const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
          const token = login?.data?.token;
          if (token && mounted) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Load Company Config, Employees
  useEffect(() => {
    (async () => {
        try {
            const res = await companyService.get();
            if (res.data) {
                setCompanyConfig(res.data);
            }
            
            // Load Employees
            const empRes = await employeeService.getAll();
            if (empRes.data && Array.isArray(empRes.data)) {
                // Filter active employees? Or all? Usually active.
                const active = empRes.data.filter((e: any) => e.ativo);
                setEmployees(active);
            }
        } catch (e) {
            console.error('Falha ao carregar config/funcionarios', e);
        }
    })();
  }, []);

  // Search Clients
  useEffect(() => {
      const delay = setTimeout(async () => {
          if (searchClientQuery.length > 2) {
              try {
                  // Assuming customerService.getAll supports filtering or we store all?
                  // Best practice: backend search. We added `?nome=` in customer.js
                  const res = await api.get('/customer/list', { params: { nome: searchClientQuery } });
                  if (res.data) setClients(res.data);
              } catch (e) { console.error(e); }
          } else {
             // If query empty, maybe clear list or show recent?
             if (searchClientQuery === '') setClients([]);
          }
      }, 500);
      return () => clearTimeout(delay);
  }, [searchClientQuery]);

  // Calculate Fee when distance changes
  useEffect(() => {
    if (deliveryDistance > 0 && companyConfig && Array.isArray(companyConfig.deliveryRanges)) {
        const ranges = companyConfig.deliveryRanges;
        // Encontrar faixa
        const match = ranges.find((r: any) => deliveryDistance >= Number(r.minDist) && deliveryDistance <= Number(r.maxDist));
        if (match) {
            setDeliveryFee(Number(match.price));
        } else {
            // Se exceder o máximo, pode cobrar o da maior faixa ou bloquear. 
            // Vamos assumir a maior faixa ou zero se não houver match.
            // Opcional: Avisar se fora do raio.
             if (companyConfig.deliveryRadius && deliveryDistance > Number(companyConfig.deliveryRadius)) {
                 // Fora do raio
                 // Alert.alert('Aviso', 'Distância excede o raio de entrega da loja.');
             }
             // Tentar pegar o ultimo?
             // setDeliveryFee(0);
        }
    }
  }, [deliveryDistance, companyConfig]);

  // Load existing delivery data from sale
  useEffect(() => {
      if (sale) {
          if (sale.isDelivery) {
              setIsDelivery(true);
              // Se tiver endereço salvo, preencher (mas google autocomplete é chato de preencher reverso sem ref manual,
              // vamos confiar que o usuario vê o endereço no texto ou mapa)
              setDeliveryAddress(sale.deliveryAddress || '');
              setDeliveryDistance(Number(sale.deliveryDistance || 0));
              setDeliveryFee(Number(sale.deliveryFee || 0));
              // Coords não salvamos no sale (apenas endereço e distancia), mas poderíamos. 
              // Por enquanto, se recarregar, o mapa pode ficar sem marker até o usuário buscar de novo ou se salvarmos lat/lng no sale (recomendado).
              // Mas o schema não tem lat/lng no Sale, só Address.
          }
          if (sale.cliente) setSelectedCliente(sale.cliente);
          if (sale.entregador) setSelectedEntregador(sale.entregador);
      }
  }, [sale]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Radius of the earth in km
      const dLat = deg2rad(lat2 - lat1); 
      const dLon = deg2rad(lon2 - lon1); 
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      const d = R * c; // Distance in km
      return d;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  const handlePlaceSelect = (data: any, details: any = null) => {
      if (details && companyConfig?.latitude && companyConfig?.longitude) {
          const { lat, lng } = details.geometry.location;
          setDeliveryCoords({ lat, lng });
          setDeliveryAddress(data.description || details.formatted_address);
          setShowDeliveryMap(true);

          // Calcular distância (Haversine simples por enquanto)
          // O ideal seria Google Distance Matrix, mas Haversine * 1.3 é uma boa estimativa urbana
          const straightLine = calculateDistance(Number(companyConfig.latitude), Number(companyConfig.longitude), lat, lng);
          const estRoadDist = parseFloat((straightLine * 1.3).toFixed(2)); // Fator de correção de rota
          setDeliveryDistance(estRoadDist);
      }
  };

  useEffect(() => {
    const w = Dimensions.get('window').width;
    const shouldTablet = Platform.OS === 'web' || w >= 1024;
    (async () => {
      try {
        if (shouldTablet) await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_MODE, 'tablet');
      } catch {}
    })();
    return () => { AsyncStorage.removeItem(STORAGE_KEYS.CLIENT_MODE).catch(() => {}); };
  }, []);

  useEffect(() => {
    if (isPhone && !isViewMode && cart.length > 0 && !initialItemsModalShown) {
      setItemsModalVisible(true);
      setInitialItemsModalShown(true);
    }
  }, [isPhone, isViewMode, cart.length, initialItemsModalShown]);

  useEffect(() => {
    try {
      let ws: any = null;
      let sse: any = null;
      const url = getWsUrl();
      if (url) {
        ws = new (globalThis as any).WebSocket(url);
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              const id = String(msg?.payload?.id || '');
              const currentId = String((sale as any)?._id || (sale as any)?.id || vendaId || '');
              if (!id || !currentId || id !== currentId) {
                console.log('[WS] sale:update ignorado', { id, currentId });
                return;
              }
              console.log('[WS] sale:update aceito', { id, currentId });
              const r = await saleService.getById(currentId);
              const v = r.data;
              if (v) {
                setSale(v);
                setCart(v.itens || []);
              }
            }
          } catch (err) {
            const e = err as any;
            console.warn('[WS] erro onmessage', e?.message || e);
          }
        };
      }
      try {
        const isWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !!(window as any).EventSource;
        if (isWeb) {
          const base = (API_URL || '').replace(/\/$/, '');
          if (base) {
            const sseUrl = `${base}/sale/stream`;
            sse = new (window as any).EventSource(sseUrl);
            sse.onmessage = async (evt: any) => {
              try {
                const msg = JSON.parse(String(evt?.data || '{}'));
                if (msg?.type === 'sale:update') {
                  const id = String(msg?.payload?.id || '');
                  const currentId = String((sale as any)?._id || (sale as any)?.id || vendaId || '');
                  if (!id || !currentId || id !== currentId) {
                    console.log('[SSE] sale:update ignorado', { id, currentId });
                    return;
                  }
                  console.log('[SSE] sale:update aceito', { id, currentId });
                  const r = await saleService.getById(currentId);
                  const v = r.data;
                  if (v) {
                    setSale(v);
                    setCart(v.itens || []);
                  }
                }
              } catch (e2) {
                const ee = e2 as any;
                console.warn('[SSE] erro onmessage', ee?.message || ee);
              }
            };
          }
        }
      } catch {}
      return () => {
        try { ws && ws.close(); } catch {}
        try { sse && sse.close && sse.close(); } catch {}
      };
    } catch {}
  }, [sale, vendaId]);

  // Listener para eventos de Polling dispostos pelos modais
  useEffect(() => {
    const unsub = events.on('sale:polling-update', (updatedSale: Sale) => {
      const currentId = (sale as any)?.id || (sale as any)?._id;
      const updatedId = (updatedSale as any)?.id || (updatedSale as any)?._id;
      
      if (currentId && updatedId && String(currentId) === String(updatedId)) {
        console.log('[SaleScreen] Recebido update via polling event');
        setSale(updatedSale);
        setCart(updatedSale.itens || []);
        
        // Se foi finalizada remotamente, fecha split modal e avisa
        if (updatedSale.status === 'finalizada' && splitModalVisible) {
          setSplitModalVisible(false);
          Alert.alert('Aviso', 'Venda finalizada remotamente.');
          router.back();
        }
      }
    });
    return () => unsub();
  }, [sale, splitModalVisible]);

  const paymentMethods: PaymentMethod[] = [
    { key: 'dinheiro', label: 'Dinheiro', icon: 'cash' },
    { key: 'cartao', label: 'Cartão', icon: 'card' },
    { key: 'pix', label: 'PIX', icon: 'phone-portrait' },
  ];

  const loadSale = useCallback(async () => {
    try {
      setLoading(true);
      const response = await saleService.getById(vendaId as string);
      setSale(response.data);
      setCart(response.data.itens || []);
      
      if (response.data.mesa) {
        setMesa(response.data.mesa);
        setNomeResponsavel(response.data.mesa.nomeResponsavel || '');
      }
    } catch (error) {
      console.error('Erro ao carregar venda:', error);
      Alert.alert('Erro', 'Não foi possível carregar a venda');
    } finally {
      setLoading(false);
    }
  }, [vendaId]);

  const loadMesaData = useCallback(async () => {
    try {
      const response = await mesaService.getById(mesaId as string);
      setMesa(response.data);
      setNomeResponsavel(response.data.nomeResponsavel || '');
    } catch (error) {
      console.error('Erro ao carregar dados da mesa:', error);
    }
  }, [mesaId]);

  // Helper: confirmação via Alert (usado apenas para remoção explícita)
  const confirmRemoveAlert = (itemName: string): Promise<boolean> => {
    if ((typeof window !== 'undefined') && (Platform as any)?.OS === 'web' && typeof (window as any).confirm === 'function') {
      const ok = (window as any).confirm(`Tem certeza que deseja remover ${itemName}?`);
      return Promise.resolve(ok);
    }

    // Mobile nativo: usar Alert.alert
    return new Promise((resolve) => {
      Alert.alert(
        'Confirmar Remoção',
        `Tem certeza que deseja remover ${itemName}?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Remover', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });
  };

  const loadComandaSale = useCallback(async () => {
    try {
      setLoading(true);
      const response = await comandaService.getById(vendaId as string);
      setSale(response.data);
      setCart(response.data.itens || []);
      setComanda(response.data);
    } catch (error) {
      console.error('Erro ao carregar comanda:', error);
      Alert.alert('Erro', 'Não foi possível carregar a comanda');
    } finally {
      setLoading(false);
    }
  }, [vendaId]);

  const handleSelectClient = async (client: any) => {
      setSelectedCliente(client);
      setShowClientModal(false);
      
      let newAddress = deliveryAddress;
      // Auto-fill delivery address if empty and client has address
      // Also if IS delivery mode or we want to prompt?
      if (!deliveryAddress && client.endereco) {
          const parts = [
              client.endereco,
              client.cidade,
              client.estado
          ].filter(p => p && p.trim().length > 0);
          
          const fullAddr = parts.join(', ');
          setDeliveryAddress(fullAddr);
          newAddress = fullAddr;
      }

      if (sale && sale._id) {
          try {
              const res = await saleService.update(sale._id, { 
                  clienteId: client.id, 
                  deliveryAddress: newAddress 
              });
              setSale(res.data);
          } catch (e) {
              console.error('Erro ao atualizar cliente da venda', e);
          }
      }
  };


  const handleSelectEntregador = async (emp: any) => {
      setSelectedEntregador(emp);
      setShowEmployeeModal(false);
      
      if (sale && sale._id) {
          try {
              const res = await saleService.update(sale._id, { entregadorId: emp.id });
              setSale(res.data);
          } catch (e) { console.error('Erro ao atualizar entregador', e); }
      }
  };

  const handleUseNameOnly = async (name: string) => {
      // Cria cliente "lite" apenas com nome
      try {
          if (!name || name.length < 3) return;
          const res = await customerService.create({ nome: name, fone: '', endereco: '' });
          if (res.data && res.data.customer) {
              handleSelectClient(res.data.customer);
          } else {
              Alert.alert('Erro', 'Não foi possível criar o cliente temporário.');
          }
      } catch (e: any) {
          console.error(e);
          const msg = e.response?.data?.error || e.message || 'Falha ao usar nome temporário';
          Alert.alert('Erro', msg);
      }
  };

  const handleRegisterClient = async () => {
      if (!registerForm.nome) {
          Alert.alert('Erro', 'Nome é obrigatório');
          return;
      }
      setRegisterLoading(true);
      try {
          const res = await customerService.create(registerForm);
          if (res.data && res.data.customer) {
              setRegisterForm({ nome: '', fone: '', endereco: '', cidade: '', estado: '' });
              setShowRegisterModal(false);
              // Pequeno delay para garantir transição suave de modais
              setTimeout(() => {
                  handleSelectClient(res.data.customer);
                  Platform.OS === 'web' ? window.alert('Cliente cadastrado!') : Alert.alert('Sucesso', 'Cliente cadastrado!');
              }, 100);
          } else {
              Alert.alert('Erro', 'Servidor não retornou dados do cliente.');
          }
      } catch (e: any) {
          const msg = e.response?.data?.error || e.message || 'Erro ao cadastrar';
          Alert.alert('Erro', msg);
      } finally {
          setRegisterLoading(false);
      }
  };

  const createNewSale = useCallback(async () => {
    try {
      console.log('=== CRIANDO NOVA VENDA ===');
      console.log('User:', user);
      console.log('User ID:', user?._id);
      console.log('Mesa ID:', mesaId);
      console.log('Tipo:', tipo);

      if (!user || !user._id) {
        console.log('❌ Usuário não está logado');
        Alert.alert('Erro', 'Usuário não está logado');
        return;
      }

      const saleData = {
        funcionario: user._id,
        tipoVenda: tipo || 'mesa',
        ...(mesaId && { mesa: mesaId }),
        status: 'aberta',
        clienteId: selectedCliente?.id || null,
        entregadorId: selectedEntregador?.id || null,
        itens: [],
        total: 0
      };

      console.log('Dados da venda a serem enviados:', saleData);

      const response = await saleService.create(saleData);
      console.log('✅ Venda criada com sucesso:', response.data);
      
      setSale(response.data);
      setCart([]);
    } catch (error: any) {
      console.error('❌ Erro ao criar venda:', error);
      console.error('Detalhes do erro:', error.response?.data);
      const errMsg = ((error && (error as any)?.message) || 'Erro desconhecido');
      Alert.alert('Erro ao criar venda', `Detalhes: ${JSON.stringify(error?.response?.data || errMsg)}`);
    } finally {
      setLoading(false);
    }
  }, [user, mesaId, tipo]);

  const loadMesaSale = useCallback(async () => {
    try {
      setLoading(true);
      await loadMesaData();
      
      const response = await saleService.getByMesa(mesaId as string);
      if (response.data && response.data.length > 0) {
        // Pega SOMENTE a venda ativa (status 'aberta') em modo normal
        const activeSale = response.data.find((sale: Sale) => sale.status === 'aberta');
        if (activeSale) {
          setSale(activeSale);
          setCart(activeSale.itens || []);
        } else if (!isViewMode) {
          // Sem venda aberta: cria uma nova venda para evitar reutilizar itens antigos
          await createNewSale();
        } else {
          // Em modo visualização, permitir ver a última venda (mesmo finalizada)
          const lastSale = response.data[0];
          setSale(lastSale);
          setCart(lastSale.itens || []);
        }
      } else if (!isViewMode) {
        await createNewSale();
      }
    } catch (error) {
      console.error('Erro ao carregar venda da mesa:', error);
      if (!isViewMode) {
        createNewSale();
      }
    } finally {
      setLoading(false);
    }
  }, [mesaId, isViewMode, loadMesaData, createNewSale]);

  

  useEffect(() => {
    if (viewMode === 'view') {
      setIsViewMode(true);
      loadMesaSale();
    } else {
      setIsViewMode(false);
      
      if (vendaId) {
        if (tipo === 'comanda') {
          loadComandaSale();
        } else {
          loadSale();
        }
      } else if (mesaId) {
        loadMesaSale();
      } else {
        createNewSale();
      }
    }
  }, [viewMode, vendaId, mesaId, tipo, loadSale, loadComandaSale, loadMesaSale, createNewSale]);

  const addToCart = async (product: Product) => {
    if (!sale) {
      Alert.alert('Erro', 'Nenhuma venda ativa encontrada');
      return;
    }

    try {
      // Check for size selection first
      if ((product as any)?.temTamanhos) {
        setSizeProduct(product);
        setSizeModalVisible(true);
        setSelectedSize(null);
        return;
      }

      if ((product as any)?.temVariacao) {
        setVariationProduct(product);
        setVariationVisible(true);
        setSelectedSize(null);
        return;
      }
      // Adiciona o item no backend
      const itemData = {
        produtoId: parseInt(String((product as any)?._id ?? (product as any)?.id ?? 0), 10),
        quantidade: 1
      };
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(clientMode).toLowerCase() === 'tablet') {
        (itemData as any).origem = 'tablet';
      }
      
      console.log('Adicionando item ao carrinho:', itemData);
      const response = await saleService.addItem(sale._id, itemData);
      
      // Atualiza o estado local com os dados do backend
      setSale(response.data);
      setCart(response.data.itens || []);
      Alert.alert('Sucesso', `${product.nome} foi adicionado ao carrinho!`);
      

      try {
        const whatsTargets = Array.isArray(response?.data?.whatsTargets) ? response.data.whatsTargets : [];
        if (whatsTargets.length > 0) {
          const msg = `Pedido: ${product.nome} x1`;
          Alert.alert(
            'Enviar via WhatsApp',
            'Deseja enviar este pedido por WhatsApp ou imprimir?',
            [
              { text: 'Imprimir', style: 'default' },
              {
                text: 'WhatsApp',
                onPress: async () => {
                  try {
                    const phone = String(whatsTargets[0]).replace(/[^0-9+]/g, '');
                    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                    const can = await Linking.canOpenURL(url);
                    if (can) await Linking.openURL(url);
                    else Alert.alert('Erro', 'Não foi possível abrir o WhatsApp');
                  } catch {
                    Alert.alert('Erro', 'Falha ao abrir o WhatsApp');
                  }
                }
              }
            ]
          );
        }
      } catch {}
      
      console.log('Item adicionado com sucesso via backend');
      
    } catch (error: any) {
      console.error('Erro ao adicionar item no backend:', error);
      
      // Fallback: adiciona localmente se o backend falhar
      console.log('Adicionando item localmente como fallback');
      
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      const isTabletMode = String(clientMode).toLowerCase() === 'tablet';
      setCart(prevCart => {
        const exists = prevCart.find(item => item.produto && item.produto._id === product._id);
        if (exists) {
          return prevCart.map(item => {
            if (item.produto && item.produto._id === product._id) {
              const newQuantity = item.quantidade + 1;
              return {
                ...item,
                quantidade: newQuantity,
                subtotal: ((item.precoUnitario ?? item.produto?.preco ?? 0) * newQuantity)
              };
            }
            return item;
          });
        }
        const newItem: CartItem = {
          _id: `temp_${Date.now()}_${Math.random()}`,
          productId: parseInt(String((product as any)?._id ?? (product as any)?.id ?? 0), 10),
          produto: {
            _id: product._id,
            nome: product.nome,
            preco: product.precoVenda
          },
          nomeProduto: product.nome,
          quantidade: 1,
          precoUnitario: product.precoVenda,
          subtotal: product.precoVenda
        };
        return [...prevCart, newItem];
      });
      
      // Mostra feedback visual de que o item foi adicionado
      Alert.alert('Sucesso', `${product.nome} foi adicionado ao carrinho!`);
    }
  };

  const handleSizeSelect = (size: ProductSize) => {
    setSizeModalVisible(false);
    setSelectedSize(size);

    if (!sizeProduct) return;

    if ((sizeProduct as any)?.temVariacao) {
      setVariationProduct(sizeProduct);
      setVariationVisible(true);
    } else {
      // Add directly with size
      addItemWithSize(sizeProduct, size);
    }
  };

  const addItemWithSize = async (product: Product, size: ProductSize) => {
    if (!sale) return;
    try {
      const itemData: any = {
        produtoId: parseInt(String(product._id || (product as any).id), 10),
        quantidade: 1,
        tamanho: size.nome // Pass size name to API
      };
      
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(clientMode).toLowerCase() === 'tablet') {
        itemData.origem = 'tablet';
      }

      const response = await saleService.addItem(sale._id, itemData);
      setSale(response.data);
      setCart(response.data.itens || []);
      Alert.alert('Sucesso', `${product.nome} (${size.nome}) adicionado!`);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao adicionar produto com tamanho');
    } finally {
      setSizeProduct(null);
      setSelectedSize(null);
    }
  };

  const confirmVariation = async (payload: any) => {
    try {
      if (!sale || !variationProduct) return;
      const itemData: any = {
        produtoId: parseInt(String((variationProduct as any)?._id ?? (variationProduct as any)?.id ?? 0), 10),
        quantidade: 1,
        variacao: payload,
        tamanho: selectedSize?.nome // Include size if selected
      };
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(clientMode).toLowerCase() === 'tablet') itemData.origem = 'tablet';
      const response = await saleService.addItem(sale._id, itemData);
      setSale(response.data);
      setCart(response.data.itens || []);
      Alert.alert('Sucesso', `${variationProduct.nome} foi adicionado com variação!`);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível adicionar com variação');
    } finally {
      setVariationVisible(false);
      setVariationProduct(null);
    }
  };

  const confirmVariationWhole = async () => {
    try {
      if (!sale || !variationProduct) return;
      const itemData: any = {
        produtoId: parseInt(String((variationProduct as any)?._id ?? (variationProduct as any)?.id ?? 0), 10),
        quantidade: 1,
        tamanho: selectedSize?.nome // Include size if selected
      };
      const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
      if (String(clientMode).toLowerCase() === 'tablet') itemData.origem = 'tablet';
      const response = await saleService.addItem(sale._id, itemData);
      setSale(response.data);
      setCart(response.data.itens || []);
      Alert.alert('Sucesso', `${variationProduct.nome} foi adicionado inteiro!`);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível adicionar o produto.');
    } finally {
      setVariationVisible(false);
      setVariationProduct(null);
    }
  };

  // Atualização de item com UI otimista e sem alert no decremento
  const updateCartItem = async (item: CartItem, newQuantity: number) => {
    console.log('[Sale] updateCartItem', { itemId: item._id, from: item.quantidade, to: newQuantity });

    // Resolver produtoId de forma robusta
    const resolveProdutoId = (): string => {
      const pn = (item as any)?.productId;
      if (Number.isInteger(pn) && pn > 0) return String(pn);
      const raw = (item as any)?.produto;
      const pid = (raw && typeof raw === 'object' && raw?._id)
        || (typeof raw === 'string' ? raw : undefined)
        || (item as any)?.produtoId
        || (item as any)?.idProduto
        || '';
      const s = pid ? String(pid) : '';
      const digits = s.match(/\d+/)?.[0] || '';
      return digits;
    };

    let produtoId = resolveProdutoId();
    console.log('[Sale] produtoId resolvido', { produtoId });

    if (!sale) {
      Alert.alert('Erro', 'Venda não encontrada.');
      return;
    }

    if (!produtoId) {
      const fromItemProductId = (item as any)?.productId;
      if (Number.isInteger(fromItemProductId)) {
        produtoId = String(fromItemProductId);
      } else {
        const found = (sale?.itens || []).find((ci: any) =>
          String(ci?._id) === String(item?._id) ||
          String(ci?.id) === String((item as any)?.id) ||
          String(ci?.nomeProduto) === String(item?.nomeProduto)
        );
        const candidate = (found as any)?.productId || (found as any)?.produto?._id || '';
        const digits = String(candidate).match(/\d+/)?.[0] || '';
        if (digits) {
          produtoId = digits;
          console.log('[Sale] produtoId fallback (found)', { produtoId });
        }
      }
      if (!produtoId) {
        Alert.alert('Erro', 'Produto inválido para atualização.');
        return;
      }
    }

    if (sale?.status && sale.status !== 'aberta') {
      Alert.alert('Venda finalizada', 'Não é possível alterar itens desta venda.');
      return;
    }

    if (!/^[0-9]+$/.test(String(produtoId))) {
      const found = (sale?.itens || []).find((ci: any) => String(ci?._id) === String(item?._id));
      const raw = (found as any)?.produto;
      const fb = (raw && typeof raw === 'object' && raw?._id) || (typeof raw === 'string' ? raw : '');
      const digits = String(fb).match(/\d+/)?.[0] || '';
      if (digits) {
        produtoId = digits;
        console.log('[Sale] produtoId fallback', { produtoId });
      } else {
        Alert.alert('Erro', 'Produto inválido para atualização.');
        return;
      }
    }

    // Nunca permitir quantidade negativa
    const clampedQty = Math.max(0, Math.floor(Number(newQuantity) || 0));
    const currentCartItem = cart.find((ci) => ci._id === item._id) || item;
    const currentQty = Math.max(0, Math.floor(Number(currentCartItem.quantidade) || 0));
    const isIncrement = clampedQty > currentQty;
    const isDecrement = clampedQty < currentQty;

    // Snapshot do estado atual para possível reversão
    const prevCart = [...cart];

    const clientMode = await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_MODE);
    const isTabletMode = String(clientMode).toLowerCase() === 'tablet';
    if (clampedQty <= 0) {
      setCart(prev => prev.filter(cartItem => cartItem._id !== item._id));
    } else if (!isTabletMode) {
      setCart(prev => prev.map(cartItem => {
        if (cartItem._id !== item._id) return cartItem;
        const unitPrice = cartItem.precoUnitario ?? cartItem.produto?.preco ?? (cartItem as any)?.produto?.precoVenda ?? 0;
        return {
          ...cartItem,
          quantidade: clampedQty,
          subtotal: unitPrice * clampedQty,
        };
      }));
    }

    let reqSeq = 0;
    try {
      const key = `${String((sale as any)?._id || (sale as any)?.id || '')}:${String(produtoId)}`;
      reqSeq = Date.now();
      latestReqRef.current.set(key, reqSeq);
      let response;
            if (isIncrement) {
              // Unificado: Incremento sempre atualiza a quantidade do item existente
              // Passamos itemId explicitamente para garantir que o backend atualize a linha correta
              const opts = { itemId: Number((item as any)?.id || (item as any)?._id) || undefined };
              
              if (tipo === 'comanda') {
                response = await comandaService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              } else {
                response = await saleService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              }
            } else if (clampedQty <= 0) {
              // Remover item
              console.log('[Sale] remove item', { produtoId });
              const opts = { itemId: Number((item as any)?.id || (item as any)?._id) || undefined };
              
              if (tipo === 'comanda') {
                response = await comandaService.removeItem(sale._id, parseInt(String(produtoId), 10), opts);
              } else {
                response = await saleService.removeItem(sale._id, parseInt(String(produtoId), 10), opts);
              }
            } else if (isDecrement) {
              // Decremento
              console.log('[Sale] decrement to', { quantidade: clampedQty });
              const opts = { itemId: Number((item as any)?.id || (item as any)?._id) || undefined };
              
              if (tipo === 'comanda') {
                response = await comandaService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              } else {
                response = await saleService.updateItemQuantity(sale._id, parseInt(String(produtoId), 10), clampedQty, opts);
              }
            } else {
        // Quantidade igual (nenhuma mudança) ou ajuste direto: sincronizar para garantir consistência
        if (tipo === 'comanda') {
          response = await comandaService.getById(sale._id);
        } else {
          response = await saleService.getById(sale._id);
        }
      }

      // Sincronizar estado local com resposta do backend
      if (response?.data) {
        const latest = latestReqRef.current.get(key);
        if (latest !== reqSeq) {
          console.log('[Sale] resposta obsoleta ignorada', { key, reqSeq, latest });
          return;
        }
        setSale(response.data);
        setCart(response.data.itens || []);
        if (isIncrement) {
          Alert.alert('Sucesso', 'Quantidade incrementada');
        } else if (isDecrement) {
          Alert.alert('Sucesso', 'Quantidade decrementada');
        } else if (clampedQty <= 0) {
          Alert.alert('Sucesso', 'Item removido');
        }
        const updatedItems = response.data.itens || [];
        const updated = updatedItems.find((ci: any) => {
          const raw = (ci as any)?.produto;
          const id = (raw && typeof raw === 'object' && raw?._id) || (typeof raw === 'string' ? raw : '');
          return String(id) === String(produtoId) || String(ci?._id) === String(item?._id);
        });
        const updatedQty = Math.max(0, Math.floor(Number(updated?.quantidade) || 0));
        if (!updated || updatedQty !== clampedQty) {
          try {
            const refreshed = tipo === 'comanda'
              ? await comandaService.getById(sale._id)
              : await saleService.getById(sale._id);
            setSale(refreshed.data);
            setCart(refreshed.data.itens || []);
          } catch {}
        }
      }
    } catch (error: any) {
      const status = error?.response?.status ?? 0;
      const data = error?.response?.data;
      console.error('Erro ao atualizar item:', { status, data });
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível atualizar o item.');
      // Reverter UI para estado anterior
      try {
        const key = `${String((sale as any)?._id || (sale as any)?.id || '')}:${String(produtoId)}`;
        const latest = latestReqRef.current.get(key);
        if (latest === reqSeq) {
          setCart(prevCart);
        }
        const log = { ts: Date.now(), action: 'updateItem', produtoId, desiredQty: clampedQty, status, data };
        try {
          const prev = await AsyncStorage.getItem('SYNC_ERROR_LOG');
          const arr = prev ? JSON.parse(prev) : [];
          const next = Array.isArray(arr) ? [...arr.slice(-19), log] : [log];
          await AsyncStorage.setItem('SYNC_ERROR_LOG', JSON.stringify(next));
        } catch {}
      } catch {}
      // Tentar re-sincronizar com backend
      try {
        if (tipo === 'comanda') {
          const refreshed = await comandaService.getById(sale._id);
          setSale(refreshed.data);
          setCart(refreshed.data.itens || []);
        } else {
          const refreshed = await saleService.getById(sale._id);
          setSale(refreshed.data);
          setCart(refreshed.data.itens || []);
        }
      } catch {}
    }
  };

  const removeFromCart = async (item: CartItem) => {
    if (!sale || !item?.produto?._id) {
      Alert.alert('Erro', 'Venda não encontrada ou item inválido.');
      return;
    }

    const confirmed = await confirmRemoveAlert(`${item.nomeProduto} do carrinho`);
    if (!confirmed) return;

    const produtoId = item.produto._id;

    try {
      let response;
      if (tipo === 'comanda') {
        response = await comandaService.removeItem(sale._id, produtoId);
      } else {
        response = await saleService.removeItem(sale._id, produtoId);
      }

      if (response?.data) {
        setSale(response.data);
        setCart(response.data.itens || []);
      } else {
        setCart(prevCart => prevCart.filter(cartItem => cartItem._id !== item._id));
      }
    } catch (error: any) {
      console.error('Erro ao remover item:', error);
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível remover o item.');
    }
  };

  // Estado específico para loading do botão de finalizar
  const [finalizing, setFinalizing] = useState(false);

  // Helper para calcular itens restantes (Lógica adaptada de PaymentSplitModal)
  const calculateRemainingItemsPayload = (currentSale: any, totalRem: number) => {
      if (!currentSale || !currentSale.itens) return [];

      const paidMap = new Map<string, number>();
      if (currentSale.caixaVendas && Array.isArray(currentSale.caixaVendas)) {
        currentSale.caixaVendas.forEach((cv: any) => {
          let pagos: any[] = [];
          if (Array.isArray(cv.itensPagos)) pagos = cv.itensPagos;
          else if (typeof cv.itensPagos === 'string') { try { pagos = JSON.parse(cv.itensPagos); } catch{} }
          
          pagos.forEach((p: any) => {
            const pid = String(p.id);
            const val = Number(p.paidAmount) || 0;
            paidMap.set(pid, (paidMap.get(pid) || 0) + val);
          });
        });
      }

      let sumItemRemaining = 0;
      const itemsRaw = currentSale.itens.map((item: any) => {
          const itemId = String(item._id || item.id);
          const isStatusPaid = item.status === 'pago';
          const partialPaid = paidMap.get(itemId) || 0;
          const total = Number(item.subtotal);
          const paid = isStatusPaid ? total : Math.min(partialPaid, total);
          const remaining = Math.max(0, total - paid);
          sumItemRemaining += remaining;
          return { id: itemId, remaining, paid };
      });

      // Adicionar Taxa de Entrega se houver e não paga
      const fee = Number(currentSale.deliveryFee || 0);
      if (fee > 0) {
          const feeId = 'delivery-fee';
          const feePaid = paidMap.get(feeId) || 0;
          const feeRemaining = Math.max(0, fee - feePaid);
          if (feeRemaining > 0.00) {
              itemsRaw.push({ id: feeId, remaining: feeRemaining, paid: feePaid });
              sumItemRemaining += feeRemaining;
          }
      }

      // Distribuição de pagamento genérico se houver
      // Se totalRemaining < sumItemRemaining, temos que abater proporcionalmente ou sequencialmente
      // Mas aqui no QuickPay, queremos PAGAR TUDO que falta.
      // Então o payload deve ser exatamente o 'remaining' de cada item.
      
      // Ajuste fino: Se houver discrepância de centavos, confiamos no cálculo local
      
      const payload = itemsRaw
        .filter((i:any) => i.remaining > 0.00)
        .map((i:any) => ({
             id: i.id,
             paidAmount: i.remaining, // Pagar tudo que falta
             fullyPaid: true
        }));
      
      return payload;
  };

  const finalizeSale = async (options?: { silent?: boolean; skipNavigation?: boolean }) => {
    console.log('🔄 FINALIZAR VENDA - Iniciando processo');
    
    if (!sale || cart.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos um item à venda');
      return;
    }

    // Validação Delivery
    if (isDelivery) {
        if (!deliveryAddress) {
            Alert.alert('Erro', 'Informe o endereço de entrega para Delivery.');
            return;
        }
        // Atualizar dados de delivery na venda antes de qualquer coisa
        try {
            setFinalizing(true);
            const deliveryPayload = {
                isDelivery: true,
                deliveryAddress,
                deliveryDistance,
                deliveryFee,
                deliveryStatus: 'pending'
            };
            
            // Usar endpoint especifico ou sale update? 
            // Sale update geral não exposto facil, mas criamos PUT /:id/delivery
            // Mas precisamos chamar via axios direto se nao tiver no service?
            // Adicionamos no sale.js backend. Vamos chamar via api.put
            // Melhor: Adicionei ao sale.js mas preciso chamar.
            // Vou usar axios direto por brevidade ou criar no service?
             // Service não tem `updateDelivery`. Vou usar `api.put`.
             await api.put(`/sale/${sale._id}/delivery`, deliveryPayload);
             
             // If delivery, we DO NOT finalize (close) the sale in the sense of closing connection,
             
             // If delivery, we DO NOT finalize (close) the sale in the sense of closing connection, 
             // but we might want to "Confirmar Entrega" later.
             // The button said "Finalizar Venda".
             // If Delivery: "Despachar" or "Salvar para Entrega".
             // Let's just Save and Go Back.
             
             // Actually, `isDelivery` changes the flow.
             // If `isDelivery`, `finalizeSale` is strictly "Update Delivery Info".
             // The user can then "Confirm Delivery" later from another screen.
             // So I will update delivery info and return.
             
        } catch (e) {
            console.error('Erro ao salvar delivery', e);
            Alert.alert('Erro', 'Falha ao salvar dados de delivery.');
            setFinalizing(false);
            return;
        }
    }

    if (isDelivery) {
        // Enviar atualização de delivery e sair
         try {
             await api.put(`/sale/${sale._id}/delivery`, {
                isDelivery: true,
                deliveryAddress,
                deliveryDistance,
                deliveryFee,
                deliveryStatus: 'pending'
            });
            
            if (options?.skipNavigation) {
                console.log('🔄 Delivery salvo. Mantendo na tela para NFC-e (skipNavigation)');
                return;
            }

            Alert.alert('Sucesso', 'Venda configurada para entrega!');
            router.back();
            return;
         } catch (e) {
             Alert.alert('Erro', 'Falha ao salvar delivery.');
             setFinalizing(false);
             return;
         }
    }

    try {
      setFinalizing(true);
      const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
      const finalizeData = {
        formaPagamento: paymentMethod,
        total: total
      };
      
      let response;
      if (tipo === 'comanda') {
        response = await comandaService.finalize(sale._id, finalizeData);
      } else {
        response = await saleService.finalize(sale._id, finalizeData);
      }
      
      
      // Limpar dados APENAS se não formos pular a navegação (caso do NFC-e)
      if (!options?.skipNavigation) {
          setCart([]);
          setSale(null);
          setNomeResponsavel('');
          setMesa(null);
          setComanda(null);
      }
      setModalVisible(false);

      // Disparar eventos de atualização para outras telas
      events.emit('caixa:refresh');
      events.emit('mesas:refresh');
      events.emit('comandas:refresh');

      if (options?.skipNavigation) {
        console.log('🔄 Finalização (skipNavigation): mantendo na tela para NFC-e...');
        // Não faz nada de navegação/alert, apenas retorna
      } else if (options?.silent) {
        console.log('🔄 Finalização silenciosa: voltando imediatamente...');
        router.back();
      } else {
        // Navegação NÃO BLOQUEANTE (Fire and forget visual)
        console.log('🔄 Voltando para tela anterior imediatamente...');
        router.back();

        // Alerta não bloqueante
        if (Platform.OS === 'web') {
           setTimeout(() => window.alert('Venda finalizada com sucesso!'), 300);
        } else {
           // No mobile, router.back() desmonta a tela. 
           Alert.alert('Sucesso', 'Venda finalizada com sucesso!');
        }
      }
      
    } catch (error: any) {
      console.error('❌ ERRO DETALHADO ao finalizar venda:', error);
      
      let errorMessage = 'Não foi possível finalizar a venda';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else {
        const errMsg = (error && (error as any)?.message) || '';
        if (errMsg) errorMessage = errMsg;
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setFinalizing(false);
    }
  };

  const formatMesaNumero = (numero: number | undefined | null) => {
    if (numero === undefined || numero === null) {
      return '00';
    }
    return numero.toString().padStart(2, '0');
  };

  const totalItems = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalPaid = (sale as any)?.caixaVendas?.reduce((sum: number, cv: any) => sum + Number(cv.valor), 0) || 0;
  const totalRemaining = Math.max(0, totalItems - totalPaid);
  const isFullyPaid = totalItems > 0 && totalRemaining <= 0.01;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  const renderFooter = () => (
    <View style={{ paddingBottom: 100 }}>
      {/* Botões de Ação no Final da Lista */}
      {!isViewMode && cart.length > 0 && (
        <View style={{ gap: 10, padding: 16 }}>
             {/* Botão Delivery */}
             {/* Botão Delivery - Apenas para Balcão (Sem mesa, sem comanda) */}
             {(!mesaId && tipo !== 'comanda' && tipo !== 'mesa') && (
             <TouchableOpacity
                style={{
                    backgroundColor: isDelivery ? '#FF9800' : '#fff',
                    padding: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#FF9800',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8
                }}
                onPress={() => {
                    setIsDelivery(true);
                    setDeliveryModalVisible(true);
                }}
             >
                <Ionicons name="bicycle" size={24} color={isDelivery ? '#fff' : '#FF9800'} />
                <Text style={{ 
                    color: isDelivery ? '#fff' : '#FF9800', 
                    fontWeight: 'bold', 
                    fontSize: 16 
                }}>
                    {isDelivery ? 'Configurar Entrega' : 'Vender como Delivery'}
                </Text>
             </TouchableOpacity>
             )}

            {/* Botão Finalizar Balcão (se não for delivery) */}
            {!isDelivery && (
                <TouchableOpacity
                style={[styles.finalizeButton, { margin: 0 }]}
                onPress={() => setModalVisible(true)}
                >
                <Text style={styles.finalizeButtonText}>
                    Finalizar Venda - R$ {totalRemaining.toFixed(2)}
                </Text>
                </TouchableOpacity>
            )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenIdentifier screenName="Nova Venda" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isViewMode ? 'Visualizar Venda' : 'Nova Venda'}
          </Text>
          {mesa && (
            <Text style={styles.headerSubtitle}>
              Mesa {formatMesaNumero(mesa.numero)} {nomeResponsavel && `- ${nomeResponsavel}`}
            </Text>
          )}
          {sale && tipo === 'comanda' && comanda && (
             <Text style={styles.headerSubtitle}>
               Comanda: {comanda.nomeComanda || comanda.numeroComanda || 'Sem nome'}
             </Text>
           )}
        </View>
        
        <View style={styles.headerRight}>
          {isPhone && !isViewMode && cart.length > 0 && (
            <TouchableOpacity onPress={() => setItemsModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="list" size={18} color="#fff" />
              <Text style={styles.headerRightButtonText}>Ver itens</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <AddProductToTable
          saleItems={isPhone ? [] : cart}
          onAddProduct={addToCart}
          onUpdateItem={(item, newQty) => { updateCartItem(item, newQty); }}
          onRemoveItem={removeFromCart}
          isViewMode={isViewMode}
          hideSaleSection={isPhone}
          ListFooterComponent={renderFooter()}
        />
      </View>




      {isPhone && (
        <SaleItemsModal
          visible={itemsModalVisible}
          items={cart}
          total={totalItems}
          onClose={() => setItemsModalVisible(false)}
          onAddItems={() => setItemsModalVisible(false)}
          onIncrementItem={(item) => updateCartItem(item, item.quantidade + 1)}
          onDecrementItem={(item) => {
            const nextQty = Math.max((item?.quantidade ?? 0) - 1, 0);
            const msg = nextQty <= 0
              ? `Zerar quantidade e remover ${item?.nomeProduto}?`
              : `Diminuir quantidade de ${item?.nomeProduto}?`;
            if ((typeof window !== 'undefined') && (Platform as any)?.OS === 'web' && typeof (window as any).confirm === 'function') {
              const ok = (window as any).confirm(msg);
              if (ok) updateCartItem(item, nextQty);
            } else {
              Alert.alert(
                'Confirmar',
                msg,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'OK', style: 'destructive', onPress: () => updateCartItem(item, nextQty) },
                ]
              );
            }
          }}
          onRemoveItem={removeFromCart}
          onFinalize={() => {
            setItemsModalVisible(false);
            setTimeout(() => setModalVisible(true), 100);
          }}
        />
      )}

      <VariationSelectorModal
        visible={variationVisible}
        product={variationProduct as any}
        onClose={() => { setVariationVisible(false); setVariationProduct(null); }}
        onConfirm={confirmVariation}
        onConfirmWhole={confirmVariationWhole}
        selectedSize={selectedSize}
      />
      
      <SizeSelectorModal
        visible={sizeModalVisible}
        product={sizeProduct}
        onClose={() => setSizeModalVisible(false)}
        onSelectSize={handleSizeSelect}
      />

       <DeliveryDetailsModal
            visible={deliveryModalVisible}
            onClose={() => setDeliveryModalVisible(false)}
            isDelivery={isDelivery}
            setIsDelivery={setIsDelivery}
            deliveryAddress={deliveryAddress}
            setDeliveryAddress={setDeliveryAddress}
            deliveryDistance={deliveryDistance}
            setDeliveryDistance={setDeliveryDistance}
            deliveryFee={deliveryFee}
            setDeliveryFee={setDeliveryFee}
            deliveryCoords={deliveryCoords}
            setDeliveryCoords={setDeliveryCoords}
            companyConfig={companyConfig}
            selectedCliente={selectedCliente}
            onSelectClient={() => setShowClientModal(true)}
            selectedEntregador={selectedEntregador}
            onSelectEntregador={() => setShowEmployeeModal(true)}
            user={user}
            loading={loading}
            GOOGLE_API_KEY={googleMapsKey}
            onConfirm={async () => {
                if(!deliveryAddress) { 
                    Platform.OS === 'web' ? window.alert('Endereço obrigatório') : Alert.alert('Erro', 'Endereço obrigatório'); 
                    return; 
                }
                
                try {
                    setLoading(true);
                    
                    // Robust handling of ID
                    let currentSaleId = (sale as any)?._id || (sale as any)?.id ? String((sale as any)?._id || (sale as any)?.id) : undefined;

                    // Auto-recovery: If no sale ID but items exist, create it
                    if (!currentSaleId && cart.length > 0) {
                        try {
                            const createRes = await saleService.create({ type: 'balcao' });
                            if (createRes.data && (createRes.data._id || createRes.data.id)) {
                                currentSaleId = createRes.data._id || String(createRes.data.id);
                                for (const item of cart) {
                                    const pId = item.productId || ((item.produto as any)?._id || (item.produto as any)?.id);
                                    if (pId) {
                                        await saleService.addItem(currentSaleId, {
                                            produtoId: parseInt(String(pId), 10),
                                            quantidade: item.quantidade
                                        });
                                    }
                                }
                                const freshSale = await saleService.getById(currentSaleId);
                                setSale(freshSale.data);
                            }
                        } catch (syncErr) { console.error('Auto-recovery falhou', syncErr); }
                    }

                    if (!currentSaleId) {
                        const msg = 'Venda não inicializada.';
                        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Erro', msg);
                        setLoading(false);
                        return;
                    }

                    // 1. Atualizar dados de delivery no backend (Sempre acontece primeiro)
                    await saleService.updateDelivery(currentSaleId, {
                        isDelivery: true,
                        deliveryAddress,
                        deliveryDistance,
                        deliveryFee,
                        clienteId: selectedCliente?.id || selectedCliente?._id,
                        entregadorId: selectedEntregador?.id || selectedEntregador?._id,
                        funcionarioId: user?.id
                    });

                    setDeliveryModalVisible(false);

                    // 2. Imprimir Cupom de Entrega AUTOMATICAMENTE (User Request)
                    try {
                        const sid = currentSaleId;
                        const printRes = await api.post(`/sale/${sid}/delivery-print`);
                        if (printRes.data && printRes.data.content) {
                            printHtmlContent(printRes.data.content);
                        }
                    } catch (e) {
                        console.error('Erro impressão entrega:', e);
                        const msg = 'Falha ao imprimir comprovante de entrega.';
                        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Erro', msg);
                    }

                    // 3. Perguntar se deseja pagar AGORA - Via Custom Modal
                    // Remover delay e setar visibilidade do modal
                    setPaymentPromptVisible(true);

                } catch(e: any) {
                    const msg = e.response?.data?.error || e.message || 'Erro ao processar delivery';
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Erro', msg);
                } finally {
                    setLoading(false);
                }
            }}
        />

      <PaymentPromptModal
        visible={paymentPromptVisible}
        onClose={() => setPaymentPromptVisible(false)}
        onYes={() => {
            setPaymentPromptVisible(false);
            setSplitModalVisible(true);
        }}
        onNo={() => {
             setPaymentPromptVisible(false);
             router.replace('/delivery-dashboard'); 
             const sucMsg = 'Entrega lançada! Pagamento pendente.';
             Platform.OS === 'web' ? window.alert(sucMsg) : Alert.alert('Sucesso', sucMsg);
        }}
      />



      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >

        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finalizar Venda</Text>
            <Text style={styles.modalSubtitle}>Total: R$ {totalItems.toFixed(2)}</Text>
            {totalPaid > 0 && (
              <>
                <Text style={[styles.modalSubtitle, { color: '#4CAF50', marginTop: -20 }]}>Pago: R$ {totalPaid.toFixed(2)}</Text>
                <Text style={[styles.modalSubtitle, { color: '#F44336', marginTop: -20 }]}>Falta: R$ {totalRemaining.toFixed(2)}</Text>
              </>
            )}

            {/* Seleção de Cliente no Modal de Finalização - Ocultar se for Mesa */ }
            { tipo !== 'mesa' ? (
             <>
             <Text style={styles.modalLabel}>Cliente:</Text>
             <TouchableOpacity
              style={[
                styles.paymentOption,
                selectedCliente && styles.paymentOptionSelected,
                { marginBottom: 16, justifyContent: 'space-between' }
              ]}
              onPress={() => setShowClientModal(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons 
                    name={selectedCliente ? "person" : "person-outline"} 
                    size={20} 
                    color={selectedCliente ? '#2196F3' : '#666'} 
                />
                <Text style={[
                    styles.paymentOptionText,
                    selectedCliente && styles.paymentOptionTextSelected
                ]}>
                    {selectedCliente ? selectedCliente.nome : 'Selecionar Cliente'}
                </Text>
              </View>
              <Ionicons name="search" size={18} color={selectedCliente ? '#2196F3' : '#999'} />
            </TouchableOpacity>
            </>
            ) : (
                // Exibir apenas o nome do responsável se for mesa
                <View style={{ marginBottom: 16 }}>
                    <Text style={styles.modalLabel}>Responsável pela Mesa:</Text>
                    <View style={[styles.paymentOption, { backgroundColor: '#f5f5f5', borderColor: '#ddd' }]}>
                        <Ionicons name="person" size={20} color="#666" />
                        <Text style={styles.paymentOptionText}>
                            {nomeResponsavel || 'Não informado'}
                        </Text>
                    </View>
                </View>
            )}

            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: '#FF9800', marginBottom: 20, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
              onPress={() => {
                setModalVisible(false);
                setSplitModalVisible(true);
              }}
            >
              <Ionicons name="people" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Dividir / Parcial</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Método de Pagamento (Restante):</Text>
            {paymentMethods.map(method => (
              <TouchableOpacity
                key={method.key}
                style={[
                  styles.paymentOption,
                  paymentMethod === method.key && styles.paymentOptionSelected
                ]}
                onPress={() => setPaymentMethod(method.key)}
              >
                <Ionicons 
                  name={method.icon} 
                  size={20} 
                  color={paymentMethod === method.key ? '#2196F3' : '#666'} 
                />
                <Text style={[
                  styles.paymentOptionText,
                  paymentMethod === method.key && styles.paymentOptionTextSelected
                ]}>
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
            
            {totalRemaining > 0.05 && (
                <Text style={{ textAlign: 'center', color: '#F44336', marginBottom: 10, width: '100%' }}>
                  Para finalizar, o saldo deve ser zero. Clique em "Pagar & Finalizar" para quitar o restante agora.
                </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.confirmButton,
                  // Botão agora sempre habilitado (verde) se houver saldo a pagar ou se já estiver pago
                  { backgroundColor: '#4CAF50' }
                ]}
                disabled={finalizing}
                onPress={async () => {
                  console.log('🔥 BOTÃO FINALIZAR CLICADO!');
                  
                  // Se já está pago, apenas finaliza
                  if (totalRemaining <= 0.05) {
                     console.log('✅ Tudo pago. Finalizando venda...');
                     finalizeSale();
                     return;
                  }

                  if (paymentMethod === 'pix') {
                      setModalVisible(false); // Fecha modal principal
                      setPixModalVisible(true); // Abre modal PIX
                      return;
                  }

                  // Se falta pagar, realiza o pagamento total com o método selecionado e DEPOIS finaliza
                  console.log(`💰 Pagando restante (${totalRemaining}) e finalizando...`);
                  
                  try {
                      setFinalizing(true);
                      
                      if (!sale) {
                        Alert.alert('Erro', 'Venda não identificada.');
                        setFinalizing(false);
                        return;
                      }

                      // 1. Calcular payload de pagamento (todos os itens restantes)
                      const itemsPayload = calculateRemainingItemsPayload(sale, totalRemaining);
                      
                      const payPayload = {
                          paymentInfo: {
                              method: paymentMethod, // Método selecionado no modal
                              totalAmount: totalRemaining
                          },
                          items: itemsPayload
                      };

                      console.log('Enviando pagamento:', payPayload);
                      const saleId = sale._id || (sale as any).id;
                      await saleService.payItems(saleId, payPayload);
                      
                      // 2. Finalizar
                      // Pequeno delay para garantir propciação do pagamento se necessário
                      await finalizeSale();

                  } catch (e: any) {
                      console.error('Erro ao realizar pagamento rápido:', e);
                      const msg = e.response?.data?.error || e.message || 'Erro ao processar pagamento.';
                      Alert.alert('Erro', msg);
                      setFinalizing(false);
                  }
                }}
              >
                {finalizing ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.confirmButtonText}>
                    {totalRemaining <= 0.05 ? 'Finalizar Venda' : `Pagar R$ ${totalRemaining.toFixed(2)} & Finalizar`}
                    </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      <PaymentSplitModal
        visible={splitModalVisible}
        sale={sale}
        onClose={() => setSplitModalVisible(false)}
        onPaymentSuccess={(isFullPayment, wantNfce) => {
           // Recarregar venda sempre para garantir consistência visual imediata
           if (vendaId) {
             if (tipo === 'comanda') loadComandaSale(); else loadSale();
           } else if (mesaId) {
             loadMesaSale();
           }

           // Se quitou tudo, finaliza a venda (fecha status e volta)
           if (isFullPayment) {
             // Força o fechamento do modal antes de prosseguir
             setSplitModalVisible(false);
             
             if (wantNfce && sale) {
                 // Se vai emitir NFC-e, NÃO navega de volta ainda. O modal de NFC-e fará isso ao fechar.
                 finalizeSale({ silent: true, skipNavigation: true }).then(() => {
                    const sid = String((sale as any).id || (sale as any)._id);
                    // Pequeno delay para garantir que o modal split fechou e estado limpou
                    setTimeout(() => {
                        handleEmitNfce(sid).then(() => {
                            // SE FOR DELIVERY, imprimimos o cupom de entrega APÓS a tentativa de NFC-e
                            if (isDelivery) {
                                // Pequeno delay e imprime
                                setTimeout(async () => {
                                    try {
                                        const printRes = await api.post(`/sale/${sid}/delivery-print`);
                                        if (printRes.data && printRes.data.content) {
                                            printHtmlContent(printRes.data.content);
                                        }
                                    } catch(e) { console.error('Erro delivery print pos-nfce', e); }
                                }, 1000);
                            }
                        });
                    }, 200);
                 });
             } else {
                 // Comportamento padrão: finaliza e volta
                 finalizeSale({ silent: true });
                 
                 // Se for delivery mas o usuario NÃO quis NFC-e aqui (mas talvez tenha vindo do fluxo SIM -> Pagamento -> mas mudou ideia?)
                 // Não, se ele veio do fluxo SIM, ele marcou wantNfce no split.
                 // Mas se ele veio do fluxo convencional e pagou? 
                 // Se isDelivery for true, sempre imprimimos entrega ao finalizar?
                 // O fluxo NÃO já foi tratado no onConfirm. 
                 // Portanto, aqui é só se ele veio do botão "Finalizar" normal E acabou sendo delivery (o que nao deve acontecer se o botão sumiu)
                 // O único caso é: Fluxo SIM -> Modal Pagamento -> Finalizou com NFC-e
             }
           }
        }}
      />
      
      <ImpressaoNfceModal
        visible={nfceModalVisible}
        status={nfceStatus}
        message={nfceMessage}
        nfceData={nfceData}
        onClose={() => {
            setNfceModalVisible(false);
            // Ao fechar o modal de NFC-e após sucesso ou erro, volta para a tela anterior (mesas/lista)
            router.back();
        }}
      />

      <Modal
          visible={showClientModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowClientModal(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { height: '80%' }]}>
                  <Text style={styles.modalTitle}>Selecionar Cliente</Text>
                  <TextInput
                      style={[styles.placesInput, { marginBottom: 10 }]}
                      placeholder="Buscar por nome..."
                      value={searchClientQuery}
                      onChangeText={setSearchClientQuery}
                  />
                  {clients.length === 0 && searchClientQuery.length > 2 && (
                       <View>
                           <TouchableOpacity style={{ padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                               onPress={() => {
                                   setRegisterForm({ ...registerForm, nome: searchClientQuery });
                                   setShowRegisterModal(true);
                               }}
                           >
                               <Ionicons name="person-add" size={20} color="#2196F3" style={{ marginRight: 8 }} />
                               <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>Cadastrar Completo: "{searchClientQuery}"</Text>
                           </TouchableOpacity>

                           <TouchableOpacity style={{ padding: 12, backgroundColor: '#FFF3E0', borderRadius: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                               onPress={() => handleUseNameOnly(searchClientQuery)}
                           >
                               <Ionicons name="text" size={20} color="#FF9800" style={{ marginRight: 8 }} />
                               <Text style={{ color: '#FF9800', fontWeight: 'bold' }}>Usar Apenas Nome: "{searchClientQuery}"</Text>
                           </TouchableOpacity>
                       </View>
                  )}
                  <ScrollView>
                      {clients.map(c => (
                          <TouchableOpacity key={c.id || c._id} 
                              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                              onPress={() => handleSelectClient(c)}
                          >
                              <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{c.nome}</Text>
                              {c.endereco && <Text style={{ fontSize: 12, color: '#666' }}>{c.endereco}</Text>}
                          </TouchableOpacity>
                      ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { marginTop: 10 }]} onPress={() => setShowClientModal(false)}>
                      <Text style={styles.cancelButtonText}>Fechar</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      <Modal
          visible={showEmployeeModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEmployeeModal(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { height: '60%' }]}>
                  <Text style={styles.modalTitle}>Selecionar Entregador</Text>
                  <ScrollView>
                      {employees.map(e => (
                          <TouchableOpacity key={e.id || e._id} 
                              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                              onPress={() => handleSelectEntregador(e)}
                          >
                              <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{e.nome}</Text>
                          </TouchableOpacity>
                      ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { marginTop: 10 }]} onPress={() => setShowEmployeeModal(false)}>
                      <Text style={styles.cancelButtonText}>Fechar</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      {/* Modal Cadastro Rápido de Cliente */}
      <Modal
          visible={showRegisterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRegisterModal(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                  <Text style={styles.modalTitle}>Novo Cliente</Text>
                  <ScrollView>
                      <Text style={styles.label}>Nome *</Text>
                      <TextInput 
                          style={styles.placesInput} 
                          value={registerForm.nome}
                          onChangeText={t => setRegisterForm({...registerForm, nome: t})}
                      />
                      
                      <Text style={styles.label}>Whatsapp / Telefone</Text>
                      <TextInput 
                          style={styles.placesInput} 
                          value={registerForm.fone}
                          keyboardType="phone-pad"
                          onChangeText={t => setRegisterForm({...registerForm, fone: t})}
                      />

                      <Text style={styles.label}>CEP (Opcional)</Text>
                      <TextInput 
                          style={styles.placesInput} 
                          placeholder="Digite CEP para buscar"
                          keyboardType="numeric"
                          onBlur={async () => {
                              if (registerForm.endereco?.length > 5) return; // Já tem endereço
                              const c = (registerForm as any).cep?.replace(/\D/g,'');
                              if(c?.length===8) {
                                  try {
                                      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
                                      const d = await r.json();
                                      if(!d.erro) {
                                          setRegisterForm(prev => ({
                                              ...prev,
                                              endereco: `${d.logradouro}, ${d.bairro}`,
                                              cidade: d.localidade,
                                              estado: d.uf
                                          }));
                                      }
                                  } catch {}
                              }
                          }}
                          onChangeText={t => setRegisterForm({...registerForm, cep: t} as any)} 
                      />

                      <Text style={styles.label}>Endereço Completo</Text>
                      <TextInput 
                          style={styles.placesInput} 
                          value={registerForm.endereco}
                          placeholder="Rua, Número, Bairro"
                          onChangeText={t => setRegisterForm({...registerForm, endereco: t})}
                      />

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Cidade</Text>
                              <TextInput 
                                  style={styles.placesInput} 
                                  value={registerForm.cidade}
                                  onChangeText={t => setRegisterForm({...registerForm, cidade: t})}
                              />
                          </View>
                          <View style={{ width: 80 }}>
                              <Text style={styles.label}>UF</Text>
                              <TextInput 
                                  style={styles.placesInput} 
                                  value={registerForm.estado}
                                  onChangeText={t => setRegisterForm({...registerForm, estado: t})}
                              />
                          </View>
                      </View>
                  </ScrollView>

                  <View style={styles.modalButtons}>
                      <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowRegisterModal(false)}>
                          <Text style={styles.cancelButtonText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                          style={[styles.modalButton, styles.confirmButton, registerLoading && { opacity: 0.7 }]} 
                          onPress={handleRegisterClient}
                          disabled={registerLoading}
                      >
                          {registerLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Salvar e Selecionar</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      <PixModal
        visible={pixModalVisible}
        amount={totalRemaining}
        transactionId={sale ? String((sale as any).numeroVenda || (sale as any)._id || (sale as any).id || '').slice(-6) : 'Venda'}
        onClose={() => setPixModalVisible(false)}
        onConfirm={() => {
            setPixModalVisible(false);
            finalizeSale();
        }}
      />
    </SafeAreaView>
  );
}

// Helper para imprimir HTML
const printHtmlContent = (html: string) => {
    if (Platform.OS === 'web') {
        // Open a visible new window for the user to see/print/save as PDF
        const win = window.open('', '_blank', 'width=800,height=600');
        if (win) {
            win.document.write(html);
            win.document.close();
            // Wait for content to load, then print
            setTimeout(() => {
                win.focus();
                win.print();
            }, 500);
        } else {
             window.alert('Por favor, permita pop-ups para visualizar o comprovante.');
        }
    } else {
        // Para mobile nativo, ideal usar expo-print
        // import * as Print from 'expo-print';
        // Print.printAsync({ html });
        console.log('Impressão nativa pendente de implementação. HTML:', html.substring(0, 50) + '...');
        Alert.alert('Impressão', 'Conteúdo enviado para impressão.');
    }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  date: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    color: '#666',
  },
  debugText: {
    fontSize: 10,
    color: 'red',
    textAlign: 'center',
    backgroundColor: '#ffebee',
    padding: 2
  },
  cartList: {
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center'
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  finalizeButton: {
    backgroundColor: '#4CAF50',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  finalizeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finalizeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  paymentOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#f0f8ff',
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  paymentOptionTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  headerRightButton: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerRightButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  deliveryContainer: {
      backgroundColor: '#fff',
      margin: 16,
      marginTop: 0,
      padding: 16,
      borderRadius: 8,
      elevation: 2,
      zIndex: 9000
  },
  deliveryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 0
  },
  deliveryTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  deliveryText: { color: '#666', fontSize: 13, marginTop: 4 },
  deliveryContent: { marginTop: 16 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  placesInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 6,
      height: 40,
      paddingHorizontal: 10,
      backgroundColor: '#f9f9f9'
  },
  miniMap: {
      height: 150,
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 10,
      backgroundColor: '#eee'
  },
  deliveryInfoRow: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 12
  },
  infoBox: {
      flex: 1,
      backgroundColor: '#E3F2FD',
      padding: 10,
      borderRadius: 6,
      alignItems: 'center'
  },
  infoLabel: { fontSize: 12, color: '#1976D2' },
  infoValue: { fontSize: 16, fontWeight: 'bold', color: '#1565C0' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});



