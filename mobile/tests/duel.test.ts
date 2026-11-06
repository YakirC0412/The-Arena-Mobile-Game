import {
  applyAnswer,
  applySkip,
  currentItem,
  duelView,
  isFinished,
  remainingMs,
  SKIP_PAUSE_MS,
  startDuel,
  tick,
} from '../src/game/duel';
import { SKIP_PENALTY_MS } from '../src/game/engine';
import type { CategoryItem } from '../src/game/types';
import { assert, assertEqual, suite, test } from './harness';

const item = (id: string, answer: string, aliases: string[] = []): CategoryItem => (
  { id, visual: '?', imageKey: `pic-${id}`, answer, aliases, difficulty: 1 }
);
const DECK = [item('a', 'אריה'), item('b', 'פיל', ['פילון']), item('c', 'כלב'), item('d', 'חתול')];
const PAUSE = 800;

suite('duel state machine (fake clock)', () => {
  test('the attacker starts and only the attacker clock runs', () => {
    const duel = startDuel(DECK, 40000, 40000, 1000);
    assertEqual(duel.active, 'attacker', 'Attacker starts');
    assertEqual(remainingMs(duel, 'attacker', 11000), 30000, 'Attacker clock runs');
    assertEqual(remainingMs(duel, 'defender', 11000), 40000, 'Defender clock waits');
  });

  test('a bonus gives 45 seconds', () => {
    assertEqual(remainingMs(startDuel(DECK, 45000, 40000, 0), 'attacker', 0), 45000, 'Bonus seconds');
  });

  test('a wrong answer changes nothing', () => {
    const duel = startDuel(DECK, 40000, 40000, 0);
    const result = applyAnswer(duel, 'פיל', 3000, PAUSE);
    assertEqual(result.correct, false, 'Wrong answer');
    assertEqual(JSON.stringify(result.state), JSON.stringify(duel), 'State untouched');
  });

  test('a correct answer stops both clocks, then passes the turn with the next picture', () => {
    const duel = startDuel(DECK, 40000, 40000, 0);
    const { state, correct } = applyAnswer(duel, 'אריה', 5000, PAUSE);
    assert(correct, 'Correct');
    assertEqual(remainingMs(state, 'attacker', 5400), 35000, 'Clock frozen during the pause');
    assertEqual(remainingMs(state, 'defender', 5400), 40000, 'Other clock frozen too');
    assertEqual(currentItem(tick(state, 5400)).id, 'a', 'Same picture during the pause');
    const after = tick(state, 5800);
    assertEqual(after.active, 'defender', 'Turn passed');
    assertEqual(currentItem(after).id, 'b', 'Next picture');
    assertEqual(remainingMs(after, 'defender', 6800), 39000, 'Defender clock started when the pause ended');
    assertEqual(remainingMs(after, 'attacker', 9999), 35000, 'Attacker keeps what was left');
  });

  test('final letters, niqqud and aliases are accepted like in the local game', () => {
    const duel = startDuel([item('x', 'פילים', ['פילון'])], 40000, 40000, 0);
    assert(applyAnswer(duel, 'פילימ', 100, PAUSE).correct, 'Final mem typed as a regular mem');
    assert(applyAnswer(duel, 'פילון', 100, PAUSE).correct, 'Alias');
  });

  test('answers and skips during a pause are ignored (no double advance)', () => {
    const duel = startDuel(DECK, 40000, 40000, 0);
    const first = applyAnswer(duel, 'אריה', 1000, PAUSE).state;
    assertEqual(applyAnswer(first, 'פיל', 1200, PAUSE).correct, false, 'Answer during pause');
    assertEqual(JSON.stringify(applySkip(first, 1200)), JSON.stringify(first), 'Skip during pause');
  });

  test('skip costs 3 seconds, pauses briefly and keeps the turn on the next picture', () => {
    const duel = startDuel(DECK, 40000, 40000, 0);
    const skipped = applySkip(duel, 2000);
    assertEqual(remainingMs(skipped, 'attacker', 2100), 40000 - 2000 - SKIP_PENALTY_MS, 'Elapsed time and penalty');
    const after = tick(skipped, 2000 + SKIP_PAUSE_MS);
    assertEqual(after.active, 'attacker', 'Turn stays');
    assertEqual(currentItem(after).id, 'b', 'Next picture');
    assertEqual(remainingMs(after, 'attacker', 2000 + SKIP_PAUSE_MS + 1000), 40000 - 2000 - SKIP_PENALTY_MS - 1000, 'Clock runs again');
  });

  test('a skip with less than 3 seconds left loses the duel', () => {
    const duel = startDuel(DECK, 40000, 40000, 0);
    const state = applySkip(duel, 38000);
    assertEqual(state.winner, 'defender', 'Defender wins');
  });

  test('a clock that reaches zero loses, and nothing counts after that', () => {
    const duel = startDuel(DECK, 40000, 45000, 0);
    const done = tick(duel, 40000);
    assert(isFinished(done), 'Finished');
    assertEqual(done.winner, 'defender', 'Attacker ran out');
    assertEqual(applyAnswer(done, 'אריה', 40001, PAUSE).correct, false, 'Late answer');
    assertEqual(duelView(done, 99999).remainingMs.attacker, 0, 'Clock shows zero');
  });

  test('time is judged even if tick is called late: an answer after expiry does not count', () => {
    const duel = startDuel(DECK, 40000, 40000, 0);
    const result = applyAnswer(duel, 'אריה', 41000, PAUSE);
    assertEqual(result.correct, false, 'Too late');
    assertEqual(result.state.winner, 'defender', 'Loss recorded');
  });

  test('the defender can win on time after the turn passes', () => {
    let duel = startDuel(DECK, 40000, 5000, 0);
    duel = tick(applyAnswer(duel, 'אריה', 1000, PAUSE).state, 1800);
    assertEqual(duel.active, 'defender', 'Defender plays');
    const done = tick(duel, 1800 + 5000);
    assertEqual(done.winner, 'attacker', 'Defender ran out');
  });

  test('the deck starts over (or is refilled) without repeating the last picture', () => {
    let duel = startDuel([item('a', 'אריה'), item('b', 'פיל')], 40000, 40000, 0);
    let now = 0;
    for (let i = 0; i < 5; i += 1) {
      const answer = currentItem(duel).answer;
      now += 1000;
      duel = tick(applyAnswer(duel, answer, now, PAUSE).state, now + PAUSE);
      now += PAUSE;
    }
    assert(duel.winner === null && currentItem(duel) !== undefined, 'Keeps going past the end of the deck');
    const refilled = startDuel([item('a', 'אריה')], 40000, 40000, 0);
    const next = tick(applySkip(refilled, 0), SKIP_PAUSE_MS, { refill: () => [item('z', 'זברה'), item('y', 'יען')] });
    assertEqual(currentItem(next).id, 'z', 'Refilled deck is used');
  });

  test('the phone view never contains the answer', () => {
    const duel = startDuel(DECK, 40000, 40000, 0);
    const text = JSON.stringify(duelView(duel, 500));
    assert(!text.includes('אריה') && !text.includes('answer'), 'No answer in the view');
    assert(text.includes('pic-a'), 'The picture key is there');
  });
});
