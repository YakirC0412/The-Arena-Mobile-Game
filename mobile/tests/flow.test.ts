// Plays whole games through the screen-flow reducer, one action per screen,
// the way the UI does. Covers decision 5 (human eliminated → loss → champion
// → main menu) and the human-champion path.
import { getChampion } from '../src/game/engine';
import { createFlowState, flowReducer, type FlowAction, type FlowState, type FlowUser } from '../src/game/flow';
import { createSeededRandom, type RandomSource } from '../src/game/rng';
import { assert, assertEqual, suite, test } from './harness';

type HumanPolicy = 'win' | 'lose' | 'random';

const TEST_USER: FlowUser = { id: 'u-1', fullName: 'בדיקה', email: 'test@example.com', nickname: 'טסט', avatar: 'avatar-01' };

function nextAction(state: FlowState, policy: HumanPolicy, random: RandomSource, seed: number): FlowAction | null {
  const game = state.game;
  switch (state.screen) {
    case 'welcome': return { type: 'SIGNED_IN', user: TEST_USER };
    case 'home': return { type: 'HOME_GUIDE' };
    case 'guide': return { type: 'GUIDE_COMPLETE' };
    case 'setup': return { type: 'START_GAME', seed };
    case 'building': return { type: 'BUILD_COMPLETE' };
    case 'arena': {
      if (!state.selectingTarget) return { type: 'DRAW' };
      if (state.selectedTargetId) return { type: 'CONFIRM_TARGET' };
      const attackerId = game!.selectedPlayerId!;
      const targetId = game!.cells.map((cell) => cell.ownerId).find((ownerId) => ownerId !== attackerId
        && game!.players[ownerId].isActive
        && game!.players[attackerId].cellIds.some((cellId) => {
          const cell = game!.cells[cellId];
          return game!.cells.some((other) => other.ownerId === ownerId
            && Math.abs(other.row - cell.row) + Math.abs(other.column - cell.column) === 1);
        }))!;
      return { type: 'SELECT_TARGET', targetId };
    }
    case 'draw': return { type: 'DRAW_COMPLETE' };
    case 'aiTarget': return { type: 'AI_TARGET_COMPLETE' };
    case 'selection': return { type: 'BATTLE_INTRO_COMPLETE' };
    case 'battle': {
      const { attackerId, defenderId } = state.battle!;
      const humanId = game!.humanPlayerId;
      const opponentId = attackerId === humanId ? defenderId : attackerId;
      const humanWins = policy === 'win' || (policy === 'random' && random() < 0.5);
      return { type: 'BATTLE_COMPLETE', winnerId: humanWins ? humanId : opponentId };
    }
    case 'aiBattle': return { type: 'BATTLE_COMPLETE', winnerId: state.aiWinnerId! };
    case 'outcome': return { type: 'OUTCOME_COMPLETE' };
    case 'conquest': return { type: 'CONQUEST_COMPLETE' };
    case 'result': {
      const winner = game!.players[state.resolution!.winnerId];
      if (winner.isHuman && random() < 0.5) return { type: 'RETURN_TO_ARENA' };
      return { type: 'RESULT_CONTINUE' };
    }
    case 'decision': return { type: 'AI_DECISION_COMPLETE' };
    case 'finalReveal': return { type: 'FINAL_REVEAL_COMPLETE' };
    case 'finalCategory': {
      const categoryId = state.aiFinalCategoryId ?? game!.players[game!.humanPlayerId].categoryId;
      return { type: 'FINAL_CATEGORY_SELECT', categoryId };
    }
    case 'eliminated': return { type: 'ELIMINATED_CONTINUE' };
    case 'victory': return null;
  }
}

function playThrough(seed: number, policy: HumanPolicy) {
  const random = createSeededRandom(seed * 7 + 1);
  let state = createFlowState(seed);
  const screens: string[] = [];
  for (let step = 0; step < 2000; step += 1) {
    screens.push(state.screen);
    const action = nextAction(state, policy, random, seed);
    if (!action) return { state, screens };
    const next = flowReducer(state, action);
    if (next === state) throw new Error(`Seed ${seed}: ${action.type} did nothing on screen ${state.screen}`);
    state = next;
  }
  throw new Error(`Seed ${seed}: the game never reached the champion screen`);
}

suite('screen flow', () => {
  test('sign-in leads home; home opens the guide or a new game; sign-out returns to welcome', () => {
    let state = createFlowState(1);
    assertEqual(state.screen, 'welcome', 'Signed-out start');
    state = flowReducer(state, { type: 'SIGNED_IN', user: TEST_USER });
    assertEqual(state.screen, 'home', 'Home after sign-in');
    assertEqual(createFlowState(1, TEST_USER).screen, 'home', 'A remembered user starts at home');
    assertEqual(flowReducer(state, { type: 'HOME_GUIDE' }).screen, 'guide', 'Instructions');
    assertEqual(flowReducer(flowReducer(state, { type: 'HOME_GUIDE' }), { type: 'GUIDE_BACK' }).screen, 'home', 'Back from the guide');
    const setup = flowReducer(state, { type: 'HOME_NEW_GAME' });
    assertEqual(setup.screen, 'setup', 'New game opens category setup');
    assertEqual(flowReducer(setup, { type: 'SETUP_BACK' }).screen, 'home', 'Back from setup');
    const started = flowReducer(setup, { type: 'START_GAME', seed: 3 });
    assertEqual(started.game!.players.human.name, 'טסט', 'The arena uses the nickname');
    assertEqual(started.game!.players.human.avatar, 'avatar-01', 'The arena uses the avatar');
    const signedOut = flowReducer(started, { type: 'SIGN_OUT' });
    assertEqual(signedOut.screen, 'welcome', 'Sign-out returns to welcome');
    assertEqual(signedOut.user, null, 'User cleared');
    assertEqual(signedOut.game, null, 'Game cleared');
  });

  test('300 games with random human results all reach a champion after 15 duels', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const { state } = playThrough(seed, 'random');
      const champion = getChampion(state.game!);
      assert(champion, `Seed ${seed}: no champion`);
      assertEqual(state.battleNumber, 15, `Seed ${seed}: duels played`);
      assertEqual(state.resolution!.winnerId, champion.id, `Seed ${seed}: the shown duel must be the deciding one`);
    }
  });

  test('a human who wins every duel becomes champion and goes back home', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const { state, screens } = playThrough(seed, 'win');
      if (!screens.includes('battle')) continue;
      assertEqual(getChampion(state.game!)?.isHuman, true, `Seed ${seed}: human champion`);
      assert(!screens.includes('eliminated'), `Seed ${seed}: no loss screen for the winner`);
      assertEqual(flowReducer(state, { type: 'VICTORY_COMPLETE' }).screen, 'home', 'Winner goes back home');
    }
  });

  test('decision 5: an eliminated human sees loss → champion → main menu', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const { state, screens } = playThrough(seed, 'lose');
      if (!screens.includes('battle')) continue;
      checked += 1;
      const lossIndex = screens.indexOf('eliminated');
      assert(lossIndex > 0, `Seed ${seed}: the loss screen must appear`);
      assertEqual(screens[lossIndex + 1], 'victory', `Seed ${seed}: champion screen follows the loss screen`);
      assertEqual(screens.indexOf('battle', lossIndex), -1, `Seed ${seed}: no more human duels after elimination`);
      assert(!getChampion(state.game!)?.isHuman, `Seed ${seed}: the champion is a bot`);
      assertEqual(flowReducer(state, { type: 'VICTORY_COMPLETE' }).screen, 'home', 'Back to the home screen');
    }
    assert(checked > 10, `Only ${checked} games reached a human duel`);
  });

  test('the same seed replays the same flow, and the reducer never mutates its input', () => {
    const first = playThrough(42, 'random');
    const second = playThrough(42, 'random');
    assertEqual(first.screens.join(','), second.screens.join(','), 'Screens');
    assertEqual(getChampion(first.state.game!)?.id, getChampion(second.state.game!)?.id, 'Champion');

    const before = flowReducer(createFlowState(5, TEST_USER), { type: 'START_GAME', seed: 5 });
    const snapshot = JSON.stringify(before);
    flowReducer(before, { type: 'DRAW' });
    assertEqual(JSON.stringify(before), snapshot, 'DRAW must not mutate the previous state');
  });

  test('returning to the arena resets the winner streak but keeps the board', () => {
    let state = flowReducer(createFlowState(9, TEST_USER), { type: 'START_GAME', seed: 9 });
    const humanId = state.game!.humanPlayerId;
    const human = state.game!.players[humanId];
    const neighborId = state.game!.cells.find((cell) => cell.ownerId !== humanId
      && human.cellIds.some((cellId) => {
        const own = state.game!.cells[cellId];
        return Math.abs(own.row - cell.row) + Math.abs(own.column - cell.column) === 1;
      }))!.ownerId;
    state = { ...state, game: { ...state.game!, selectedPlayerId: humanId }, selectingTarget: true };
    state = flowReducer(state, { type: 'SELECT_TARGET', targetId: neighborId });
    state = flowReducer(state, { type: 'CONFIRM_TARGET' });
    state = flowReducer(state, { type: 'BATTLE_INTRO_COMPLETE' });
    assertEqual(state.screen, 'battle', 'Human duel screen');
    state = flowReducer(state, { type: 'BATTLE_COMPLETE', winnerId: humanId });
    assertEqual(state.game!.players[humanId].winStreak, 1, 'Win counted');
    state = flowReducer(state, { type: 'RETURN_TO_ARENA' });
    assertEqual(state.screen, 'arena', 'Back in the arena');
    assertEqual(state.game!.players[humanId].winStreak, 0, 'Streak reset on return');
    assertEqual(state.game!.players[humanId].cellIds.length, 2, 'Conquered cells stay');
  });
});
