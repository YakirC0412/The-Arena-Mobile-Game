import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { ArenaLogo, BrandBackground } from '@/design/brand';
import { colors, spacing, typeScale } from '@/design/tokens';
import { useReducedMotion } from '@/design/use-reduced-motion';
import { NumberOneBadge } from './number-one-badge';

const NATIVE = Platform.OS !== 'web';
const CELLS = 16;
const CELL_STEP_MS = 75;
const TOTAL_MS = 2900;

// A short opening before the welcome or home screen: the logo lands with a
// shockwave of light, the 16 arena cells light up as a loading bar, and the
// tagline "BE THE ① TO CONQUER THE ARENA" appears. Not skippable.
export function IntroScreen({ greeting, onDone }: { greeting?: string; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const logoSize = Math.min(280, Math.max(190, width * 0.66));
  const reducedMotion = useReducedMotion();
  const [logoIn] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));
  const [badge] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(1));
  const [cells] = useState(() => Array.from({ length: CELLS }, () => new Animated.Value(0)));
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const fadeMs = reducedMotion ? 120 : 280;
    Animated.timing(exit, { toValue: 0, duration: fadeMs, useNativeDriver: NATIVE }).start();
    // Move on with a plain timer, not the animation's end callback: that callback
    // waits for animation frames, which a backgrounded page never draws.
    setTimeout(onDone, fadeMs + 20);
  };

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('THE ARENA. Be the one to conquer the arena');
    if (reducedMotion) {
      [logoIn, glow, ring, tagline, badge, ...cells].forEach((value) => value.setValue(1));
      const timer = setTimeout(finish, 1400);
      return () => clearTimeout(timer);
    }

    const sequence = Animated.parallel([
      // Logo drops in and settles with a small overshoot.
      Animated.timing(logoIn, { toValue: 1, duration: 750, easing: Easing.out(Easing.back(1.6)), useNativeDriver: NATIVE }),
      // The glow behind it breathes up as it lands.
      Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
      // A ring of light expands from the logo at the moment of impact.
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      ]),
      // Tagline, then the 16 cells light up one by one.
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(tagline, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
      ]),
      // The "1" coin spins in just after the words.
      Animated.sequence([
        Animated.delay(1050),
        Animated.timing(badge, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: NATIVE }),
      ]),
      Animated.stagger(CELL_STEP_MS, cells.map((value) => (
        Animated.sequence([
          Animated.delay(900),
          Animated.timing(value, { toValue: 1, duration: 180, useNativeDriver: NATIVE }),
        ])
      ))),
    ]);
    sequence.start();
    const timer = setTimeout(finish, TOTAL_MS);
    return () => {
      sequence.stop();
      clearTimeout(timer);
    };
    // Runs once per mount; finish is stable enough through doneRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const ringSize = logoSize * 0.95;

  return (
    <BrandBackground>
      <View accessibilityLabel="פתיח המשחק" style={styles.fill}>
        <Animated.View style={[styles.stage, { opacity: exit }]}>
          <View style={[styles.logoStage, { width: logoSize, height: logoSize }]}>
            <Animated.View
              style={[
                styles.glow,
                {
                  width: logoSize * 0.9,
                  height: logoSize * 0.9,
                  borderRadius: logoSize,
                  opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
                  transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize,
                  opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }),
                  transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] }) }],
                },
              ]}
            />
            <Animated.View
              style={{
                opacity: logoIn.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateY: logoIn.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
                  { scale: logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
                ],
              }}>
              <ArenaLogo size={logoSize} />
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.taglineBlock,
              {
                opacity: tagline,
                transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}>
            <View accessibilityLabel="Be the one" style={styles.taglineRow}>
              <Text style={styles.taglineEnglish} weight="black">BE THE</Text>
              <NumberOneBadge appear={badge} />
            </View>
            <Text numberOfLines={1} style={styles.taglineEnglish} weight="black">
              TO CONQUER THE ARENA
            </Text>
            {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
          </Animated.View>

          <View accessibilityLabel="טוען" accessibilityRole="progressbar" style={styles.cells}>
            {cells.map((value, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.cell,
                  {
                    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                    transform: [{ scale: value.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.8, 1.25, 1] }) }],
                  },
                ]}
              />
            ))}
          </View>

        </Animated.View>
      </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  logoStage: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    backgroundColor: colors.brandBlue,
    shadowColor: colors.brandSky,
    shadowOpacity: 1,
    shadowRadius: 60,
  },
  ring: { position: 'absolute', borderWidth: 3, borderColor: colors.brandSky },
  taglineBlock: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.xs },
  // Sized so 'TO CONQUER THE ARENA' fits one line on a 360 px wide phone.
  taglineEnglish: {
    color: colors.textPrimary,
    fontSize: 21,
    letterSpacing: 2,
    textAlign: 'center',
    writingDirection: 'ltr',
    textShadowColor: colors.brandBlue,
    textShadowRadius: 14,
  },
  // Keep the English line left-to-right inside the RTL app.
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  greeting: { color: colors.textSecondary, fontSize: typeScale.body, textAlign: 'center', marginTop: spacing.xs },
  cells: { flexDirection: 'row', gap: 5, marginTop: spacing.xl },
  cell: { width: 12, height: 12, borderRadius: 3, backgroundColor: colors.brandSky },
});
