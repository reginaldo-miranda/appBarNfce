import React from 'react';
import { View, Text } from 'react-native';

export const Marker = (props: any) => null;
export const Polyline = (props: any) => null;
export const Circle = (props: any) => null;

const MapView = (props: any) => (
  <View style={[props.style, { backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' }]}>
    <Text style={{ color: '#666', fontWeight: '500' }}>Mapa indisponível na Web</Text>
    {props.children}
  </View>
);

export default MapView;
