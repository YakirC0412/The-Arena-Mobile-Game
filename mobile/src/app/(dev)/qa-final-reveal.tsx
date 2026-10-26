import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinalRevealScreen } from '@/features/final/final-reveal-screen';
import { createInitialGame } from '@/game/engine';

const FIXED_RANDOM = () => 0;

export default function QaFinalRevealScreen() {
  const [completed, setCompleted] = useState(false);
  const state = useMemo(() => {
    const initial = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    const aiId = initial.cells[9].ownerId;
    const humanCellIds = initial.cells.slice(0, 9).map((cell) => cell.id);
    const aiCellIds = initial.cells.slice(9).map((cell) => cell.id);
    return {
      ...initial,
      cells: initial.cells.map((cell) => ({ ...cell, ownerId: humanCellIds.includes(cell.id) ? 'human' : aiId })),
      players: Object.fromEntries(Object.entries(initial.players).map(([id, player]) => [
        id,
        id === 'human'
          ? { ...player, cellIds: humanCellIds, isActive: true }
          : id === aiId
            ? { ...player, cellIds: aiCellIds, isActive: true, categoryId: 'countries', name: 'המחשב' }
            : { ...player, cellIds: [], isActive: false },
      ])),
      selectedPlayerId: 'human',
    };
  }, []);

  if (!completed) {
    return <FinalRevealScreen onComplete={() => setCompleted(true)} state={state} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>אנימציית הגמר הושלמה</Text>
      <Pressable onPress={() => setCompleted(false)} style={styles.button}>
        <Text style={styles.buttonText}>הפעלת האנימציה שוב</Text>
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
