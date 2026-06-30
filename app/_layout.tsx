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
    const inAuthScreen = firstSegment === 'login' || firstSegment === 'register';

    if (!isAuthenticated && inTabsGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, firstSegment]);

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen
        name="create-session"
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="session-setup"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="join-session"
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="waiting-room"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="register"
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="camera-scrubber"
        options={{ headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="contact"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
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
