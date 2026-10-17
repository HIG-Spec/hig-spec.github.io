import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { db, data } from './snapshot.mjs';
const v = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => v.close());
const S = await v.ssrLoadModule('/src/data/store.ts');
const M = await v.ssrLoadModule('/src/specs/materials.js');
const G = (await v.ssrLoadModule('/src/rendering/geometry.js')).default;
S.database.value = db;
S.materials.value = data;
M.initData(db, data);
G.init(db);
for (const c of db.components) {
  S.byID.set(c.id, c);
  S.bySymbol.set(c.platform + ':' + c.symbolID, c);
}
const { renderScene } = await v.ssrLoadModule('/src/rendering/scene.ts');
const { componentExport } = await v.ssrLoadModule('/src/specs/exports.ts');
const { shape } = await v.ssrLoadModule('/src/rendering/shape.ts');
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
const named = (name, platform = 'ios') =>
  db.components.find((c) => c.name === name && c.platform === platform);
const count = (s) => +(s.match(/data-glass-count="(\d+)"/)?.[1] ?? 0);
test('every visible saved glass occurrence across every definition reaches the compositor', () => {
  const before = JSON.stringify(db),
    beforeMaterials = JSON.stringify(data);
  for (const c of db.components) {
    const expected = S.glassRecords(c),
      svg = renderScene(c, { width: 400, height: 200, maxScale: 2 });
    assert.equal(count(svg), expected.length, c.id + ' ' + c.name);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity/, c.name);
  }
  assert.equal(JSON.stringify(db), before);
  assert.equal(JSON.stringify(data), beforeMaterials);
});
test('slider child pressed state stays within its full parent, with track and source provenance', () => {
  const c = named('Sliders/Light/Glyphs/Mid - 1 - Enabled'),
    p = S.statePartner(c, true);
  assert.ok(p.previewOf === c.id);
  assert.deepEqual(p.root.f, c.root.f);
  assert.ok(S.glassRecords(p).length);
  assert.ok(renderScene(p).includes('feDisplacementMap'));
  assert.equal(S.statePartner(p, false), c);
  assert.equal(componentExport(p).component, c);
  assert.equal(
    componentExport(p).previewComposition.substitutions[0].from,
    S.bySymbol.get('ios:' + M.flatten(c.root).find((n) => n.name === 'Knob').symbolID).id,
  );
});
test('all segmented-control touch targets preserve labels and do not change sibling slots', () => {
  const c = named('Segmented Controls/Light/Large/1 - Enabled'),
    vs = S.interactionVariants(c);
  assert.equal(vs.length, 5);
  for (const p of vs) {
    assert.equal(S.glassRecords(p).length, 1);
    const svg = renderScene(p);
    for (let i = 1; i <= 5; i++)
      assert.ok(svg.includes('Item ' + i), p.previewLabel + ' Item ' + i);
    assert.equal(p.substitutions.length, 1);
  }
  assert.equal(S.glassRecords(c).length, 0);
});
test('catalogue uses a complete glass state consistently, not a switch-name special case', () => {
  for (const f of [
    'sliders',
    'segmented-controls',
    'switches',
    'menus',
    'sheets',
    'buttons',
    'toolbars',
    'tab-bars',
  ]) {
    const c = S.catalogueDefinition(f, 'ios');
    assert.ok(!c.internal);
    assert.ok(count(renderScene(c)) > 0, f);
  }
});
test('disabled controls are never given an active-glass press partner', () => {
  for (const c of db.components.filter((c) => /Disabled|Inactive/.test(c.name)))
    assert.equal(S.statePartner(c, true), undefined, c.name);
});
test('background blur is composited and is not mislabeled as Liquid Glass', () => {
  const c = named('Popovers (iPad Only)/Light/Top Middle'),
    svg = renderScene(c);
  assert.equal(count(svg), 0);
  assert.ok(+svg.match(/data-background-blur-count="(\d+)"/)[1] > 0);
  assert.match(svg, /feGaussianBlur/);
  assert.doesNotMatch(svg, /feDisplacementMap/);
});
test('macOS popover uses body plus cartouche contour without painting the construction artwork', () => {
  const c = named('Popovers/Light/East-Top', 'macos'),
    svg = renderScene(c);
  assert.equal(count(svg), 1);
  assert.match(svg, /<mask[^>]*>[\s\S]*<path/);
  // The raw green construction shape must not be visible above the glass.
  assert.doesNotMatch(svg, /rgba\(121\.89,206\.04,109\.905,1\)/);
  assert.ok(shape(c.root.children[0]).includes('translate(210 30)'));
});
test('oval and nonuniform corners retain their contour instead of becoming generic capsules', () => {
  const n = { type: 'oval', f: [0, 0, 40, 20] };
  assert.match(shape(n), /ellipse.*rx="20" ry="10"/);
  assert.match(
    shape({ type: 'rectangle', f: [0, 0, 50, 40], style: { corners: { radii: [2, 4, 8, 10] } } }),
    /<path/,
  );
});
test('material annotations and cards use the same shared paint path for non-switch families', () => {
  for (const fam of ['menus', 'sliders', 'toolbars', 'tab-bars', 'alerts', 'popovers']) {
    const c = S.catalogueDefinition(fam, fam === 'popovers' ? 'macos' : 'ios');
    const svg = G.diagram(
      c,
      { dimensions: true, renderIllustration: (view) => renderScene(c, view) },
      720,
      300,
    );
    assert.equal(count(svg), S.glassRecords(c).length, fam);
    assert.match(svg, /pt/);
  }
});

test('source per-side borders are retained and never painted as a closed outline', () => {
  const c = named('Sliders/Light/Glyphs/Mid - 1 - Enabled');
  const record = M.resolve(c).records.find((r) => r.recipe.borders?.some((b) => b.sides));
  assert.ok(record);
  assert.equal(record.recipe.borders[0].sides.bottomInset, 0);
  assert.ok(record.recipe.borders[0].sides.leftInset > 1e30);
  const svg = renderScene(c);
  assert.match(svg, /data-border-side="bottom"/);
  assert.doesNotMatch(svg, /data-border-side="top"/);
});
