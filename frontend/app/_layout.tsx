// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { AppProvider, useApp } from '../src/contexts/AppContext';
import { colors } from '../src/theme';

function RootGate() {
  const { isAuthenticated, isBootstrapping } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isBootstrapping) return;
    const inAuth = segments[0] === 'login' || segments[0] === undefined;
    if (!isAuthenticated && !inAuth) {
      router.replace('/login');
    } else if (isAuthenticated && (segments[0] === 'login' || segments.length === 0)) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isBootstrapping, segments, router]);

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <RootGate />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
