import { createTapGate } from '../src/features/battle/tap-gate';
import { assertEqual, suite, test } from './harness';

suite('tap gate (skip button)', () => {
  test('touchstart, pointerdown and mousedown of one tap skip once', () => {
    const gate = createTapGate();
    assertEqual([gate.down(1000), gate.down(1004), gate.down(1020)].filter(Boolean).length, 1, 'One tap, one skip');
  });

  test('the click that follows a counted press is ignored', () => {
    const gate = createTapGate();
    gate.down(1000);
    assertEqual(gate.click(1450), false, 'Click after a counted press');
  });

  test('a later tap counts again', () => {
    const gate = createTapGate();
    gate.down(1000);
    assertEqual(gate.down(1400), true, 'Second quick tap after the dedupe window');
  });

  test('a click alone (no touch or mouse down seen) still skips, once', () => {
    const gate = createTapGate();
    assertEqual(gate.click(5000), true, 'Click-only press');
    assertEqual(gate.click(5100), false, 'Duplicate click');
    assertEqual(gate.click(5500), true, 'Next click');
  });
});
