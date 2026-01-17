import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TabletCozinhaScreen from '../screens/TabletCozinhaScreen';
import TabletBarScreen from '../screens/TabletBarScreen';

const Tab = createBottomTabNavigator();

export default function TabletNavigation() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ff6b6b',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Cozinha"
        component={TabletCozinhaScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Bar"
        component={TabletBarScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wine" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
  );
}