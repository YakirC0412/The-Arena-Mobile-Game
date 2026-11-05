import { createRandomDrawSequence, drawStepDelaysMs } from '../src/game/engine';
import { createSeededRandom } from '../src/game/rng';
import { assert, assertEqual, suite, test } from './harness';

suite('draw animation (the cursor jumping between squares)', () => {
  test('normal motion: 34 jumps that start fast and slow down, 4.6 seconds (unchanged)', () => {
    const delays = drawStepDelaysMs(false);
    assertEqual(delays.length, 34, 'Jumps');
    assert(delays[0] < delays[delays.length - 1], 'The cursor slows down');
    const total = delays.reduce((sum, ms) => sum + ms, 0);
    assertEqual(total, 4600, 'Total ms, as before');
  });

  test('Reduce Motion still plays the draw: several slow jumps, never a flicker', () => {
    const delays = drawStepDelaysMs(true);
    assert(delays.length >= 6, 'The draw must stay visible (at least 6 jumps)');
    assert(delays.every((ms) => ms >= 340), 'No more than 3 changes a second');
  });

  test('the jump sequence has one entry per delay and never repeats a square twice in a row', () => {
    for (const reduced of [false, true]) {
      const delays = drawStepDelaysMs(reduced);
      const sequence = createRandomDrawSequence(['a', 'b', 'c', 'd'], delays.length, createSeededRandom(7));
      assertEqual(sequence.length, delays.length, 'One contestant per jump');
      assert(sequence.every((id, i) => i === 0 || id !== sequence[i - 1]), 'No immediate repeat');
    }
  });
});
