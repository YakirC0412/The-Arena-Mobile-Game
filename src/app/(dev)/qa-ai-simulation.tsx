import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { useLocalSearchParams } from 'expo-router';

import { AiBattleSimulationScreen } from '@/features/battle/battle-transitions';
import { createBattleSetup, createInitialGame, getNeighborPlayerIds } from '@/game/engine';

const FIXED_RANDOM = () => 0.42;

export default function QaAiSimulationScreen() {
  const { winner } = useLocalSearchParams<{ winner?: string }>();
  const [completedWinner, setCompletedWinner] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const scenario = useMemo(() => {
    const state = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    const attackerId = getNeighborPlayerIds(state, 'human')[0];
    const defenderId = getNeighborPlayerIds(state, attackerId).find((id) => id !== 'human') ?? 'human';
    const setup = createBattleSetup(state, attackerId, defenderId);
    return {
      state,
      setup,
      winnerId: winner === 'defender' ? defenderId : attackerId,
    };
  }, [winner]);

  if (!completedWinner) {
    return (
      <AiBattleSimulationScreen
        key={runId}
        onComplete={setCompletedWinner}
        setup={scenario.setup}
        state={scenario.state}
        winnerId={scenario.winnerId}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{scenario.state.players[completedWinner].name} ניצח/ה</Text>
      <Text style={styles.body}>התוצאה תואמת לשעון שהגיע לאפס.</Text>
      <Pressable onPress={() => { setCompletedWinner(null); setRunId((value) => value + 1); }} style={styles.button}>
        <Text style={styles.buttonText}>הרצה חוזרת</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  body: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', writingDirection: 'rtl', marginTop: 8 },
  button: { minHeight: 54, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', marginTop: 22 },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
});
