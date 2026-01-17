import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SafeIconProps {
  name: string;
  size?: number;
  color?: string;
  fallbackText?: string;
  style?: StyleProp<TextStyle>;
}

// SafeIcon estável: sempre usa Ionicons em todas as plataformas.
// Se houver qualquer falha inesperada, cai para texto simples como fallback.
export function SafeIcon({ name, size = 24, color = '#000', fallbackText, style }: SafeIconProps) {
  try {
    return <Ionicons name={name as any} size={size} color={color} style={style as any} />;
  } catch (error) {
    return (
      <Text style={[{ fontSize: size, lineHeight: size, color }, style as any]}>
        {fallbackText || '•'}
      </Text>
    );
  }
}
