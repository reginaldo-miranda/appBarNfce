import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

async function isSecureStoreAvailable() {
  try {
    return await SecureStore.isAvailableAsync?.();
  } catch (_e) {
    return false;
  }
}

export async function setSecureItem(key, value) {
  const available = await isSecureStoreAvailable();
  if (available) {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (e) {
      console.warn('SecureStore setItemAsync falhou, fallback AsyncStorage:', e?.message || e);
    }
  }
  await AsyncStorage.setItem(key, value);
  return true;
}

export async function getSecureItem(key) {
  const available = await isSecureStoreAvailable();
  if (available) {
    try {
      const v = await SecureStore.getItemAsync(key);
      if (v != null) return v;
    } catch (e) {
      console.warn('SecureStore getItemAsync falhou, fallback AsyncStorage:', e?.message || e);
    }
  }
  return await AsyncStorage.getItem(key);
}

export async function deleteSecureItem(key) {
  const available = await isSecureStoreAvailable();
  if (available) {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (e) {
      console.warn('SecureStore deleteItemAsync falhou, fallback AsyncStorage:', e?.message || e);
    }
  }
  await AsyncStorage.removeItem(key);
  return true;
}

// Chaves padronizadas
export const STORAGE_KEYS = {
  API_BASE_URL: 'API_BASE_URL',
  API_AUTH_KEY: 'API_AUTH_KEY',
  WIFI_SSID: 'WIFI_SSID',
  WIFI_PASSWORD: 'WIFI_PASSWORD',
  AUTH_TOKEN: 'authToken',
  API_TIMEOUT_MS: 'API_TIMEOUT_MS',
  DB_TARGET: 'DB_TARGET',
  CLIENT_MODE: 'CLIENT_MODE',
};