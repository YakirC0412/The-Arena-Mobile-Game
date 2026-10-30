import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_BY_ID } from '@/content/categories';
import { BattleView } from '@/features/battle/battle-view';
import { createBattleSetup, createInitialGame, getNeighborPlayerIds } from '@/game/engine';

const STRONG_AI_RANDOM = () => 0;
const WEAK_AI_RANDOM = () => 0.99;

function secondsFrom(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(45, Math.max(1, parsed)) : fallback;
}

export default function QaDuelScreen() {
  const params = useLocalSearchParams<{
    ai?: string;
    aiSeconds?: string;
    category?: string;
    playerSeconds?: string;
  }>();
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const random = params.ai === 'weak' ? WEAK_AI_RANDOM : STRONG_AI_RANDOM;

  const { setup, state } = useMemo(() => {
    const base = createInitialGame('countries', STRONG_AI_RANDOM, 'שחקן בדיקה');
    const defenderId = getNeighborPlayerIds(base, base.humanPlayerId)[0];
    const nextState = {
      ...base,
      players: {
        ...base.players,
        [defenderId]: {
          ...base.players[defenderId],
          categoryId: params.category && CATEGORY_BY_ID[params.category] ? params.category : 'animals',
          wayId: 'w1' as const,
          name: 'המחשב',
        },
      },
    };
    return {
      state: nextState,
      setup: {
        ...createBattleSetup(nextState, nextState.humanPlayerId, defenderId),
        attackerSeconds: secondsFrom(params.playerSeconds, 40),
        defenderSeconds: secondsFrom(params.aiSeconds, 40),
      },
    };
  }, [params.aiSeconds, params.category, params.playerSeconds]);

  if (winnerId) {
    const winner = state.players[winnerId];
    return (
      <SafeAreaView style={styles.resultScreen}>
        <Text style={styles.eyebrow}>בדיקת דו־קרב הושלמה</Text>
        <Text style={styles.title}>{winner.name} ניצח/ה</Text>
        <Text style={styles.body}>
          {winner.isHuman ? 'השעון של המחשב הגיע לאפס.' : 'השעון של השחקן הגיע לאפס.'}
        </Text>
        <Pressable
          onPress={() => {
            setWinnerId(null);
            setRunId((current) => current + 1);
          }}
          style={styles.button}>
          <Text style={styles.buttonText}>הפעלת בדיקה נוספת</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.qaBadge} pointerEvents="none">
        <Text style={styles.qaBadgeText}>מצב בדיקה</Text>
      </View>
      <BattleView
        key={runId}
        onComplete={setWinnerId}
        random={random}
        setup={setup}
        state={state}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  qaBadge: { position: 'absolute', top: 7, right: 8, zIndex: 10, borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 3 },
  qaBadgeText: { color: colors.accentGold, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  resultScreen: { flex: 1, backgroundColor: colors.bg, padding: 28, justifyContent: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 31, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 5 },
  body: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', writingDirection: 'rtl', marginTop: 10, marginBottom: 24 },
  button: { minHeight: 54, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
});
