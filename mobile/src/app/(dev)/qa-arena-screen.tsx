import { useMemo } from 'react';

import { ArenaScreen } from '@/features/arena/arena-screen';
import { createInitialGame, createBattleSetup, getNeighborPlayerIds, resolveBattle } from '@/game/engine';
import { useLocalSearchParams } from 'expo-router';

// QA: the arena screen between duels. `?wins=N` = how many duels the human has already won.
export default function QaArenaScreen() {
  const params = useLocalSearchParams<{ wins?: string }>();
  const wins = Math.min(14, Math.max(0, Number(params.wins) || 0));
  const game = useMemo(() => {
    let state = createInitialGame('animals', () => 0, 'שחקן בדיקה');
    for (let index = 0; index < wins; index += 1) {
      const target = getNeighborPlayerIds(state, 'human')[0];
      if (!target) break;
      state = resolveBattle(state, createBattleSetup(state, 'human', target), 'human').state;
    }
    return state;
  }, [wins]);
  return (
    <ArenaScreen
      game={game}
      onConfirmTarget={() => {}}
      onDraw={() => {}}
      onSelectTarget={() => {}}
      onSkipToMyTurn={() => {}}
      selectedTargetId={null}
      selectingTarget={false}
    />
  );
}
