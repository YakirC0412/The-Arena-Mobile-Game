// Plays bot-only games without a server and prints the story: `npm run bots -- 7` plays seed 7.
import { createGame } from '../../mobile/src/game/engine';
import { createSeededRandom } from '../../mobile/src/game/rng';
import { CATEGORY_BY_ID } from '../../mobile/src/content/categories';
import { playToEnd } from './gameLoop';

const seed = Number(process.argv[2] ?? 1);
const random = createSeededRandom(seed);
const categoryId = Object.keys(CATEGORY_BY_ID).find((id) => CATEGORY_BY_ID[id].status === 'active')!;
const start = createGame([{ id: 'host', name: 'host', categoryId }], random);
const end = playToEnd(start, random, (event) => {
  if (event.kind === 'resolved') console.log(`duel ${event.duel}: ${event.resolution.summary}`);
  if (event.kind === 'champion') console.log(`champion: ${event.championId}`);
});
console.log(`seed ${seed}: ${end.duels} duels`);
