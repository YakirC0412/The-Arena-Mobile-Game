// Manual end-to-end check against the running server (npm.cmd run start): two scripted people play a whole online game
// (their phones are fake clients) next to 14 bots. Run from server/:  node tests/live-game-check.mjs [guest-only <CODE>]
//   no arguments        = creates the room itself with two scripted people and plays to the champion
//   guest-only <CODE>   = joins an existing room (for example one opened in the browser) as a scripted second person,
//                         picks a category, and plays until the game ends
import { createRequire } from 'node:module';
import { Client } from '@colyseus/sdk';

const require = createRequire(import.meta.url);
const { CATEGORY_BY_ID, getWayItems } = require('../dist/mobile/src/content/categories.js');
const base = process.env.ARENA_HTTP ?? 'http://localhost:2567';
const j = async (path, options) => (await fetch(base + path, options)).json();
const tag = Date.now();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const register = async (name) =>
  (await j('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${name}${tag}@example.com`, password: 'secret1', name }) })).token;
const client = new Client(base.replace('http', 'ws'));
const categories = (await j('/api/categories')).categories;

// A scripted player: picks the first neighbor, returns to the arena after a win, answers every picture right.
function drive(name, room, log) {
  const player = { name, me: null, view: null, stages: new Set(), duelsSeen: 0 };
  room.onMessage('me', (message) => { player.me = message.playerId; });
  room.onMessage('game', (view) => {
    player.view = view;
    if (!player.stages.has(view.stage)) { player.stages.add(view.stage); log(`${name}: stage ${view.stage} (duel ${view.duels})`); }
  });
  room.onMessage('correct', () => {});
  room.onMessage('error', (message) => log(`${name}: error ${message.error}`));
  const timer = setInterval(() => {
    const view = player.view;
    if (!view || !player.me) return;
    if (view.stage === 'target' && view.attackerId === player.me && view.targets.length) room.send('pickTarget', { targetId: view.targets[0] });
    else if (view.stage === 'final' && view.finalOptions.length) room.send('pickFinalCategory', { categoryId: view.finalOptions[0] });
    else if (view.stage === 'after' && view.attackerId === player.me && view.choiceLeftMs !== null) room.send('return');
    else if (view.stage === 'duel' && view.duel && !view.duel.paused && !view.duel.winner && view.setup) {
      const side = view.setup.attackerId === player.me ? 'attacker' : view.setup.defenderId === player.me ? 'defender' : null;
      if (side && view.duel.active === side) {
        const category = CATEGORY_BY_ID[view.setup.categoryId];
        const wayId = category.ways.find((way) => way.label === view.setup.wayLabel)?.id ?? 'w1';
        const answer = getWayItems(category, wayId).find((item) => item.id === view.duel.itemId)?.answer;
        if (process.env.WEAK) room.send('skip');
        else if (answer) room.send('answer', { text: answer });
      }
    }
  }, 300);
  return { player, stop: () => clearInterval(timer) };
}

const log = (text) => console.log(`[${((Date.now() - tag) / 1000).toFixed(0).padStart(3)}s] ${text}`);
const guestOnly = process.argv[2] === 'guest-only';
let hostRoom = null;
let roomId;
if (guestOnly) {
  roomId = (await j('/api/rooms/code/' + process.argv[3].toLowerCase())).roomId;
} else {
  const code = (await j('/api/rooms/new-code', { headers: { Authorization: 'Bearer ' + (await register('x')) } })).code;
  hostRoom = await client.create('game', { token: await register('host'), name: 'בדיקה חיה', visibility: 'public', code });
  roomId = (await j('/api/rooms/code/' + code)).roomId;
  log(`room ${code} open`);
}
const guestRoom = await client.joinById(roomId, { token: await register('guest') });
const lobbies = [];
for (const room of [hostRoom, guestRoom].filter(Boolean)) room.onMessage('lobby', (view) => { lobbies.push(view); });
const drivers = [];
if (hostRoom) drivers.push(drive('host', hostRoom, log));
drivers.push(drive('guest', guestRoom, log));
for (const room of [hostRoom, guestRoom].filter(Boolean)) room.send('hello');
await wait(400);
guestRoom.send('pickCategory', { categoryId: process.env.GUEST_CAT ?? categories[categories.length - 1].id, wayId: 'w1' });
if (hostRoom) {
  hostRoom.send('pickCategory', { categoryId: process.env.HOST_CAT ?? categories[0].id, wayId: 'w1' });
  await wait(500);
  hostRoom.send('start');
  log('start sent');
}

const started = Date.now();
const finish = await new Promise((resolve) => {
  const poll = setInterval(() => {
    const view = drivers[0].player.view;
    if (view?.stage === 'done') { clearInterval(poll); resolve('champion'); }
    if (Date.now() - started > Number(process.env.CAP_MS ?? 600_000)) { clearInterval(poll); resolve('time cap'); }
  }, 500);
});
const last = drivers[0].player.view;
log(`ended by ${finish}: duels ${last?.duels}, champion ${last?.players.find((p) => p.id === last.championId)?.name}`);
drivers.forEach((d) => d.stop());
console.log('leaders:', JSON.stringify((await j('/api/leaders')).leaders?.slice(0, 3)));
process.exit(0);
