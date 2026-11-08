import { by } from '@/game/gender';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArenaBoard } from '@/features/arena/arena-board';
import { BonusEarnedPopup } from '@/features/battle/bonus-earned-popup';
import { CATEGORY_BY_ID } from '@/content/categories';
import { getNeighborPlayerIds } from '@/game/engine';
import type { BattleResolution, GameState } from '@/game/types';
import { styles } from './flow-styles';

export function ResultScreen({
  canContinue,
  onContinue,
  onReturn,
  resolution,
  state,
}: {
  canContinue: boolean;
  onContinue: () => void;
  onReturn: () => void;
  resolution: BattleResolution;
  state: GameState;
}) {
  const winner = state.players[resolution.winnerId];
  const category = CATEGORY_BY_ID[winner.categoryId];
  const [showBonusPopup, setShowBonusPopup] = useState(resolution.winnerEarnedBonus);
  const [showArenaPreview, setShowArenaPreview] = useState(false);
  const availableTargetIds = getNeighborPlayerIds(state, winner.id);
  return (
    <SafeAreaView style={styles.resultScreen}>
      <Text style={styles.resultIcon}>🏅</Text>
      <Text style={styles.resultEyebrow}>ניצחון בדו־קרב</Text>
      <Text style={styles.resultTitle}>{winner.name} {by(winner, 'ניצח', 'ניצחה')}</Text>
      <Text style={styles.resultSummary}>{resolution.summary}</Text>

      <View style={styles.resultStats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{winner.cellIds.length}</Text>
          <Text style={styles.statLabel}>משבצות בשטח</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{category.icon}</Text>
          <Text style={styles.statLabel}>{category.name}</Text>
        </View>
      </View>

      {winner.isHuman ? (
        <View style={styles.resultActions}>
          <Pressable
            accessibilityLabel="הצצה לזירה וליריבים הזמינים"
            onHoverIn={() => setShowArenaPreview(true)}
            onHoverOut={() => setShowArenaPreview(false)}
            onPress={() => setShowArenaPreview((visible) => !visible)}
            style={styles.arenaPeekArea}>
            <View style={styles.arenaPeekButton}>
              <Text style={styles.arenaPeekIcon}>▦</Text>
            </View>
            {showArenaPreview && (
              <View style={styles.arenaPeekPanel}>
                <Text style={styles.arenaPeekTitle}>יריבים סמוכים שניתן לתקוף</Text>
                <ArenaBoard
                  meId={winner.id}
                  mode="select-target"
                  state={state}
                  targetIds={availableTargetIds}
                />
              </View>
            )}
          </Pressable>
          {canContinue && (
            <Pressable onPress={onContinue} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>להמשיך ולתקוף</Text>
            </Pressable>
          )}
          <Pressable onPress={onReturn} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>לחזור לזירה</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onContinue} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>המשך</Text>
        </Pressable>
      )}

      {showBonusPopup && (
        <BonusEarnedPopup
          onClose={() => setShowBonusPopup(false)}
          gender={winner.gender}
          playerName={winner.name}
        />
      )}
    </SafeAreaView>
  );
}
