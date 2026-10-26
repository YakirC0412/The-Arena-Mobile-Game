import { colors } from '@/design/tokens';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPortrait } from '@/design/avatar-portrait';
import { CATEGORY_BY_ID } from '@/content/categories';
import { getActivePlayers, getChampion } from '@/game/engine';
import type { GameState } from '@/game/types';

export function GameOverScreen({
  onRestart,
  state,
}: {
  onRestart: () => void;
  state: GameState;
}) {
  const champion = getChampion(state);
  const human = state.players[state.humanPlayerId];
  const won = champion?.id === human.id;
  const activePlayers = getActivePlayers(state).length;
  const leadingPlayer = champion ?? getActivePlayers(state)
    .sort((left, right) => right.cellIds.length - left.cellIds.length)[0];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(won ? 'כבשת את הזירה' : 'הודחת מהזירה');
  }, [won]);

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.icon}>{won ? '🏆' : '⚔️'}</Text>
      <Text style={styles.eyebrow}>THE ARENA</Text>
      <Text style={styles.title}>{won ? 'כבשת את הזירה!' : 'הודחת מהזירה'}</Text>
      <Text style={styles.body}>
        {won
          ? 'כל 16 המשבצות נמצאות בשליטתך. הזירה כולה היא שטח אחד.'
          : champion
            ? `${champion.name} כבש/ה את כל הזירה והפך/ה לאלוף/ה.`
            : `המסע שלך הסתיים. ${activePlayers} מתמודדים עדיין נשארו בזירה.`}
      </Text>

      {leadingPlayer && (
        <View style={styles.championCard}>
          <AvatarPortrait avatarId={leadingPlayer.avatar} borderColor={leadingPlayer.color} size={62} />
          <View style={[styles.colorMark, { backgroundColor: leadingPlayer.color }]} />
          <View style={styles.championCopy}>
            <Text style={styles.championLabel}>{champion ? 'אלוף/ת הזירה' : 'מוביל/ת כרגע'}</Text>
            <Text style={styles.championName}>{leadingPlayer.name}</Text>
            <Text style={styles.championMeta}>
              {leadingPlayer.cellIds.length} משבצות • {CATEGORY_BY_ID[leadingPlayer.categoryId].name}
            </Text>
          </View>
        </View>
      )}

      <Pressable accessibilityLabel="התחלת משחק חדש" accessibilityRole="button" onPress={onRestart} style={styles.button}>
        <Text style={styles.buttonText}>משחק חדש</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 28, justifyContent: 'center', alignItems: 'stretch' },
  icon: { fontSize: 76, textAlign: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 13, fontWeight: '900', textAlign: 'center', letterSpacing: 1.5, marginTop: 8 },
  title: { color: colors.textPrimary, fontSize: 30, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 4 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', writingDirection: 'rtl', marginTop: 14 },
  championCard: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, marginVertical: 20, flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  colorMark: { width: 14, height: 58, borderRadius: 8 },
  championCopy: { flex: 1, alignItems: 'flex-end' },
  championLabel: { color: colors.accentGold, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  championName: { color: colors.textPrimary, fontSize: 20, fontWeight: '900', writingDirection: 'rtl', marginTop: 2 },
  championMeta: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl', marginTop: 3 },
  button: { minHeight: 54, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '900', writingDirection: 'rtl' },
});
