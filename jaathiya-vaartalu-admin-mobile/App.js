import React from 'react';
import { Image, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { Loading, headerStyle } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewsEditorScreen from './src/screens/NewsEditorScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import UsersScreen from './src/screens/UsersScreen';

const Stack = createNativeStackNavigator();
// Logo mark beside the title on the home screen.
const BrandTitle = ({ title }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Image source={require('./assets/mark.png')} style={{ width: 32, height: 32, marginRight: 10, backgroundColor: '#fff', borderRadius: 8 }} resizeMode="contain" />
    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{title}</Text>
  </View>
);

function Routes() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'జాతియ వార్తలు Desk', headerTitle: () => <BrandTitle title={'జాతియ వార్తలు Desk'} /> }} />
          <Stack.Screen name="NewsEditor" component={NewsEditorScreen} options={({ route }) => ({ title: route.params?.id ? 'Edit news' : 'New news card' })} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review news' }} />
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
