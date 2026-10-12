import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { C } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewsEditorScreen from './src/screens/NewsEditorScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import EpaperScreen from './src/screens/EpaperScreen';
import UsersScreen from './src/screens/UsersScreen';

const Stack = createNativeStackNavigator();
const header = { headerStyle: { backgroundColor: C.red }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } };

function Routes() {
  const { user, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={C.red} /></View>;
  return (
    <Stack.Navigator screenOptions={header}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create account' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'జాతియ వార్తలు' }} />
          <Stack.Screen name="NewsEditor" component={NewsEditorScreen} options={({ route }) => ({ title: route.params?.id ? 'Edit news' : 'New news card' })} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review news' }} />
          <Stack.Screen name="Epaper" component={EpaperScreen} options={{ title: 'E-paper' }} />
          <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Team accounts' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer><StatusBar style="light" /><Routes /></NavigationContainer>
    </AuthProvider>
  );
}
