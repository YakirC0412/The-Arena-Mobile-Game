import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/design/app-text';
import { colors, fontFamilies, radii, spacing, typeScale } from '@/design/tokens';

export type BattleRole = 'attacker' | 'defender';

type ClockValues = Record<BattleRole, number>;

export type BattleClockHandle = {
  getRemaining: (role: BattleRole) => number;
  penalize: (role: BattleRole, milliseconds: number) => void;
};

type BattleClockCardsProps = {
  activeRole: BattleRole;
  attackerBonus: boolean;
  attackerColor: string;
  attackerLabel: string;
  attackerMilliseconds: number;
  // Short screens (iPhone with the keyboard up): a flatter card so the picture keeps its room.
  compact?: boolean;
  defenderBonus: boolean;
  defenderColor: string;
  defenderLabel: string;
  defenderMilliseconds: number;
  onClockExpired?: (role: BattleRole) => void;
  onDangerTick?: () => void;
  onTimeUp: (role: BattleRole) => void;
  paused: boolean;
};

function formatClock(milliseconds: number): string {
  return (Math.max(0, milliseconds) / 1000).toFixed(1);
}

export const BattleClockCards = forwardRef<BattleClockHandle, BattleClockCardsProps>(function BattleClockCards({
  activeRole,
  attackerBonus,
  attackerColor,
  attackerLabel,
  attackerMilliseconds,
  defenderBonus,
  defenderColor,
  defenderLabel,
  defenderMilliseconds,
  compact = false,
  onClockExpired,
  onDangerTick,
  onTimeUp,
  paused,
}, ref) {
  const [values, setValues] = useState<ClockValues>({
    attacker: attackerMilliseconds,
    defender: defenderMilliseconds,
  });
  const valuesRef = useRef(values);
  const onTimeUpRef = useRef(onTimeUp);
  const onClockExpiredRef = useRef(onClockExpired);
  const onDangerTickRef = useRef(onDangerTick);
  const timeUpReportedRef = useRef(false);
  const lastDangerSecondRef = useRef('');
  const lastMilestoneRef = useRef('');

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onClockExpiredRef.current = onClockExpired;
    onDangerTickRef.current = onDangerTick;
  }, [onClockExpired, onDangerTick, onTimeUp]);

  const updateValues = (updater: (current: ClockValues) => ClockValues) => {
    setValues((current) => {
      const next = updater(current);
      valuesRef.current = next;
      return next;
    });
  };

  const reportTimeUp = (role: BattleRole) => {
    if (timeUpReportedRef.current) return;
    timeUpReportedRef.current = true;
    onClockExpiredRef.current?.(role);
    setTimeout(() => onTimeUpRef.current(role), 420);
  };

  useImperativeHandle(ref, () => ({
    getRemaining: (role) => valuesRef.current[role],
    penalize: (role, milliseconds) => {
      updateValues((current) => {
        const remaining = Math.max(0, current[role] - milliseconds);
        if (remaining === 0) reportTimeUp(role);
        return { ...current, [role]: remaining };
      });
    },
  }), []);

  useEffect(() => {
    if (paused || timeUpReportedRef.current) return;
    let lastTick = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTick;
      lastTick = now;
      updateValues((current) => {
        const remaining = Math.max(0, current[activeRole] - elapsed);
        const wholeSeconds = Math.ceil(remaining / 1000);
        const dangerKey = `${activeRole}:${wholeSeconds}`;
        if (remaining > 0 && remaining <= 5000 && lastDangerSecondRef.current !== dangerKey) {
          lastDangerSecondRef.current = dangerKey;
          onDangerTickRef.current?.();
        }
        const milestoneKey = `${activeRole}:${wholeSeconds}`;
        if (wholeSeconds > 0 && wholeSeconds < 40 && wholeSeconds % 10 === 0 && lastMilestoneRef.current !== milestoneKey) {
          lastMilestoneRef.current = milestoneKey;
          AccessibilityInfo.announceForAccessibility(`נותרו ${wholeSeconds} שניות`);
        }
        if (remaining === 0) reportTimeUp(activeRole);
        return { ...current, [activeRole]: remaining };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [activeRole, paused]);

  return (
    <View style={styles.row}>
      <ClockCard
        active={activeRole === 'attacker'}
        bonus={attackerBonus}
        compact={compact}
        color={attackerColor}
        label={attackerLabel}
        milliseconds={values.attacker}
      />
      <ClockCard
        active={activeRole === 'defender'}
        bonus={defenderBonus}
        compact={compact}
        color={defenderColor}
        label={defenderLabel}
        milliseconds={values.defender}
      />
    </View>
  );
});

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
