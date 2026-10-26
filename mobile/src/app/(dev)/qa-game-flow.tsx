import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameOverScreen } from '@/features/final/game-over-screen';
import {
  createBattleSetup,
  createInitialGame,
  getChampion,
  getNeighborPlayerIds,
  resolveBattle,
} from '@/game/engine';
import type { GameState } from '@/game/types';

const FIXED_RANDOM = () => 0;

function createHumanChampion(): GameState {
  let state = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
  while (!getChampion(state)) {
    const targetId = getNeighborPlayerIds(state, 'human')[0];
    state = resolveBattle(state, createBattleSetup(state, 'human', targetId), 'human').state;
  }
  return state;
}

function createComputerResult(completeGame: boolean): GameState {
  let state = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
  const computerId = getNeighborPlayerIds(state, 'human')[0];
  state = resolveBattle(
    state,
    createBattleSetup(state, computerId, 'human'),
    computerId,
  ).state;

  while (completeGame && !getChampion(state)) {
    const targetId = getNeighborPlayerIds(state, computerId)[0];
    state = resolveBattle(
      state,
      createBattleSetup(state, computerId, targetId),
      computerId,
    ).state;
  }
  return state;
}

export default function GameFlowQaScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [restarted, setRestarted] = useState(false);
  const state = useMemo(() => {
    if (mode === 'win') return createHumanChampion();
    return createComputerResult(mode === 'champion');
  }, [mode]);

  if (restarted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>פעולת משחק חדש תקינה</Text>
          <Text style={styles.title}>אפשר לחזור לבחירת קטגוריה ולהתחיל מחדש</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <GameOverScreen onRestart={() => setRestarted(true)} state={state} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  card: { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 22, lineHeight: 31, fontWeight: '900', marginTop: 8, textAlign: 'center', writingDirection: 'rtl' },
});
