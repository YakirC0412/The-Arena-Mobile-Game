import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/design/app-text';
import { colors, layout, radii, spacing, typeScale } from '@/design/tokens';

// Shared pieces for screens in the logo's navy / light-blue identity.

const BACKGROUND = [colors.brandNavyDeep, colors.brandNavy, colors.brandNavyDeep] as const;
const LOGO = require('../../assets/app/arena-logo.webp');

export function BrandBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={BACKGROUND} locations={[0, 0.55, 1]} style={styles.fill}>
      <SafeAreaView style={styles.fill}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

export function ArenaLogo({ size }: { size: number }) {
  return (
    <Image
      accessibilityLabel="THE ARENA – הזירה"
      accessibilityRole="image"
      resizeMode="contain"
      source={LOGO}
      style={{ width: size, height: size }}
    />
  );
}

type BrandButtonProps = PressableProps & {
  label: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
};

export function BrandPrimaryButton({ disabled, icon, label, style, ...props }: BrandButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...props}
      style={({ pressed }) => [styles.button, styles.primary, disabled && styles.disabled, pressed && styles.pressed, style]}>
      <View style={styles.buttonRow}>
        {icon ? <AppText style={styles.primaryLabel} weight="black">{icon}</AppText> : null}
        <AppText style={styles.primaryLabel} weight="black">{label}</AppText>
      </View>
    </Pressable>
  );
}

export function BrandSecondaryButton({ disabled, icon, label, style, ...props }: BrandButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...props}
      style={({ pressed }) => [styles.button, styles.secondary, disabled && styles.disabled, pressed && styles.pressed, style]}>
      <View style={styles.buttonRow}>
        {icon ? <AppText style={styles.secondaryLabel} weight="bold">{icon}</AppText> : null}
        <AppText style={styles.secondaryLabel} weight="bold">{label}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  button: {
    minHeight: layout.primaryButtonHeight,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  primary: {
    backgroundColor: colors.brandSky,
    shadowColor: colors.brandSky,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  secondary: { borderWidth: 2, borderColor: colors.brandSky, backgroundColor: colors.brandSkySoft },
  primaryLabel: { color: colors.brandInk, fontSize: typeScale.button, textAlign: 'center' },
  secondaryLabel: { color: colors.textPrimary, fontSize: typeScale.button, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
});
