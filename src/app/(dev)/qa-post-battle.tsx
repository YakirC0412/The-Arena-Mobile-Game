import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AiTargetSelectionScreen,
  BattleOutcomeScreen,
  ConquestAnimationScreen,
} from '@/features/battle/battle-transitions';
import {
  chooseAiTarget,
  createBattleSetup,
  createInitialGame,
  getNeighborPlayerIds,
  resolveBattle,
} from '@/game/engine';

const FIXED_RANDOM = () => 0.25;
type Phase = 'outcome' | 'conquest' | 'target' | 'done';

export default function QaPostBattleScreen() {
  const [phase, setPhase] = useState<Phase>('outcome');
  const scenario = useMemo(() => {
    const initial = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    const attackerId = initial.cells[1].ownerId;
    const defenderId = getNeighborPlayerIds(initial, attackerId)
      .find((id) => id !== initial.humanPlayerId)!;
    const setup = createBattleSetup(initial, attackerId, defenderId);
    const resolution = resolveBattle(initial, setup, attackerId);
    const targetId = chooseAiTarget(resolution.state, attackerId, FIXED_RANDOM)!;
    return { initial, resolution, targetId };
  }, []);

  if (phase === 'outcome') {
    return <BattleOutcomeScreen onComplete={() => setPhase('conquest')} resolution={scenario.resolution} />;
  }

  if (phase === 'conquest') {
    return (
      <ConquestAnimationScreen
        beforeState={scenario.initial}
        onComplete={() => setPhase('target')}
        resolution={scenario.resolution}
      />
    );
  }

  if (phase === 'target') {
    return (
      <AiTargetSelectionScreen
        onComplete={() => setPhase('done')}
        state={scenario.resolution.state}
        targetId={scenario.targetId}
        winnerId={scenario.resolution.winnerId}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>רצף סיום הקרב הושלם</Text>
      <Pressable onPress={() => setPhase('outcome')} style={styles.button}>
        <Text style={styles.buttonText}>הפעלת הרצף שוב</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  title: { color: colors.textPrimary, fontSize: 27, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  button: { minHeight: 54, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
});
