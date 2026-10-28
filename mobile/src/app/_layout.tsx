import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_700Bold,
  Heebo_900Black,
  useFonts,
} from '@expo-google-fonts/heebo';
import { DarkTheme, LocaleProvider, Redirect, Stack, ThemeProvider, useSegments } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { colors } from '@/design/tokens';

// One brand gradient behind every screen; screens draw on transparent.
const BACKGROUND = [colors.brandNavyDeep, colors.brandNavy, colors.brandNavyDeep] as const;
// The navigator paints its own (light gray) background unless told otherwise.
const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.screen, card: colors.screen },
};

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

  // QA screens live in the (dev) route group and are hidden from production builds.
  if (!__DEV__ && (segments as string[]).includes('(dev)')) {
    return <Redirect href="/" />;
  }

  return (
    <LocaleProvider direction="rtl">
      <LinearGradient colors={BACKGROUND} locations={[0, 0.55, 1]} style={styles.fill}>
        <ThemeProvider value={NAVIGATION_THEME}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: styles.transparent }} />
        </ThemeProvider>
      </LinearGradient>
    </LocaleProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  transparent: { backgroundColor: colors.screen },
});
