import { CATEGORY_BY_ID, getWayItems } from '../../mobile/src/content/categories';
import { createSeededRandom } from '../../mobile/src/game/rng';
import { assert, assertEqual, suite, test } from '../../mobile/tests/harness';
import { LiveDuel } from '../src/liveDuel';

const CATEGORY = Object.keys(CATEGORY_BY_ID).find((id) => CATEGORY_BY_ID[id].status === 'active')!;

function setup(options: { attackerSeconds?: number; defenderSeconds?: number } = {}) {
  const clock = { now: 1_000_000 };
  const duel = new LiveDuel({ categoryId: CATEGORY, random: createSeededRandom(4), now: () => clock.now, ...options });
  const answerNow = () => {
    const id = duel.view().duel!.itemId;
    return getWayItems(CATEGORY_BY_ID[CATEGORY], 'w1').find((item) => item.id === id)!.answer;
  };
  return { clock, duel, answerNow };
}

suite('live duel (two people and spectators, fake clock)', () => {
  test('seats fill in order, the duel starts with two people, later joiners watch', () => {
    const { duel } = setup();
    assertEqual(duel.view().phase, 'waiting', 'Waits for an opponent');
    assertEqual(duel.join('a', 'דנה'), 'attacker', 'First is the attacker');
    assertEqual(duel.view().phase, 'waiting', 'Still waiting with one');
    assertEqual(duel.join('b', 'רון'), 'defender', 'Second is the defender');
    assertEqual(duel.view().phase, 'running', 'Running');
    assertEqual(duel.join('c', 'גיא'), 'spectator', 'Third watches');
    assertEqual(duel.view().spectators, 1, 'One spectator');
    assertEqual(duel.join('a', 'דנה'), 'attacker', 'Joining twice keeps the seat');
  });

  test('only the side whose turn it is can answer; spectators and the other side change nothing', () => {
    const { duel, answerNow } = setup();
    duel.join('a', 'א'); duel.join('b', 'ב'); duel.join('c', 'ג');
    const right = answerNow();
    assert(!duel.answer('b', right), 'Defender cannot answer on the attacker turn');
    assert(!duel.answer('c', right), 'Spectator cannot answer');
    assert(!duel.answer('a', 'תשובה שגויה לגמרי'), 'Wrong answer');
    assertEqual(duel.view().duel!.active, 'attacker', 'Still the attacker turn');
    assert(duel.answer('a', right), 'Right answer from the attacker');
  });

  test('a right answer stops both clocks for a moment, then the defender gets the next picture', () => {
    const { clock, duel, answerNow } = setup();
    duel.join('a', 'א'); duel.join('b', 'ב');
    const first = duel.view().duel!.itemId;
    clock.now += 5000;
    assert(duel.answer('a', answerNow()), 'Correct');
    clock.now += 100;
    const paused = duel.view().duel!;
    assert(paused.paused, 'Paused');
    assertEqual(paused.remainingMs.attacker, 35000, 'Attacker clock frozen');
    assertEqual(paused.remainingMs.defender, 40000, 'Defender clock frozen');
    assert(!duel.answer('b', answerNow()), 'No answers during the pause');
    clock.now += 1000;
    duel.update();
    const after = duel.view().duel!;
    assertEqual(after.active, 'defender', 'Turn passed');
    assert(after.itemId !== first, 'New picture');
    assert(duel.answer('b', answerNow()), 'Defender answers');
  });

  test('skip costs 3 seconds and keeps the turn; only the active side may skip', () => {
    const { clock, duel } = setup();
    duel.join('a', 'א'); duel.join('b', 'ב');
    duel.skip('b');
    assertEqual(duel.view().duel!.remainingMs.attacker, 40000, 'Defender skip ignored');
    clock.now += 2000;
    duel.skip('a');
    clock.now += 1000;
    duel.update();
    const view = duel.view().duel!;
    assertEqual(view.active, 'attacker', 'Turn stays');
    assert(view.remainingMs.attacker <= 40000 - 2000 - 3000, 'Penalty paid');
  });

  test('a clock that runs out loses; nothing counts afterwards', () => {
    const { clock, duel, answerNow } = setup({ attackerSeconds: 10 });
    duel.join('a', 'א'); duel.join('b', 'ב');
    clock.now += 10_500;
    duel.update();
    const view = duel.view();
    assertEqual(view.phase, 'finished', 'Finished');
    assertEqual(view.winner, 'defender', 'Defender wins on time');
    assertEqual(view.endedBy, 'time', 'By time');
    assert(!duel.answer('a', answerNow()), 'Late answer');
  });

  test('a seated person who leaves forfeits; a spectator leaving changes nothing', () => {
    const one = setup();
    one.duel.join('a', 'א'); one.duel.join('b', 'ב'); one.duel.join('c', 'ג');
    one.duel.leave('c');
    assertEqual(one.duel.view().phase, 'running', 'Spectator left, duel goes on');
    one.duel.leave('b');
    const view = one.duel.view();
    assertEqual(view.winner, 'attacker', 'Opponent wins');
    assertEqual(view.endedBy, 'forfeit', 'By forfeit');
  });

  test('what the phones receive never contains an answer', () => {
    const { duel, answerNow } = setup();
    duel.join('a', 'א'); duel.join('b', 'ב');
    const text = JSON.stringify(duel.view());
    assert(!text.includes(answerNow()), 'No answer in the view');
    assert(!text.includes('"answer"') && !text.includes('aliases'), 'No answer fields');
  });
});
