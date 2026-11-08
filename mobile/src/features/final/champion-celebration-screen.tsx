import { by } from '@/game/gender';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_BY_ID } from '@/content/categories';
import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { colors } from '@/design/tokens';
import { useReducedMotion } from '@/design/use-reduced-motion';
import type { BattleResolution, GameState } from '@/game/types';
import { useGameFeedback } from '@/services/use-game-feedback';

const NATIVE = Platform.OS !== 'web';
const TAKEOVER_MS = 2400;
const STAGE = [colors.brandNavyDeep, colors.boardFrame, colors.brandNavyDeep] as const;
const SPARK_COLORS = [colors.accentGold, colors.brandSky, colors.textPrimary, colors.territoryTargetBorder];

// Firework bursts inside the arena: position (% of the board), radius in px,
// spark count, and when it first fires. Each one then repeats forever.
const BURSTS = [
  { x: 22, y: 24, radius: 46, sparks: 12, delay: 0, period: 1500 },
  { x: 76, y: 20, radius: 40, sparks: 10, delay: 350, period: 1700 },
  { x: 50, y: 52, radius: 58, sparks: 14, delay: 700, period: 1900 },
  { x: 18, y: 78, radius: 38, sparks: 10, delay: 1000, period: 1600 },
  { x: 80, y: 76, radius: 44, sparks: 12, delay: 1300, period: 1800 },
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

// The game's last moment, for a human or a bot champion: the winner's light
// blue floods the last territory (arena colors), then the arena turns into a
// night stage with fireworks bursting inside it, and the champion's avatar and
// name rise above them.
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
  const [stage] = useState(() => new Animated.Value(0));
  const [champion] = useState(() => new Animated.Value(0));
  const [bursts] = useState(() => BURSTS.map(() => new Animated.Value(0)));
  const reducedMotion = useReducedMotion();
  const { champion: playChampionFeedback } = useGameFeedback();

  useEffect(() => {
    playChampionFeedback();
    AccessibilityInfo.announceForAccessibility(`${winner.name} אלוף או אלופת הזירה`);
    if (reducedMotion) {
      takeover.setValue(1);
      stage.setValue(1);
      champion.setValue(1);
      return;
    }
    const fireworks = Animated.parallel(bursts.map((value, index) => Animated.sequence([
      Animated.delay(BURSTS[index].delay),
      Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: BURSTS[index].period, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      ])),
    ])));
    const intro = Animated.sequence([
      Animated.timing(takeover, { toValue: 1, duration: TAKEOVER_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(stage, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
    ]);
    intro.start(({ finished }) => {
      if (!finished) return;
      fireworks.start();
      Animated.timing(champion, { toValue: 1, duration: 750, easing: Easing.out(Easing.back(1.5)), useNativeDriver: NATIVE }).start();
    });
    return () => {
      intro.stop();
      fireworks.stop();
    };
  }, [bursts, champion, playChampionFeedback, reducedMotion, stage, takeover, winner.name]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <Text style={styles.eyebrow} weight="bold">הקרב האחרון הוכרע</Text>
        <Text style={styles.title} weight="black">
          {winner.isHuman ? 'כבשת את הזירה!' : `${winner.name} ${by(winner, 'כובש', 'כובשת')} את הזירה`}
        </Text>

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
                <View
                  key={cell.id}
                  style={[
                    styles.cell,
                    connectedStyle(beforeState, cell.id),
                    isWinner ? styles.winnerCell : styles.floorCell,
                    { left: `${cell.column * 25}%`, top: `${cell.row * 25}%` },
                  ]}>
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

            {/* The conquered arena becomes a night stage for the fireworks. */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: stage }]}>
              <LinearGradient colors={STAGE} end={{ x: 0.5, y: 1 }} start={{ x: 0.5, y: 0 }} style={StyleSheet.absoluteFill} />
              <View style={styles.stageRing} />
            </Animated.View>

            {BURSTS.map((burst, burstIndex) => (
              <View
                key={burstIndex}
                pointerEvents="none"
                style={[styles.burstOrigin, { left: `${burst.x}%`, top: `${burst.y}%` }]}>
                {Array.from({ length: burst.sparks }, (_, sparkIndex) => {
                  const angle = (sparkIndex / burst.sparks) * Math.PI * 2 + burstIndex;
                  const dx = Math.cos(angle) * burst.radius;
                  const dy = Math.sin(angle) * burst.radius;
                  const value = bursts[burstIndex];
                  return (
                    <Animated.View
                      key={sparkIndex}
                      style={[
                        styles.spark,
                        {
                          backgroundColor: SPARK_COLORS[(sparkIndex + burstIndex) % SPARK_COLORS.length],
                          opacity: value.interpolate({ inputRange: [0, 0.08, 0.6, 1], outputRange: [0, 1, 0.9, 0] }),
                          transform: [
                            { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                            // A little gravity: the sparks sag as they fade.
                            { translateY: value.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, dy * 0.85, dy + 14] }) },
                            { scale: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.2, 0.3] }) },
                          ],
                        },
                      ]}
                    />
                  );
                })}
                <Animated.View
                  style={[
                    styles.flash,
                    {
                      opacity: bursts[burstIndex].interpolate({ inputRange: [0, 0.05, 0.25], outputRange: [0, 0.9, 0], extrapolate: 'clamp' }),
                      transform: [{ scale: bursts[burstIndex].interpolate({ inputRange: [0, 0.25], outputRange: [0.3, 1.6], extrapolate: 'clamp' }) }],
                    },
                  ]}
                />
              </View>
            ))}

            {/* The champion, above the fireworks. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.championBlock,
                {
                  opacity: champion,
                  transform: [
                    { translateY: champion.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                    { scale: champion.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                  ],
                },
              ]}>
              <Text style={styles.crown}>👑</Text>
              <View style={styles.avatarRing}>
                <AvatarPortrait avatarId={winner.avatar} borderColor={colors.accentGold} size={92} />
              </View>
              <View style={styles.namePlate}>
                <Text numberOfLines={1} style={styles.championName} weight="black">{winner.name}</Text>
                <Text style={styles.championMeta} weight="bold">{category.name} · כל 16 המשבצות</Text>
              </View>
            </Animated.View>
          </View>
        </View>

        <Animated.View style={[styles.footer, { opacity: champion }]}>
          <Text style={styles.footerTitle} weight="black">
            {winner.isHuman ? by(winner, 'אתה אלוף הזירה 🏆', 'את אלופת הזירה 🏆') : `${winner.name} ${by(winner, 'הוא אלוף', 'היא אלופת')} הזירה 🏆`}
          </Text>
          <Pressable accessibilityLabel="התחלת משחק חדש" accessibilityRole="button" onPress={onComplete} style={styles.button}>
            <Text style={styles.buttonText} weight="black">התחלת משחק חדש</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screen },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 16 },
  eyebrow: { color: colors.accentGold, fontSize: 13, textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: 27, lineHeight: 34, textAlign: 'center', marginTop: 3 },

  boardFrame: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: 25,
    backgroundColor: colors.boardFrame,
    borderWidth: 2,
    borderColor: colors.boardFrameBorder,
    padding: 10,
    marginTop: 20,
    shadowColor: colors.boardFrameBorder,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 9,
  },
  board: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 14 },
  cell: { position: 'absolute', width: '25%', height: '25%', overflow: 'hidden' },
  winnerCell: { backgroundColor: colors.territoryMeEnd, borderColor: colors.territoryMeBorder },
  floorCell: { backgroundColor: colors.arenaFloor, borderColor: colors.arenaFloorBorder },
  takeover: { position: 'absolute', backgroundColor: colors.territoryMeEnd },
  fromLeft: { top: 0, bottom: 0, left: 0 },
  fromRight: { top: 0, bottom: 0, right: 0 },
  fromTop: { top: 0, right: 0, left: 0 },
  fromBottom: { right: 0, bottom: 0, left: 0 },

  stageRing: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 14, borderWidth: 2, borderColor: colors.brandSky, opacity: 0.6 },
  burstOrigin: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  flash: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: colors.textPrimary },

  championBlock: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  crown: { fontSize: 30, lineHeight: 36, marginBottom: -6 },
  avatarRing: {
    padding: 5,
    borderRadius: 30,
    backgroundColor: 'rgba(248, 201, 92, 0.18)',
    borderWidth: 2,
    borderColor: colors.accentGold,
    shadowColor: colors.accentGold,
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  namePlate: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(3, 10, 36, 0.78)',
    borderWidth: 1,
    borderColor: colors.brandSky,
    alignItems: 'center',
  },
  championName: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  championMeta: { color: colors.brandSky, fontSize: 12, textAlign: 'center' },

  footer: { marginTop: 20, gap: 14 },
  footerTitle: { color: colors.textPrimary, fontSize: 19, textAlign: 'center' },
  button: { minHeight: 56, borderRadius: 14, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.bg, fontSize: 17 },
});
