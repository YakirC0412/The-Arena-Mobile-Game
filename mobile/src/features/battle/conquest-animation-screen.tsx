import { by } from '@/game/gender';
import { colors } from '@/design/tokens';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_BY_ID } from '@/content/categories';
import type { BattleResolution, GameState } from '@/game/types';
import { useGameFeedback } from '@/services/use-game-feedback';
import { useReducedMotion } from '@/design/use-reduced-motion';
import { BrandPrimaryButton } from '@/design/brand';
import { styles } from './battle-transition-styles';

export function ConquestAnimationScreen({
  beforeState,
  onComplete,
  resolution,
}: {
  beforeState: GameState;
  // Missing online: the server decides when the animation ends, so there is no "continue" button either.
  onComplete?: () => void;
  resolution: BattleResolution;
}) {
  const winner = resolution.state.players[resolution.winnerId];
  const winnerBefore = beforeState.players[resolution.winnerId];
  const loserBefore = beforeState.players[resolution.loserId];
  const winningCategory = CATEGORY_BY_ID[winner.categoryId];
  const conqueredIds = loserBefore.cellIds;
  const conqueredCells = conqueredIds.map((cellId) => beforeState.cells[cellId]);
  const winnerCells = winnerBefore.cellIds.map((cellId) => beforeState.cells[cellId]);
  const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const horizontalTravel = Math.abs(average(conqueredCells.map((cell) => cell.column)) - average(winnerCells.map((cell) => cell.column)))
    >= Math.abs(average(conqueredCells.map((cell) => cell.row)) - average(winnerCells.map((cell) => cell.row)));
  const forwardTravel = horizontalTravel
    ? average(conqueredCells.map((cell) => cell.column)) >= average(winnerCells.map((cell) => cell.column))
    : average(conqueredCells.map((cell) => cell.row)) >= average(winnerCells.map((cell) => cell.row));
  const axisValues = conqueredCells.map((cell) => horizontalTravel ? cell.column : cell.row);
  const axisMin = Math.min(...axisValues);
  const axisMax = Math.max(...axisValues);
  const axisSpan = axisMax - axisMin + 1;
  const [takeover] = useState(() => new Animated.Value(0));
  const [merge] = useState(() => new Animated.Value(0));
  const [wave] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  const { conquest: playConquestFeedback } = useGameFeedback();

  useEffect(() => {
    playConquestFeedback();
    AccessibilityInfo.announceForAccessibility(`${winner.name} ${by(winner, 'משתלט', 'משתלטת')} על השטח של ${loserBefore.name}`);
    if (reducedMotion) {
      takeover.setValue(1);
      merge.setValue(1);
      wave.setValue(0);
      const reducedTimer = setTimeout(() => onComplete?.(), 500);
      return () => clearTimeout(reducedTimer);
    }
    const conquest = Animated.sequence([
      Animated.timing(takeover, {
        duration: conqueredIds.length > 1 ? 2800 : 1500,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: false,
      }),
      Animated.timing(merge, {
        duration: 1200,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(wave, {
        duration: 800,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    let timer: ReturnType<typeof setTimeout> | null = null;
    conquest.start(({ finished }) => {
      if (finished) timer = setTimeout(() => onComplete?.(), 500);
    });
    return () => {
      conquest.stop();
      if (timer) clearTimeout(timer);
    };
  }, [conqueredIds.length, loserBefore.name, merge, onComplete, playConquestFeedback, reducedMotion, takeover, wave, winner.name]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.conquestScreen}>
        <Text style={styles.eyebrow}>השטח משתנה</Text>
        <Text style={styles.conquestTitle}>{winner.name} {by(winner, 'צובע', 'צובעת')} את השטח</Text>
        <Text style={styles.conquestBody}>משבצות {loserBefore.name} נצבעות ומתחברות לשטח אחד.</Text>

        <View style={styles.conquestBoardFrame}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.conquestWave,
              {
                borderColor: colors.territoryMeBorder,
                opacity: wave.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.95, 0] }),
                transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.12] }) }],
              },
            ]}
          />
          <View style={styles.conquestBoard}>
            {beforeState.cells.map((cell) => {
              const oldOwner = beforeState.players[cell.ownerId];
              const isConquered = oldOwner.id === loserBefore.id;
              const belongsToWinner = oldOwner.id === winner.id;
              const axisPosition = horizontalTravel ? cell.column : cell.row;
              const waveIndex = forwardTravel ? axisPosition - axisMin : axisMax - axisPosition;
              const waveStart = waveIndex / axisSpan;
              const waveEnd = (waveIndex + 1) / axisSpan;
              return (
                <View
                  key={cell.id}
                  style={[
                    styles.conquestCell,
                    { left: `${cell.column * 25}%`, top: `${cell.row * 25}%` },
                    belongsToWinner ? styles.conquestWinnerCell : styles.conquestDarkCell,
                    connectedConquestCellStyle(beforeState, cell.id),
                  ]}>
                  {isConquered && (
                    <Animated.View
                      style={[
                        styles.takeoverFill,
                        horizontalTravel
                          ? forwardTravel ? styles.takeoverFromLeft : styles.takeoverFromRight
                          : forwardTravel ? styles.takeoverFromTop : styles.takeoverFromBottom,
                        {
                          [horizontalTravel ? 'width' : 'height']: takeover.interpolate({
                            inputRange: [waveStart, waveEnd],
                            outputRange: ['0%', '100%'],
                            extrapolate: 'clamp',
                          }),
                        },
                      ]}
                    />
                  )}
                  {isConquered && (
                    <Animated.View
                      style={[
                        styles.territoryWaveSegment,
                        horizontalTravel ? styles.verticalWaveSegment : styles.horizontalWaveSegment,
                        horizontalTravel
                          ? { [forwardTravel ? 'left' : 'right']: takeover.interpolate({ inputRange: [waveStart, waveEnd], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }
                          : { [forwardTravel ? 'top' : 'bottom']: takeover.interpolate({ inputRange: [waveStart, waveEnd], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) },
                        { opacity: waveSegmentOpacity(takeover, waveStart, waveEnd) },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.mergedBoard,
              {
                opacity: merge,
                transform: [{ scale: merge.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
              },
            ]}>
            {resolution.state.cells.map((cell) => {
              const owner = resolution.state.players[cell.ownerId];
              const belongsToWinner = owner.id === winner.id;
              return (
                <View
                  key={cell.id}
                  style={[
                    styles.mergedCell,
                    { left: `${cell.column * 25}%`, top: `${cell.row * 25}%` },
                    belongsToWinner ? styles.conquestWinnerCell : styles.conquestDarkCell,
                    connectedConquestCellStyle(resolution.state, cell.id),
                  ]}
                />
              );
            })}
          </Animated.View>
        </View>

        <View style={styles.territoryResult}>
          <Text style={styles.territoryNumber}>{winner.cellIds.length}</Text>
          <Text style={styles.territoryLabel}>משבצות בשליטת {winner.name}</Text>
          <Text style={styles.categoryOutcome}>
            {resolution.inheritedCategory
              ? `קטגוריה חדשה: ${winningCategory.name} — ירושה מ${loserBefore.name}`
              : `הקטגוריה נשמרה: ${winningCategory.name}`}
          </Text>
        </View>
        {onComplete ? (
          <BrandPrimaryButton accessibilityLabel="המשך, דילוג על אנימציית ההשתלטות" label="המשך" onPress={onComplete} style={styles.continueButton} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function connectedConquestCellStyle(state: GameState, cellId: number) {
  const cell = state.cells[cellId];
  const sameOwnerAt = (row: number, column: number) => (
    row >= 0 && row < 4 && column >= 0 && column < 4
      ? state.cells[row * 4 + column].ownerId === cell.ownerId
      : false
  );
  return {
    borderTopWidth: sameOwnerAt(cell.row - 1, cell.column) ? 0 : 1.5,
    borderBottomWidth: sameOwnerAt(cell.row + 1, cell.column) ? 0 : 1.5,
    borderLeftWidth: sameOwnerAt(cell.row, cell.column - 1) ? 0 : 1.5,
    borderRightWidth: sameOwnerAt(cell.row, cell.column + 1) ? 0 : 1.5,
  };
}

function waveSegmentOpacity(value: Animated.Value, start: number, end: number) {
  if (start === 0 && end === 1) {
    return value.interpolate({ inputRange: [0, 0.999, 1], outputRange: [1, 1, 0], extrapolate: 'clamp' });
  }
  if (start === 0) {
    return value.interpolate({ inputRange: [0, end, Math.min(1, end + 0.001)], outputRange: [1, 1, 0], extrapolate: 'clamp' });
  }
  if (end === 1) {
    return value.interpolate({ inputRange: [Math.max(0, start - 0.001), start, 0.999, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  }
  return value.interpolate({ inputRange: [start - 0.001, start, end, end + 0.001], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
}
