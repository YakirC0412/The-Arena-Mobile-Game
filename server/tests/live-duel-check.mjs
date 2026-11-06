// Manual check against the running server (npm run start): 2 players + 1 spectator play a duel over real sockets.
import { createRequire } from 'node:module';
import { Client } from '@colyseus/sdk';
const require = createRequire(import.meta.url);
const { CATEGORY_BY_ID, getWayItems } = require('../dist/mobile/src/content/categories');
const base = process.env.ARENA_HTTP ?? 'http://localhost:2567';
const post = async (path, body) => (await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const tag = Date.now();
const token = async (name) => (await post('/api/register', { email: `${name}${tag}@example.com`, password: 'secret1', name })).token;
const categoryId = Object.keys(CATEGORY_BY_ID).find((id) => CATEGORY_BY_ID[id].status === 'active');
const items = getWayItems(CATEGORY_BY_ID[categoryId], 'w1');
const answerFor = (id) => items.find((item) => item.id === id).answer;

const client = new Client(base.replace('http', 'ws'));
const join = async (name, existing) => {
  const options = { token: await token(name), categoryId };
  const room = existing ? await client.joinById(existing, options) : await client.create('duel', options);
  const state = { room, role: null, view: null, leaked: false };
  room.onMessage('role', (m) => { state.role = m.role; });
  room.onMessage('view', (m) => { state.view = m; if (JSON.stringify(m).includes(answerFor(m.duel?.itemId ?? items[0].id))) state.leaked = true; });
  room.onMessage('correct', () => { state.correct = (state.correct ?? 0) + 1; });
  return state;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = await join('Dana');
const b = await join('Ron', a.room.roomId);
const c = await join('Guy', a.room.roomId);
await wait(600);
console.log('roles:', a.role, b.role, c.role, '| phase:', c.view.phase, '| spectators:', c.view.spectators);

// Wrong player answers: nothing happens. Right player answers: turn passes.
b.room.send('answer', { text: answerFor(a.view.duel.itemId) });
await wait(400);
console.log('defender answers on attacker turn -> active still', c.view.duel.active);
a.room.send('answer', { text: answerFor(a.view.duel.itemId) });
await wait(1500);
console.log('attacker answered right -> active now', c.view.duel.active, '| correct msgs to attacker:', a.correct, 'to spectator:', c.correct ?? 0);
a.room.send('skip');
b.room.send('skip');
await wait(500);
console.log('defender skipped (their turn) -> defender clock', Math.round(c.view.duel.remainingMs.defender / 1000), 's');
console.log('answer leaked to a phone:', a.leaked || b.leaked || c.leaked);
b.room.leave();
await wait(600);
console.log('defender left -> winner:', c.view.winner, 'by', c.view.endedBy);
process.exit(0);
