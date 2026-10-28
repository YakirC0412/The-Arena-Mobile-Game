import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { colors } from '@/design/tokens';

// A glossy 3D coin with an extruded "1", built from layered views so it
// needs no image or SVG: a bevelled rim gradient, a recessed face, a gloss
// highlight, and the numeral stacked in darker copies to look raised.
// `appear` (0 → 1) drives a spin-and-pop entrance.

const SIZE = 58;
const DEPTH = 5;
const RIM = ['#E3F4FF', colors.brandSky, colors.brandBlue, '#0A2A80'] as const;
const FACE = ['#3D8BFF', colors.brandBlue, '#0B2A86'] as const;
// Extrusion layers, from the back (darkest) toward the front.
const EXTRUSION = ['#04112F', '#071A4D', '#0A2470', '#0D2F8F', '#123C9E'];

export function NumberOneBadge({ appear }: { appear: Animated.Value }) {
  return (
    <Animated.View
      accessibilityLabel="ONE"
      style={[
        styles.shadow,
        {
          opacity: appear.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: appear.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0.2, 1.18, 1] }) },
            { rotate: appear.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '-8deg'] }) },
          ],
        },
      ]}>
      <LinearGradient colors={RIM} end={{ x: 0.8, y: 1 }} start={{ x: 0.2, y: 0 }} style={styles.rim}>
        <LinearGradient colors={FACE} end={{ x: 0.3, y: 1 }} start={{ x: 0.7, y: 0 }} style={styles.face}>
          <View style={styles.numeral}>
            {EXTRUSION.map((color, index) => (
              <Text
                key={color}
                style={[
                  styles.digit,
                  styles.layer,
                  { color, transform: [{ translateX: DEPTH - index }, { translateY: DEPTH - index }] },
                ]}
                weight="black">
                1
              </Text>
            ))}
            <Text style={[styles.digit, styles.front]} weight="black">1</Text>
          </View>
          <View pointerEvents="none" style={styles.gloss} />
        </LinearGradient>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    shadowColor: colors.brandSky,
    shadowOpacity: 0.85,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  rim: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  face: {
    flex: 1,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(4, 17, 47, 0.6)',
  },
  numeral: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 34, lineHeight: 40, textAlign: 'center', writingDirection: 'ltr' },
  layer: { position: 'absolute', left: 0, right: 0, top: 0 },
  front: {
    color: colors.textPrimary,
    textShadowColor: 'rgba(124, 203, 255, 0.9)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
  gloss: {
    position: 'absolute',
    top: -SIZE * 0.32,
    left: -SIZE * 0.1,
    right: -SIZE * 0.1,
    height: SIZE * 0.62,
    borderRadius: SIZE,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
