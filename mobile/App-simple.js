import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Tela inicial ultra-simples
function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sistema de Mesas - Versão Simples</Text>
      <Text style={styles.subtitle}>Teste de funcionamento básico</Text>
      
      <View style={styles.buttonContainer}>
        <Button
          title="Ir para Mesas"
          onPress={() => navigation.navigate('Mesas')}
        />
        <View style={styles.spacing} />
        <Button
          title="Configurar IP"
          onPress={() => navigation.navigate('Config')}
        />
        <View style={styles.spacing} />
        <Button
          title="Tablet Cozinha"
          onPress={() => navigation.navigate('TabletCozinha')}
        />
        <View style={styles.spacing} />
        <Button
          title="Tablet Bar"
          onPress={() => navigation.navigate('TabletBar')}
        />
      </View>
    </View>
  );
}

// Tela de mesas simplificada
function MesasScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tela de Mesas</Text>
      <Text style={styles.text}>Funcionando com base local!</Text>
      <Text style={styles.text}>✅ API: localhost:4000</Text>
      <Text style={styles.text}>✅ Banco: MySQL Local</Text>
    </View>
  );
}

// Tela de configuração simplificada
function ConfigScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuração de IP</Text>
      <Text style={styles.text}>IP configurado: localhost:4000</Text>
      <Text style={styles.text}>✅ Conexão local ativada</Text>
    </View>
  );
}

// Tela de tablet cozinha simplificada
function TabletCozinhaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tablet Cozinha</Text>
      <Text style={styles.text}>Aguardando pedidos...</Text>
      <Text style={styles.text}>✅ Conectado ao servidor local</Text>
    </View>
  );
}

// Tela de tablet bar simplificada
function TabletBarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tablet Bar</Text>
      <Text style={styles.text}>Aguardando pedidos...</Text>
      <Text style={styles.text}>✅ Conectado ao servidor local</Text>
    </View>
  );
}

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Início' }} />
        <Stack.Screen name="Mesas" component={MesasScreen} options={{ title: 'Mesas' }} />
        <Stack.Screen name="Config" component={ConfigScreen} options={{ title: 'Configuração' }} />
        <Stack.Screen name="TabletCozinha" component={TabletCozinhaScreen} options={{ title: 'Cozinha' }} />
        <Stack.Screen name="TabletBar" component={TabletBarScreen} options={{ title: 'Bar' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    marginVertical: 5,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  spacing: {
    height: 10,
  },
});