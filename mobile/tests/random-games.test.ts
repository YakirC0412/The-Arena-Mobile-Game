import { CATEGORIES } from '../src/content/categories';
import { autoPlayGame, createInitialGame } from '../src/game/engine';
import { createSeededRandom } from '../src/game/rng';
import { assert, assertEqual, suite, test } from './harness';

const GAMES = 1000;

function playSeed(seed: number) {
  const random = createSeededRandom(seed);
  const categoryId = CATEGORIES[seed % CATEGORIES.length].id;
  return autoPlayGame(createInitialGame(categoryId, random), random);
}

suite('random games', () => {
  test(`${GAMES} seeded games each end after exactly 15 duels with one champion`, () => {
    for (let seed = 1; seed <= GAMES; seed += 1) {
      const { champion, duels, state } = playSeed(seed);
      assertEqual(duels, 15, `Seed ${seed}: duel count`);
      assertEqual(champion.cellIds.length, 16, `Seed ${seed}: champion must own the whole board`);
      assert(state.cells.every((cell) => cell.ownerId === champion.id), `Seed ${seed}: board ownership`);
      const eliminated = Object.values(state.players).filter((player) => !player.isActive);
      assertEqual(eliminated.length, 15, `Seed ${seed}: eliminated players`);
      assert(eliminated.every((player) => player.cellIds.length === 0), `Seed ${seed}: eliminated players own no cells`);
    }
  });

  test('the same seed replays the same game', () => {
    for (const seed of [3, 42, 999]) {
      const first = playSeed(seed);
      const second = playSeed(seed);
      assertEqual(first.champion.id, second.champion.id, `Seed ${seed}: champion`);
      assertEqual(first.state.round, second.state.round, `Seed ${seed}: rounds`);
      assertEqual(
        JSON.stringify(first.state.events),
        JSON.stringify(second.state.events),
        `Seed ${seed}: event log`,
      );
    }
  });

  test('different seeds produce different champions', () => {
    const champions = new Set<string>();
    for (let seed = 1; seed <= 50; seed += 1) champions.add(playSeed(seed).champion.id);
    assert(champions.size > 5, `Only ${champions.size} distinct champions in 50 games`);
  });
});
