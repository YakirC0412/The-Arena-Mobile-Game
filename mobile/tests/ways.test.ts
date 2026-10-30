// Decisions 14–15: the arena draw by level spread, and a battle way per player.
import { CATEGORY_BY_ID, getAvailableWays, PLAYABLE_CATEGORIES } from '../src/content/categories';
import {
  createBattleSetup,
  createFinalBattleSetup,
  createInitialGame,
  drawArenaCategories,
  getActivePlayers,
  getFinalCategoryChooser,
  getNeighborPlayerIds,
  resolveBattle,
} from '../src/game/engine';
import { createSeededRandom } from '../src/game/rng';
import type { GameState } from '../src/game/types';
import { assert, assertEqual, suite, test } from './harness';

suite('categories and ways', () => {
  test('the arena draws 15 other categories, never the human\'s, active ones before the reserve', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const human = PLAYABLE_CATEGORIES[seed % PLAYABLE_CATEGORIES.length].id;
      const drawn = drawArenaCategories(human, createSeededRandom(seed));
      assertEqual(drawn.length, 15, `Seed ${seed}: count`);
      assertEqual(new Set(drawn).size, 15, `Seed ${seed}: unique`);
      assert(!drawn.includes(human), `Seed ${seed}: the human's category is not repeated`);
      assert(drawn.every((id) => CATEGORY_BY_ID[id].status !== 'soon'), `Seed ${seed}: no coming-soon category`);
      const active = drawn.filter((id) => CATEGORY_BY_ID[id].status === 'active').length;
      assertEqual(active, Math.min(15, PLAYABLE_CATEGORIES.length - 1), `Seed ${seed}: every other active category is used before the reserve`);
    }
  });

  test('the draw keeps a level spread when there are enough categories of each level', () => {
    const levels = new Set<string>();
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const id of drawArenaCategories('animals', createSeededRandom(seed))) levels.add(CATEGORY_BY_ID[id].level);
    }
    assert(levels.has('easy') && levels.has('medium'), `Levels seen: ${[...levels].join(', ')}`);
  });

  test('the human keeps the chosen way; bots get an available way', () => {
    const game = createInitialGame('countries', createSeededRandom(4), 'טסט', 'avatar-01', 'w2');
    assertEqual(game.players.human.wayId, 'w2', 'Human way');
    for (const player of Object.values(game.players)) {
      const ways = getAvailableWays(CATEGORY_BY_ID[player.categoryId]).map((way) => way.id);
      assert(ways.includes(player.wayId), `${player.id}: way ${player.wayId} is not available in ${player.categoryId}`);
    }
    const fallback = createInitialGame('technology', createSeededRandom(4), 'טסט', 'avatar-01', 'w2');
    assertEqual(fallback.players.human.wayId, 'w1', 'An unavailable way falls back to way 1');
  });

  test('a duel uses the defender\'s way, and a winning defender inherits the attacker\'s way', () => {
    const game = createInitialGame('countries', createSeededRandom(9), 'טסט', 'avatar-01', 'w2');
    const defenderId = getNeighborPlayerIds(game, 'human')[0];
    const attack = createBattleSetup(game, 'human', defenderId);
    assertEqual(attack.wayId, game.players[defenderId].wayId, 'Human attacks: defender\'s way');
    const defend = createBattleSetup(game, defenderId, 'human');
    assertEqual(defend.wayId, 'w2', 'Human defends: the human\'s way');
    const humanWins = resolveBattle(game, defend, 'human');
    assertEqual(humanWins.state.players.human.wayId, game.players[defenderId].wayId, 'A defending winner takes the attacker\'s way');
    const attackerWins = resolveBattle(game, attack, 'human');
    assertEqual(attackerWins.state.players.human.wayId, 'w2', 'An attacking winner keeps its way');
  });

  test('the final is played the way of the chosen category\'s owner', () => {
    const base = createInitialGame('countries', createSeededRandom(2), 'טסט', 'avatar-01', 'w2');
    const opponentId = getNeighborPlayerIds(base, 'human')[0];
    const final: GameState = {
      ...base,
      cells: base.cells.map((cell) => ({ ...cell, ownerId: cell.id < 9 ? 'human' : opponentId })),
      players: Object.fromEntries(Object.entries(base.players).map(([id, player]) => [
        id,
        id === 'human' ? { ...player, cellIds: [0, 1, 2, 3, 4, 5, 6, 7, 8] }
          : id === opponentId ? { ...player, cellIds: [9, 10, 11, 12, 13, 14, 15] }
            : { ...player, isActive: false, cellIds: [] },
      ])),
    };
    assertEqual(getActivePlayers(final).length, 2, 'Fixture: two finalists');
    assertEqual(getFinalCategoryChooser(final)?.id, 'human', 'Fixture: the human chooses');
    assertEqual(createFinalBattleSetup(final, 'human', 'countries').wayId, 'w2', 'Own category: own way');
    const opponent = final.players[opponentId];
    assertEqual(createFinalBattleSetup(final, 'human', opponent.categoryId).wayId, opponent.wayId, 'Opponent category: opponent way');
  });
});
