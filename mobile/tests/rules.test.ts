// One test per scenario in docs/GAME_RULES.md. When a rule changes, change it
// there first, then here.
import {
  AI_DIFFICULTY_STEP_MS,
  AI_MIN_THINK_MS,
  AI_WORD_SWITCH_MS,
  aiThinkDelayMs,
  aiTypingLoad,
  chooseAiFinalCategory,
  correctAnswerPauseMs,
  CORRECT_PAUSE_MAX_MS,
  CORRECT_PAUSE_MIN_MS,
  createBattleDeck,
  createBattleSetup,
  createInitialGame,
  decideAiContinue,
  drawPlayer,
  getActivePlayers,
  getDrawCandidates,
  getNeighborPlayerIds,
  getRoundProgress,
  pictureMixAt,
  resolveBattle,
  returnWinnerToArena,
} from '../src/game/engine';
import { CATEGORIES, difficultyTierSizes } from '../src/content/categories';
import { createSeededRandom } from '../src/game/rng';
import type { CategoryItem } from '../src/game/types';
import type { GameState } from '../src/game/types';
import { assert, assertEqual, suite, test } from './harness';

// The tests run under Node (compiled to .engine-test/), where `require` exists; the app's TypeScript config has no Node types.
declare const require: (path: string) => unknown;
const nodeRequire = require;

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

// A bot "types" like a person: a longer answer takes longer (decision 27).
suite('§7 bot response time follows the answer', () => {
  const item = (answer: string, difficulty: 1 | 2 | 3 = 1, aliases: string[] = []) => ({ answer, aliases, difficulty });
  // A roll of 0.5 is the middle of the +-15% variation, so the delay is exactly base + typing.
  const delay = (value: ReturnType<typeof item>) => aiThinkDelayMs(value, () => 0.5);

  test('letters are counted after the same normalisation as the answer check, without spaces', () => {
    assertEqual(aiTypingLoad(item('ג׳ירפה')).letters, 5, 'The geresh is not a letter');
    assertEqual(aiTypingLoad(item('ארצות הברית')).letters, 10, 'Spaces are not letters');
    assertEqual(aiTypingLoad(item('ארצות הברית', 1, ['ארהב'])).letters, 7, 'Halfway between 10 and 4 letters');
    assertEqual(aiTypingLoad(item('ארצות הברית')).words, 2, 'Two words');
    assertEqual(aiTypingLoad(item('')).letters, 1, 'An empty answer cannot divide by zero or give a free answer');
  });

  test('a longer answer takes longer, and a second word costs a pause', () => {
    assert(delay(item('אריה')) < delay(item('התנשמית')), 'Four letters are faster than seven');
    assert(delay(item('התנשמית')) < delay(item('התיאטרון הרומי בקיסריה')), 'Seven letters are faster than twenty');
    assertEqual(delay(item('אבג דה')) - delay(item('אבגדה')), AI_WORD_SWITCH_MS, 'Same letters, one more word: one pause more');
  });

  test('a short accepted form counts halfway: faster than the full answer, slower than the short form alone', () => {
    const full = delay(item('ארצות הברית'));
    const both = delay(item('ארצות הברית', 1, ['ארהב']));
    const short = delay(item('ארהב'));
    assert(short < both && both < full, `short ${short} < both ${both} < full ${full}`);
    assertEqual(delay(item('פיל', 1, ['פיל אפריקני'])), delay(item('פיל')), 'A longer alias changes nothing');
  });

  test('harder pictures take longer, and the variation stays within 15%', () => {
    assertEqual(delay(item('אריה', 2)) - delay(item('אריה', 1)), AI_DIFFICULTY_STEP_MS, 'One difficulty step');
    const middle = delay(item('התנשמית', 2));
    const fastest = aiThinkDelayMs(item('התנשמית', 2), () => 0);
    const slowest = aiThinkDelayMs(item('התנשמית', 2), () => 1);
    assert(fastest >= Math.round(middle * 0.85) - 1 && slowest <= Math.round(middle * 1.15) + 1, 'Within +-15%');
    assert(aiThinkDelayMs(item('אב'), () => 0) >= AI_MIN_THINK_MS, 'Never faster than the minimum');
  });

  test('over the real content a bot is not instant on long answers and quick on short ones', () => {
    const quick = aiThinkDelayMs(item('כלב', 1), () => 0.5);
    const slow = aiThinkDelayMs(item('פורטלנד טרייל בלייזרס', 3), () => 0.5);
    assert(quick < 2200, `A three-letter easy picture takes under 2.2 s (${quick} ms)`);
    assert(slow > 6000, `A 19-letter hard picture takes over 6 s (${slow} ms)`);
  });
});

// Decision 28: a category's pictures are 12 easy / 10 medium / 8 hard, and a duel shows them in random order with a
// difficulty that rises as the duel goes on.
suite('§3 picture mix in a duel (decision 28)', () => {
  const pool = (easy = 12, medium = 10, hard = 8): CategoryItem[] => {
    const make = (count: number, difficulty: 1 | 2 | 3, offset: number) => Array.from({ length: count }, (_, index) => ({
      id: `p${offset + index}`, visual: '?', answer: `a${offset + index}`, aliases: [], difficulty,
    }));
    return [...make(easy, 1, 0), ...make(medium, 2, 100), ...make(hard, 3, 200)];
  };
  const decks = (count: number, items = pool()) => Array.from({ length: count }, (_, seed) => createBattleDeck(items, createSeededRandom(seed + 1)));

  test('a list of 30 pictures is split 12 / 10 / 8, and every real category follows it', () => {
    assertEqual(difficultyTierSizes(30).join('/'), '12/10/8', '30 pictures');
    assertEqual(difficultyTierSizes(1).join('/'), '1/0/0', 'A single picture is easy');
    assertEqual(difficultyTierSizes(0).join('/'), '0/0/0', 'No pictures');
    for (const count of [2, 5, 17, 40]) assertEqual(difficultyTierSizes(count).reduce((a, b) => a + b, 0), count, `${count} pictures add up`);
    for (const category of CATEGORIES.filter((entry) => entry.items.length === 30)) {
      const counts = [1, 2, 3].map((tier) => category.items.filter((item) => item.difficulty === tier).length).join('/');
      assertEqual(counts, '12/10/8', `${category.id} tiers`);
    }
  });

  test('the admin panel splits a list into tiers exactly like the game', () => {
    // admin/tiers.js is plain Node code (the panel is not part of the app), so it is loaded at run time.
    const admin = nodeRequire('../../../admin/tiers.js') as { tierSizes: (count: number) => number[]; tierOf: (index: number, count: number) => number };
    for (let count = 0; count <= 80; count += 1) {
      assertEqual(admin.tierSizes(count).join('/'), difficultyTierSizes(count).join('/'), `${count} items`);
    }
    const category = CATEGORIES.find((entry) => entry.items.length === 30)!;
    assertEqual(category.items.map((item, index) => item.difficulty === admin.tierOf(index, 30)).every(Boolean), true, 'Every item of a real category');
  });

  test('the first picture is always easy and a hard picture never comes before the 4th', () => {
    for (const deck of decks(400)) {
      assertEqual(deck[0].difficulty, 1, 'First picture is easy');
      assert(deck.slice(0, 3).every((item) => item.difficulty < 3), 'No hard picture in the first three');
    }
    assertEqual(pictureMixAt(0).join(','), '1,0,0', 'The table says the same');
    assertEqual(pictureMixAt(2)[2], 0, 'No hard chance at place 3');
  });

  test('the deck holds every picture exactly once', () => {
    for (const deck of decks(50)) {
      assertEqual(deck.length, 30, 'All pictures');
      assertEqual(new Set(deck.map((item) => item.id)).size, 30, 'No repeats');
    }
  });

  test('the same seed gives the same deck, different seeds give different decks', () => {
    const [a, b] = [createBattleDeck(pool(), createSeededRandom(7)), createBattleDeck(pool(), createSeededRandom(7))];
    assertEqual(a.map((item) => item.id).join(), b.map((item) => item.id).join(), 'Same seed');
    assert(a.map((item) => item.id).join() !== createBattleDeck(pool(), createSeededRandom(8)).map((item) => item.id).join(), 'Other seed');
  });

  test('difficulty rises along the duel and the first 22 pictures mix like the pool', () => {
    const all = decks(3000);
    const hardShare = (from: number, to: number) => {
      let hard = 0;
      let total = 0;
      for (const deck of all) for (const item of deck.slice(from, to)) { total += 1; if (item.difficulty === 3) hard += 1; }
      return hard / total;
    };
    const early = hardShare(3, 8);
    const middle = hardShare(8, 14);
    const late = hardShare(14, 20);
    assert(early < middle && middle < late, `Hard share rises: ${early.toFixed(2)} < ${middle.toFixed(2)} < ${late.toFixed(2)}`);
    assert(early < 0.2 && late > 0.3, 'Few hard pictures early, many late');
    const shares = [1, 2, 3].map((tier) => all.reduce((sum, deck) => sum + deck.slice(0, 22).filter((item) => item.difficulty === tier).length, 0) / (all.length * 22));
    assert(shares[0] > 0.32 && shares[0] < 0.44, `Easy share of the first 22: ${shares[0].toFixed(2)}`);
    assert(shares[1] > 0.29 && shares[1] < 0.39, `Medium share of the first 22: ${shares[1].toFixed(2)}`);
    assert(shares[2] > 0.24 && shares[2] < 0.34, `Hard share of the first 22: ${shares[2].toFixed(2)}`);
  });

  test('odd pools still work: a missing tier, a single picture, and a refilled deck that carries on hard', () => {
    const noEasy = createBattleDeck(pool(0, 10, 8), createSeededRandom(3));
    assertEqual(noEasy[0].difficulty, 2, 'Without easy pictures the first one is medium');
    assertEqual(noEasy.length, 18, 'Nothing is lost');
    assertEqual(createBattleDeck(pool(1, 0, 0), createSeededRandom(3)).length, 1, 'A single picture');
    const late = Array.from({ length: 300 }, (_, seed) => createBattleDeck(pool(), createSeededRandom(seed + 1), 30));
    const hardAtStart = late.reduce((sum, deck) => sum + deck.slice(0, 5).filter((item) => item.difficulty === 3).length, 0) / (late.length * 5);
    assert(hardAtStart > 0.4, `A refilled deck starts with the late chances (${hardAtStart.toFixed(2)} hard)`);
  });
});
