import React from 'react';
import { Image, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { Loading, headerStyle } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PasswordScreen from './src/screens/PasswordScreen';
import StudioScreen from './src/screens/StudioScreen';
import ImportsScreen from './src/screens/ImportsScreen';
import ImportPaperScreen from './src/screens/ImportPaperScreen';
import NewsCutScreen from './src/screens/NewsCutScreen';

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
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'జాతియ వార్తలు Studio', headerTitle: () => <BrandTitle title={'జాతియ వార్తలు Studio'} /> }} />
          {/* No iOS swipe-back here: dragging stories near the left edge would leave the studio. */}
          <Stack.Screen name="Studio" component={StudioScreen} options={{ title: 'Layout studio', gestureEnabled: false }} />
          <Stack.Screen name="Imports" component={ImportsScreen} options={{ title: 'Upload newspaper' }} />
          <Stack.Screen name="ImportPaper" component={ImportPaperScreen} options={({ route }) => ({ title: route.params?.title || 'Imported paper' })} />
          <Stack.Screen name="NewsCut" component={NewsCutScreen} options={({ route }) => ({ title: route.params?.id ? 'Edit news cut' : 'New news cut' })} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My profile' }} />
          <Stack.Screen name="Password" component={PasswordScreen} options={{ title: 'Change password' }} />
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
