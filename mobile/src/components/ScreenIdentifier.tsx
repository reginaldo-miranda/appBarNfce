import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ScreenIdentifierProps {
  screenName: string;
  isDev?: boolean;
}

const ScreenIdentifier: React.FC<ScreenIdentifierProps> = ({ 
  screenName, 
  isDev = __DEV__ 
}) => {
  // Só mostra em modo de desenvolvimento
  if (!isDev) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{screenName}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ScreenIdentifier;