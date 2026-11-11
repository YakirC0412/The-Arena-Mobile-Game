import { by } from '@/game/gender';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORY_BY_ID, getWay } from '@/content/categories';
import { AppText as Text } from '@/design/app-text';
import { ArenaBoard } from '@/features/arena/arena-board';
import { getActivePlayers, getNeighborPlayerIds } from '@/game/engine';
import type { GameState } from '@/game/types';
import { styles } from './flow-styles';

// The arena between duels: HUD, board, and either the draw button or the
// human's target picker.
export function ArenaScreen({
  game,
  onConfirmTarget,
  onDraw,
  onSelectTarget,
  onSkipToMyTurn,
  selectedTargetId,
  selectingTarget,
}: {
  game: GameState;
  onConfirmTarget: () => void;
  onDraw: () => void;
  onSelectTarget: (targetId: string) => void;
  onSkipToMyTurn: () => void;
  selectedTargetId: string | null;
  selectingTarget: boolean;
}) {
  const human = game.players[game.humanPlayerId];
  const activeCount = getActivePlayers(game).length;
  const duelNumber = Math.min(16 - activeCount + 1, 15);
  const remainingText = activeCount === 1 ? 'מתמודד אחד נותר' : `${activeCount} מתמודדים נותרו`;
  const duelText = `דו־קרב ${duelNumber} מתוך 15`;
  const cellsText = human.cellIds.length === 1 ? 'משבצת 1 בשליטה שלך' : `${human.cellIds.length} משבצות בשליטה שלך`;
  const targetIds = selectingTarget && game.selectedPlayerId
    ? getNeighborPlayerIds(game, game.selectedPlayerId)
    : [];
  const selected = game.selectedPlayerId ? game.players[game.selectedPlayerId] : null;
  const selectedTarget = selectedTargetId ? game.players[selectedTargetId] : null;
  const selectedTargetCategory = selectedTarget ? CATEGORY_BY_ID[selectedTarget.categoryId] : null;
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.arenaScreen}>
        <View style={styles.arenaHeader}>
          <Text style={styles.logo}>THE ARENA</Text>
          <Text style={styles.arenaHeaderSubtitle}>הזירה שלך</Text>
        </View>

        {/* One rounded line: who is left, which duel this is, and how many cells I hold (no rounds, no win counts). */}
        <View accessibilityLabel={`${remainingText}, ${duelText}, ${cellsText}`} style={styles.hudPanel}>
          <Text style={styles.hudPanelText} weight="bold">{remainingText}</Text>
          <View style={styles.hudDivider} />
          <Text style={styles.hudPanelText} weight="bold">{duelText}</Text>
          <View style={styles.hudDivider} />
          <Text style={styles.hudPanelText} weight="bold">{cellsText}</Text>
          {human.bonusReady ? (
            <>
              <View style={styles.hudDivider} />
              <Text style={[styles.hudPanelText, styles.hudPanelBonus]} weight="black">⭐ +5</Text>
            </>
          ) : null}
        </View>

        <ArenaBoard
          meId={selectingTarget ? game.selectedPlayerId : game.humanPlayerId}
          mode={selectingTarget ? 'select-target' : 'overview'}
          onSelectTarget={onSelectTarget}
          selectedId={selectedTargetId}
          state={game}
          targetIds={targetIds}
        />

        {selectingTarget ? (
          <View style={styles.arenaLegend}>
            <View style={styles.arenaLegendItem}>
              <View style={[styles.arenaLegendDot, styles.arenaLegendMe]} />
              <Text style={styles.arenaLegendText}>השטח שלך</Text>
            </View>
            <View style={styles.arenaLegendItem}>
              <View style={[styles.arenaLegendDot, styles.arenaLegendTarget]} />
              <Text style={styles.arenaLegendText}>ניתן לתקוף</Text>
            </View>
          </View>
        ) : null}

        {selectingTarget ? (
          <View style={styles.targetCard}>
            <Text style={styles.targetCardTitle}>בחרו יריב להתקפה</Text>
            {selectedTarget && selectedTargetCategory ? (
              <View style={styles.targetSummary}>
                <Text style={styles.targetCategory}>{selectedTargetCategory.name}</Text>
                <Text style={styles.targetName}>{selectedTarget.name} · {selectedTarget.cellIds.length} משבצות</Text>
                {/* Decision 15: the duel is played the defender's way – show it before attacking. */}
                <View style={styles.targetWay}>
                  <Text style={styles.targetWayLabel}>הדו־קרב ישוחק כך</Text>
                  <Text style={styles.targetWayValue}>{getWay(selectedTargetCategory, selectedTarget.wayId).label}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.targetHint}>בחרו שטח זוהר בזירה</Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={!selectedTarget}
              onPress={onConfirmTarget}
              style={[styles.confirmTargetButton, !selectedTarget && styles.confirmTargetButtonDisabled]}>
              <Text style={styles.confirmTargetButtonText}>
                {selectedTarget ? `תקפו את ${selectedTarget.name}` : 'בחרו יעד בזירה'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.instructionCard}>
              <Text style={styles.instructionTitle}>
                {selected ? `${selected.name} ${by(selected, 'נבחר', 'נבחרה')} לשחק` : 'הזירה ממתינה להגרלה'}
              </Text>
              <Text style={styles.instructionText}>{game.events[0]?.text}</Text>
            </View>
            <Pressable accessibilityLabel="הגרלת מתמודד" onPress={onDraw} style={styles.drawButton}>
              <Text style={styles.drawButtonIcon}>🎲</Text>
            </Pressable>
            <Pressable
              accessibilityHint="משחק את הדו־קרבות בין המחשבים ברקע עד שמגיע תורך"
              accessibilityRole="button"
              onPress={() => setConfirmingSkip(true)}
              style={({ pressed }) => [styles.skipTurnButton, pressed && styles.skipTurnButtonPressed]}>
              <Text style={styles.skipTurnText}>⏭  דלגו לתור שלי</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {confirmingSkip ? (
        <View accessibilityViewIsModal style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>לדלג לתור שלך?</Text>
            <Text style={styles.confirmBody}>
              באישור, המערכת תדלג אוטומטית לתור שלך – בין אם הוגרלת לתקוף ובין אם נבחרת לשחק בדו־קרב.
              הדו־קרבות בין המחשבים יוכרעו ברקע.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setConfirmingSkip(false);
                onSkipToMyTurn();
              }}
              style={styles.confirmPrimary}>
              <Text style={styles.confirmPrimaryText}>דלגו לתור שלי</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirmingSkip(false)} style={styles.confirmSecondary}>
              <Text style={styles.confirmSecondaryText}>ביטול</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
