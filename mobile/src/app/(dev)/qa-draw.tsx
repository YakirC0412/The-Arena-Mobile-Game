import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawAnimationScreen } from '@/features/arena/draw-animation-screen';
import { createInitialGame, drawPlayer, getDrawCandidates } from '@/game/engine';

const FIXED_RANDOM = () => 0;

export default function DrawQaScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [completed, setCompleted] = useState(false);

  const scenario = useMemo(() => {
    const initial = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    const activeIds = Object.values(initial.players).map((player) => player.id);
    const playedCount = mode === 'all' ? activeIds.length : 10;
    const bonusMode = mode === 'bonus';
    const prepared = {
      ...initial,
      players: Object.fromEntries(
        Object.entries(initial.players).map(([id, player], index) => [
          id,
          {
            ...player,
            bonusReady: bonusMode && id === 'human',
            hasPlayedThisRound: bonusMode ? id !== 'human' : index < playedCount,
          },
        ]),
      ),
    };
    const candidatesBeforeDraw = getDrawCandidates(prepared).map((player) => player.id);
    return {
      candidateCount: candidatesBeforeDraw.length,
      state: drawPlayer(prepared, FIXED_RANDOM),
    };
  }, [mode]);

  if (!completed) {
    return <DrawAnimationScreen onComplete={() => setCompleted(true)} state={scenario.state} />;
  }

  const selected = scenario.state.players[scenario.state.selectedPlayerId!];
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>בדיקת הגרלה הושלמה</Text>
        <Text style={styles.title}>{selected.name} נבחר/ה כתוקף</Text>
        <Text style={styles.body}>
          ההגרלה נערכה בין {scenario.candidateCount} מתמודדים חוקיים בלבד.
        </Text>
        <Pressable onPress={() => setCompleted(false)} style={styles.button}>
          <Text style={styles.buttonText}>הפעלת ההגרלה שוב</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  card: { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 22, alignItems: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center', writingDirection: 'rtl' },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 14, textAlign: 'center', writingDirection: 'rtl' },
  button: { width: '100%', height: 52, borderRadius: 16, backgroundColor: colors.success, marginTop: 18, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
});
