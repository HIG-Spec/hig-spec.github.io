import { createServer } from 'vite';
import { db, data } from './snapshot.mjs';
import { writeFileSync } from 'node:fs';
const v = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const S = await v.ssrLoadModule('/src/data/store.ts');
const M = await v.ssrLoadModule('/src/specs/materials.js');
S.database.value = db;
S.materials.value = data;
M.initData(db, data);
for (const c of db.components) {
  S.byID.set(c.id, c);
  S.bySymbol.set(c.platform + ':' + c.symbolID, c);
}
const rows = [];
const seen = new Set();
function add(c) {
  if (c && !seen.has(c.id)) {
    rows.push({ id: c.id, family: c.family, platform: c.platform, name: c.name });
    seen.add(c.id);
  }
}
for (const c of db.components.filter(
  (c) => ['tab-bars', 'notifications'].includes(c.family) && !c.internal,
))
  add(c);
for (const f of db.families)
  for (const p of f.platforms) {
    const c = S.defaultDefinition(f.id, p);
    add(c);
    if (c) {
      const target = c.name.replace(/\/Light\//g, '/Dark/');
      let dark = db.components.find(
        (x) => x.family === f.id && x.platform === p && x.name === target && x.id !== c.id,
      );
      if (!dark && c.facets.appearance === 'light')
        dark = db.components.find(
          (x) =>
            x.family === f.id && x.platform === p && x.facets.appearance === 'dark' && !x.internal,
        );
      add(dark);
    }
  }
writeFileSync('tests/visual-cases.json', JSON.stringify(rows, null, 2) + '\n');
console.log(
  'cases',
  rows.length,
  'families',
  new Set(rows.map((c) => c.family)).size,
  'pairs',
  new Set(rows.map((c) => c.family + ':' + c.platform)).size,
);
await v.close();
