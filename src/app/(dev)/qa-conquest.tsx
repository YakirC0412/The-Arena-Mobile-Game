import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConquestAnimationScreen } from '@/features/battle/battle-transitions';
import { CATEGORY_BY_ID } from '@/content/categories';
import {
  createBattleSetup,
  createInitialGame,
  resolveBattle,
} from '@/game/engine';
import type { GameState } from '@/game/types';

const FIXED_RANDOM = () => 0;

export default function ConquestQaScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [completed, setCompleted] = useState(false);

  const scenario = useMemo(() => {
    const initial = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    const defenderId = initial.cells[1].ownerId;
    const humanCellIds = mode === 'single-to-territory' ? [0] : [0, 4, 5];
    const defenderCellIds = mode === 'territory-to-single' ? [1] : mode === 'single-to-territory' ? [1, 2, 3] : [1, 2, 6];
    const prepared = assignQaTerritories(initial, 'human', humanCellIds, defenderId, defenderCellIds);
    const setup = createBattleSetup(prepared, 'human', defenderId);

    return {
      beforeState: prepared,
      resolution: resolveBattle(prepared, setup, 'human'),
    };
  }, [mode]);

  if (!completed) {
    return (
      <ConquestAnimationScreen
        beforeState={scenario.beforeState}
        onComplete={() => setCompleted(true)}
        resolution={scenario.resolution}
      />
    );
  }

  const winner = scenario.resolution.state.players.human;
  const category = CATEGORY_BY_ID[winner.categoryId];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>בדיקת השתלטות הושלמה</Text>
        <Text style={styles.title}>{winner.cellIds.length} משבצות הן שטח אחד</Text>
        <Text style={styles.summary}>{scenario.resolution.summary}</Text>
        <View style={styles.categoryCard}>
          <Text style={styles.categoryIcon}>{category.icon}</Text>
          <Text style={styles.categoryText}>הקטגוריה הפעילה: {category.name}</Text>
        </View>
        <Pressable onPress={() => setCompleted(false)} style={styles.button}>
          <Text style={styles.buttonText}>הפעלת האנימציה שוב</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function assignQaTerritories(
  state: GameState,
  attackerId: string,
  attackerCellIds: number[],
  defenderId: string,
  defenderCellIds: number[],
): GameState {
  const attackerCells = new Set(attackerCellIds);
  const defenderCells = new Set(defenderCellIds);
  const thirdTerritoryOwnerId = state.cells[8].ownerId;
  const thirdTerritoryCells = new Set([8, 9, 12]);
  const fallbackOwnerId = state.cells[7].ownerId;
  const cells = state.cells.map((cell) => ({
    ...cell,
    ownerId: attackerCells.has(cell.id)
      ? attackerId
      : defenderCells.has(cell.id)
        ? defenderId
        : thirdTerritoryCells.has(cell.id)
          ? thirdTerritoryOwnerId
        : cell.ownerId === attackerId || cell.ownerId === defenderId
          ? fallbackOwnerId
          : cell.ownerId,
  }));
  const players = Object.fromEntries(Object.entries(state.players).map(([id, player]) => {
    const cellIds = cells.filter((cell) => cell.ownerId === id).map((cell) => cell.id);
    return [id, { ...player, cellIds, isActive: cellIds.length > 0 }];
  }));
  return { ...state, cells, players };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  card: { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 22, alignItems: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center', writingDirection: 'rtl' },
  summary: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 14, textAlign: 'center', writingDirection: 'rtl' },
  categoryCard: { width: '100%', borderRadius: 18, backgroundColor: colors.surfaceMuted, marginTop: 18, padding: 16, alignItems: 'center' },
  categoryIcon: { fontSize: 38 },
  categoryText: { color: colors.success, fontSize: 15, fontWeight: '900', marginTop: 6, writingDirection: 'rtl' },
  button: { width: '100%', height: 52, borderRadius: 16, backgroundColor: colors.success, marginTop: 18, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
});
