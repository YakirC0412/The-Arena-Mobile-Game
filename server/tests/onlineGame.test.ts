import { CATEGORY_BY_ID, getWayItems } from '../../mobile/src/content/categories';
import { createGame } from '../../mobile/src/game/engine';
import type { HumanSeat } from '../../mobile/src/game/engine';
import { createSeededRandom } from '../../mobile/src/game/rng';
import { assert, assertEqual, suite, test } from '../../mobile/tests/harness';
import { OnlineGame } from '../src/onlineGame';

const ACTIVE = Object.keys(CATEGORY_BY_ID).filter((id) => CATEGORY_BY_ID[id].status === 'active');

function build(seed: number, humans: number, finished?: (result: unknown) => void) {
  const seats: (HumanSeat & { userId: string })[] = Array.from({ length: humans }, (_, index) => ({
    id: `c${index}`, name: `שחקן ${index}`, categoryId: ACTIVE[index], userId: String(100 + index),
  }));
  const random = createSeededRandom(seed);
  const clock = { now: 5_000_000 };
  const game = new OnlineGame({
    state: createGame(seats, random), random, now: () => clock.now, onFinish: finished,
    timing: { humanChoiceMs: 3000 },
  });
  return { game, clock, seats };
}

// A pretend person who plays quickly: picks the first neighbor, always continues, answers every picture right
// (the test cheats by looking the answer up; a real phone cannot).
function play(game: OnlineGame, clientId: string): void {
  const view = game.view();
  const me = game.seatOf(clientId);
  if (!me) return;
  if (view.stage === 'target' && view.attackerId === me && view.targets.length) {
    game.act(clientId, { type: 'pickTarget', targetId: view.targets[0] });
  } else if (view.stage === 'final' && view.finalOptions.length) {
    game.act(clientId, { type: 'pickFinalCategory', categoryId: view.finalOptions[0] });
  } else if (view.stage === 'after' && view.choiceLeftMs !== null && view.attackerId === me) {
    game.act(clientId, { type: 'continue' });
  } else if (view.stage === 'duel' && view.duel && !view.duel.paused && !view.duel.winner) {
    const setup = view.setup!;
    const side = setup.attackerId === me ? 'attacker' : setup.defenderId === me ? 'defender' : null;
    if (side && view.duel.active === side) {
      const wayId = game.getState().players[setup.defenderId].categoryId === setup.categoryId
        ? game.getState().players[setup.defenderId].wayId
        : 'w1';
      const answer = getWayItems(CATEGORY_BY_ID[setup.categoryId], wayId).find((item) => item.id === view.duel!.itemId)?.answer;
      if (answer) game.act(clientId, { type: 'answer', text: answer });
    }
  }
}

function runToEnd(game: OnlineGame, clock: { now: number }, people: string[], maxSteps = 600_000) {
  for (let step = 0; step < maxSteps && !game.isFinished(); step += 1) {
    clock.now += 100;
    for (const person of people) play(game, person);
    game.update();
  }
}

suite('online game (whole game with a fake clock)', () => {
  test('three people and 13 bots play a full game: 15 duels, one champion, recorded once', () => {
    const results: unknown[] = [];
    const { game, clock, seats } = build(11, 3, (result) => results.push(result));
    seats.forEach((seat, index) => game.connect(`s${index}`, Number(seat.userId)));
    runToEnd(game, clock, ['s0', 's1', 's2']);
    assert(game.isFinished(), 'The game ended');
    const view = game.view();
    assertEqual(view.duels, 15, 'Always 15 duels');
    assertEqual(view.players.filter((player) => player.isActive).length, 1, 'One champion left');
    assertEqual(view.championId, view.players.find((player) => player.isActive)!.id, 'Champion matches');
    assertEqual(results.length, 1, 'Finish reported once');
    assertEqual((results[0] as { userIds: number[] }).userIds.join(), '100,101,102', 'All accounts counted');
  });

  test('with nobody connected the bots take over after the away time and finish the game', () => {
    const { game, clock } = build(5, 2);
    runToEnd(game, clock, []);
    assert(game.isFinished(), 'Finished without any human');
    assertEqual(game.view().duels, 15, '15 duels');
    assertEqual(game.view().players.filter((player) => player.isHuman).length, 0, 'Seats became bots');
  });

  test('a returning person gets the seat back between duels', () => {
    const { game, clock, seats } = build(7, 2);
    game.connect('a', Number(seats[0].userId));
    game.connect('b', Number(seats[1].userId));
    game.disconnect('a');
    clock.now += 31_000;
    game.update();
    assert(!game.getState().players['c0'].isHuman, 'Replaced by a bot after 30 seconds');
    game.connect('a2', Number(seats[0].userId));
    const view = game.view();
    const inDuel = view.stage === 'duel' && (view.setup!.attackerId === 'c0' || view.setup!.defenderId === 'c0');
    assertEqual(game.getState().players['c0'].isHuman, !inDuel, 'Human again (unless in a live duel)');
    assertEqual(game.seatOf('a2'), 'c0', 'The new phone controls the seat');
  });

  test('choices from the wrong person or at the wrong time change nothing, and the view holds no answers', () => {
    const { game, clock, seats } = build(3, 2);
    game.connect('a', Number(seats[0].userId));
    game.connect('b', Number(seats[1].userId));
    assertEqual(game.act('a', { type: 'answer', text: 'x' }).ok, false, 'No duel yet');
    assertEqual(game.act('zzz', { type: 'skip' }).ok, false, 'Not a player');
    let sawDuel = false;
    for (let step = 0; step < 200_000 && !sawDuel; step += 1) {
      clock.now += 100;
      game.update();
      const view = game.view();
      assert(!JSON.stringify(view).includes('"answer"'), 'No answer in the view');
      if (view.stage === 'target' && view.targets.length) {
        const me = view.attackerId === 'c0' ? 'a' : 'b';
        const other = me === 'a' ? 'b' : 'a';
        assertEqual(game.act(other, { type: 'pickTarget', targetId: view.targets[0] }).ok, false, 'Only the attacker picks');
        assertEqual(game.act(me, { type: 'pickTarget', targetId: 'ai-99' }).ok, false, 'Only a neighbor');
        assertEqual(game.act(me, { type: 'pickTarget', targetId: view.targets[0] }).ok, true, 'A neighbor works');
      }
      if (view.stage === 'duel' && view.duel) {
        sawDuel = true;
        const setup = view.setup!;
        const waiting = view.duel.active === 'attacker' ? setup.defenderId : setup.attackerId;
        const clientOf = (playerId: string) => (playerId === 'c0' ? 'a' : playerId === 'c1' ? 'b' : null);
        if (clientOf(waiting)) assertEqual(game.act(clientOf(waiting)!, { type: 'skip' }).ok, false, 'The waiting side cannot skip');
      }
    }
    assert(sawDuel, 'A live duel with a human happened');
  });
});
