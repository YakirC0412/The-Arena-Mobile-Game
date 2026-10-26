import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPortrait } from '@/components/avatar-portrait';
import { AppText as Text } from '@/design/app-text';
import { colors } from '@/design/tokens';
import { useGameFeedback } from '@/design/use-game-feedback';
import { useReducedMotion } from '@/design/use-reduced-motion';
import { CATEGORY_BY_ID } from '@/game/content';
import type { BattleResolution, GameState } from '@/game/types';

const FIREWORKS = [
  { symbol: '🎆', top: '-7%', left: '-8%', size: 42 },
  { symbol: '✨', top: '-8%', right: '-7%', size: 38 },
  { symbol: '✦', top: '34%', left: '-9%', size: 32 },
  { symbol: '🎇', top: '37%', right: '-10%', size: 42 },
  { symbol: '✨', bottom: '-7%', left: '-8%', size: 37 },
  { symbol: '✦', bottom: '-6%', right: '-7%', size: 36 },
] as const;

function connectedStyle(state: GameState, cellId: number) {
  const cell = state.cells[cellId];
  const sameOwnerAt = (row: number, column: number) => row >= 0 && row < 4 && column >= 0 && column < 4
    ? state.cells[row * 4 + column].ownerId === cell.ownerId
    : false;
  return {
    borderTopWidth: sameOwnerAt(cell.row - 1, cell.column) ? 0 : 1.5,
    borderBottomWidth: sameOwnerAt(cell.row + 1, cell.column) ? 0 : 1.5,
    borderLeftWidth: sameOwnerAt(cell.row, cell.column - 1) ? 0 : 1.5,
    borderRightWidth: sameOwnerAt(cell.row, cell.column + 1) ? 0 : 1.5,
  };
}

export function ChampionCelebrationScreen({
  beforeState,
  onComplete,
  resolution,
}: {
  beforeState: GameState;
  onComplete: () => void;
  resolution: BattleResolution;
}) {
  const winner = resolution.state.players[resolution.winnerId];
  const loser = beforeState.players[resolution.loserId];
  const category = CATEGORY_BY_ID[winner.categoryId];
  const winnerCells = beforeState.players[winner.id].cellIds.map((id) => beforeState.cells[id]);
  const loserCells = loser.cellIds.map((id) => beforeState.cells[id]);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const horizontal = Math.abs(average(loserCells.map((cell) => cell.column)) - average(winnerCells.map((cell) => cell.column)))
    >= Math.abs(average(loserCells.map((cell) => cell.row)) - average(winnerCells.map((cell) => cell.row)));
  const forward = horizontal
    ? average(loserCells.map((cell) => cell.column)) >= average(winnerCells.map((cell) => cell.column))
    : average(loserCells.map((cell) => cell.row)) >= average(winnerCells.map((cell) => cell.row));
  const axis = loserCells.map((cell) => horizontal ? cell.column : cell.row);
  const axisMin = Math.min(...axis);
  const axisMax = Math.max(...axis);
  const axisSpan = axisMax - axisMin + 1;
  const [takeover] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [fireworks] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  const { champion: playChampionFeedback } = useGameFeedback();
  const particles = useMemo(() => FIREWORKS, []);

  useEffect(() => {
    playChampionFeedback();
    AccessibilityInfo.announceForAccessibility(`${winner.name} זכה או זכתה במשחק ושולט או שולטת בכל הזירה`);
    if (reducedMotion) {
      takeover.setValue(1);
      reveal.setValue(1);
      fireworks.setValue(1);
      return;
    }
    const intro = Animated.sequence([
      Animated.timing(takeover, { duration: 3300, easing: Easing.inOut(Easing.cubic), toValue: 1, useNativeDriver: false }),
      Animated.timing(reveal, { duration: 850, easing: Easing.out(Easing.back(1.25)), toValue: 1, useNativeDriver: true }),
    ]);
    const livingFireworks = Animated.loop(Animated.sequence([
      Animated.timing(fireworks, { duration: 750, easing: Easing.out(Easing.cubic), toValue: 1, useNativeDriver: true }),
      Animated.timing(fireworks, { duration: 750, easing: Easing.in(Easing.cubic), toValue: 0.12, useNativeDriver: true }),
    ]));
    intro.start(({ finished }) => { if (finished) livingFireworks.start(); });
    return () => {
      intro.stop();
      livingFireworks.stop();
    };
  }, [fireworks, playChampionFeedback, reducedMotion, reveal, takeover, winner.name]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <Text style={styles.eyebrow}>הקרב האחרון הוכרע</Text>
        <Text style={styles.title}>הזירה עוברת לשליטת {winner.name}</Text>

        <View style={styles.boardFrame}>
          <View style={styles.board}>
            {beforeState.cells.map((cell) => {
              const isWinner = cell.ownerId === winner.id;
              const isLoser = cell.ownerId === loser.id;
              const position = horizontal ? cell.column : cell.row;
              const waveIndex = forward ? position - axisMin : axisMax - position;
              const start = waveIndex / axisSpan;
              const end = (waveIndex + 1) / axisSpan;
              return (
                <View key={cell.id} style={[styles.cell, connectedStyle(beforeState, cell.id), { backgroundColor: isWinner ? colors.territoryTarget : colors.boardCellDark, left: `${cell.column * 25}%`, top: `${cell.row * 25}%` }]}>
                  {isLoser ? (
                    <Animated.View style={[
                      styles.takeover,
                      horizontal ? (forward ? styles.fromLeft : styles.fromRight) : (forward ? styles.fromTop : styles.fromBottom),
                      { [horizontal ? 'width' : 'height']: takeover.interpolate({ inputRange: [start, end], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) },
                    ]} />
                  ) : null}
                </View>
              );
            })}
          </View>

          <Animated.View pointerEvents="none" style={[styles.unifiedArena, { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
            <AvatarPortrait avatarId={winner.avatar} borderColor={colors.textPrimary} size={82} />
            <Text style={styles.unifiedName}>{winner.name}</Text>
            <Text style={styles.unifiedLabel}>{category.name} • כל הזירה</Text>
          </Animated.View>

          {particles.map((particle, index) => (
            <Animated.Text key={index} style={[
              styles.firework,
              {
                top: 'top' in particle ? particle.top : undefined,
                right: 'right' in particle ? particle.right : undefined,
                bottom: 'bottom' in particle ? particle.bottom : undefined,
                left: 'left' in particle ? particle.left : undefined,
                fontSize: particle.size,
                opacity: fireworks,
                transform: [
                  { scale: fireworks.interpolate({ inputRange: [0, 1], outputRange: [0.45 + (index % 2) * 0.15, 1.25] }) },
                  { rotate: fireworks.interpolate({ inputRange: [0, 1], outputRange: [index % 2 ? '18deg' : '-18deg', index % 2 ? '-12deg' : '12deg'] }) },
                ],
              },
            ]}>{particle.symbol}</Animated.Text>
          ))}
        </View>

        <Animated.View style={[styles.winnerCard, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.winnerTitle}>{winner.name} הוא/היא אלוף/ת הזירה!</Text>
          <Text style={styles.winnerSubtitle}>כל 16 המשבצות נכבשו</Text>
        </Animated.View>

        <Animated.View style={{ opacity: reveal }}>
          <Pressable accessibilityLabel="התחלת משחק חדש" accessibilityRole="button" onPress={onComplete} style={styles.button}>
            <Text style={styles.buttonText}>התחלת משחק חדש</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 16 },
  eyebrow: { color: colors.accentGold, fontSize: 13, textAlign: 'center', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 3 },
  boardFrame: { width: '100%', maxWidth: 320, aspectRatio: 1, alignSelf: 'center', borderRadius: 25, backgroundColor: colors.boardFrame, borderWidth: 2, borderColor: colors.boardFrameBorder, padding: 10, marginTop: 20, shadowColor: colors.boardFrameBorder, shadowOpacity: 0.5, shadowRadius: 18, elevation: 9 },
  board: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 14 },
  cell: { position: 'absolute', width: '25%', height: '25%', borderColor: colors.territoryMeBorder, overflow: 'hidden' },
  takeover: { position: 'absolute', backgroundColor: colors.territoryTarget },
  fromLeft: { top: 0, bottom: 0, left: 0 },
  fromRight: { top: 0, bottom: 0, right: 0 },
  fromTop: { top: 0, right: 0, left: 0 },
  fromBottom: { right: 0, bottom: 0, left: 0 },
  unifiedArena: { position: 'absolute', top: 10, right: 10, bottom: 10, left: 10, borderRadius: 14, backgroundColor: colors.territoryTarget, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  unifiedName: { color: colors.textPrimary, fontSize: 25, fontWeight: '900', writingDirection: 'rtl', marginTop: 6 },
  unifiedLabel: { color: colors.textPrimary, fontSize: 14, writingDirection: 'rtl', marginTop: 2 },
  firework: { position: 'absolute', zIndex: 6, color: colors.accentGold, textShadowColor: colors.textPrimary, textShadowRadius: 8 },
  winnerCard: { minHeight: 104, borderRadius: 20, borderWidth: 2, borderColor: colors.accentGold, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 18, padding: 12 },
  trophy: { fontSize: 31 },
  winnerTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 2 },
  winnerSubtitle: { color: colors.accentGold, fontSize: 13, textAlign: 'center', writingDirection: 'rtl', marginTop: 3 },
  button: { minHeight: 56, borderRadius: 14, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  buttonText: { color: colors.bg, fontSize: 17, fontWeight: '900', writingDirection: 'rtl' },
});
