import { Platform, PermissionsAndroid } from 'react-native';

let WifiManager = null;

async function ensureWifiLib() {
  if (WifiManager) return WifiManager;
  try {
    // Lazy require para evitar erro no Web/Expo Go
    WifiManager = require('react-native-wifi-reborn').default || require('react-native-wifi-reborn');
  } catch (_e) {
    WifiManager = null;
  }
  return WifiManager;
}

async function requestAndroidWifiPermissions() {
  if (Platform.OS !== 'android') return true;

  const perms = [];
  // Localização necessária para varredura de WiFi em Android < 13
  perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  // Android 13+ exige NEARBY_WIFI_DEVICES
  if (PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES) {
    perms.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
  }

  const results = await PermissionsAndroid.requestMultiple(perms);
  return Object.values(results).every((res) => res === PermissionsAndroid.RESULTS.GRANTED);
}

export async function scanWifiNetworks() {
  // Web/iOS não suportam varredura; retorna lista vazia e UI deverá permitir SSID manual
  if (Platform.OS !== 'android') {
    return [];
  }

  const ok = await requestAndroidWifiPermissions();
  if (!ok) throw new Error('Permissões de WiFi negadas.');

  const lib = await ensureWifiLib();
  if (!lib?.reScanAndLoadWifiList && !lib?.loadWifiList) {
    // Biblioteca não disponível (Expo Go / sem prebuild)
    return [];
  }

  try {
    const list = (await (lib.reScanAndLoadWifiList?.() || lib.loadWifiList?.())) || [];
    // Normalizar saída
    return list.map((item) => ({
      ssid: item?.SSID || item?.ssid || '',
      signal: item?.level ?? undefined,
      security: item?.capabilities || item?.capabilitiesString || undefined,
    })).filter((n) => n.ssid);
  } catch (_e) {
    // Falha na leitura -> retorna vazio para permitir fluxo manual
    return [];
  }
}

export async function connectToWifi(ssid, password) {
  if (!ssid) throw new Error('SSID é obrigatório.');
  if (Platform.OS !== 'android') {
    // Em web/iOS, apenas simula salvamento; conexão real não suportada
    await new Promise((r) => setTimeout(r, 400));
    return { success: true, ssid };
  }
  const ok = await requestAndroidWifiPermissions();
  if (!ok) throw new Error('Permissões de WiFi negadas.');
  const lib = await ensureWifiLib();
  if (!lib?.connectToProtectedSSID) {
    // Sem biblioteca nativa (Expo Go / sem prebuild)
    await new Promise((r) => setTimeout(r, 400));
    return { success: true, ssid };
  }
  await lib.connectToProtectedSSID(ssid, password, false);
  return { success: true, ssid };
}

export async function isWifiConnectionRealPossible() {
  // Conexão real só é possível em Android nativo com biblioteca disponível
  if (Platform.OS !== 'android') return false;
  const lib = await ensureWifiLib();
  return !!(lib && lib.connectToProtectedSSID);
}