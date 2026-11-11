// One test per scenario in docs/GAME_RULES.md. When a rule changes, change it
// there first, then here.
import {
  chooseAiFinalCategory,
  correctAnswerPauseMs,
  CORRECT_PAUSE_MAX_MS,
  CORRECT_PAUSE_MIN_MS,
  createBattleSetup,
  createInitialGame,
  decideAiContinue,
  drawPlayer,
  getActivePlayers,
  getDrawCandidates,
  getNeighborPlayerIds,
  getRoundProgress,
  resolveBattle,
  returnWinnerToArena,
} from '../src/game/engine';
import { createSeededRandom } from '../src/game/rng';
import type { GameState } from '../src/game/types';
import { assert, assertEqual, suite, test } from './harness';

const fixedRandom = () => 0;

// Plays one duel and returns the new state.
function duel(state: GameState, attackerId: string, defenderId: string, winnerId: string) {
  return resolveBattle(state, createBattleSetup(state, attackerId, defenderId), winnerId);
}

function firstNeighbor(state: GameState, playerId: string) {
  return getNeighborPlayerIds(state, playerId)[0];
}

suite('§2 rounds and draw (decision 1)', () => {
  test('every active player is drawn once per round', () => {
    let state = createInitialGame('animals', fixedRandom);
    const drawn = new Set<string>();
    for (let draw = 0; draw < 16; draw += 1) {
      state = drawPlayer(state, fixedRandom);
      drawn.add(state.selectedPlayerId!);
    }
    assertEqual(drawn.size, 16, 'Every territory must be drawn once per round');
    assertEqual(getRoundProgress(state).drawn, 16, 'Round progress must count every drawn player');
  });

  test('a new round starts after everyone was drawn', () => {
    let state = createInitialGame('animals', fixedRandom);
    for (let draw = 0; draw < 17; draw += 1) state = drawPlayer(state, fixedRandom);
    assertEqual(state.round, 2, 'The 17th draw must open round 2');
    assertEqual(getRoundProgress(state).drawn, 1, 'Only the first draw of round 2 is marked');
  });

  test('only the drawn attacker is marked; a winning defender stays drawable', () => {
    let state = drawPlayer(createInitialGame('animals', fixedRandom), fixedRandom);
    const attackerId = state.selectedPlayerId!;
    const defenderId = firstNeighbor(state, attackerId);
    state = returnWinnerToArena(duel(state, attackerId, defenderId, defenderId).state, defenderId);
    assert(!state.players[defenderId].hasPlayedThisRound, 'The defender must not be marked as drawn');
    assert(getDrawCandidates(state).some((player) => player.id === defenderId), 'The defender must stay drawable');
    assertEqual(getDrawCandidates(state).length, 15, 'The eliminated attacker leaves 15 drawable players');
  });

  test('a winner who keeps attacking is not marked as drawn', () => {
    let state = createInitialGame('animals', fixedRandom);
    const target = firstNeighbor(state, 'human');
    state = duel(state, target, 'human', 'human').state;
    state = duel(state, 'human', firstNeighbor(state, 'human'), 'human').state;
    assert(!state.players.human.hasPlayedThisRound, 'Continuing attacks must not mark the winner');
  });
});

suite('§3 duel timing', () => {
  test('the pause after a correct answer is 0.7–1.0 s', () => {
    const random = createSeededRandom(7);
    for (let sample = 0; sample < 200; sample += 1) {
      const pause = correctAnswerPauseMs(random);
      assert(pause >= CORRECT_PAUSE_MIN_MS && pause <= CORRECT_PAUSE_MAX_MS, `Pause ${pause} ms is out of range`);
    }
    assertEqual(correctAnswerPauseMs(() => 0), 700, 'Minimum pause');
    assertEqual(correctAnswerPauseMs(() => 0.999999), 1000, 'Maximum pause');
  });
});

suite('§5 streak and bonus (decision 2)', () => {
  test('scenario A: three attacking wins earn the bonus, which survives a return and applies when defending', () => {
    let state = createInitialGame('animals', fixedRandom);
    for (let win = 1; win <= 3; win += 1) {
      const result = duel(state, 'human', firstNeighbor(state, 'human'), 'human');
      assertEqual(result.winnerEarnedBonus, win === 3, `Bonus must be earned exactly on win 3 (win ${win})`);
      state = result.state;
    }
    assert(state.players.human.bonusReady, 'Three wins must bank the bonus');

    state = returnWinnerToArena(state, 'human');
    assertEqual(state.players.human.winStreak, 0, 'Returning to the arena resets the streak');
    assert(state.players.human.bonusReady, 'Returning to the arena keeps a banked bonus');

    const attackerId = firstNeighbor(state, 'human');
    const setup = createBattleSetup(state, attackerId, 'human');
    assert(setup.defenderUsesBonus, 'The bonus must apply automatically when defending');
    assertEqual(setup.defenderSeconds, 45, 'A bonus defender starts with 45 seconds');
    const after = resolveBattle(state, setup, 'human').state;
    assert(!after.players.human.bonusReady, 'The bonus is used up after its duel');
    assertEqual(after.players.human.winStreak, 0, 'The streak restarts at 0 after the bonus duel');
    assertEqual(createBattleSetup(after, 'human', firstNeighbor(after, 'human')).attackerSeconds, 40, 'The bonus is used once');
  });

  test('scenario B: two wins then a return to the arena leave no bonus', () => {
    let state = createInitialGame('animals', fixedRandom);
    const attackerId = firstNeighbor(state, 'human');
    state = duel(state, attackerId, 'human', 'human').state;
    assertEqual(state.players.human.winStreak, 1, 'A defending win counts as win 1');
    state = duel(state, 'human', firstNeighbor(state, 'human'), 'human').state;
    assertEqual(state.players.human.winStreak, 2, 'A continuing attack win counts as win 2');
    state = returnWinnerToArena(state, 'human');
    assertEqual(state.players.human.winStreak, 0, 'Returning before win 3 resets the streak');
    assert(!state.players.human.bonusReady, 'No bonus without three wins in a row');
  });

  test('scenario C: a defending win plus two continuing wins earn the bonus for a 4th duel', () => {
    let state = createInitialGame('animals', fixedRandom);
    state = duel(state, firstNeighbor(state, 'human'), 'human', 'human').state;
    state = duel(state, 'human', firstNeighbor(state, 'human'), 'human').state;
    const third = duel(state, 'human', firstNeighbor(state, 'human'), 'human');
    assert(third.winnerEarnedBonus, 'Defend + attack + attack must earn the bonus');
    const fourth = createBattleSetup(third.state, 'human', firstNeighbor(third.state, 'human'));
    assert(fourth.attackerUsesBonus, 'The bonus applies in the 4th duel in a row');
    assertEqual(fourth.attackerSeconds, 45, 'The 4th duel starts with 45 seconds');
  });

  test('scenario D: reaching the final clears every bonus and streak, and nobody earns a bonus in the semi-final or the final', () => {
    let state = createInitialGame('animals', fixedRandom);
    let last = duel(state, 'human', firstNeighbor(state, 'human'), 'human');
    state = last.state;
    while (Object.values(state.players).filter((player) => player.isActive).length > 2) {
      last = duel(state, 'human', firstNeighbor(state, 'human'), 'human');
      state = last.state;
    }
    const finalists = Object.values(state.players).filter((player) => player.isActive);
    assertEqual(finalists.length, 2, 'Two contestants are left');
    assert(finalists.every((player) => !player.bonusReady && player.winStreak === 0), 'No bonus or streak survives into the final');
    assert(!last.winnerEarnedBonus, 'The duel that reaches the final earns no bonus');
    const final = createBattleSetup(state, finalists[0].id, finalists[1].id);
    assert(!final.attackerUsesBonus && !final.defenderUsesBonus && final.attackerSeconds === 40, 'The final uses normal clocks');
    const decided = resolveBattle(state, final, finalists[0].id);
    assert(!decided.winnerEarnedBonus, 'Winning the final earns no bonus');
  });

  test('the bonus also applies when drawn as attacker after returning', () => {
    let state = createInitialGame('animals', fixedRandom);
    for (let win = 0; win < 3; win += 1) state = duel(state, 'human', firstNeighbor(state, 'human'), 'human').state;
    state = returnWinnerToArena(state, 'human');
    const setup = createBattleSetup(state, 'human', firstNeighbor(state, 'human'));
    assert(setup.attackerUsesBonus, 'A drawn attacker with a banked bonus uses it');
  });

  test('returning with no winner only clears the selection', () => {
    const state = drawPlayer(createInitialGame('animals', fixedRandom), fixedRandom);
    const next = returnWinnerToArena(state, null);
    assertEqual(next.selectedPlayerId, null, 'Selection is cleared');
    assert(next.players === state.players, 'Players are untouched');
  });
});

suite('§7 bots', () => {
  test('a bot never continues without a neighbor', () => {
    const state = createInitialGame('animals', fixedRandom);
    const lonely: GameState = {
      ...state,
      players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [
        id, id === 'human' ? player : { ...player, isActive: false },
      ])),
    };
    assert(!decideAiContinue(lonely, 'human', () => 0), 'No neighbor means return to the arena');
    assert(decideAiContinue(state, 'human', () => 0), 'With a neighbor and a low roll the bot continues');
  });

  test('a bot finalist picks one of the two finalist categories', () => {
    const state = createInitialGame('animals', fixedRandom);
    const opponentId = firstNeighbor(state, 'human');
    const finalists: GameState = {
      ...state,
      players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [
        id, id === 'human' || id === opponentId ? player : { ...player, isActive: false },
      ])),
    };
    assertEqual(getActivePlayers(finalists).length, 2, 'Fixture has two finalists');
    const options = new Set([finalists.players.human.categoryId, finalists.players[opponentId].categoryId]);
    assert(options.has(chooseAiFinalCategory(finalists, 'human', () => 0)), 'Low roll picks a finalist category');
    assert(options.has(chooseAiFinalCategory(finalists, 'human', () => 0.99)), 'High roll picks a finalist category');
  });
});
