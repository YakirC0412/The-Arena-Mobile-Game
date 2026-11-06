// The server's game loop, one step at a time (PRD_MULTIPLAYER phase 1). Pure: no sockets, no timers, no clock.
// It walks the same order as the screens and as `autoPlayGame` in the shared engine:
//   draw -> target -> duel -> (continue | return) -> ... -> the final when two are left -> champion.
// The room calls `stepGame` on a timer and broadcasts each event. In this phase every seat is a bot, so the
// duel is simulated; later phases replace the simulated duel by a live one for human seats.
// The random calls happen in exactly the same order as in `autoPlayGame`, so a seed gives the same game.
import {
  chooseAiFinalCategory,
  chooseAiTarget,
  createBattleSetup,
  createFinalBattleSetup,
  decideAiContinue,
  drawPlayer,
  getChampion,
  getFinalCategoryChooser,
  resolveBattle,
  returnWinnerToArena,
  simulateAiBattle,
} from '../../mobile/src/game/engine';
import type { RandomSource } from '../../mobile/src/game/engine';
import type { BattleResolution, BattleSetup, GameState } from '../../mobile/src/game/types';

export type GamePhase = 'draw' | 'target' | 'duel' | 'after' | 'done';

export type LoopState = {
  state: GameState;
  phase: GamePhase;
  // The contestant who attacks now (set by the draw, kept while the winner keeps attacking).
  attackerId: string | null;
  // The duel that is about to be played (set by the 'target' step).
  setup: BattleSetup | null;
  // Finished duels so far.
  duels: number;
};

// What happened in one step; the room turns each of these into a message for the phones.
export type LoopEvent =
  | { kind: 'drawn'; attackerId: string }
  | { kind: 'finalStart'; chooserId: string }
  | { kind: 'targeted'; setup: BattleSetup }
  | { kind: 'resolved'; setup: BattleSetup; resolution: BattleResolution; duel: number }
  | { kind: 'continues'; playerId: string }
  | { kind: 'returned'; playerId: string }
  | { kind: 'champion'; championId: string };

export function startLoop(state: GameState): LoopState {
  return { state, phase: 'draw', attackerId: null, setup: null, duels: 0 };
}

export const isLoopDone = (loop: LoopState): boolean => loop.phase === 'done';

// Does one step. Never call it after the loop is done.
export function stepGame(loop: LoopState, random: RandomSource): { loop: LoopState; event: LoopEvent } {
  const { state } = loop;

  if (loop.phase === 'done') throw new Error('The game is over');

  if (loop.phase === 'draw') {
    const champion = getChampion(state);
    if (champion) return { loop: { ...loop, phase: 'done' }, event: { kind: 'champion', championId: champion.id } };
    const chooser = getFinalCategoryChooser(state);
    if (chooser) {
      return { loop: { ...loop, phase: 'target' }, event: { kind: 'finalStart', chooserId: chooser.id } };
    }
    const drawn = drawPlayer(state, random);
    const attackerId = drawn.selectedPlayerId!;
    return { loop: { ...loop, state: drawn, attackerId, phase: 'target' }, event: { kind: 'drawn', attackerId } };
  }

  if (loop.phase === 'target') {
    const chooser = getFinalCategoryChooser(state);
    let setup: BattleSetup;
    if (chooser) {
      setup = createFinalBattleSetup(state, chooser.id, chooseAiFinalCategory(state, chooser.id, random));
    } else {
      const targetId = loop.attackerId ? chooseAiTarget(state, loop.attackerId, random) : null;
      if (!loop.attackerId || !targetId) throw new Error(`${loop.attackerId} has no neighbor to attack`);
      setup = createBattleSetup(state, loop.attackerId, targetId);
    }
    return { loop: { ...loop, setup, phase: 'duel' }, event: { kind: 'targeted', setup } };
  }

  if (loop.phase === 'duel') {
    const setup = loop.setup!;
    const resolution = resolveBattle(state, setup, simulateAiBattle(state, setup, random));
    const duels = loop.duels + 1;
    const next: LoopState = { ...loop, state: resolution.state, setup: null, duels };
    // Champion, or two left (the final comes next): back to the top, no continue-or-return question.
    if (getChampion(resolution.state) || getFinalCategoryChooser(resolution.state)) {
      return { loop: { ...next, phase: 'draw' }, event: { kind: 'resolved', setup, resolution, duel: duels } };
    }
    return { loop: { ...next, phase: 'after' }, event: { kind: 'resolved', setup, resolution, duel: duels } };
  }

  // 'after': the winner keeps attacking or goes back to the arena.
  const winnerId = state.selectedPlayerId!;
  if (decideAiContinue(state, winnerId, random)) {
    return { loop: { ...loop, attackerId: winnerId, phase: 'target' }, event: { kind: 'continues', playerId: winnerId } };
  }
  return {
    loop: { ...loop, state: returnWinnerToArena(state, winnerId), attackerId: null, phase: 'draw' },
    event: { kind: 'returned', playerId: winnerId },
  };
}

// Runs the whole game without waiting (tests and the command-line runner).
export function playToEnd(
  start: GameState,
  random: RandomSource,
  onEvent?: (event: LoopEvent) => void,
  maxSteps = 1000,
): LoopState {
  let loop = startLoop(start);
  for (let steps = 0; !isLoopDone(loop); steps += 1) {
    if (steps >= maxSteps) throw new Error('The game did not finish');
    const result = stepGame(loop, random);
    loop = result.loop;
    onEvent?.(result.event);
  }
  return loop;
}
