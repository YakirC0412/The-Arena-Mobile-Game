import { colors } from '@/design/tokens';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArenaBoard } from '@/features/arena/arena-board';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { CATEGORY_BY_ID } from '@/content/categories';
import { getNeighborPlayerIds } from '@/game/engine';
import type { BattleResolution, BattleSetup, GameState } from '@/game/types';
import { ITEM_IMAGES } from '@/content/item-images';
import { useGameFeedback } from '@/services/use-game-feedback';
import { useReducedMotion } from '@/design/use-reduced-motion';

type SimulationFrame = {
  activeId: string;
  attackerSeconds: number;
  defenderSeconds: number;
  questionIndex: number;
  status: string;
  decided: boolean;
};

function createSimulationFrames(setup: BattleSetup, winnerId: string): SimulationFrame[] {
  const loserId = winnerId === setup.attackerId ? setup.defenderId : setup.attackerId;
  let attackerSeconds = setup.attackerSeconds;
  let defenderSeconds = setup.defenderSeconds;
  let activeId = setup.attackerId;
  let questionIndex = 0;
  const frames: SimulationFrame[] = [];
  const spendPattern = [3, 4, 2, 5, 3, 6, 2, 4, 5, 3, 4, 6, 3, 5];

  spendPattern.forEach((spend, index) => {
    if (activeId === setup.attackerId) attackerSeconds = Math.max(1, attackerSeconds - spend);
    else defenderSeconds = Math.max(1, defenderSeconds - spend);
    frames.push({
      activeId,
      attackerSeconds,
      defenderSeconds,
      questionIndex,
      status: index % 5 === 4 ? 'דילוג • 3- שניות' : 'מנסה לזהות...',
      decided: false,
    });
    if (index % 5 === 4) {
      if (activeId === setup.attackerId) attackerSeconds = Math.max(1, attackerSeconds - 3);
      else defenderSeconds = Math.max(1, defenderSeconds - 3);
    } else {
      questionIndex += 1;
      frames.push({
        activeId,
        attackerSeconds,
        defenderSeconds,
        questionIndex,
        status: 'תשובה נכונה • התור עובר',
        decided: false,
      });
      activeId = activeId === setup.attackerId ? setup.defenderId : setup.attackerId;
    }
  });

  activeId = loserId;
  frames.push({
    activeId,
    attackerSeconds,
    defenderSeconds,
    questionIndex,
    status: 'הזמן הולך ואוזל...',
    decided: false,
  });
  frames.push({
    activeId,
    attackerSeconds: loserId === setup.attackerId ? 0 : attackerSeconds,
    defenderSeconds: loserId === setup.defenderId ? 0 : defenderSeconds,
    questionIndex,
    status: 'הזמן נגמר',
    decided: true,
  });
  return frames;
}

export function BattleOutcomeScreen({
  onComplete,
  resolution,
}: {
  onComplete: () => void;
  resolution: BattleResolution;
}) {
  const winner = resolution.state.players[resolution.winnerId];
  const loser = resolution.state.players[resolution.loserId];
  const category = CATEGORY_BY_ID[winner.categoryId];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${winner.name} ניצח או ניצחה. ${loser.name} הודח או הודחה`);
    const timer = setTimeout(onComplete, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.outcomeScreen}>
        <Text style={styles.outcomeMedal}>🏅</Text>
        <Text style={styles.eyebrow}>הדו־קרב הסתיים</Text>
        <Text style={styles.outcomeTitle}>{winner.name} ניצח/ה!</Text>
        <Text style={styles.outcomeLoser}>{loser.name} הודח/ה מהזירה</Text>
        <View style={[styles.outcomeCategory, { borderColor: winner.color }]}>
          <Text style={styles.outcomeCategoryIcon}>{category.icon}</Text>
          <View style={styles.outcomeCategoryCopy}>
            <Text style={styles.outcomeCategoryLabel}>
              {resolution.inheritedCategory ? 'קטגוריה שנירשה' : 'הקטגוריה שנשמרה'}
            </Text>
            <Text style={styles.outcomeCategoryName}>{category.name}</Text>
          </View>
        </View>
        <Text style={styles.outcomeNext}>מיד עוברים להשתלטות על השטח...</Text>
      </View>
    </SafeAreaView>
  );
}

export function AiTargetSelectionScreen({
  onComplete,
  state,
  targetId,
  winnerId,
}: {
  onComplete: (targetId: string) => void;
  state: GameState;
  targetId: string;
  winnerId: string;
}) {
  const possibleTargets = getNeighborPlayerIds(state, winnerId);
  const [revealedTargetId, setRevealedTargetId] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState(1);
  const completedRef = useRef(false);
  const winner = state.players[winnerId];
  const target = state.players[targetId];

  const finishSelection = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(targetId);
  }, [onComplete, targetId]);

  useEffect(() => {
    const revealTimer = setTimeout(() => setRevealedTargetId(targetId), 3000);
    const completeTimer = setTimeout(finishSelection, 4400);
    const thinkingTimer = setInterval(() => setThinkingStep((step) => (step % 3) + 1), 420);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(completeTimer);
      clearInterval(thinkingTimer);
    };
  }, [finishSelection, targetId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.aiTargetScreen}>
        <Text style={styles.eyebrow}>בחירת היריב הבא</Text>
        <Text style={styles.aiTargetTitle}>
          {revealedTargetId ? `${winner.name} בחר/ה יעד` : `${winner.name} בוחר/ת יעד${'.'.repeat(thinkingStep)}`}
        </Text>
        <View style={styles.aiTargetBoard}>
          <ArenaBoard
            meId={winnerId}
            mode="simulation"
            selectedId={revealedTargetId}
            state={state}
            targetIds={revealedTargetId ? [revealedTargetId] : possibleTargets}
          />
        </View>
        <View style={styles.aiTargetStatus}>
          <Text style={styles.aiTargetStatusText}>
            {revealedTargetId
              ? `${CATEGORY_BY_ID[target.categoryId].name} · ${target.name} · ${target.cellIds.length} משבצות`
              : 'היריבים הזמינים מודגשים בזירה'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={finishSelection} style={styles.aiTargetSkipButton}>
          <Text style={styles.aiTargetSkipText}>דלגו לתוצאה</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function BattleIntroScreen({
  battleNumber = 1,
  onComplete,
  setup,
  state,
}: {
  battleNumber?: number;
  onComplete: () => void;
  setup: BattleSetup;
  state: GameState;
}) {
  const attacker = state.players[setup.attackerId];
  const defender = state.players[setup.defenderId];
  const category = CATEGORY_BY_ID[setup.categoryId];
  const hasBonusNotice = setup.attackerUsesBonus || setup.defenderUsesBonus;
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(entrance, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.centerScreen}>
        <Text style={styles.eyebrow}>{setup.isFinal ? 'הקרב על כל הזירה' : 'האתגר נבחר'}</Text>
        <View style={styles.duelTitleWrap}>
          <Text style={[styles.duelTitle, styles.duelTitleDepth]}>{setup.isFinal ? 'דו־קרב הגמר' : `דו־קרב ${battleNumber}`}</Text>
          <Text style={styles.duelTitle}>{setup.isFinal ? 'דו־קרב הגמר' : `דו־קרב ${battleNumber}`}</Text>
        </View>

        <Animated.View
          style={[
            styles.matchup,
            {
              opacity: entrance,
              transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}>
          <PlayerCard avatar={attacker.avatar} bonus={setup.attackerUsesBonus} cellCount={attacker.cellIds.length} color={attacker.color} label="תוקף" name={attacker.name} />
          <View style={styles.versusBadge}><Text style={styles.versusText}>VS</Text></View>
          <PlayerCard avatar={defender.avatar} bonus={setup.defenderUsesBonus} cellCount={defender.cellIds.length} color={defender.color} label="מגן" name={defender.name} />
        </Animated.View>

        <View style={styles.categoryCard}>
          <Text style={styles.categoryLabel}>הקטגוריה עליה מתחרים</Text>
          <Text style={styles.categoryValue}>{category.name}</Text>
        </View>

        {hasBonusNotice && (
          <View style={styles.bonusNotice}>
            <Text style={styles.bonusNoticeText}>
              {setup.attackerUsesBonus && setup.defenderUsesBonus
                ? `ל${attacker.name} ול${defender.name} יש בונוס — כל אחד מתחיל עם 45 שניות.`
                : `${setup.attackerUsesBonus ? attacker.name : defender.name} מקבל/ת 45 שניות במקום 40.`}
            </Text>
          </View>
        )}

        <Pressable accessibilityRole="button" onPress={onComplete} style={styles.startBattleButton}>
          <Text style={styles.startBattleButtonText}>התחלת דו־קרב</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function AiBattleSimulationScreen({
  onComplete,
  setup,
  state,
  winnerId,
}: {
  onComplete: (winnerId: string) => void;
  setup: BattleSetup;
  state: GameState;
  winnerId: string;
}) {
  const attacker = state.players[setup.attackerId];
  const defender = state.players[setup.defenderId];
  const category = CATEGORY_BY_ID[setup.categoryId];
  const winner = state.players[winnerId];
  const frames = useMemo(() => createSimulationFrames(setup, winnerId), [setup, winnerId]);
  const [frameIndex, setFrameIndex] = useState(0);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const item = category.items[frame.questionIndex % category.items.length];
  const itemImage = item.imageKey ? ITEM_IMAGES[item.imageKey] : undefined;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((current) => Math.min(current + 1, frames.length - 1));
    }, 280);
    const completeTimer = setTimeout(() => onComplete(winnerId), frames.length * 280 + 1100);
    return () => {
      clearInterval(interval);
      clearTimeout(completeTimer);
    };
  }, [frames.length, onComplete, winnerId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.simulationScreen}>
        <Text style={styles.eyebrow}>סימולציית דו־קרב</Text>
        <Text style={styles.simulationTitle}>{category.name}</Text>

        <View style={styles.simulationPlayers}>
          <SimulationClock active={!frame.decided && frame.activeId === attacker.id} avatar={attacker.avatar} color={attacker.color} name={attacker.name} seconds={frame.attackerSeconds} />
          <Text style={styles.simulationVs}>מול</Text>
          <SimulationClock active={!frame.decided && frame.activeId === defender.id} avatar={defender.avatar} color={defender.color} name={defender.name} seconds={frame.defenderSeconds} />
        </View>

        <View style={styles.questionStage}>
          <Text style={styles.questionCount}>{frame.decided ? 'הקרב הוכרע' : `תמונה ${frame.questionIndex + 1}`}</Text>
          <View style={styles.abstractImage}>
            {itemImage
              ? <Image resizeMode="contain" source={itemImage} style={styles.simulationImage} />
              : <Text style={styles.simulationVisual}>{item.visual}</Text>}
          </View>
          <Text style={styles.thinkingText}>
            {frame.decided ? `${winner.name} ניצח/ה בדו־קרב` : `${state.players[frame.activeId].name}: ${frame.status}`}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((frameIndex + 1) / frames.length) * 100}%` }]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export function ConquestAnimationScreen({
  beforeState,
  onComplete,
  resolution,
}: {
  beforeState: GameState;
  onComplete: () => void;
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
    AccessibilityInfo.announceForAccessibility(`${winner.name} משתלט או משתלטת על השטח של ${loserBefore.name}`);
    if (reducedMotion) {
      takeover.setValue(1);
      merge.setValue(1);
      wave.setValue(0);
      const reducedTimer = setTimeout(onComplete, 500);
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
      if (finished) timer = setTimeout(onComplete, 500);
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
        <Text style={styles.conquestTitle}>{winner.name} צובע/ת את השטח</Text>
        <Text style={styles.conquestBody}>משבצות {loserBefore.name} נצבעות ומתחברות לשטח אחד.</Text>

        <View style={styles.conquestBoardFrame}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.conquestWave,
              {
                borderColor: colors.territoryTargetBorder,
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
        <Pressable accessibilityLabel="דילוג על אנימציית ההשתלטות" accessibilityRole="button" onPress={onComplete} style={styles.transitionSkipButton}>
          <Text style={styles.transitionSkipText}>המשך</Text>
        </Pressable>
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

export function AiDecisionScreen({
  canContinue,
  onDecision,
  winnerName,
}: {
  canContinue: boolean;
  onDecision: (continues: boolean) => void;
  winnerName: string;
}) {
  const [choice, setChoice] = useState<boolean | null>(null);

  useEffect(() => {
    const decision = canContinue && Math.random() < 0.38;
    const revealTimer = setTimeout(() => setChoice(decision), 1250);
    const completeTimer = setTimeout(() => onDecision(decision), 2600);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(completeTimer);
    };
  }, [canContinue, onDecision]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.decisionScreen}>
        <Text style={styles.eyebrow}>החלטת המנצח</Text>
        <Text style={styles.decisionTitle}>מה {winnerName} יבחר/תבחר?</Text>
        <Text style={styles.decisionBody}>{choice === null ? 'ההחלטה מתקבלת...' : 'הבחירה התקבלה'}</Text>

        <View style={styles.decisionCards}>
          <View style={[styles.decisionCard, choice === true && styles.decisionCardSelected]}>
            <Text style={styles.decisionCardSymbol}>↗</Text>
            <Text style={styles.decisionCardTitle}>להמשיך</Text>
            <Text style={styles.decisionCardBody}>לבחור יריב סמוך נוסף</Text>
          </View>
          <View style={[styles.decisionCard, choice === false && styles.decisionCardSelected]}>
            <Text style={styles.decisionCardSymbol}>⌂</Text>
            <Text style={styles.decisionCardTitle}>לחזור לזירה</Text>
            <Text style={styles.decisionCardBody}>לעבור להגרלה חדשה</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PlayerCard({ avatar, bonus, cellCount, color, label, name }: { avatar: string; bonus: boolean; cellCount: number; color: string; label: string; name: string }) {
  return (
    <View style={[styles.playerCard, { borderColor: color }]}>
      <View style={[styles.playerColor, { backgroundColor: color }]} />
      <Text style={styles.playerLabel}>{label}</Text>
      <View style={styles.playerAvatar}><AvatarPortrait avatarId={avatar} borderColor={colors.textPrimary} size={112} /></View>
      <Text numberOfLines={1} style={styles.playerCardName}>{name}</Text>
      <Text numberOfLines={1} style={styles.playerCategory}>{cellCount === 1 ? 'משבצת אחת' : `${cellCount} משבצות`}</Text>
      {bonus && <Text style={styles.playerBonus}>45 שניות • בונוס</Text>}
    </View>
  );
}

function SimulationClock({ active, avatar, color, name, seconds }: { active: boolean; avatar: string; color: string; name: string; seconds: number }) {
  return (
    <View style={[styles.simulationClock, active && styles.simulationClockActive, { borderColor: color }]}> 
      <AvatarPortrait avatarId={avatar} borderColor={color} size={52} />
      <Text numberOfLines={1} style={styles.clockName}>{name}</Text>
      <Text style={styles.clockSeconds}>{seconds}</Text>
      <Text style={styles.clockUnit}>שניות</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerScreen: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  introTitle: { color: colors.textPrimary, fontSize: 27, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 5 },
  duelTitleWrap: { height: 53, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  duelTitle: { position: 'absolute', color: colors.textPrimary, fontSize: 38, lineHeight: 48, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', textShadowColor: colors.boardFrameBorder, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1 },
  duelTitleDepth: { color: colors.boardFrameBorder, transform: [{ translateY: 5 }], textShadowColor: colors.bg, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 4 },
  matchup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginTop: 14 },
  playerCard: { flex: 1, minHeight: 232, borderRadius: 10, borderWidth: 2, backgroundColor: colors.surface, paddingHorizontal: 7, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', shadowColor: colors.boardFrameBorder, shadowOpacity: 0.5, shadowRadius: 10 },
  playerColor: { width: 44, height: 5, borderRadius: 0, marginBottom: 5 },
  playerLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  playerAvatar: { marginTop: 5, marginBottom: 6 },
  playerCardName: { color: colors.textPrimary, fontSize: 19, fontWeight: '900', writingDirection: 'rtl', marginTop: 1 },
  playerCategory: { color: colors.accentGold, fontSize: 12, fontWeight: '800', writingDirection: 'rtl', marginTop: 2 },
  playerBonus: { color: colors.accentGold, fontSize: 12, fontWeight: '900', marginTop: 7, writingDirection: 'rtl' },
  versusBadge: { width: 39, height: 39, borderRadius: 20, backgroundColor: colors.accentGold, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  versusText: { color: colors.bg, fontSize: 13, fontWeight: '900' },
  categoryCard: { borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.boardFrameBorder, padding: 12, marginTop: 12, alignItems: 'center' },
  categoryLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  categoryValue: { color: colors.success, fontSize: 26, fontWeight: '900', writingDirection: 'rtl', marginTop: 2 },
  categoryOwner: { color: colors.textSecondary, fontSize: 12, writingDirection: 'rtl', marginTop: 2 },
  bonusNotice: { borderRadius: 16, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.accentGold, padding: 12, marginTop: 12 },
  bonusNoticeText: { color: colors.accentGold, fontSize: 12, lineHeight: 18, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  startBattleButton: { minHeight: 54, borderRadius: 12, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  startBattleButtonText: { color: colors.bg, fontSize: 16, fontWeight: '900', writingDirection: 'rtl' },
  simulationScreen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', padding: 16, paddingTop: 18 },
  simulationTitle: { color: colors.textPrimary, fontSize: 29, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 3 },
  simulationPlayers: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 24 },
  simulationClock: { flex: 1, minHeight: 108, borderRadius: 20, borderWidth: 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  simulationClockActive: { backgroundColor: colors.surface, transform: [{ scale: 1.025 }] },
  clockName: { color: colors.textSecondary, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  clockSeconds: { color: colors.textPrimary, fontSize: 31, lineHeight: 35, fontWeight: '900', fontVariant: ['tabular-nums'] },
  clockUnit: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  simulationVs: { color: colors.accentGold, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  questionStage: { flex: 1, minHeight: 190, borderRadius: 27, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 14, padding: 14, alignItems: 'center', justifyContent: 'center' },
  questionCount: { color: colors.accentGold, fontSize: 12, fontWeight: '900', writingDirection: 'rtl', marginBottom: 13 },
  abstractImage: { width: 150, height: 130, borderRadius: 25, backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' },
  simulationImage: { width: 138, height: 118, borderRadius: 18 },
  simulationVisual: { fontSize: 68, lineHeight: 86 },
  thinkingText: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl', marginTop: 16 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden', marginTop: 18 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.success },
  outcomeScreen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', padding: 26, justifyContent: 'center', alignItems: 'center' },
  outcomeMedal: { fontSize: 68, marginBottom: 10 },
  outcomeTitle: { color: colors.textPrimary, fontSize: 32, lineHeight: 40, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 5 },
  outcomeLoser: { color: colors.textSecondary, fontSize: 14, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl', marginTop: 6 },
  outcomeCategory: { width: '100%', minHeight: 94, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 14, borderRadius: 22, borderWidth: 2, backgroundColor: colors.surface, marginTop: 25, padding: 14 },
  outcomeCategoryIcon: { fontSize: 42 },
  outcomeCategoryCopy: { alignItems: 'flex-end' },
  outcomeCategoryLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  outcomeCategoryName: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', writingDirection: 'rtl', marginTop: 2 },
  outcomeNext: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 18 },
  aiTargetScreen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 22, justifyContent: 'center' },
  aiTargetTitle: { color: colors.textPrimary, fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 4 },
  aiTargetBoard: { marginTop: 18 },
  aiTargetStatus: { minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.success, justifyContent: 'center', alignItems: 'center', marginTop: 18, paddingHorizontal: 12 },
  aiTargetStatusText: { color: colors.textPrimary, fontSize: 12, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  aiTargetSkipButton: { minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: colors.textSecondary, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  aiTargetSkipText: { color: colors.textPrimary, fontSize: 14, fontWeight: '900', writingDirection: 'rtl' },
  conquestScreen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 16, alignItems: 'stretch', justifyContent: 'center' },
  conquestTitle: { color: colors.textPrimary, fontSize: 25, lineHeight: 32, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 2 },
  conquestBody: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', writingDirection: 'rtl', marginTop: 5 },
  conquestBoardFrame: { width: '100%', maxWidth: 360, aspectRatio: 1, alignSelf: 'center', borderRadius: 20, backgroundColor: colors.boardFrame, borderWidth: 2, borderColor: colors.boardFrameBorder, padding: 8, marginTop: 14, shadowColor: colors.boardFrameBorder, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  conquestWave: { position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, borderRadius: 12, borderWidth: 8, zIndex: 3 },
  conquestBoard: { width: '100%', aspectRatio: 1, position: 'relative' },
  conquestCell: { position: 'absolute', width: '25%', height: '25%', borderRadius: 0, borderWidth: 1.5, borderColor: colors.territoryMeBorder, overflow: 'hidden' },
  conquestDarkCell: { backgroundColor: colors.boardCellDark },
  conquestWinnerCell: { backgroundColor: colors.territoryTarget },
  takeoverFill: { position: 'absolute', borderRadius: 0, backgroundColor: colors.territoryTarget },
  takeoverFromLeft: { top: 0, bottom: 0, left: 0 },
  takeoverFromRight: { top: 0, bottom: 0, right: 0 },
  takeoverFromTop: { top: 0, right: 0, left: 0 },
  takeoverFromBottom: { right: 0, bottom: 0, left: 0 },
  territoryWaveSegment: { position: 'absolute', borderColor: colors.territoryMeBorder, borderStyle: 'solid', shadowColor: colors.territoryTargetBorder, shadowOpacity: 1, shadowRadius: 12, zIndex: 4 },
  verticalWaveSegment: { top: 0, bottom: 0, width: 1, borderLeftWidth: 4 },
  horizontalWaveSegment: { right: 0, left: 0, height: 1, borderTopWidth: 4 },
  mergedBoard: { position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, zIndex: 2 },
  mergedCell: { position: 'absolute', width: '25%', height: '25%', borderWidth: 1.5, borderColor: colors.territoryMeBorder, overflow: 'hidden' },
  territoryResult: { minHeight: 70, borderRadius: 20, borderWidth: 2, borderColor: colors.territoryTargetBorder, backgroundColor: colors.surface, marginTop: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
  territoryNumber: { color: colors.textPrimary, fontSize: 27, lineHeight: 30, fontWeight: '900' },
  territoryLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  categoryOutcome: { color: colors.accentGold, fontSize: 12, fontWeight: '900', marginTop: 5, textAlign: 'center', writingDirection: 'rtl' },
  transitionSkipButton: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 2 },
  transitionSkipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  decisionScreen: { flex: 1, padding: 24, justifyContent: 'center' },
  decisionTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 5 },
  decisionBody: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', writingDirection: 'rtl', marginTop: 7 },
  decisionCards: { flexDirection: 'row-reverse', gap: 12, marginTop: 34 },
  decisionCard: { flex: 1, minHeight: 170, borderRadius: 24, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, alignItems: 'center', justifyContent: 'center', opacity: 0.62 },
  decisionCardSelected: { borderColor: colors.success, backgroundColor: colors.surface, opacity: 1, transform: [{ scale: 1.03 }] },
  decisionCardSymbol: { color: colors.accentGold, fontSize: 31, fontWeight: '900' },
  decisionCardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 8 },
  decisionCardBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 16, textAlign: 'center', writingDirection: 'rtl', marginTop: 4 },
});
