import { colors } from '@/design/tokens';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_BY_ID } from '@/content/categories';
import { getActivePlayers } from '@/game/engine';
import type { GameState } from '@/game/types';

export function FinalCategoryScreen({
  chooserId,
  onSelect,
  random = Math.random,
  state,
}: {
  chooserId: string;
  onSelect: (categoryId: string) => void;
  random?: () => number;
  state: GameState;
}) {
  const finalists = getActivePlayers(state);
  const chooser = state.players[chooserId];
  const opponent = finalists.find((player) => player.id !== chooserId)!;
  const [aiChoice, setAiChoice] = useState<string | null>(null);

  useEffect(() => {
    if (chooser.isHuman) return;
    const categoryId = random() < 0.65 ? chooser.categoryId : opponent.categoryId;
    const revealTimer = setTimeout(() => setAiChoice(categoryId), 1300);
    const completeTimer = setTimeout(() => onSelect(categoryId), 2800);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(completeTimer);
    };
  }, [chooser.categoryId, chooser.isHuman, onSelect, opponent.categoryId, random]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <Text style={styles.eyebrow}>נשארו שניים</Text>
        <Text style={styles.title}>בחירת קטגוריית הגמר</Text>
        <Text style={styles.body}>
          {chooser.name} מחזיק/ה בשטח הגדול ביותר ולכן בוחר/ת את נושא דו־קרב הגמר.
        </Text>

        <View style={styles.finalists}>
          {finalists.map((player) => (
            <View key={player.id} style={[styles.finalistCard, { borderColor: player.color }]}>
              <Text style={styles.finalistName}>{player.name}</Text>
              <Text style={styles.finalistCells}>{player.cellIds.length}</Text>
              <Text style={styles.finalistLabel}>משבצות</Text>
            </View>
          ))}
        </View>

        <Text style={styles.prompt}>
          {chooser.isHuman ? 'באיזו קטגוריה תרצו לשחק?' : aiChoice ? 'הקטגוריה נבחרה' : 'המחשב בוחן את שתי הקטגוריות...'}
        </Text>

        <View style={styles.options}>
          {[chooser, opponent].map((owner) => {
            const category = CATEGORY_BY_ID[owner.categoryId];
            const selected = aiChoice === category.id;
            return (
              <Pressable
                accessibilityLabel={`${category.name}, הקטגוריה של ${owner.name}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: !chooser.isHuman, selected }}
                disabled={!chooser.isHuman}
                key={category.id}
                onPress={() => onSelect(category.id)}
                style={[styles.option, selected && styles.optionSelected]}>
                <Text style={styles.optionIcon}>{category.icon}</Text>
                <Text style={styles.optionName}>{category.name}</Text>
                <Text style={styles.optionOwner}>הקטגוריה של {owner.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>הקטגוריה שנבחרה תקבע את כל דו־קרב הגמר.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', justifyContent: 'center', padding: 22 },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 29, lineHeight: 36, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 4 },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', writingDirection: 'rtl', marginTop: 8 },
  finalists: { flexDirection: 'row-reverse', gap: 10, marginTop: 22 },
  finalistCard: { flex: 1, minHeight: 104, borderRadius: 20, borderWidth: 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  finalistName: { color: colors.textSecondary, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  finalistCells: { color: colors.textPrimary, fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 2 },
  finalistLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  prompt: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 24, marginBottom: 10 },
  options: { flexDirection: 'row-reverse', gap: 10 },
  option: { flex: 1, minHeight: 142, borderRadius: 22, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: 12 },
  optionSelected: { borderColor: colors.accentGold, backgroundColor: colors.surfaceMuted, transform: [{ scale: 1.03 }] },
  optionIcon: { fontSize: 39 },
  optionName: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 7 },
  optionOwner: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl', marginTop: 4 },
  note: { color: colors.accentGold, fontSize: 12, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl', marginTop: 16 },
});
