import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_700Bold,
  Heebo_900Black,
  useFonts,
} from '@expo-google-fonts/heebo';
import { LocaleProvider, Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const segments = useSegments();
  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Heebo_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  if (!__DEV__ && String(segments[0] ?? '').startsWith('qa-')) {
    return <Redirect href="/" />;
  }

  return (
    <LocaleProvider direction="rtl">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </LocaleProvider>
  );
}
