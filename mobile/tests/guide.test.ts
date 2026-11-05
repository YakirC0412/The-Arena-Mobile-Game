import { GUIDE_PAGES } from '../src/features/onboarding/guide-pages';
import { assert, assertEqual, suite, test } from './harness';

suite('guide pages', () => {
  test('there are several pages, each with a title, a text, 2–4 points and a picture', () => {
    assert(GUIDE_PAGES.length >= 6, 'The guide needs at least 6 pages');
    for (const page of GUIDE_PAGES) {
      assert(page.title.trim().length > 0 && page.body.trim().length > 0, `${page.title}: missing text`);
      assert(page.points.length >= 2 && page.points.length <= 4, `${page.title}: 2–4 points`);
    }
  });

  test('titles and pictures are unique, so every page looks different', () => {
    assertEqual(new Set(GUIDE_PAGES.map((page) => page.title)).size, GUIDE_PAGES.length, 'Unique titles');
    assertEqual(new Set(GUIDE_PAGES.map((page) => page.visual)).size, GUIDE_PAGES.length, 'Unique pictures');
  });
});
