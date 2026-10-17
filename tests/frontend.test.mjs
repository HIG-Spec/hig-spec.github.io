import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { db, data, manifest, dataURL, hash } from './snapshot.mjs';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const store = await server.ssrLoadModule('/src/data/store.ts');
const M = await server.ssrLoadModule('/src/specs/materials.js');
const G = (await server.ssrLoadModule('/src/rendering/geometry.js')).default;
store.database.value = db;
store.materials.value = data;
M.initData(db, data);
G.init(db);
for (const c of db.components) {
  store.byID.set(c.id, c);
  store.bySymbol.set(c.platform + ':' + c.symbolID, c);
}
const { metrics } = await server.ssrLoadModule('/src/specs/measurements.ts');
const { offsetAt, filterDefinition } = await server.ssrLoadModule('/src/rendering/refraction.ts');
const { renderScene } = await server.ssrLoadModule('/src/rendering/scene.ts');
const { componentExport } = await server.ssrLoadModule('/src/specs/exports.ts');
const { blendNames } = await server.ssrLoadModule('/src/rendering/surface.ts');
// Filter structure tests don't rasterize the displacement map. Browser tests do.
globalThis.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      measureText: (s) => ({ width: s.length * 7 }),
    }),
    toDataURL: () => 'data:image/png;base64,',
  }),
};
const pressed = db.components.find((c) => c.name === 'Toggles/Light/On/3 - Pressed');
const idle = db.components.find((c) => c.name === 'Toggles/Light/On/1 - Idle');
test('split snapshots retain independent digests and the untouched geometry binary', () => {
  for (const k of ['geometry', 'materials'])
    assert.equal(hash(fs.readFileSync(new URL(k + '.json.gz', dataURL))), manifest[k]);
  assert.equal(
    manifest.geometry,
    '5fcf831e72a3e2e973481e0613bd1a9ab587436c80fcd2d88b3af82ddfb9010d',
  );
});
test('zero blur is still active refractive glass on the pressed iOS switch', () => {
  const glass = store.glassRecords(pressed);
  assert.equal(glass.length, 1);
  const b = glass[0].recipe.blurs.find((b) => b.type === 4);
  assert.deepEqual([b.radius, b.distortion, b.depth], [0, 0.075, 0.4]);
  assert.equal(store.glassRecords(idle).length, 0);
});
test('pressed switch material includes previously omitted soft shadow and compositing rim', () => {
  const r = M.resolve(pressed).records;
  assert.ok(
    r.some(
      (x) =>
        x.nodeName === 'Knob Shadow' && x.recipe.blurs.some((b) => b.type === 0 && b.radius === 3),
    ),
  );
  assert.ok(
    r.some(
      (x) =>
        x.nodeName === 'Knob Glow' &&
        x.recipe.borders.some((b) => b.contextSettings.blendMode === 16),
    ),
  );
  assert.equal(blendNames[16], 'Plus darker');
  assert.equal(blendNames[17], 'Plus lighter');
});
test('state discovery preserves true idle appearance and makes the real pressed partner reachable', () => {
  assert.equal(store.statePartner(idle, true).id, pressed.id);
  assert.equal(store.statePartner(pressed, false).id, idle.id);
  assert.match(store.togglePartner(idle).name, /Off/);
  const mac = db.components.find(
    (c) =>
      c.platform === 'macos' &&
      c.name.includes('Toggles - Switches/Light/Content Area/3 Rg/Active, On, 1 - Idle'),
  );
  assert.ok(mac);
  assert.match(store.statePartner(mac, true).name, /Clicked/);
  assert.ok(store.glassRecords(store.statePartner(mac, true)).length);
});
test('slider pressed knob is discoverable from its opaque static variant', () => {
  const slider = store.defaultDefinition('sliders', 'ios');
  assert.ok(slider);
  assert.ok(store.glassVariants(slider).some((c) => c.internal && /Pressed/.test(c.name)));
});
test('SDF displacement is directional, symmetric, finite, and zero at the centre', () => {
  assert.deepEqual(offsetAt(30, 20, 60, 40, 20), [0, 0]);
  const a = offsetAt(1, 20, 60, 40, 20),
    b = offsetAt(59, 20, 60, 40, 20);
  assert.ok(a[0] > 0);
  assert.ok(b[0] < 0);
  assert.ok(Math.abs(a[0] + b[0]) < 1e-8);
  for (let y = 0; y < 40; y += 2)
    for (let x = 0; x < 60; x += 2) assert.ok(offsetAt(x, y, 60, 40, 20).every(Number.isFinite));
});
test('SVG refraction actually uses displacement of the preceding scene, not a CSS blur stand-in', () => {
  const svg = renderScene(pressed, { glass: true });
  assert.match(svg, /<feDisplacementMap/);
  assert.match(svg, /data-glass-count="1"/);
  assert.match(svg, /Knob|Toggles/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  const flat = renderScene(pressed, { glass: false });
  assert.doesNotMatch(flat, /<feDisplacementMap/);
});
test('aberration and source zero radius survive the preview mapping', () => {
  const svg = filterDefinition('x', 59, 37, 18.5, {
    radius: 0,
    distortion: 0.075,
    depth: 0.4,
    chromaticAberrationMultiplier: 0.4,
  });
  assert.equal((svg.match(/<feDisplacementMap/g) || []).length, 3);
  assert.match(svg, /stdDeviation="0"/);
});
test('size and explicit padding are shown, freeform default padding is not a constraint', () => {
  assert.ok(metrics(idle.root).some((r) => r[0] === '上内边距' && r[1] === '2 pt'));
  const knob = db.components.find((c) => c.id === 'ios:799E7BE1-15D6-4C03-AED1-9B169B3B884F');
  assert.ok(!metrics(knob.root).some((r) => r[0].includes('内边距')));
});
test('component export includes actual nested glass, source IDs, precision and support effects', () => {
  const e = componentExport(pressed);
  assert.equal(e.source.id, 'ios');
  assert.equal(e.component, pressed);
  const r = e.materials.records.find((r) => r.recipe.blurs.some((b) => b.type === 4));
  assert.equal(r.recipe.blurs[0].distortion, 0.075);
  assert.ok(r.chain.length);
  assert.ok(r.location.startsWith('pages/'));
});
test('all source definitions can generate bounded SVG scene markup without mutating source data', () => {
  const before = JSON.stringify(db),
    mat = JSON.stringify(data);
  for (const c of db.components) {
    const svg = renderScene(c, { width: 400, height: 200, glass: true, maxScale: 2 });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(!/NaN|undefined|Infinity/.test(svg), c.name);
  }
  assert.equal(JSON.stringify(db), before);
  assert.equal(JSON.stringify(data), mat);
});

test('dimension diagrams share the material scene rather than drawing hard shadow borders', () => {
  let viewport;
  const diagram = G.diagram(
    pressed,
    {
      dimensions: true,
      padding: true,
      renderIllustration: (v) => {
        viewport = v;
        return renderScene(pressed, { ...v, background: 'plain' });
      },
    },
    720,
    300,
  );
  assert.deepEqual(viewport.placement.slice(0, 4), [3.3, 0, 0, 3.3]);
  assert.match(diagram, /data-glass-count="1"/);
  assert.match(diagram, /feDisplacementMap/);
  assert.match(diagram, /stdDeviation="1.5"/);
  assert.match(diagram, /64 pt/);
  assert.match(diagram, /单位 pt/);
  assert.doesNotMatch(diagram, /NaN|undefined|Infinity/);
});

test('pressed switch soft shadow and glass remain present at thumbnail scale', () => {
  const svg = renderScene(pressed, {
    width: 300,
    height: 160,
    maxScale: 1.35,
    background: 'plain',
  });
  assert.match(svg, /data-glass-count="1"/);
  assert.match(svg, /stdDeviation="1.5"/);
  assert.match(svg, /feDisplacementMap/);
  // No fabricated opaque fill: the lens retains the source zero-blur recipe.
  assert.equal(store.glassRecords(pressed)[0].recipe.blurs[0].radius, 0);
});
