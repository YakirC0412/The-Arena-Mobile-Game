import { colors } from '@/design/tokens';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinalCategoryScreen } from '@/components/final-category-screen';
import { CATEGORY_BY_ID } from '@/game/content';
import { createFinalBattleSetup, createInitialGame, getFinalCategoryChooser } from '@/game/engine';

const FIXED_RANDOM = () => 0;

export default function QaFinalCategoryScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const state = useMemo(() => {
    const initial = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    const aiId = initial.cells[1].ownerId;
    const humanChooses = mode !== 'ai';
    const humanCellIds = humanChooses ? initial.cells.slice(0, 9).map((cell) => cell.id) : initial.cells.slice(0, 7).map((cell) => cell.id);
    const aiCellIds = initial.cells.filter((cell) => !humanCellIds.includes(cell.id)).map((cell) => cell.id);
    const players = Object.fromEntries(Object.entries(initial.players).map(([id, player]) => [
      id,
      id === 'human'
        ? { ...player, cellIds: humanCellIds, isActive: true }
        : id === aiId
          ? { ...player, cellIds: aiCellIds, isActive: true, categoryId: 'countries', name: 'המחשב' }
          : { ...player, cellIds: [], isActive: false },
    ]));
    return {
      ...initial,
      cells: initial.cells.map((cell) => ({ ...cell, ownerId: humanCellIds.includes(cell.id) ? 'human' : aiId })),
      players,
      selectedPlayerId: humanChooses ? 'human' : aiId,
    };
  }, [mode]);

  const chooser = getFinalCategoryChooser(state)!;
  if (!selectedCategoryId) {
    return (
      <FinalCategoryScreen
        chooserId={chooser.id}
        onSelect={(categoryId) => {
          createFinalBattleSetup(state, chooser.id, categoryId);
          setSelectedCategoryId(categoryId);
        }}
        random={FIXED_RANDOM}
        state={state}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>נבחרה הקטגוריה {CATEGORY_BY_ID[selectedCategoryId].name}</Text>
      <Pressable onPress={() => setSelectedCategoryId(null)} style={styles.button}>
        <Text style={styles.buttonText}>בדיקה נוספת</Text>
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
