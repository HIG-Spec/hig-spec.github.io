import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/specs/materials.js';
import { db, data, manifest } from './snapshot.mjs';
const preset = (platform, name) =>
    data.styles.find((s) => s.platform === platform && s.name === name),
  recipe = (s) => data.recipes[s.recipe];
M.initData(db, data);
test('materials belong to the exact unchanged geometry payload and source snapshots', () => {
  assert.equal(manifest.geometryPayloadSHA256, data.geometryPayloadSHA256);
  assert.equal(db.components.length, 6536);
  assert.equal(db.families.length, 36);
  for (const s of data.sources)
    assert.equal(s.sha256, db.sources.find((x) => x.id === s.platform).sha256);
});
test('38 catalogue records retain same-name macOS styles as distinct IDs', () => {
  assert.equal(data.styles.filter((s) => s.catalog).length, 38);
  for (const p of ['ios', 'macos'])
    assert.equal(data.styles.filter((s) => s.catalog && s.platform === p).length, 19);
  const dup = data.styles.filter(
    (s) => s.platform === 'macos' && s.name === 'Liquid Glass/Light/Regular - Small - Tinted',
  );
  assert.equal(dup.length, 2);
  assert.notEqual(dup[0].id, dup[1].id);
  assert.notEqual(dup[0].recipe, dup[1].recipe);
});
test('iOS and macOS Medium keep distinct source blur radii', () => {
  assert.equal(recipe(preset('ios', 'Liquid Glass/Light/Regular - Medium')).blurs[0].radius, 15);
  assert.equal(recipe(preset('macos', 'Liquid Glass/Light/Regular - Medium')).blurs[0].radius, 30);
});
test('Small preserves every effect, float and raw shader-facing control', () => {
  const r = recipe(preset('ios', 'Liquid Glass/Light/Regular - Small')),
    b = r.blurs[0];
  assert.deepEqual(
    [
      b.radius,
      b.distortion,
      b.depth,
      b.saturation,
      b.brightness,
      b.chromaticAberrationMultiplier,
      b.skipLightingEffects,
    ],
    [6, 0.4, 0.8, 2, 1, 0, true],
  );
  assert.equal(r.fills.filter((x) => x.isEnabled).length, 4);
  assert.equal(r.shadows.filter((x) => x.isEnabled && !x.isInnerShadow).length, 4);
  assert.equal(r.shadows.filter((x) => x.isEnabled && x.isInnerShadow).length, 9);
  assert.equal(r.fills[0].color.red, 0.973333333333334);
  assert.equal(r.shadows[0].offsetY, 8);
  assert.equal(r.shadows[0].blurRadius, 15);
});
test('inactive and disabled effects are not fabricated as zero-valued active glass', () => {
  const r = recipe(preset('ios', 'Liquid Glass/Light/Regular - Small - Inactive'));
  assert.ok(!r.blurs?.some((x) => x.type === 4 && x.isEnabled));
  assert.equal(M.enabled(r), false);
  assert.ok(data.recipes.some((r) => r.blurs?.some((b) => b.type === 4 && b.isEnabled === false)));
});
test('all material and support bindings have real nodes, effect recipes and platform-correct sources', () => {
  let n = 0;
  for (const [ci, entries] of Object.entries(data.bindings))
    for (const [ni, ri, si] of entries) {
      const c = db.components[ci],
        node = M.flatten(c.root)[ni];
      assert.ok(node?.id && data.recipes[ri]);
      if (si !== null) assert.equal(data.styles[si].platform, c.platform);
      n++;
    }
  assert.equal(n, 1933);
  assert.equal(Object.keys(data.bindings).length, 1342);
});
test('all definitions resolve without mutating either geometry or material payloads', () => {
  const before = JSON.stringify(db),
    beforeMaterials = JSON.stringify(data);
  let count = 0,
    changed = 0,
    overridden = 0;
  for (const c of db.components) {
    const r = M.resolve(c);
    count += r.records.length > 0;
    for (const x of r.records) {
      changed += !!x.localDifference.length;
      overridden += !!x.overrides.length;
      assert.ok(x.location.startsWith('pages/'));
      assert.ok(x.nodeID);
    }
  }
  assert.ok(count > 1164);
  assert.ok(changed > 0);
  assert.ok(overridden > 0);
  assert.equal(JSON.stringify(db), before);
  assert.equal(JSON.stringify(data), beforeMaterials);
});
function fixtures() {
  const leaf = { id: 'glass', name: 'Surface', type: 'rectangle', path: '/layers/0', children: [] };
  const master = {
    id: 'master',
    platform: 'ios',
    name: 'Master',
    symbolID: 'SYM',
    source: { member: 'pages/test.json', pointer: '/layers/0' },
    root: { id: 'R', path: '', children: [leaf] },
  };
  const instance = (id) => ({
    id,
    name: id,
    type: 'symbolInstance',
    symbolID: 'SYM',
    path: '/layers/0',
    overrides: [],
  });
  const c = {
    id: 'screen',
    platform: 'ios',
    name: 'Screen',
    source: { member: 'pages/test.json', pointer: '/layers/1' },
    root: { id: 'S', path: '', children: [instance('A'), instance('B')] },
  };
  const d = { sources: [{ id: 'ios', sha256: 'test' }], components: [master, c] };
  const p = {
    format: 'hig-material-specs/1',
    sources: [{ platform: 'ios', sha256: 'test' }],
    styles: [
      { platform: 'ios', id: 'base', name: 'Base', catalog: true, recipe: 0 },
      { platform: 'ios', id: 'new', name: 'New', catalog: true, recipe: 1 },
    ],
    recipes: [
      {
        blurs: [{ type: 4, isEnabled: true, radius: 6 }],
        fills: [{ isEnabled: true, color: { red: 0, green: 0, blue: 0, alpha: 1 } }],
      },
      {
        blurs: [{ type: 4, isEnabled: true, radius: 30 }],
        fills: [{ isEnabled: true, color: { red: 1, green: 1, blue: 1, alpha: 1 } }],
      },
    ],
    bindings: { 0: [[1, 0, 0]] },
    counts: {},
  };
  return { d, p, c, master };
}
test('nested layerStyle and color overrides remain scoped to their instance', () => {
  const { d, p, c } = fixtures();
  c.root.children[0].overrides = [
    { overrideName: 'glass_layerStyle', value: 'new' },
    { overrideName: 'glass_color:fill-0', value: { red: 0.5, green: 0, blue: 0, alpha: 0.7 } },
  ];
  M.initData(d, p);
  const r = M.resolve(c).records;
  assert.equal(r.length, 2);
  assert.equal(r[0].shared.id, 'new');
  assert.equal(r[0].recipe.blurs[0].radius, 30);
  assert.equal(r[0].recipe.fills[0].color.alpha, 0.7);
  assert.equal(r[1].recipe.blurs[0].radius, 6);
  assert.equal(r[1].recipe.fills[0].color.alpha, 1);
  assert.equal(r[0].overrides.length, 2);
  assert.ok(r[0].overrides[0].source.endsWith('/overrideValues/0'));
  M.initData(db, data);
});
test('outer overrides win, hidden parents propagate, and siblings do not share changes', () => {
  const { d, p, c, master } = fixtures();
  const outer = {
    id: 'outer',
    platform: 'ios',
    name: 'Outer',
    source: { member: 'pages/test.json', pointer: '/layers/2' },
    root: {
      id: 'O',
      path: '',
      children: [
        {
          id: 'I',
          name: 'I',
          type: 'symbolInstance',
          symbolID: 'SCREEN',
          path: '/layers/0',
          overrides: [
            { overrideName: 'A/glass_layerStyle', value: 'new' },
            { overrideName: 'A_isVisible', value: 0 },
          ],
        },
      ],
    },
  };
  c.symbolID = 'SCREEN';
  c.root.children[0].overrides = [{ overrideName: 'glass_layerStyle', value: 'base' }];
  d.components.push(outer);
  M.initData(d, p);
  const r = M.resolve(outer).records;
  assert.equal(r[0].shared.id, 'new');
  assert.equal(r[0].hidden, true);
  assert.equal(r[1].hidden, false);
  assert.equal(r[1].shared.id, 'base');
  M.initData(db, data);
});
test('cycle and missing-reference warnings are explicit, not silent no-material results', () => {
  const { d, p, c, master } = fixtures();
  master.root.children.push(
    { id: 'cycle', name: 'cycle', path: '/layers/1', type: 'symbolInstance', symbolID: 'SYM' },
    {
      id: 'missing',
      name: 'missing',
      path: '/layers/2',
      type: 'symbolInstance',
      symbolID: 'UNKNOWN',
    },
  );
  M.initData(d, p);
  const r = M.resolve(c);
  assert.ok(r.warnings.some((w) => w.includes('循环')));
  assert.ok(r.warnings.some((w) => w.includes('UNKNOWN')));
  assert.equal(r.records.length, 2);
  M.initData(db, data);
});
