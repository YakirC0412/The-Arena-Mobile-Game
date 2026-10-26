import { colors } from '@/design/tokens';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPortrait } from '@/design/avatar-portrait';
import { CATEGORY_BY_ID } from '@/content/categories';
import { createRandomDrawSequence } from '@/game/engine';
import type { GameState } from '@/game/types';
import { useGameFeedback } from '@/services/use-game-feedback';
import { useReducedMotion } from '@/design/use-reduced-motion';

export function DrawAnimationScreen({
  onComplete,
  random = Math.random,
  state,
}: {
  onComplete: () => void;
  random?: () => number;
  state: GameState;
}) {
  const selectedPlayer = state.selectedPlayerId ? state.players[state.selectedPlayerId] : null;
  const reducedMotion = useReducedMotion();
  const { draw: playDrawFeedback } = useGameFeedback();
  const candidatePlayerIds = useMemo(() => (
    Object.values(state.players)
      .filter((player) => (
        player.isActive
        && (!player.hasPlayedThisRound || player.id === state.selectedPlayerId)
      ))
      .map((player) => player.id)
  ), [state]);
  const candidatePlayerIdSet = useMemo(() => new Set(candidatePlayerIds), [candidatePlayerIds]);
  const anchorIds = useMemo(() => {
    const anchors = new Map<string, number>();
    Object.values(state.players).forEach((player) => {
      if (!player.isActive || player.cellIds.length === 0) return;
      const cells = player.cellIds.map((cellId) => state.cells[cellId]);
      const centerRow = cells.reduce((total, cell) => total + cell.row, 0) / cells.length;
      const centerColumn = cells.reduce((total, cell) => total + cell.column, 0) / cells.length;
      const anchor = cells.reduce((closest, cell) => {
        const distance = (cell.row - centerRow) ** 2 + (cell.column - centerColumn) ** 2;
        const closestDistance = (closest.row - centerRow) ** 2 + (closest.column - centerColumn) ** 2;
        return distance < closestDistance ? cell : closest;
      });
      anchors.set(player.id, anchor.id);
    });
    return anchors;
  }, [state.cells, state.players]);
  const selectedPlayerId = selectedPlayer?.id ?? candidatePlayerIds[0];
  const selectedHasBonus = selectedPlayer?.bonusReady ?? false;
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(candidatePlayerIds[0]);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    const steps = reducedMotion ? 1 : 34;
    const sequence = createRandomDrawSequence(candidatePlayerIds, steps, random);

    for (let step = 0; step < sequence.length; step += 1) {
      const playerId = sequence[step];
      timers.push(setTimeout(() => setHighlightedPlayerId(playerId), elapsed));
      elapsed += step < 20 ? 80 : step < 28 ? 140 : step < 32 ? 260 : 420;
    }

    timers.push(setTimeout(() => {
      setHighlightedPlayerId(selectedPlayerId);
      setLanded(true);
      playDrawFeedback();
      if (selectedPlayer) AccessibilityInfo.announceForAccessibility(`${selectedPlayer.name} נבחר או נבחרה לשחק`);
    }, elapsed));
    timers.push(setTimeout(onComplete, elapsed + (reducedMotion ? 350 : selectedHasBonus ? 1700 : 800)));

    return () => timers.forEach(clearTimeout);
  }, [candidatePlayerIds, onComplete, playDrawFeedback, random, reducedMotion, selectedHasBonus, selectedPlayer, selectedPlayerId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>הגרלת הזירה</Text>
          <Text style={styles.title}>{landed ? 'המתמודד נבחר' : 'מי יוצא לדו־קרב?'}</Text>
          <Text style={styles.body}>
            {landed && selectedPlayer
              ? `${selectedPlayer.name} נבחר/ה לשחק`
              : `הסמן קופץ באקראי בין ${candidatePlayerIds.length} המתמודדים שטרם הוגרלו...`}
          </Text>
          {landed && selectedHasBonus && (
            <View style={styles.bonusNotice}>
              <Text style={styles.bonusNoticeText}>בונוס פעיל — 45 שניות במקום 40 בקרב הקרוב</Text>
            </View>
          )}
        </View>

        <View accessibilityLabel="הגרלת מתמודד בין משבצות הזירה" style={styles.boardFrame}>
          <View style={styles.board}>
            {state.cells.map((cell) => {
              const owner = state.players[cell.ownerId];
              const category = CATEGORY_BY_ID[owner.categoryId];
              const isCandidate = candidatePlayerIdSet.has(owner.id);
              const isHighlighted = owner.id === highlightedPlayerId;
              const foreground = isHighlighted ? colors.boardFrame : colors.textPrimary;
              const isAnchor = anchorIds.get(owner.id) === cell.id;
              const sameOwnerAt = (row: number, column: number) => (
                row >= 0 && row < 4 && column >= 0 && column < 4
                  ? state.cells[row * 4 + column].ownerId === owner.id
                  : false
              );
              const joinsTop = sameOwnerAt(cell.row - 1, cell.column);
              const joinsBottom = sameOwnerAt(cell.row + 1, cell.column);
              const joinsLeft = sameOwnerAt(cell.row, cell.column - 1);
              const joinsRight = sameOwnerAt(cell.row, cell.column + 1);
              return (
                <View
                  accessibilityLabel={`${owner.name}, ${category.name}, ${
                    isCandidate ? 'משתתף בהגרלה' : 'לא משתתף בהגרלה הנוכחית'
                  }${isHighlighted ? ', מסומן כעת' : ''}`}
                  key={cell.id}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isHighlighted ? colors.territoryMeEnd : colors.boardCellDark,
                      borderTopWidth: joinsTop ? 0 : isHighlighted ? 3 : 1,
                      borderBottomWidth: joinsBottom ? 0 : isHighlighted ? 3 : 1,
                      borderLeftWidth: joinsLeft ? 0 : isHighlighted ? 3 : 1,
                      borderRightWidth: joinsRight ? 0 : isHighlighted ? 3 : 1,
                      left: `${cell.column * 25}%`,
                      top: `${cell.row * 25}%`,
                    },
                    !owner.isActive && styles.inactiveCell,
                    isHighlighted && styles.highlightedCell,
                    landed && isHighlighted && styles.landedCell,
                  ]}>
                  {isAnchor ? (
                    <>
                      <Text numberOfLines={1} style={[styles.cellCategory, { color: foreground }]}>{category.name}</Text>
                      <View style={styles.ownerRow}>
                        <AvatarPortrait avatarId={owner.avatar} borderColor={foreground} size={25} />
                        <Text numberOfLines={1} style={[styles.cellName, { color: foreground }]}>{owner.name}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.lotteryTrack}>
          <View style={[styles.lotteryPulse, landed && styles.lotteryPulseLanded]} />
          <Text style={styles.lotteryText}>{landed ? 'הבחירה הושלמה' : 'ההגרלה בעיצומה'}</Text>
        </View>
        <Pressable accessibilityLabel="דילוג על ההגרלה" accessibilityRole="button" onPress={onComplete} style={styles.skipTransitionButton}>
          <Text style={styles.skipTransitionText}>דלגו</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', padding: 18, paddingTop: 24, paddingBottom: 18, justifyContent: 'space-between' },
  copy: { alignItems: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 29, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 5 },
  body: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', writingDirection: 'rtl', marginTop: 6 },
  bonusNotice: { borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.accentGold, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10 },
  bonusNoticeText: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  boardFrame: { width: '100%', maxWidth: 380, aspectRatio: 1, borderRadius: 20, backgroundColor: colors.boardFrame, borderWidth: 2, borderColor: colors.boardFrameBorder, padding: 8, alignSelf: 'center', shadowColor: colors.boardFrameBorder, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  board: { flex: 1, position: 'relative' },
  cell: { position: 'absolute', width: '25%', height: '25%', borderColor: colors.boardCellDarkBorder, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', opacity: 1 },
  inactiveCell: { opacity: 0.24 },
  highlightedCell: { opacity: 1, borderColor: colors.territoryMeBorder, zIndex: 3 },
  landedCell: { borderColor: colors.territoryMeBorder },
  ownerRow: { maxWidth: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 2 },
  cellName: { flexShrink: 1, fontSize: 12, lineHeight: 15, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' },
  cellCategory: { maxWidth: '100%', fontSize: 15, lineHeight: 18, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  lotteryTrack: { minHeight: 62, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.success, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10 },
  lotteryPulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, shadowColor: colors.success, shadowOpacity: 0.8, shadowRadius: 9 },
  lotteryPulseLanded: { backgroundColor: colors.accentGold, shadowColor: colors.accentGold, transform: [{ scale: 1.25 }] },
  lotteryText: { color: colors.textSecondary, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  skipTransitionButton: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  skipTransitionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
});
