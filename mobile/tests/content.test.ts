import { CATEGORIES } from '../src/content/categories';
import { normalizeAnswer } from '../src/game/engine';
import { assert, assertEqual, suite, test } from './harness';

suite('content', () => {
  test('16 categories with 24 items each and unique ids', () => {
    assertEqual(CATEGORIES.length, 16, 'Category count');
    assertEqual(new Set(CATEGORIES.map((category) => category.id)).size, 16, 'Category ids must be unique');
    for (const category of CATEGORIES) {
      assertEqual(category.items.length, 24, `${category.id}: item count`);
      assertEqual(new Set(category.items.map((item) => item.id)).size, 24, `${category.id}: item ids must be unique`);
    }
  });

  test('every item has an answer and a visual', () => {
    for (const category of CATEGORIES) {
      for (const item of category.items) {
        assert(item.answer.trim().length > 0, `${item.id}: missing answer`);
        assert(item.visual.trim().length > 0, `${item.id}: missing visual`);
      }
    }
  });

  test('no answer or alias belongs to two items in the same category', () => {
    const duplicates: string[] = [];
    for (const category of CATEGORIES) {
      const owners = new Map<string, string>();
      for (const item of category.items) {
        for (const text of new Set([item.answer, ...item.aliases].map(normalizeAnswer))) {
          const owner = owners.get(text);
          if (owner && owner !== item.id) duplicates.push(`${category.id}: "${text}" (${owner}, ${item.id})`);
          owners.set(text, item.id);
        }
      }
    }
    assert(duplicates.length === 0, `Duplicate answers: ${duplicates.join('; ')}`);
  });
});
