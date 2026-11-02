// Writes categories-data.json: one category per block, one field or item per line, so git diffs stay readable.
function serialize(data) {
  const cats = data.order.map((id) => {
    const { items, ...rest } = data.categories[id];
    const head = Object.entries(rest).map(([k, v]) => `   ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
    const lines = items.map((item) => `    ${JSON.stringify(item)}`).join(',\n');
    return `  ${JSON.stringify(id)}: {\n${head}\n   "items": [\n${lines}\n   ]\n  }`;
  });
  return `{\n "order": ${JSON.stringify(data.order)},\n "categories": {\n${cats.join(',\n')}\n }\n}\n`;
}
module.exports = { serialize };
