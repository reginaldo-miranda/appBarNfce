import { Platform } from 'react-native';

export const FontConfig = {
  timeout: Platform.OS === 'web' ? 3000 : 6000,
  
  systemFonts: Platform.select({
    web: {
      sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      serif: 'Georgia, "Times New Roman", serif',
      mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    ios: {
      sans: 'system-ui',
      serif: 'ui-serif',
      mono: 'ui-monospace',
    },
    android: {
      sans: 'Roboto',
      serif: 'serif',
      mono: 'monospace',
    },
    default: {
      sans: 'sans-serif',
      serif: 'serif',
      mono: 'monospace',
    },
  }),
};

export const getFontFamily = (type: 'sans' | 'serif' | 'mono' = 'sans') => {
  return FontConfig.systemFonts?.[type] || FontConfig.systemFonts?.sans || 'sans-serif';
};