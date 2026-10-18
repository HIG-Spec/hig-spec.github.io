import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { db, data, hash, compressed } from './snapshot.mjs';
import { readFileSync } from 'node:fs';
const v = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => v.close());
const S = await v.ssrLoadModule('/src/data/store.ts');
const M = await v.ssrLoadModule('/src/specs/materials.js');
const G = (await v.ssrLoadModule('/src/rendering/geometry.js')).default;
const { renderScene } = await v.ssrLoadModule('/src/rendering/scene.ts');
const { resizeFrame } = await v.ssrLoadModule('/src/rendering/layout.ts');
const T = await v.ssrLoadModule('/src/rendering/text-layout.js');
const { sourceMetadata } = await v.ssrLoadModule('/src/rendering/source-meta.ts');
S.database.value = db;
S.materials.value = data;
M.initData(db, data);
G.init(db);
for (const c of db.components) {
  S.byID.set(c.id, c);
  S.bySymbol.set(c.platform + ':' + c.symbolID, c);
}
globalThis.document = {
  createElement: () => ({
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      measureText: (s) => ({ width: s.length * 7 }),
    }),
    toDataURL: () => '',
  }),
};
const named = (id) => S.byID.get(id);
const render = (id) => renderScene(named(id), { width: 680, height: 320, maxScale: 2 });
test('presentation metadata is tied to the unchanged source snapshots', () => {
  assert.equal(sourceMetadata.geometrySHA256, hash(compressed));
  assert.equal(sourceMetadata.rows.length, 2743);
  for (const [p, sha] of Object.entries(sourceMetadata.sources))
    assert.equal(db.sources.find((s) => s.id === p).sha256, sha);
  for (const [ci, ni] of sourceMetadata.rows) {
    const list = [];
    const walk = (n) => {
      list.push(n);
      for (const ch of n.children ?? []) walk(ch);
    };
    walk(db.components[ci].root);
    assert.ok(list[ni]);
  }
});
test('notification background resizes to 344x78 without stretching 20pt corners', () => {
  const c = named('macos:26CCF802-2D00-460F-A309-889BC71CE45B'),
    before = JSON.stringify(c);
  const svg = render(c.id);
  assert.match(svg, /width="344" height="78" rx="20"/);
  assert.match(svg, />Message<\/tspan>/);
  assert.equal(JSON.stringify(c), before);
});
test('Tab Bar has no sample-canvas fill and retains all five captions', () => {
  const svg = render('ios:9D65D820-397C-4F6E-9A6E-D2689B0B7BD9');
  const root = svg.match(
    /data-node-id="9D65D820-397C-4F6E-9A6E-D2689B0B7BD9"[^>]*>(.*?)<\/g>/s,
  )?.[1];
  assert.notEqual(root, undefined);
  assert.doesNotMatch(root, /<rect|<path|<ellipse/);
  for (let i = 1; i <= 5; i++) assert.ok(svg.includes('Tab ' + i));
  for (const m of svg.matchAll(/transform="matrix\(([^)]+)\)"/g)) {
    const a = m[1].split(' ').map(Number);
    if (Math.abs(a[1]) + Math.abs(a[2]) < 1e-8)
      assert.ok(Math.abs(Math.abs(a[0]) - Math.abs(a[3])) < 1e-7);
  }
});
test('fixed centered children stay fixed while pinned backgrounds resize', () => {
  const n = {
    id: 'root',
    f: [0, 0, 200, 54],
    children: [
      { id: 'glyph', f: [87, 7, 26, 38], horizontalSizing: 0, verticalSizing: 0 },
      {
        id: 'bg',
        f: [-4, 0, 208, 54],
        horizontalSizing: 0,
        horizontalPins: 5,
        verticalSizing: 0,
        verticalPins: 5,
      },
    ],
  };
  const r = resizeFrame(n, 70, 54);
  assert.deepEqual(r.children[0].f, [22, 7, 26, 38]);
  assert.deepEqual(r.children[1].f, [-4, 0, 78, 54]);
  assert.equal(n.children[0].f[0], 87);
});
test('space-between Stack distributes slots without adding an invented fixed gutter', () => {
  const n = {
    id: 'root',
    f: [0, 0, 100, 20],
    layout: {
      _class: 'MSImmutableFlexGroupLayout',
      flexDirection: 0,
      justifyContent: 3,
      allGuttersGap: 30,
      alignItems: 0,
    },
    children: [0, 1, 2].map((i) => ({
      id: String(i),
      f: [i * 40, 0, 20, 20],
      horizontalSizing: 0,
      verticalSizing: 0,
    })),
  };
  const r = resizeFrame(n, 200, 20);
  assert.deepEqual(
    r.children.map((n) => n.f[0]),
    [0, 90, 180],
  );
});
test('Fit-width string overrides keep their center and no longer use a one-digit box', () => {
  const n = {
    id: 'date',
    f: [5, 0, 7, 20],
    horizontalSizing: 1,
    text: { value: '28', previewOriginalValue: '8', size: 13, alignment: 2 },
  };
  const r = T.fitOverriddenText(n);
  assert.equal(r.f[2], 14);
  assert.equal(r.f[0] + r.f[2] / 2, 8.5);
  assert.equal(n.f[2], 7);
});
test('preview wrapping and font weight do not squeeze text or invent source-line ellipses', () => {
  assert.equal(T.fontWeight('SFProText-Semibold'), 600);
  assert.equal(T.fontWeight('SFProText-Medium'), 500);
  assert.deepEqual(
    T.textLines({ value: 'Label', size: 13, lineHeight: 16, glyphBounds: [0, 0, 30, 12] }, 30, 16),
    ['Label'],
  );
  assert.ok(
    T.textLines(
      { value: 'A longer message that wraps onto multiple lines', size: 13, lineHeight: 16 },
      100,
      64,
    ).length > 1,
  );
});
test('source clipping uses actual masks and does not clip pressed switch overflow', () => {
  const step = S.defaultDefinition('steppers', 'ios');
  assert.match(render(step.id), /mask="url\(#[^"]*frame-clip/);
  const press = S.statePartner(S.defaultDefinition('switches', 'ios'), true);
  assert.ok(press);
  const svg = renderScene(press, { width: 680, height: 320 });
  assert.match(svg, /data-glass-count="[1-9]/);
});
test('dark control ink is not erased by the multiply fallback', async () => {
  const { blendCSS } = await v.ssrLoadModule('/src/rendering/surface.ts');
  assert.equal(blendCSS[16], 'normal');
  for (const family of ['checkboxes', 'radio-buttons']) {
    const c = db.components.find(
      (c) => c.family === family && c.facets.appearance === 'dark' && !c.internal,
    );
    assert.ok(c);
    assert.match(render(c.id), /<text/);
  }
});
test('catalogue examples are complete source components rather than isolated demo fragments', () => {
  assert.equal(
    S.defaultDefinition('keyboards', 'ios').id,
    'ios:DE3EB3A7-81F3-4C60-90E3-BDBDBF201EB0',
  );
  assert.equal(
    S.defaultDefinition('alerts', 'macos').id,
    'macos:EBE46E1F-FD04-4CC0-B526-1759F0ADC3A4',
  );
});
test('review cases span all families with every public Tab Bar and Notification variant', () => {
  const cases = JSON.parse(readFileSync('tests/visual-cases.json'));
  assert.equal(new Set(cases.map((c) => c.family)).size, 36);
  assert.equal(new Set(cases.map((c) => c.family + ':' + c.platform)).size, 50);
  for (const c of db.components.filter(
    (c) => ['tab-bars', 'notifications'].includes(c.family) && !c.internal,
  ))
    assert.ok(cases.some((x) => x.id === c.id));
  for (const c of cases) assert.equal(named(c.id).name, c.name);
});
