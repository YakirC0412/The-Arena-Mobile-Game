// A tiny dependency-free test runner. Tests compile with tsconfig.engine.json
// and run under plain Node (npm run test:engine).

type TestCase = { suite: string; name: string; run: () => void | Promise<void> };

const cases: TestCase[] = [];
let currentSuite = '';

export function suite(name: string, register: () => void) {
  currentSuite = name;
  register();
  currentSuite = '';
}

export function test(name: string, run: () => void | Promise<void>) {
  cases.push({ suite: currentSuite, name, run });
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

// Tests may be async: each one is awaited before the next starts.
export async function runAll() {
  const failures: string[] = [];
  for (const testCase of cases) {
    const label = `${testCase.suite} › ${testCase.name}`;
    try {
      await testCase.run();
      console.log(`  ✓ ${label}`);
    } catch (error) {
      failures.push(label);
      console.log(`  ✗ ${label}\n      ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`\n${cases.length - failures.length} passed, ${failures.length} failed`);
  if (failures.length > 0) throw new Error(`${failures.length} test(s) failed`);
}
