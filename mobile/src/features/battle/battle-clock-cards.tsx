import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/design/app-text';
import { colors, fontFamilies, radii, spacing, typeScale } from '@/design/tokens';
import { remainingMs } from '@/game/duel';
import type { DuelSide, DuelState } from '@/game/duel';

export type BattleRole = DuelSide;

type BattleClockCardsProps = {
  // The duel state machine (game/duel.ts) is the single source of truth; these cards only show it.
  duel: DuelState;
  attackerBonus: boolean;
  attackerColor: string;
  attackerLabel: string;
  // Short screens (iPhone with the keyboard up): a flatter card so the picture keeps its room.
  compact?: boolean;
  defenderBonus: boolean;
  defenderColor: string;
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
  attackerBonus,
  attackerColor,
  attackerLabel,
  defenderBonus,
  defenderColor,
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
        bonus={attackerBonus}
        compact={compact}
        color={attackerColor}
        label={attackerLabel}
        milliseconds={attackerMs}
      />
      <ClockCard
        active={activeRole === 'defender'}
        bonus={defenderBonus}
        compact={compact}
        color={defenderColor}
        label={defenderLabel}
        milliseconds={defenderMs}
      />
    </View>
  );
}

function ClockCard({
  active,
  bonus,
  compact,
  color,
  label,
  milliseconds,
}: {
  active: boolean;
  bonus: boolean;
  compact: boolean;
  color: string;
  label: string;
  milliseconds: number;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pulse] = useState(() => new Animated.Value(1));
  const [shake] = useState(() => new Animated.Value(0));
  const urgency = !active ? 'inactive' : milliseconds <= 5000 ? 'danger' : milliseconds <= 10000 ? 'warning' : 'normal';

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
      active && { borderColor: color, shadowColor: color },
      urgency === 'warning' && styles.warningCard,
      urgency === 'danger' && styles.dangerCard,
      { transform: [{ scale: pulse }, { translateX: shake }] },
    ]}>
      <AppText numberOfLines={1} style={styles.label} weight="bold">{label}</AppText>
      <AppText style={[
        styles.value,
        !active && styles.inactiveValue,
        compact && (active ? styles.compactValue : styles.compactInactiveValue),
        urgency === 'warning' && styles.warningValue,
        urgency === 'danger' && styles.dangerValue,
      ]} weight="black">
        {formatClock(milliseconds)}
      </AppText>
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
  compactCard: { minHeight: 58, padding: spacing.xs },
  compactValue: { fontSize: 34, lineHeight: 38 },
  compactInactiveValue: { fontSize: 28, lineHeight: 38 },
  activeCard: { borderWidth: 3, shadowOpacity: 0.55, shadowRadius: 12 },
  inactiveCard: { borderColor: colors.border },
  warningCard: { borderColor: colors.warning, shadowColor: colors.warning },
  dangerCard: { borderColor: colors.danger, shadowColor: colors.danger, shadowOpacity: 0.8, shadowRadius: 16 },
  label: { color: colors.textSecondary, fontSize: typeScale.caption, textAlign: 'center' },
  value: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.black,
    fontSize: typeScale.clockActive,
    lineHeight: 62,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  inactiveValue: { color: colors.textSecondary, fontSize: typeScale.clockInactive },
  warningValue: { color: colors.warning },
  dangerValue: { color: colors.danger },
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
