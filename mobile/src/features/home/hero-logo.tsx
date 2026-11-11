import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ArenaLogo } from '@/design/brand';
import { colors } from '@/design/tokens';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

// The front door of the game: the logo (the arena with its 16 contestants) big, on a pool of light, floating gently.
// The float stops when the phone asks for reduced motion.
export function HeroLogo({ maxSize = 300 }: { maxSize?: number }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 56, maxSize);
  const reduceMotion = useReducedMotion();
  const [float] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      float.setValue(0);
      return undefined;
    }
    const native = Platform.OS !== 'web';
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 3200, easing: ease, useNativeDriver: native }),
      Animated.timing(float, { toValue: 0, duration: 3200, easing: ease, useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float, reduceMotion]);

  return (
    <View style={[styles.stage, { width: size, height: size * 0.92 }]}>
      <View pointerEvents="none" style={[styles.glow, { width: size * 0.7, height: size * 0.5, shadowRadius: size * 0.23 }]} />
      <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [3, -7] }) }] }}>
        <ArenaLogo size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  // A soft pool of light behind the logo (colour of the logo's own blue).
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.brandBlue,
    opacity: 0.35,
    shadowColor: colors.brandSky,
    shadowOpacity: 0.7,
    shadowRadius: 70,
    shadowOffset: { width: 0, height: 12 },
  },
});
