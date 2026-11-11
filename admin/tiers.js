// Difficulty tiers of a category (decision 28): the position of an item in its list decides its difficulty.
// The shares come from mobile/src/content/difficulty-tiers.json, the same file the game reads; the formula below is the
// same as `difficultyTierSizes` in mobile/src/content/categories.ts (mobile/tests/rules.test.ts checks they agree).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SHARES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mobile', 'src', 'content', 'difficulty-tiers.json'), 'utf8'));

// How many items are easy, medium and hard in a list of `count` items.
function tierSizes(count) {
  if (count <= 0) return [0, 0, 0];
  const easy = Math.min(count, Math.max(1, Math.round(count * SHARES.easyShare)));
  const hard = Math.min(count - easy, Math.round(count * SHARES.hardShare));
  return [easy, count - easy - hard, hard];
}

// 1 = easy, 2 = medium, 3 = hard, for the item at `index` (0-based) in a list of `count` items.
function tierOf(index, count) {
  const [easy, medium] = tierSizes(count);
  return index < easy ? 1 : index < easy + medium ? 2 : 3;
}

module.exports = { tierSizes, tierOf, SHARES };
