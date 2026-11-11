import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { colors, fontFamilies, radii, spacing, typeScale } from '@/design/tokens';
import { remainingMs } from '@/game/duel';
import type { DuelSide, DuelState } from '@/game/duel';

export type BattleRole = DuelSide;

// Something just happened to this side's clock: a skip (the -3 s penalty) or a right answer. `key` changes on every event,
// so two skips in a row both animate.
export type ClockEvent = { key: number; kind: 'skip' | 'correct' } | null;

type BattleClockCardsProps = {
  // The duel state machine (game/duel.ts) is the single source of truth; these cards only show it.
  duel: DuelState;
  attackerAvatar: string;
  attackerBonus: boolean;
  // Time the side started with (ms): the bar under the numerals shows how much of it is left.
  attackerTotalMs: number;
  attackerEvent?: ClockEvent;
  attackerLabel: string;
  // Short screens (iPhone with the keyboard up): a flatter card so the picture keeps its room.
  compact?: boolean;
  defenderAvatar: string;
  defenderBonus: boolean;
  defenderTotalMs: number;
  defenderEvent?: ClockEvent;
  defenderLabel: string;
  onDangerTick?: () => void;
};

function formatClock(milliseconds: number): string {
  return (Math.max(0, milliseconds) / 1000).toFixed(1);
}

// Shows both clocks from the duel state, redrawn ten times a second. It owns no clock logic: pauses, turns, skips
// and the end of the duel all live in the duel state.
export function BattleClockCards({
  duel,
  attackerAvatar,
  attackerBonus,
  attackerTotalMs,
  attackerEvent = null,
  attackerLabel,
  defenderAvatar,
  defenderBonus,
  defenderTotalMs,
  defenderEvent = null,
  defenderLabel,
  compact = false,
  onDangerTick,
}: BattleClockCardsProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const attackerMs = remainingMs(duel, 'attacker', now);
  const defenderMs = remainingMs(duel, 'defender', now);
  const activeRole = duel.active;
  const activeMs = activeRole === 'attacker' ? attackerMs : defenderMs;
  // The clock of the active side is running (not in a pause, not finished).
  const running = duel.turnStartedAt !== null && duel.winner === null;

  const onDangerTickRef = useRef(onDangerTick);
  const lastDangerSecondRef = useRef('');
  const lastMilestoneRef = useRef('');
  useEffect(() => {
    onDangerTickRef.current = onDangerTick;
  }, [onDangerTick]);

  // A tick sound in the last five seconds, and a spoken announcement every ten seconds.
  useEffect(() => {
    if (!running) return;
    const wholeSeconds = Math.ceil(activeMs / 1000);
    const key = `${activeRole}:${wholeSeconds}`;
    if (activeMs > 0 && activeMs <= 5000 && lastDangerSecondRef.current !== key) {
      lastDangerSecondRef.current = key;
      onDangerTickRef.current?.();
    }
    if (wholeSeconds > 0 && wholeSeconds < 40 && wholeSeconds % 10 === 0 && lastMilestoneRef.current !== key) {
      lastMilestoneRef.current = key;
      AccessibilityInfo.announceForAccessibility(`נותרו ${wholeSeconds} שניות`);
    }
  }, [activeMs, activeRole, running]);

  return (
    <View style={styles.row}>
      <ClockCard
        active={activeRole === 'attacker'}
        avatar={attackerAvatar}
        bonus={attackerBonus}
        totalMs={attackerTotalMs}
        compact={compact}
        event={attackerEvent}
        label={attackerLabel}
        milliseconds={attackerMs}
      />
      <ClockCard
        active={activeRole === 'defender'}
        avatar={defenderAvatar}
        bonus={defenderBonus}
        totalMs={defenderTotalMs}
        compact={compact}
        event={defenderEvent}
        label={defenderLabel}
        milliseconds={defenderMs}
      />
    </View>
  );
}

export function ClockCard({
  active,
  avatar,
  bonus,
  compact,
  event,
  label,
  milliseconds,
  totalMs,
}: {
  active: boolean;
  avatar: string;
  bonus: boolean;
  totalMs: number;
  compact: boolean;
  event: ClockEvent;
  label: string;
  milliseconds: number;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pulse] = useState(() => new Animated.Value(1));
  const [shake] = useState(() => new Animated.Value(0));
  // Event feedback: a tint flash over the card (red for a skip, green for a right answer), a small bump on a right
  // answer and a "-3" that floats up from the numerals on a skip. Reduced motion keeps the flash and drops the movement.
  const [flash] = useState(() => new Animated.Value(0));
  const [bump] = useState(() => new Animated.Value(1));
  const [floatUp] = useState(() => new Animated.Value(0));
  const [lastKind, setLastKind] = useState<'skip' | 'correct'>('skip');  const urgency = !active ? 'inactive' : milliseconds <= 5000 ? 'danger' : milliseconds <= 10000 ? 'warning' : 'normal';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(1);
    if (reduceMotion || urgency === 'normal' || urgency === 'inactive') return undefined;
    const scale = urgency === 'danger' ? 1.045 : 1.025;
    const duration = urgency === 'danger' ? 260 : 520;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: scale, duration, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion, urgency]);

  useEffect(() => {
    if (!event) return;
    const native = Platform.OS !== 'web';
    setLastKind(event.kind);
    flash.stopAnimation();
    flash.setValue(0);
    floatUp.stopAnimation();
    floatUp.setValue(0);
    bump.stopAnimation();
    bump.setValue(1);
    const out = Easing.out(Easing.exp);
    const animations = [
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: native }),
        Animated.timing(flash, { toValue: 0, duration: 420, easing: out, useNativeDriver: native }),
      ]),
    ];
    if (!reduceMotion && event.kind === 'skip') {
      animations.push(Animated.timing(floatUp, { toValue: 1, duration: 750, easing: out, useNativeDriver: native }));
    }
    if (!reduceMotion && event.kind === 'correct') {
      animations.push(Animated.sequence([
        Animated.timing(bump, { toValue: 1.07, duration: 110, useNativeDriver: native }),
        Animated.timing(bump, { toValue: 1, duration: 260, easing: out, useNativeDriver: native }),
      ]));
    }
    Animated.parallel(animations).start();
    // Runs once per event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.key]);

  useEffect(() => {
    if (milliseconds !== 0 || reduceMotion) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: -7, duration: 55, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shake, { toValue: 7, duration: 70, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shake, { toValue: -5, duration: 70, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [milliseconds, reduceMotion, shake]);

  return (
    <Animated.View accessible accessibilityLabel={`${label}, ${formatClock(milliseconds)} שניות`} style={[
      styles.card,
      compact && styles.compactCard,
      active ? styles.activeCard : styles.inactiveCard,
      active && { borderColor: colors.accentGold, shadowColor: colors.accentGold },
      urgency === 'warning' && styles.warningCard,
      urgency === 'danger' && styles.dangerCard,
      { transform: [{ scale: pulse }, { scale: bump }, { translateX: shake }] },
    ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { backgroundColor: lastKind === 'skip' ? colors.danger : colors.correct, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) }]}
      />
      <View style={styles.who}>
        <AvatarPortrait avatarId={avatar} borderColor={active ? colors.accentGold : colors.brandSky} size={compact ? 22 : 28} />
        <AppText numberOfLines={1} style={styles.label} weight="bold">{label}</AppText>
      </View>
      <AppText style={[
        styles.value,
        !active && styles.inactiveValue,
        compact && (active ? styles.compactValue : styles.compactInactiveValue),
        urgency === 'warning' && styles.warningValue,
        urgency === 'danger' && styles.dangerValue,
      ]} weight="black">
        {formatClock(milliseconds)}
      </AppText>
      {!reduceMotion ? (
        <Animated.Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.penalty, {
            opacity: floatUp.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: floatUp.interpolate({ inputRange: [0, 1], outputRange: [6, -30] }) }],
          }]}>
          ‎−3
        </Animated.Text>
      ) : null}
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.trackFill, { width: `${Math.max(0, Math.min(100, (milliseconds / Math.max(1, totalMs)) * 100))}%`, backgroundColor: urgency === 'danger' ? colors.danger : urgency === 'warning' ? colors.warning : active ? colors.accentGold : colors.brandBorder }]} />
      </View>
      {bonus ? (
        <View style={styles.bonusBadge}>
          <AppText style={styles.bonusText} weight="black">+5</AppText>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', gap: spacing.sm },
  card: {
    flex: 1,
    minHeight: 112,
    borderRadius: radii.card,
    borderWidth: 2,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compactCard: { minHeight: 50, paddingVertical: 2, paddingHorizontal: spacing.xs },
  compactValue: { fontSize: 32, lineHeight: 34 },
  compactInactiveValue: { fontSize: 28, lineHeight: 34 },
  activeCard: { borderWidth: 3, shadowOpacity: 0.55, shadowRadius: 12 },
  inactiveCard: { borderColor: colors.border },
  warningCard: { borderColor: colors.warning, shadowColor: colors.warning },
  dangerCard: { borderColor: colors.danger, shadowColor: colors.danger, shadowOpacity: 0.8, shadowRadius: 16 },
  who: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  label: { flexShrink: 1, color: colors.textSecondary, fontSize: typeScale.caption, textAlign: 'center' },
  track: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 5, height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  trackFill: { height: 3, borderRadius: 2, alignSelf: 'flex-end' },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.black,
    fontSize: typeScale.clockActive,
    lineHeight: 62,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  inactiveValue: { color: colors.textPrimary, opacity: 0.8, fontSize: typeScale.clockInactive },
  warningValue: { color: colors.warning },
  dangerValue: { color: colors.danger },
  flash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radii.card },
  penalty: {
    position: 'absolute',
    alignSelf: 'center',
    top: spacing.xs,
    color: colors.danger,
    fontFamily: fontFamilies.black,
    fontSize: 22,
    lineHeight: 26,
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bonusBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.accentGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bonusText: { color: colors.bg, fontSize: typeScale.caption, textAlign: 'center' },
});
