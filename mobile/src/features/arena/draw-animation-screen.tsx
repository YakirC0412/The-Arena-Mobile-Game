import { by } from '@/game/gender';
import { colors } from '@/design/tokens';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TerritoryLabelBox } from '@/features/arena/arena-board';
import { getTerritoryLabelRegion } from '@/features/arena/territory-layout';
import { CATEGORY_BY_ID } from '@/content/categories';
import { createRandomDrawSequence, drawStepDelaysMs } from '@/game/engine';
import type { GameState } from '@/game/types';
import { useGameFeedback } from '@/hooks/use-game-feedback';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export function DrawAnimationScreen({
  onComplete,
  quick = false,
  random = Math.random,
  state,
}: {
  onComplete?: () => void;
  // A short draw (about 1.5 s) for a bot: online, bots are drawn all the time and nobody should wait for them.
  quick?: boolean;
  random?: () => number;
  state: GameState;
}) {
  const selectedPlayer = state.selectedPlayerId ? state.players[state.selectedPlayerId] : null;
  const reducedMotion = useReducedMotion();
  const { draw: playDrawFeedback, drawRoll: playDrawRoll } = useGameFeedback();
  const candidatePlayerIds = useMemo(() => (
    Object.values(state.players)
      .filter((player) => (
        player.isActive
        && (!player.hasPlayedThisRound || player.id === state.selectedPlayerId)
      ))
      .map((player) => player.id)
  ), [state]);
  const candidatePlayerIdSet = useMemo(() => new Set(candidatePlayerIds), [candidatePlayerIds]);
  // Same label placement as the main board: the name sits in the territory's biggest rectangle.
  const labelRegions = useMemo(() => {
    const regions = new Map<string, ReturnType<typeof getTerritoryLabelRegion>>();
    Object.values(state.players).forEach((player) => {
      if (!player.isActive || player.cellIds.length === 0) return;
      regions.set(player.id, getTerritoryLabelRegion(player.cellIds.map((cellId) => state.cells[cellId])));
    });
    return regions;
  }, [state.cells, state.players]);
  const selectedPlayerId = selectedPlayer?.id ?? candidatePlayerIds[0];
  const selectedHasBonus = selectedPlayer?.bonusReady ?? false;
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(candidatePlayerIds[0]);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    // Reduce Motion slows the draw down but never removes it: the cursor jumping between squares is the point.
    const delays = quick ? Array.from({ length: 9 }, () => 110) : drawStepDelaysMs(reducedMotion);
    const sequence = createRandomDrawSequence(candidatePlayerIds, delays.length, random);
    // The full-length draw has its own sound (tocks that slow down, then a chime exactly at the landing); a bot's quick draw
    // and Reduce Motion (other timings) only play the chime when the cursor lands.
    const rolls = !quick && !reducedMotion;
    if (rolls) playDrawRoll();

    for (let step = 0; step < sequence.length; step += 1) {
      const playerId = sequence[step];
      timers.push(setTimeout(() => setHighlightedPlayerId(playerId), elapsed));
      elapsed += delays[step];
    }

    timers.push(setTimeout(() => {
      setHighlightedPlayerId(selectedPlayerId);
      setLanded(true);
      if (!rolls) playDrawFeedback();
      if (selectedPlayer) AccessibilityInfo.announceForAccessibility(`${selectedPlayer.name} ${by(selectedPlayer, 'נבחר', 'נבחרה')} לשחק`);
    }, elapsed));
    if (onComplete) timers.push(setTimeout(onComplete, elapsed + (selectedHasBonus ? 1700 : 800)));

    return () => timers.forEach(clearTimeout);
  }, [candidatePlayerIds, onComplete, playDrawFeedback, playDrawRoll, quick, random, reducedMotion, selectedHasBonus, selectedPlayer, selectedPlayerId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>הגרלת הזירה</Text>
          <Text style={styles.title}>{landed ? 'המתמודד נבחר' : 'מי יוצא לדו־קרב?'}</Text>
          <Text style={styles.body}>
            {landed && selectedPlayer
              ? `${selectedPlayer.name} ${by(selectedPlayer, 'נבחר', 'נבחרה')} לשחק`
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
                      backgroundColor: isHighlighted ? colors.territoryMeEnd : colors.arenaFloor,
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
                </View>
              );
            })}
            {Object.values(state.players).map((owner) => {
              const region = labelRegions.get(owner.id);
              if (!region) return null;
              const highlighted = owner.id === highlightedPlayerId;
              return (
                // zIndex above the highlighted cell (3): otherwise the cell the cursor sits on hides its own label.
                <View key={`label-${owner.id}`} pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 5 }, !owner.isActive && styles.inactiveCell]}>
                  <TerritoryLabelBox
                    categoryName={CATEGORY_BY_ID[owner.categoryId].name}
                    isMe={highlighted}
                    mode="simulation"
                    ownerAvatar={owner.avatar}
                    ownerName={owner.name}
                    region={region}
                  />
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
  safe: { flex: 1, backgroundColor: colors.screen },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', padding: 18, paddingTop: 24, paddingBottom: 18, justifyContent: 'space-between' },
  copy: { alignItems: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 29, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 5 },
  body: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', writingDirection: 'rtl', marginTop: 6 },
  bonusNotice: { borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.accentGold, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10 },
  bonusNoticeText: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  boardFrame: { width: '100%', maxWidth: 380, aspectRatio: 1, borderRadius: 20, backgroundColor: colors.boardFrame, borderWidth: 2, borderColor: colors.boardFrameBorder, padding: 8, alignSelf: 'center', shadowColor: colors.boardFrameBorder, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  board: { flex: 1, position: 'relative' },
  cell: { position: 'absolute', width: '25%', height: '25%', borderColor: colors.arenaFloorBorder, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', opacity: 1 },
  inactiveCell: { opacity: 0.24 },
  highlightedCell: { opacity: 1, borderColor: colors.territoryMeBorder, zIndex: 3 },
  landedCell: { borderColor: colors.territorySelected },
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
