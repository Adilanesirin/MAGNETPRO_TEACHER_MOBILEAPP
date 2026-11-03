import AsyncStorage from '@react-native-async-storage/async-storage';
import NoNetworkScreen from '@/components/NoNetworkScreen';
import * as Network from 'expo-network';
import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Default to offline until the native check confirms a usable connection.
  // This prevents an authenticated tab from flashing stale content at startup.
  const [isOnline, setIsOnline] = useState(false);
  const [retryingNetwork, setRetryingNetwork] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    AsyncStorage.getItem('magnetpro_user').then((user) => {
      setIsLoggedIn(!!user);
      setChecking(false);
    });
  }, [pathname]);

  const updateNetworkStatus = (state: Network.NetworkState) => {
    // A network connection alone is not enough: it must be able to reach the internet.
    setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
  };

  const checkNetwork = async () => {
    setRetryingNetwork(true);
    try {
      updateNetworkStatus(await Network.getNetworkStateAsync());
    } catch {
      setIsOnline(false);
    } finally {
      setRetryingNetwork(false);
    }
  };

  useEffect(() => {
    checkNetwork();
    const subscription = Network.addNetworkStateListener(updateNetworkStatus);
    return () => subscription.remove();
  }, []);

  if (checking) {
    return null;
  }

  // The login form must remain available offline. All authenticated content is
  // hidden when connectivity is unavailable so stale data is never displayed.
  const isLoginScreen = pathname.startsWith('/login');
  if (isLoggedIn && !isLoginScreen && isOnline === false) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="dark" />
        <NoNetworkScreen onTryAgain={checkNetwork} retrying={retryingNetwork} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {!isLoggedIn && !pathname.startsWith('/login') && <Redirect href="/login" />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
