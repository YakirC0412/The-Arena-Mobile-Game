import type { TextProps } from 'react-native';
import { Platform, StyleSheet, Text as NativeText } from 'react-native';

import { colors, fontFamilies } from '@/design/tokens';

type TextWeight = keyof typeof fontFamilies;

export type AppTextProps = TextProps & {
  weight?: TextWeight;
};

function inferWeight(style: TextProps['style']): TextWeight {
  const fontWeight = StyleSheet.flatten(style)?.fontWeight;
  const numericWeight = typeof fontWeight === 'number'
    ? fontWeight
    : Number.parseInt(fontWeight ?? '400', 10);
  // Reserve the black face for the few headings that request it explicitly.
  // Regular 900 declarations use the calmer bold face across the game UI.
  if (numericWeight >= 850) return 'bold';
  if (numericWeight >= 650) return 'bold';
  if (numericWeight >= 500) return 'medium';
  return 'regular';
}

export function AppText({ style, weight, ...props }: AppTextProps) {
  const resolvedWeight = weight ?? inferWeight(style);
  return (
    <NativeText
      accessibilityLanguage="he"
      maxFontSizeMultiplier={1.3}
      {...(Platform.OS === 'web' ? { lang: 'he' } : {})}
      {...props}
      style={[styles.base, { fontFamily: fontFamilies[resolvedWeight] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.textPrimary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
