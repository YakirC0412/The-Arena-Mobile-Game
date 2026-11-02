import type {
  Category,
  CategoryItem,
  CategoryLevel,
  CategoryStatus,
  CategoryWay,
  Difficulty,
  WayId,
} from '../game/types';
import data from './categories-data.json';
import { IMAGED_ITEM_IDS } from './image-manifest';

// The category pool (docs/CATEGORIES.md, decisions 14–15, 19). Every category, its items, answers, ways and
// levels live in categories-data.json, which the admin panel edits (`npm run admin`, mobile/scripts/admin/).
// Item n of a category has the id `<category>-<n>` and its picture `assets/items/<category>/<category>-<n>`;
// its difficulty comes from its position in the list (first third easy, last third hard).
//
// Every category is played with pictures only (no emoji): it shows only items that have a picture
// (`npm run images`) and unlocks once MIN_PICTURE_ITEMS have one, so a long duel never runs out of pictures.
// A reserve category without pictures is hidden; any other one without enough pictures is listed as "soon".

type RawItem = {
  answer: string;
  aliases?: string[];
  visual: string;
  en?: string;
  second?: { answer: string; aliases?: string[] };
};
type RawCategory = {
  name: string;
  icon: string;
  level: CategoryLevel;
  status: Exclude<CategoryStatus, 'soon'>;
  ways: [string, boolean][];
  items: RawItem[];
};
type RawData = { order: string[]; categories: Record<string, RawCategory> };

export const MIN_PICTURE_ITEMS = 30;
const IMAGED = new Set(IMAGED_ITEM_IDS);
const DATA = data as unknown as RawData;

function makeItems(categoryId: string, rows: RawItem[]): CategoryItem[] {
  const tierSize = Math.ceil(rows.length / 3);
  return rows.map((row, index) => ({
    id: `${categoryId}-${index + 1}`,
    visual: row.visual,
    imageKey: `${categoryId}-${index + 1}`,
    answer: row.answer,
    aliases: row.aliases ?? [],
    secondAnswer: row.second ? { answer: row.second.answer, aliases: row.second.aliases ?? [] } : undefined,
    difficulty: (index < tierSize ? 1 : index < tierSize * 2 ? 2 : 3) as Difficulty,
  }));
}

function toWays(ways: [string, boolean][]): CategoryWay[] {
  return ways.map(([label, available], index) => ({ id: `w${index + 1}` as WayId, label, available }));
}

export const CATEGORIES: Category[] = DATA.order.flatMap((id): Category[] => {
  const raw = DATA.categories[id];
  if (!raw) throw new Error(`Category ${id} is in the order list but has no data`);
  const items = makeItems(id, raw.items).filter((item) => IMAGED.has(item.id));
  const ready = items.length >= MIN_PICTURE_ITEMS;
  if (!ready && raw.status === 'reserve') return [];
  const ways = toWays(raw.ways.map(([label, available]) => [label, available && ready]));
  const status: CategoryStatus = ready ? raw.status : 'soon';
  return [{ id, name: raw.name, icon: raw.icon, level: raw.level, status, ways, items: ready ? items : [] }];
});

export const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((item) => [item.id, item]),
) as Record<string, Category>;

// Categories a player may pick, and that arenas are drawn from first.
export const PLAYABLE_CATEGORIES = CATEGORIES.filter((item) => item.status === 'active');

export function getAvailableWays(category: Category): CategoryWay[] {
  return category.ways.filter((way) => way.available);
}

export function getWay(category: Category, wayId: WayId): CategoryWay {
  return category.ways.find((way) => way.id === wayId) ?? category.ways[0];
}

// The items of a category as played in one way, with that way's answer as
// `answer`, so the duel code needs no knowledge of ways.
export function getWayItems(category: Category, wayId: WayId): CategoryItem[] {
  if (wayId === 'w1') return category.items;
  return category.items
    .filter((item) => item.secondAnswer)
    .map((item) => ({ ...item, answer: item.secondAnswer!.answer, aliases: item.secondAnswer!.aliases }));
}
