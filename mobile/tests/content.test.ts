import { CATEGORIES, getAvailableWays, getWayItems, MIN_PICTURE_ITEMS, PLAYABLE_CATEGORIES } from '../src/content/categories';
import { IMAGED_ITEM_IDS } from '../src/content/image-manifest';
import { normalizeAnswer } from '../src/game/engine';
import { assert, assertEqual, suite, test } from './harness';

const MIN_ITEMS_PER_WAY = 8;

suite('content', () => {
  test('at least 16 listed categories (one per contestant) plus a hidden reserve, with unique ids', () => {
    const listed = CATEGORIES.filter((category) => category.status !== 'reserve');
    assert(listed.length >= 16, 'An arena needs 16 different categories (the pool is edited in the admin panel)');
    assertEqual(new Set(CATEGORIES.map((category) => category.id)).size, CATEGORIES.length, 'Category ids must be unique');
    for (const category of CATEGORIES) {
      assertEqual(new Set(category.items.map((item) => item.id)).size, category.items.length, `${category.id}: item ids must be unique`);
      assert(category.ways.length >= 1 && category.ways.length <= 2, `${category.id}: one or two ways`);
    }
  });

  test('every playable category, plus the reserve, can fill a duel in each available way', () => {
    assert(PLAYABLE_CATEGORIES.length + CATEGORIES.filter((c) => c.status === 'reserve').length >= 16, 'Enough categories for an arena');
    for (const category of CATEGORIES.filter((c) => c.status !== 'soon')) {
      const ways = getAvailableWays(category);
      assert(ways.length >= 1, `${category.id}: needs an available way`);
      for (const way of ways) {
        const items = getWayItems(category, way.id);
        assert(items.length >= MIN_ITEMS_PER_WAY, `${category.id}/${way.id}: only ${items.length} items`);
      }
    }
  });

  // Pictures only, no emoji: a long duel must never run out of pictures.
  test(`every playable category has at least ${MIN_PICTURE_ITEMS} items, each with a picture`, () => {
    for (const category of PLAYABLE_CATEGORIES) {
      assert(category.items.length >= MIN_PICTURE_ITEMS, `${category.id}: only ${category.items.length} pictures`);
      for (const item of category.items) {
        assert(Boolean(item.imageKey) && IMAGED_ITEM_IDS.includes(item.imageKey!), `${item.id}: no picture`);
      }
    }
  });

  test('coming-soon categories have no items and no available way', () => {
    for (const category of CATEGORIES.filter((c) => c.status === 'soon')) {
      assertEqual(category.items.length, 0, `${category.id}: items before pictures exist`);
      assertEqual(getAvailableWays(category).length, 0, `${category.id}: no playable way yet`);
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

  test('second-way answers are used only by categories that have a second way', () => {
    for (const category of CATEGORIES) {
      const hasSecond = category.items.some((item) => item.secondAnswer);
      if (hasSecond) assert(category.ways.some((way) => way.id === 'w2'), `${category.id}: second answers without a second way`);
    }
  });

  // Way 1 names the thing itself, so every item needs its own answers. Way 2
  // answers repeat by design (two dishes from Italy), so it is not checked.
  test('in way 1 no answer or alias belongs to two items of the same category', () => {
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
