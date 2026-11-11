// Writes docs/IMAGE_CREDITS.md from assets/items/credits.json.
// Used by the admin panel and the arena-images skill; also runs on its own:
// `node scripts/write-image-credits.js`.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const creditsPath = path.join(root, 'assets', 'items', 'credits.json');
const creditsDoc = path.join(root, '..', 'docs', 'IMAGE_CREDITS.md');

function writeCreditsDoc(credits) {
  const lines = ['# קרדיטים לתמונות', '',
    'תמונות מוויקישיתוף, מוויקיפדיה ומאתרי תמונות חופשיים, ותמונות שנוצרו ב-AI. רישיונות CC BY / CC BY-SA מחייבים ייחוס – לכן הרשימה הזו.',
    'הקובץ נוצר אוטומטית מתוך mobile/assets/items/credits.json (לוח הניהול או הסקיל arena-images).', ''];
  let current = '';
  for (const [id, credit] of Object.entries(credits)) {
    const category = id.replace(/-\d+$/, '');
    if (category !== current) {
      current = category;
      lines.push('', `## ${category}`, '', '| פריט | מקור | צלם / יוצר | רישיון | קובץ |', '|---|---|---|---|---|');
    }
    const cell = (value) => String(value ?? '').replace(/\|/g, '/');
    const license = credit.review ? `${cell(credit.license)} (לבדיקה)` : cell(credit.license);
    const file = credit.page ? `[${cell(credit.file)}](${credit.page})` : cell(credit.file || '—');
    lines.push(`| ${id} | ${cell(credit.source)} | ${cell(credit.author)} | ${license} | ${file} |`);
  }
  fs.writeFileSync(creditsDoc, `${lines.join('\n')}\n`);
}

module.exports = { writeCreditsDoc };

if (require.main === module) {
  writeCreditsDoc(JSON.parse(fs.readFileSync(creditsPath, 'utf8')));
  console.log('Wrote docs/IMAGE_CREDITS.md');
}
