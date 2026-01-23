import React from 'react';
import { View, Text } from 'react-native';

export default function DebugScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: 'blue', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 40, color: 'white', fontWeight: 'bold' }}>
        CONEXÃO OK
      </Text>
      <Text style={{ fontSize: 20, color: 'white', marginTop: 20 }}>
        Se você vê isso, o código novo está funcionando.
      </Text>
    </View>
  );
}
