import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { db } from './snapshot.mjs';
import S from '../src/rendering/symbols.js';
const cp = (code) => String.fromCodePoint(parseInt(code, 16));
const text = (value, more = {}) => ({
  value,
  size: 13,
  lineHeight: 16,
  alignment: 2,
  font: 'SFPro-Regular',
  ...more,
});
test('source inventory and measurement values are intact', () => {
  assert.equal(db.components.length, 6536);
  assert.equal(db.families.length, 36);
  const button = db.components.find(
    (c) =>
      c.platform === 'ios' &&
      c.name === 'Buttons/Light/Large/Bordered Prominent/Symbol + Text/1 - Idle',
  );
  assert.ok(button);
  assert.deepEqual(button.root.f.slice(2), [91, 50]);
});
test('PUA detection respects supplementary code points', () => {
  assert.ok(S.isPUA(cp('100284')));
  assert.ok(S.isPUA(cp('E000')));
  assert.ok(!S.isPUA('Play 42'));
  assert.equal(S.nameFor(cp('100284')), 'play.fill');
  assert.equal(S.nameFor(cp('100188')), 'chevron.down');
  assert.equal(S.nameFor(cp('101004')), 'diamond.righthalf.filled');
});
test('chevron directions have distinct paths, not a minus fallback', () => {
  const up = S.illustration('chevron.up'),
    down = S.illustration('chevron.down'),
    left = S.illustration('chevron.left'),
    right = S.illustration('chevron.right');
  assert.equal(new Set([up, down, left, right]).size, 4);
  assert.ok([up, down, left, right].every((s) => s.includes('<path') && !s.includes('<circle')));
});
test('genuine minus.circle is retained, unknown glyphs are explicitly marked', () => {
  const real = S.symbol(cp('10004E'), 0, 0, 16, 16, 'black');
  assert.ok(real.includes('data-symbol-name="minus.circle"'));
  assert.ok(real.includes('<circle'));
  const unknown = S.symbol(cp('10FFFD'), 0, 0, 16, 16, 'black');
  assert.ok(unknown.includes('data-symbol-status="unmapped"'));
  assert.ok(unknown.includes('U+10FFFD'));
  assert.ok(unknown.includes('<rect'));
  assert.ok(!unknown.includes('<path') && !unknown.includes('<circle'));
});
test('single symbol uses measured 14pt glyph, not a 50pt hit target', () => {
  const svg = S.renderText(
    text(cp('100284'), { size: 17, lineHeight: 18, glyphBounds: [19, 2, 14, 14] }),
    50,
    50,
    'g1',
  );
  assert.ok(svg.includes('translate(19 18) scale(0.5833333333333334 0.5833333333333334)'));
  assert.ok(!svg.includes('<svg'), 'nested SVG must not inherit width:100% preview CSS');
});
test('mixed heart + Toggle keeps its text and does not expand glyph to label width', () => {
  const svg = S.renderText(
    text(cp('1002B4') + ' Toggle', { glyphBounds: [1, 2, 60, 14] }),
    62,
    16,
    'g2',
  );
  assert.ok(svg.includes('> Toggle</text>'));
  assert.ok(svg.includes('data-symbol-name="heart"'));
  assert.ok(svg.includes('scale(0.5416666666666666 0.5416666666666666)'));
});
test('multiple glyphs, spaces, labels, and XML escaping survive', () => {
  const svg = S.renderText(text(cp('100202') + ' Send <Copy> & ' + cp('1003A0')), 180, 20, 'g3');
  assert.equal((svg.match(/data-symbol-code=/g) || []).length, 2);
  assert.ok(svg.includes(' Send &lt;Copy&gt; &amp; '));
  assert.ok(svg.includes('xml:space="preserve"'));
  assert.ok(!svg.includes('undefined') && !svg.includes('NaN'));
});
test('multiline mixed label retains every line', () => {
  const svg = S.renderText(text(cp('1003A0') + ' Locked\nFriday 9:41'), 150, 40, 'g4');
  assert.ok(svg.includes(' Locked</text>'));
  assert.ok(svg.includes('Friday 9:41</text>'));
});
test('source-only Apple logo is not silently substituted with unrelated artwork', () => {
  assert.equal(S.illustration('apple.logo'), null);
  const svg = S.symbol(cp('1008FA'), 0, 0, 15, 15, 'black');
  assert.ok(svg.includes('unmapped') && svg.includes('apple.logo'));
});
test('all source symbol-bearing text layers render, without invalid numeric output', () => {
  let count = 0;
  function visit(n) {
    if (n.text && S.isPUA(n.text.value || '')) {
      const svg = S.renderText(n.text, n.f[2], n.f[3], 'unit' + count++);
      assert.ok(!svg.includes('NaN') && !svg.includes('Infinity'), n.name);
      for (const c of Array.from(n.text.value).filter(S.isPUA)) {
        assert.ok(
          svg.includes('data-symbol-code="' + c.codePointAt(0).toString(16).toUpperCase() + '"'),
          n.name,
        );
      }
    }
    (n.children || []).forEach(visit);
  }
  db.components.forEach((c) => visit(c.root));
  assert.ok(count > 1500, 'exercise the real extracted dataset, not only fixtures');
});
test('direct overrides clone the preview and leave master data unchanged', () => {
  const master = {
    id: 'root',
    children: [{ id: 'label', text: text('Original', { glyphBounds: [0, 0, 1, 1] }) }],
  };
  const frozen = JSON.stringify(master);
  const applied = S.applyOverrides(master, [
    { overrideName: 'label_stringValue', value: cp('100185') + ' Done' },
  ]);
  assert.equal(applied.children[0].text.value, cp('100185') + ' Done');
  assert.equal(applied.children[0].text.glyphBounds, undefined);
  assert.equal(JSON.stringify(master), frozen);
  assert.notEqual(applied, master);
});
test('nested instance overrides stay scoped and preserve existing overrides', () => {
  const master = {
    id: 'root',
    children: [
      {
        id: 'A',
        type: 'symbolInstance',
        symbolID: 'old',
        overrides: [{ overrideName: 'L_stringValue', value: 'old label' }],
      },
      { id: 'B', type: 'symbolInstance', symbolID: 'old' },
    ],
  };
  const applied = S.applyOverrides(master, [
    { overrideName: 'A/L_stringValue', value: 'Only A' },
    { overrideName: 'A_symbolID', value: 'new' },
  ]);
  assert.equal(applied.children[0].symbolID, 'new');
  assert.equal(applied.children[1], master.children[1]);
  const resolved = S.applyOverrides(
    { id: 'R', children: [{ id: 'L', text: text('Default') }] },
    applied.children[0].overrides,
  );
  assert.equal(resolved.children[0].text.value, 'Only A');
  assert.equal(master.children[0].symbolID, 'old');
});
test('visibility override is honored and missing overrides preserve identity', () => {
  const n = { id: 'A', hidden: false, children: [] };
  assert.equal(S.applyOverrides(n), n);
  assert.equal(S.applyOverrides(n, [{ overrideName: 'A_isVisible', value: false }]).hidden, true);
  assert.equal(n.hidden, false);
});
