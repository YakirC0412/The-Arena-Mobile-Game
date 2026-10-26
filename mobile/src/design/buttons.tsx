import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/design/app-text';
import { colors, layout, radii, spacing, typeScale } from '@/design/tokens';

type ButtonProps = PressableProps & {
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ disabled, label, style, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...props}
      style={({ pressed }) => [styles.base, styles.primary, disabled && styles.disabled, pressed && styles.pressed, style]}>
      <AppText style={styles.primaryLabel} weight="black">{label}</AppText>
    </Pressable>
  );
}

export function SecondaryButton({ disabled, label, style, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...props}
      style={({ pressed }) => [styles.base, styles.secondary, disabled && styles.disabled, pressed && styles.pressed, style]}>
      <AppText style={styles.secondaryLabel} weight="bold">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.primaryButtonHeight,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.success },
  secondary: { borderWidth: 2, borderColor: colors.accentGold },
  primaryLabel: { color: colors.bg, fontSize: typeScale.button },
  secondaryLabel: { color: colors.accentGold, fontSize: typeScale.button },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
});
