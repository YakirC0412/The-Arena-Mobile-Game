import { useMemo, useState } from 'react';

import { ChampionCelebrationScreen } from '@/components/champion-celebration-screen';
import { createFinalBattleSetup, createInitialGame, resolveBattle } from '@/game/engine';

const FIXED_RANDOM = () => 0;

export default function QaVictoryScreen() {
  const [run, setRun] = useState(0);
  const scenario = useMemo(() => {
    const initial = createInitialGame('animals', FIXED_RANDOM, 'שחקן בדיקה');
    const aiId = initial.cells[9].ownerId;
    const humanCellIds = initial.cells.slice(0, 9).map((cell) => cell.id);
    const aiCellIds = initial.cells.slice(9).map((cell) => cell.id);
    const beforeState = {
      ...initial,
      cells: initial.cells.map((cell) => ({ ...cell, ownerId: humanCellIds.includes(cell.id) ? 'human' : aiId })),
      players: Object.fromEntries(Object.entries(initial.players).map(([id, player]) => [
        id,
        id === 'human'
          ? { ...player, cellIds: humanCellIds, isActive: true }
          : id === aiId
            ? { ...player, cellIds: aiCellIds, isActive: true, categoryId: 'countries', name: 'המחשב' }
            : { ...player, cellIds: [], isActive: false },
      ])),
      selectedPlayerId: 'human',
    };
    const setup = createFinalBattleSetup(beforeState, 'human', 'animals');
    return { beforeState, resolution: resolveBattle(beforeState, setup, 'human') };
  }, []);

  return (
    <ChampionCelebrationScreen
      beforeState={scenario.beforeState}
      key={run}
      onComplete={() => setRun((value) => value + 1)}
      resolution={scenario.resolution}
    />
  );
}
