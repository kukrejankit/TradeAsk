import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatProvider } from './src/contexts/ChatContext';
import { AdminProvider } from './src/contexts/AdminContext';
import { registerForPushNotifications } from './src/services/notifications';
import { LandingScreen } from './src/screens/LandingScreen';
import { AskScreen } from './src/screens/AskScreen';
import { ExpertScreen } from './src/screens/ExpertScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import type { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    registerForPushNotifications().catch(console.error);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ChatProvider>
          <AdminProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Landing" component={LandingScreen} />
                <Stack.Screen name="Ask" component={AskScreen} />
                <Stack.Screen name="Expert" component={ExpertScreen} />
                <Stack.Screen name="Admin" component={AdminScreen} />
                <Stack.Screen name="Documents" component={DocumentsScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </AdminProvider>
        </ChatProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
