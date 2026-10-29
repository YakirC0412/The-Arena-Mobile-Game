// "Skip to my turn": bot-vs-bot duels are played in the background and the
// game stops exactly where the human plays again.
import { CATEGORIES } from '../src/content/categories';
import { createInitialGame, fastForwardToHuman, getActivePlayers, getNeighborPlayerIds } from '../src/game/engine';
import { createFlowState, flowReducer, type FlowState } from '../src/game/flow';
import { createSeededRandom } from '../src/game/rng';
import { assert, assertEqual, suite, test } from './harness';

const USER = { id: 'u', fullName: 'בדיקה', email: 'skip@example.com', nickname: 'טסט', avatar: 'avatar-01' };

function arenaState(seed: number): FlowState {
  let state = createFlowState(seed, USER);
  state = flowReducer(state, { type: 'INTRO_COMPLETE' });
  state = flowReducer(state, { type: 'HOME_NEW_GAME' });
  state = flowReducer(state, { type: 'START_GAME', seed });
  return flowReducer(state, { type: 'BUILD_COMPLETE' });
}

suite('skip to my turn', () => {
  test('fast-forward stops only where the human plays, and never eliminates the human', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = createSeededRandom(seed);
      const game = createInitialGame(CATEGORIES[seed % 16].id, random);
      const { state, duels, stop } = fastForwardToHuman(game, random);
      kinds.add(stop.kind);
      const human = state.players[state.humanPlayerId];
      assert(human.isActive, `Seed ${seed}: the human must still be playing`);
      assertEqual(getActivePlayers(state).length, 16 - duels, `Seed ${seed}: one elimination per skipped duel`);
      if (stop.kind === 'humanDrawn') assertEqual(state.selectedPlayerId, human.id, `Seed ${seed}: the human was drawn`);
      if (stop.kind === 'humanAttacked') {
        assert(getNeighborPlayerIds(state, stop.attackerId).includes(human.id), `Seed ${seed}: the attacker borders the human`);
        assert(!state.players[stop.attackerId].isHuman, `Seed ${seed}: a bot attacks`);
      }
      if (stop.kind === 'final') assertEqual(getActivePlayers(state).length, 2, `Seed ${seed}: two finalists`);
    }
    assert(kinds.has('humanDrawn') && kinds.has('humanAttacked'), `Both stop kinds must occur, saw ${[...kinds].join(', ')}`);
  });

  test('the skip action lands on the draw, the duel intro, or the final reveal', () => {
    const screens = new Set<string>();
    for (let seed = 1; seed <= 100; seed += 1) {
      const before = arenaState(seed);
      const after = flowReducer(before, { type: 'SKIP_TO_MY_TURN' });
      screens.add(after.screen);
      assert(['draw', 'selection', 'finalReveal'].includes(after.screen), `Seed ${seed}: landed on ${after.screen}`);
      assertEqual(after.battleNumber, before.battleNumber + after.skippedDuels + (after.screen === 'selection' ? 1 : 0), `Seed ${seed}: duel count`);
      if (after.screen === 'selection') {
        const { attackerId, defenderId } = after.battle!;
        assert(defenderId === after.game!.humanPlayerId && !after.game!.players[attackerId].isHuman, `Seed ${seed}: a bot attacks the human`);
      }
      if (after.screen === 'draw') assertEqual(after.game!.selectedPlayerId, after.game!.humanPlayerId, `Seed ${seed}: the human is drawn`);
    }
    assert(screens.has('draw') && screens.has('selection'), `Expected both outcomes, saw ${[...screens].join(', ')}`);
  });

  test('skipping repeatedly still plays a full game of exactly 15 duels', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      let state = arenaState(seed);
      for (let step = 0; step < 400 && state.screen !== 'victory'; step += 1) {
        const game = state.game!;
        const humanId = game.humanPlayerId;
        switch (state.screen) {
          case 'arena':
            if (!state.selectingTarget) { state = flowReducer(state, { type: 'SKIP_TO_MY_TURN' }); break; }
            if (!state.selectedTargetId) state = flowReducer(state, { type: 'SELECT_TARGET', targetId: getNeighborPlayerIds(game, humanId)[0] });
            else state = flowReducer(state, { type: 'CONFIRM_TARGET' });
            break;
          case 'draw': state = flowReducer(state, { type: 'DRAW_COMPLETE' }); break;
          case 'aiTarget': state = flowReducer(state, { type: 'AI_TARGET_COMPLETE' }); break;
          case 'selection': state = flowReducer(state, { type: 'BATTLE_INTRO_COMPLETE' }); break;
          case 'battle': state = flowReducer(state, { type: 'BATTLE_COMPLETE', winnerId: humanId }); break;
          case 'aiBattle': state = flowReducer(state, { type: 'BATTLE_COMPLETE', winnerId: state.aiWinnerId! }); break;
          case 'outcome': state = flowReducer(state, { type: 'OUTCOME_COMPLETE' }); break;
          case 'conquest': state = flowReducer(state, { type: 'CONQUEST_COMPLETE' }); break;
          case 'result': state = flowReducer(state, { type: 'RETURN_TO_ARENA' }); break;
          case 'decision': state = flowReducer(state, { type: 'AI_DECISION_COMPLETE' }); break;
          case 'finalReveal': state = flowReducer(state, { type: 'FINAL_REVEAL_COMPLETE' }); break;
          case 'finalCategory': state = flowReducer(state, { type: 'FINAL_CATEGORY_SELECT', categoryId: state.aiFinalCategoryId ?? game.players[humanId].categoryId }); break;
          default: throw new Error(`Seed ${seed}: unexpected screen ${state.screen}`);
        }
      }
      assertEqual(state.screen, 'victory', `Seed ${seed}: reached the champion`);
      assertEqual(state.battleNumber, 15, `Seed ${seed}: 15 duels in total`);
      assert(state.game!.players[state.game!.humanPlayerId].isActive, `Seed ${seed}: the always-winning human is champion`);
    }
  });
});
