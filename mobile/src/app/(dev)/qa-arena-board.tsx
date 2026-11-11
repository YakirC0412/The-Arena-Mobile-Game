import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArenaBoard } from '@/features/arena/arena-board';
import { AppText } from '@/design/app-text';
import { colors, radii, spacing, typeScale } from '@/design/tokens';
import { createBattleSetup, createInitialGame, getNeighborPlayerIds, resolveBattle } from '@/game/engine';

const FIXED_RANDOM = () => 0;

export default function QaArenaBoardScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // `?wins=N` = how many duels the human has already won (bigger territory); `?mode=overview` shows the plain board.
  const params = useLocalSearchParams<{ mode?: string; wins?: string }>();
  const wins = Math.min(8, Math.max(2, Number(params.wins) || 2));
  const state = useMemo(() => {
    let expanded = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    for (let index = 0; index < wins; index += 1) {
      const target = getNeighborPlayerIds(expanded, 'human')[0];
      if (!target) break;
      expanded = resolveBattle(expanded, createBattleSetup(expanded, 'human', target), 'human').state;
    }
    return expanded;
  }, [wins]);

  const targets = getNeighborPlayerIds(state, 'human');

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <AppText style={styles.eyebrow} weight="bold">בדיקת שלב 4</AppText>
        <AppText style={styles.title} weight="black">בחירת יריב בזירה</AppText>
      </View>
      <ArenaBoard
        meId="human"
        mode={params.mode === 'overview' ? 'overview' : 'select-target'}
        onSelectTarget={setSelectedId}
        selectedId={selectedId}
        state={state}
        targetIds={targets}
      />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.meDot]} />
          <AppText style={styles.legendText}>השטח שלך</AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.targetDot]} />
          <AppText style={styles.legendText}>ניתן לתקוף</AppText>
        </View>
      </View>
      <View style={styles.status}>
        <AppText style={styles.statusText} weight="bold">
          {selectedId ? `נבחר: ${state.players[selectedId].name}` : 'בחרו שטח עם מסגרת זוהרת'}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  eyebrow: { color: colors.accentGold, fontSize: typeScale.caption },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, marginTop: spacing.xs },
  legend: { flexDirection: 'row-reverse', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 16, height: 16, borderRadius: 4 },
  meDot: { backgroundColor: colors.territoryMeEnd, borderWidth: 1, borderColor: colors.territoryMeBorder },
  targetDot: { backgroundColor: colors.territoryTarget, borderWidth: 2, borderColor: colors.territoryTargetBorder },
  legendText: { color: colors.textSecondary, fontSize: typeScale.caption },
  status: { minHeight: 52, borderRadius: radii.control, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg, justifyContent: 'center', paddingHorizontal: spacing.md },
  statusText: { color: colors.textPrimary, fontSize: typeScale.body, textAlign: 'center' },
});
