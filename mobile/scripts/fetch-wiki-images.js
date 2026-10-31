// Downloads item pictures from Wikipedia / Wikimedia Commons: `npm run wiki-images`.
//
//   npm run wiki-images                      every item that has no picture yet
//   npm run wiki-images -- animals sea       only these categories
//   npm run wiki-images -- --force sea-3     re-download these items (after
//                                            changing their entry in wiki-sources.json)
//
// Sources: scripts/wiki-sources.json (entry n = item <category>-<n>): an
// English Wikipedia title (its free lead image) or "File:<name>" on Commons.
// Pictures are 480px thumbnails saved as assets/items/<category>/<id>.<ext>.
// Credits (CC BY / CC BY-SA need attribution) go to assets/items/credits.json
// and docs/IMAGE_CREDITS.md. Run `npm run images` afterwards to connect them.
const fs = require('node:fs');
const path = require('node:path');
const { writeCreditsDoc } = require('./write-image-credits');

const root = path.join(__dirname, '..');
const itemsDir = path.join(root, 'assets', 'items');
const creditsPath = path.join(itemsDir, 'credits.json');
const replacedDir = path.join(root, '..', 'archive', 'replaced-images');
const EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.gif'];
const UA = { 'User-Agent': 'TheArenaPrototype/0.1 (private trivia game; picture download)' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const args = process.argv.slice(2);
const forceIndex = args.indexOf('--force');
const forced = new Set(forceIndex >= 0 ? args.slice(forceIndex + 1).flatMap((value) => value.split(',')) : []);
const onlyCategories = (forceIndex >= 0 ? args.slice(0, forceIndex) : args).filter(Boolean);

const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'wiki-sources.json'), 'utf8'));
const credits = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : {};

async function fetchRetry(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.ok) return res;
      if (attempt >= 5 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
    } catch (error) {
      if (attempt >= 5 || String(error.message).startsWith('4')) throw error;
    }
    await sleep(4000 * attempt);
  }
}

function existingFile(category, id) {
  const dir = path.join(itemsDir, category);
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).find((file) => path.basename(file, path.extname(file)) === id && EXTENSIONS.includes(path.extname(file).toLowerCase())) ?? null;
}

const plain = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);

async function main() {
  // 1. Which items need a picture.
  const todo = [];
  for (const [category, list] of Object.entries(sources)) {
    if (category.startsWith('_') || (onlyCategories.length && !onlyCategories.includes(category))) continue;
    list.forEach((source, index) => {
      const id = `${category}-${index + 1}`;
      if (forced.has(id) || (!forced.size && !existingFile(category, id))) todo.push({ id, category, source });
    });
  }
  if (!todo.length) return console.log('Nothing to download – every item already has a picture.');
  console.log(`Looking up ${todo.length} pictures…`);

  // 2. Article titles → their free lead image file.
  const byTitle = todo.filter((item) => !item.source.startsWith('File:'));
  for (let i = 0; i < byTitle.length; i += 40) {
    const batch = byTitle.slice(i, i + 40);
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'pageimages',
      piprop: 'name', pilicense: 'free', titles: batch.map((item) => item.source).join('|') });
    const data = await (await fetchRetry(`https://en.wikipedia.org/w/api.php?${params}`)).json();
    const back = new Map();
    for (const step of [...(data.query.normalized || []), ...(data.query.redirects || [])]) back.set(step.to, step.from);
    for (const page of data.query.pages) {
      let title = page.title;
      while (back.has(title)) title = back.get(title);
      for (const item of batch) if (item.source === title && page.pageimage) item.file = page.pageimage;
    }
    await sleep(800);
  }
  for (const item of todo) if (item.source.startsWith('File:')) item.file = item.source.slice(5);

  // 3. Commons: 480px thumbnail, license and author.
  const withFile = todo.filter((item) => item.file);
  for (let i = 0; i < withFile.length; i += 40) {
    const batch = withFile.slice(i, i + 40);
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '480', titles: batch.map((item) => `File:${item.file}`).join('|') });
    const data = await (await fetchRetry(`https://commons.wikimedia.org/w/api.php?${params}`)).json();
    const back = new Map((data.query.normalized || []).map((step) => [step.to, step.from]));
    for (const page of data.query.pages) {
      const asked = (back.get(page.title) || page.title).replace(/^File:/, '').replace(/ /g, '_');
      const info = page.imageinfo?.[0];
      if (!info) continue;
      for (const item of batch) {
        if (item.file.replace(/ /g, '_') !== asked) continue;
        const meta = info.extmetadata || {};
        item.thumb = info.thumburl || info.url;
        item.page = info.descriptionurl;
        item.license = meta.LicenseShortName?.value || '?';
        item.author = plain(meta.Artist?.value) || '—';
      }
    }
    await sleep(800);
  }

  // 4. Download.
  const missing = [];
  let bytes = 0;
  for (const item of todo) {
    if (!item.thumb) { missing.push(item); continue; }
    const ext = (path.extname(new URL(item.thumb).pathname).toLowerCase() || '.jpg').replace('.jpeg', '.jpg');
    const dir = path.join(itemsDir, item.category);
    fs.mkdirSync(dir, { recursive: true });
    const old = existingFile(item.category, item.id);
    if (old) {
      fs.mkdirSync(replacedDir, { recursive: true });
      fs.renameSync(path.join(dir, old), path.join(replacedDir, `${Date.now()}-${old}`));
    }
    const buffer = Buffer.from(await (await fetchRetry(item.thumb)).arrayBuffer());
    fs.writeFileSync(path.join(dir, `${item.id}${ext}`), buffer);
    bytes += buffer.length;
    credits[item.id] = { source: item.source, file: item.file.replace(/ /g, '_'), license: item.license, author: item.author, page: item.page };
    process.stdout.write('.');
    await sleep(500);
  }
  console.log(`\nSaved ${todo.length - missing.length} pictures (${(bytes / 1024 / 1024).toFixed(1)} MB).`);
  for (const item of missing) console.log(`  ! no free picture for ${item.id} (${item.source}) – change its entry in wiki-sources.json`);

  // 5. Credits.
  const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => {
    const [ca, na] = [a.replace(/-\d+$/, ''), Number(a.split('-').pop())];
    const [cb, nb] = [b.replace(/-\d+$/, ''), Number(b.split('-').pop())];
    return ca.localeCompare(cb) || na - nb;
  }));
  fs.writeFileSync(creditsPath, `${JSON.stringify(sorted, null, 1)}\n`);
  writeCreditsDoc(sorted);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
