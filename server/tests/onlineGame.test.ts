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

suite('online game: duel clocks', () => {
  test('the clocks the phones see only go down, and never show 0 while the duel is still on', () => {
    const { game, clock, seats } = build(21, 2);
    game.connect('a', Number(seats[0].userId));
    game.connect('b', Number(seats[1].userId));
    let samples = 0;
    let last: { attacker: number; defender: number } | null = null;
    let lastDuel = -1;
    for (let step = 0; step < 300_000 && samples < 400; step += 1) {
      clock.now += 50;
      play(game, 'a');
      play(game, 'b');
      game.update();
      const view = game.view();
      if (view.stage !== 'duel' || !view.duel) { last = null; continue; }
      if (view.duels !== lastDuel) { last = null; lastDuel = view.duels; }
      const now = view.duel.remainingMs;
      assert(view.duel.winner !== null || (now.attacker > 0 && now.defender > 0), `A clock showed 0 mid-duel: ${JSON.stringify(now)}`);
      if (last) {
        assert(now.attacker <= last.attacker && now.defender <= last.defender, `A clock went up: ${JSON.stringify(last)} -> ${JSON.stringify(now)}`);
      }
      last = { ...now };
      samples += 1;
    }
    assert(samples >= 100, 'Enough live duel samples');
  });
});

suite('online game: pacing and milestones', () => {
  test('a bot-only game shows each quarter-final and semi-final banner once, one final reveal, and finishes fast', () => {
    const { game, clock } = build(9, 2);
    const stages: string[] = [];
    const milestones: string[] = [];
    let compact = 0;
    // Let the (disconnected) people turn into bots first, so no duel is played live.
    clock.now += 31_000;
    game.update();
    const started = clock.now;
    for (let step = 0; step < 400_000 && !game.isFinished(); step += 1) {
      clock.now += 100;
      game.update();
      const view = game.view();
      if (stages.at(-1) !== view.stage) stages.push(view.stage);
      if (view.stage === 'milestone' && milestones.at(-1) !== view.milestone) milestones.push(String(view.milestone));
      if (view.stage === 'result' && view.result?.compact && stages.at(-2) !== 'result') compact += 1;
    }
    assert(game.isFinished(), 'Finished');
    assertEqual(milestones.join(), 'quarter,semi', 'Banners once each');
    assertEqual(stages.filter((stage) => stage === 'finalReveal').length, 1, 'One final reveal');
    assertEqual(stages.filter((stage) => stage === 'duel').length, 0, 'Bot fights are never played live');
    assert(compact >= 10, `Bot duels use the compact result (${compact})`);
    // 15 short duels: well under 4 minutes of game time.
    assert(clock.now - started < 240_000, `Game time ${(clock.now - started) / 1000}s`);
  });

  test('the drawn contestant is known during the draw stage (so every phone animates to the same result)', () => {
    const { game } = build(4, 2);
    const view = game.view();
    assertEqual(view.stage, 'draw', 'Starts with a draw');
    assert(!!view.attackerId && view.players.find((player) => player.id === view.attackerId)!.played, 'Attacker is set and marked as played');
  });
});
