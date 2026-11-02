// Admin panel for The Arena: `npm run admin`, then open http://localhost:8095.
// Edits the game's real files (see store.js). Only reachable from this computer; no password.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const store = require('./store');

const PORT = Number(process.env.ARENA_ADMIN_PORT || 8095);
const MIME = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

// One change at a time: the Python skill and the file operations all touch credits.json and the picture files.
let chain = Promise.resolve();
const exclusive = (fn) => { const run = chain.then(fn); chain = run.catch(() => {}); return run; };

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new store.Bad('הקובץ גדול מדי')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const json = async (req) => { const raw = (await readBody(req, 1e6)).toString('utf8'); return raw ? JSON.parse(raw) : {}; };

// Skill call for one picture; the picture list and credits come back with the next /api/data.
async function skill(cat, args) {
  const result = await store.runSkill([cat, ...args]);
  return { ok: result.ok, lines: result.lines.slice(-6) };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (req.method === 'GET') {
    if (!parts.length) return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), MIME['.html']);
    if (parts[0] === 'api' && parts[1] === 'data') return send(res, 200, store.snapshot());
    if ((parts[0] === 'img' || parts[0] === 'reveal') && parts.length === 3) {
      const [, cat, n] = parts;
      if (!/^[a-z0-9-]+$/.test(cat) || !/^\d+$/.test(n)) return send(res, 400, { error: 'bad path' });
      const file = parts[0] === 'img' ? store.imageFile(cat, n) : (fs.existsSync(store.revealFile(cat, n)) ? store.revealFile(cat, n) : null);
      if (!file) return send(res, 404, { error: 'no picture' });
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    }
    return send(res, 404, { error: 'not found' });
  }

  // Changes: only from the panel page itself (blocks other web pages and DNS tricks from touching the files).
  if (req.headers['x-admin'] !== '1') return send(res, 403, { error: 'forbidden' });
  const [api, kind, cat, n, action] = parts;
  if (api !== 'api') return send(res, 404, { error: 'not found' });
  const m = req.method;

  if (kind === 'category') {
    if (m === 'POST' && !cat) { const body = await json(req); return send(res, 200, { id: await exclusive(() => store.createCategory(body)) }); }
    if (m === 'PUT' && cat) { const body = await json(req); await exclusive(() => store.updateCategory(cat, body)); return send(res, 200, { ok: true }); }
    if (m === 'DELETE' && cat) { await exclusive(() => store.deleteCategory(cat)); return send(res, 200, { ok: true }); }
    if (m === 'POST' && cat && n === 'move') { const body = await json(req); await exclusive(() => store.moveCategory(cat, body.dir)); return send(res, 200, { ok: true }); }
  }
  if (kind === 'item') {
    if (m === 'POST' && cat && !n) { const body = await json(req); return send(res, 200, { n: await exclusive(() => store.addItem(cat, body)) }); }
    if (m === 'PUT' && n) { const body = await json(req); await exclusive(() => store.updateItem(cat, n, body)); return send(res, 200, { ok: true }); }
    if (m === 'DELETE' && n) { await exclusive(() => store.deleteItem(cat, n)); return send(res, 200, { ok: true }); }
    if (m === 'POST' && n && action === 'move') { const body = await json(req); await exclusive(() => store.moveItem(cat, n, body.dir)); return send(res, 200, { ok: true }); }
  }
  if (kind === 'pic' && cat && n) {
    if (m === 'POST' && action === 'upload') {
      const bytes = await readBody(req, 25 * 1024 * 1024);
      if (bytes.length < 100) throw new store.Bad('הקובץ ריק');
      const tmp = path.join(os.tmpdir(), `arena-upload-${Date.now()}-${n}`);
      fs.writeFileSync(tmp, bytes);
      try { return send(res, 200, await exclusive(() => skill(cat, ['--file', `${n}=${tmp}`]))); } finally { fs.rmSync(tmp, { force: true }); }
    }
    if (m === 'POST' && action === 'search') return send(res, 200, await exclusive(() => skill(cat, ['--only', n, '--force'])));
    if (m === 'POST' && action === 'ai') {
      const body = await json(req);
      const args = ['--only', n, '--ai'];
      if (String(body.desc || '').trim()) args.push('--desc', String(body.desc).trim());
      return send(res, 200, await exclusive(() => skill(cat, args)));
    }
    if (m === 'POST' && action === 'blur') { const body = await json(req); return send(res, 200, await exclusive(() => skill(cat, ['--boxes', `${n}=${body.shapes}`]))); }
    if (m === 'POST' && action === 'crop') { const body = await json(req); return send(res, 200, await exclusive(() => skill(cat, ['--crop', `${n}=${body.rect}`]))); }
    if (m === 'POST' && action === 'ok') return send(res, 200, await exclusive(() => skill(cat, ['--ok', n])));
    if (m === 'POST' && action === 'restore') { await exclusive(() => store.restoreOriginal(cat, n)); return send(res, 200, { ok: true }); }
    if (m === 'DELETE') return send(res, 200, await exclusive(() => skill(cat, ['--reject', n])));
  }
  return send(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  const host = String(req.headers.host || '').toLowerCase();
  if (!(host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`)) return send(res, 403, { error: 'forbidden host' });
  handle(req, res).catch((e) => {
    if (e instanceof store.Bad) return send(res, 400, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'שגיאה בשרת: ' + e.message });
  });
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`The Arena admin: http://localhost:${PORT}`);
  const py = store.findPython();
  console.log(py.exe ? `Python for pictures: ${py.exe}` : `WARNING: ${store.pythonHelp()}`);
});
