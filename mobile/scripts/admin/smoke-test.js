// End-to-end check of the admin server (it must be running: `npm run admin`). Creates a throwaway category
// "zz-test" with its own pictures, exercises every operation and removes it again (files go to archive/).
// Run: node scripts/admin/smoke-test.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const BASE = `http://localhost:${process.env.ARENA_ADMIN_PORT || 8095}`;
const MOBILE = path.join(__dirname, '..', '..');
const ID = 'zz-test';
const JSON_HEADERS = { 'X-Admin': '1', 'Content-Type': 'application/json' };
let failed = 0;

async function call(method, url, body, raw) {
  const res = await fetch(BASE + url, { method, headers: raw ? { 'X-Admin': '1' } : JSON_HEADERS, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const state = async () => (await (await fetch(`${BASE}/api/data`)).json()).categories[ID];
function check(name, ok, extra = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${extra}`}`);
  if (!ok) failed += 1;
}
const files = () => (fs.existsSync(path.join(MOBILE, 'assets/items', ID)) ? fs.readdirSync(path.join(MOBILE, 'assets/items', ID)).sort() : []);

(async () => {
  const sample = path.join(MOBILE, 'assets/items/animals/animals-1.webp');
  let r = await call('POST', '/api/category', { id: ID, name: 'בדיקה', icon: '🧪', level: 'easy', status: 'reserve', ways: [['תמונה ← שם', true], ['דרך שנייה', true]], picture: { kind: 'photo' } });
  check('create category', r.status === 200, JSON.stringify(r.body));
  r = await call('POST', '/api/category', { id: ID, name: 'x', ways: [['a', true]] });
  check('duplicate id is refused', r.status === 400);

  await call('POST', `/api/item/${ID}`, { answer: "פיל ג׳ירפה'", en: 'Elephant', second: { answer: 'אפריקה' } });
  await call('POST', `/api/item/${ID}`, { answer: 'אריה', aliases: 'מלך החיות, אריה אפריקאי', en: 'Lion' });
  await call('POST', `/api/item/${ID}`, { answer: 'נמר', en: 'Leopard' });
  let c = await state();
  check('three items, geresh removed', c.items.length === 3 && c.items[0].answer === 'פיל גירפה', JSON.stringify(c.items.map((i) => i.answer)));
  check('aliases split on commas', c.items[1].aliases?.length === 2);
  r = await call('POST', `/api/item/${ID}`, { answer: 'מלך החיות' });
  check('answer that equals another item\'s alias is refused', r.status === 400);
  r = await call('PUT', `/api/item/${ID}/3`, { answer: '' });
  check('empty answer is refused', r.status === 400);

  r = await call('POST', `/api/pic/${ID}/1/upload?name=a.webp`, undefined, fs.readFileSync(sample));
  check('upload picture 1', r.body.ok === true, JSON.stringify(r.body));
  r = await call('POST', `/api/pic/${ID}/3/upload?name=b.webp`, undefined, fs.readFileSync(path.join(MOBILE, 'assets/items/animals/animals-4.webp')));
  check('upload picture 3', r.body.ok === true, JSON.stringify(r.body));
  check('files named by item number', files().join() === `${ID}-1.webp,${ID}-3.webp`, files().join());
  const before3 = fs.readFileSync(path.join(MOBILE, 'assets/items', ID, `${ID}-3.webp`));

  await call('POST', `/api/item/${ID}/2/move`, { dir: 1 });
  c = await state();
  check('move item 2 down swaps data and pictures', c.items[1].answer === 'נמר' && c.items[2].answer === 'אריה' && files().join() === `${ID}-1.webp,${ID}-2.webp`
    && fs.readFileSync(path.join(MOBILE, 'assets/items', ID, `${ID}-2.webp`)).equals(before3), files().join());

  r = await call('POST', `/api/pic/${ID}/2/blur`, { shapes: '0.1,0.1,0.3,0.3;ring:0.5,0.5,0.4,0.25' });
  check('blur', r.body.ok === true, JSON.stringify(r.body));
  c = await state();
  check('blur keeps the original and marks the picture', c.items[1].pic.hasOriginal && c.items[1].credit.hidden === 'blur');
  r = await call('POST', `/api/pic/${ID}/2/restore`);
  check('restore original', r.status === 200);
  r = await call('POST', `/api/pic/${ID}/2/crop`, { rect: '0.1,0.1,0.5,0.5' });
  check('crop', r.body.ok === true, JSON.stringify(r.body));

  await call('DELETE', `/api/item/${ID}/1`);
  c = await state();
  check('delete item 1 shifts items and pictures', c.items.length === 2 && c.items[0].answer === 'נמר' && files().join() === `${ID}-1.webp`, files().join());
  r = await call('DELETE', `/api/pic/${ID}/1`);
  check('delete picture', r.body.ok === true && files().length === 0, JSON.stringify(r.body));

  r = await call('PUT', `/api/category/${ID}`, { name: 'בדיקה 2', ways: [['דרך אחת', true]] });
  c = await state();
  check('edit category keeps its items', r.status === 200 && c.name === 'בדיקה 2' && c.items.length === 2);
  r = await fetch(`${BASE}/api/item/${ID}`, { method: 'POST', body: '{}' });
  check('change without the panel header is refused', r.status === 403);

  r = await call('DELETE', `/api/category/${ID}`);
  const all = await (await fetch(`${BASE}/api/data`)).json();
  check('delete category', r.status === 200 && !all.categories[ID] && !all.order.includes(ID));
  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
