import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import MesasScreen from '../screens/MesasScreen';
import SaleScreen from '../screens/SaleScreen';
import ComandasScreen from '../screens/ComandasScreen';
import SalesHistoryScreen from '../screens/SalesHistoryScreen';
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Navegação por abas para usuários autenticados
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Mesas') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Comandas') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'Histórico') {
            iconName = focused ? 'time' : 'time-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Início' }}
      />
      <Tab.Screen 
        name="Mesas" 
        component={MesasScreen} 
        options={{ title: 'Mesas' }}
      />
      <Tab.Screen 
        name="Comandas" 
        component={ComandasScreen} 
        options={{ title: 'Comandas' }}
      />
      <Tab.Screen 
        name="Histórico" 
        component={SalesHistoryScreen} 
        options={{ title: 'Histórico' }}
      />
    </Tab.Navigator>
  );
};

// Navegação principal
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen 
              name="Sale" 
              component={SaleScreen} 
              options={{
                headerShown: true,
                title: 'Nova Venda',
                headerStyle: { backgroundColor: '#2196F3' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;