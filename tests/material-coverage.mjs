/** Emit reproducible per-platform coverage cases for production browser checks. */
import { createServer } from 'vite';
import fs from 'node:fs';
import { db, data } from './snapshot.mjs';
const v = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const S = await v.ssrLoadModule('/src/data/store.ts');
  const M = await v.ssrLoadModule('/src/specs/materials.js');
  S.database.value = db;
  S.materials.value = data;
  M.initData(db, data);
  for (const c of db.components) {
    S.byID.set(c.id, c);
    S.bySymbol.set(`${c.platform}:${c.symbolID}`, c);
  }
  const cases = [];
  for (const f of db.families)
    for (const platform of f.platforms) {
      const c = S.catalogueDefinition(f.id, platform);
      const q = new URLSearchParams({ v: c.previewOf ?? c.id });
      if (c.previewKey) q.set('interaction', c.previewKey);
      cases.push({
        family: f.id,
        platform,
        label: c.previewLabel ?? c.name,
        route: `/components/${f.id}?${q}`,
        glass: S.glassRecords(c).length,
      });
    }
  const rows = db.components.map((c) => ({
    id: c.id,
    family: c.family,
    count: S.glassRecords(c).length,
  }));
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync(
    'test-results/material-coverage.json',
    JSON.stringify(
      {
        definitions: db.components.length,
        glassDefinitions: rows.filter((c) => c.count).length,
        glassOccurrences: rows.reduce((s, c) => s + c.count, 0),
        families: db.families.length,
        cases,
      },
      null,
      2,
    ),
  );
} finally {
  await v.close();
}
