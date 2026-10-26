import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArenaBoard } from '@/features/arena/arena-board';
import { CATEGORY_BY_ID } from '@/content/categories';
import { getNeighborPlayerIds } from '@/game/engine';
import type { GameState } from '@/game/types';
import { styles } from './battle-transition-styles';

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
