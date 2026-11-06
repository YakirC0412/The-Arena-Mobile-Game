import { CATEGORY_BY_ID } from '../../mobile/src/content/categories';
import { autoPlayGame, createGame, getActivePlayers } from '../../mobile/src/game/engine';
import { createSeededRandom } from '../../mobile/src/game/rng';
import { assert, assertEqual, suite, test } from '../../mobile/tests/harness';
import { isLoopDone, playToEnd, startLoop, stepGame } from '../src/gameLoop';
import type { LoopEvent } from '../src/gameLoop';

const ACTIVE = Object.keys(CATEGORY_BY_ID).filter((id) => CATEGORY_BY_ID[id].status === 'active');
const newGame = (seed: number) => {
  const random = createSeededRandom(seed);
  return { random, state: createGame([{ id: 'host', name: 'host', categoryId: ACTIVE[seed % ACTIVE.length] }], random) };
};

suite('server game loop (bots only)', () => {
  test('100 seeded games: exactly 15 duels, one champion, 15 eliminated', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const { random, state } = newGame(seed);
      const end = playToEnd(state, random);
      assertEqual(end.duels, 15, `Duels in seed ${seed}`);
      const alive = getActivePlayers(end.state);
      assertEqual(alive.length, 1, `Champion in seed ${seed}`);
      assertEqual(alive[0].cellIds.length, 16, `Champion owns the whole board in seed ${seed}`);
    }
  });

  test('the server loop plays exactly the same game as the local engine for the same seed', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const local = newGame(seed);
      const expected = autoPlayGame(local.state, local.random);
      const server = newGame(seed);
      const end = playToEnd(server.state, server.random);
      assertEqual(end.duels, expected.duels, `Duels in seed ${seed}`);
      assertEqual(getActivePlayers(end.state)[0].id, expected.champion.id, `Champion in seed ${seed}`);
      assertEqual(JSON.stringify(end.state), JSON.stringify(expected.state), `Final state in seed ${seed}`);
    }
  });

  test('steps come in a sensible order and the last event is the champion', () => {
    const { random, state } = newGame(7);
    const events: LoopEvent[] = [];
    playToEnd(state, random, (event) => events.push(event));
    assertEqual(events[0].kind, 'drawn', 'Starts with a draw');
    assertEqual(events[events.length - 1].kind, 'champion', 'Ends with the champion');
    assertEqual(events.filter((event) => event.kind === 'resolved').length, 15, 'Fifteen duels');
    events.forEach((event, i) => {
      if (event.kind === 'targeted') {
        assert(['drawn', 'continues', 'finalStart'].includes(events[i - 1].kind), 'A duel starts after a draw, a continue or the final');
      }
      if (event.kind === 'resolved') assertEqual(events[i - 1].kind, 'targeted', 'A result follows its duel');
    });
    assertEqual(events.filter((event) => event.kind === 'finalStart').length, 1, 'One final');
  });

  test('nobody is a human, the loop stops after the champion and refuses more steps', () => {
    const { random, state } = newGame(3);
    const end = playToEnd(state, random);
    assert(isLoopDone(end), 'Done');
    let refused = false;
    try { stepGame(end, random); } catch { refused = true; }
    assert(refused, 'No steps after the end');
    assertEqual(startLoop(state).duels, 0, 'A new loop starts at zero duels');
  });
});
