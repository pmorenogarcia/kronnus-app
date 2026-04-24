import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import { Barlow_400Regular, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/contexts';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const firstSegment = segments[0];

  useEffect(() => {
    if (isLoading) return;
    const inTabsGroup = firstSegment === '(tabs)';

    if (!isAuthenticated && inTabsGroup) {
      router.replace('/login');
    } else if (isAuthenticated && !inTabsGroup) {
      router.replace('/(tabs)/');
    }
  }, [isAuthenticated, isLoading, firstSegment]);

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
    </Stack>
  );
}

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'BarlowCondensed-Bold': BarlowCondensed_700Bold,
    'BarlowCondensed-ExtraBold': BarlowCondensed_800ExtraBold,
    'BarlowCondensed-Black': BarlowCondensed_900Black,
    'Barlow-Regular': Barlow_400Regular,
    'Barlow-SemiBold': Barlow_600SemiBold,
    'SpaceMono-Regular': SpaceMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
