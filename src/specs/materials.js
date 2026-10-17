'use strict';
const clone = (v) => JSON.parse(JSON.stringify(v));
const clean = (v) =>
  String(v ?? '')
    .replace(/[\uE000-\uF8FF\u{F0000}-\u{10FFFD}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
const canonical = (v) =>
  v && typeof v === 'object'
    ? Array.isArray(v)
      ? v.map(canonical)
      : Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
    : v;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const flatten = (n) => [n, ...(n.children || []).flatMap(flatten)];
const glass = (r) => (r?.blurs || []).some((b) => b.type === 4);
const enabled = (r) => (r?.blurs || []).some((b) => b.type === 4 && b.isEnabled === true);
const source = (c, n) => `${c.source.member}#${c.source.pointer}${n.path}/style`;
let db,
  data,
  styles = new Map(),
  bindings = new Map(),
  refs = new Map(),
  cache = new Map(),
  failure = null;
function initData(database, payload) {
  if (payload.format !== 'hig-material-specs/1') throw Error('不支持的材质数据版本');
  db = database;
  data = payload;
  styles = new Map();
  bindings = new Map();
  refs = new Map();
  cache = new Map();
  failure = null;
  for (const s of data.sources) {
    if (db.sources.find((x) => x.id === s.platform)?.sha256 !== s.sha256)
      throw Error('材质与几何的源文件快照不一致');
  }
  for (const s of data.styles) styles.set(s.platform + ':' + s.id, s);
  for (const c of db.components) refs.set(c.platform + ':' + c.symbolID, c);
  for (const [ci, rows] of Object.entries(data.bindings)) {
    const c = db.components[Number(ci)];
    if (!c) throw Error('组件索引超出范围');
    const nodes = flatten(c.root);
    for (const [ni, recipe, shared] of rows) {
      if (!nodes[ni] || !data.recipes[recipe]) throw Error('材质图层索引无效');
      bindings.set(c.platform + ':' + nodes[ni].id, {
        recipe,
        shared: shared === null ? null : data.styles[shared],
      });
    }
  }
  return data.counts;
}
function parseOverrides(values, owner, node) {
  return (values || [])
    .map((o, index) => {
      const key = String(o.overrideName || ''),
        i = key.lastIndexOf('_');
      return {
        parts: key.slice(0, i).split('/'),
        prop: key.slice(i + 1),
        value: o.value,
        source: `${owner.source.member}#${owner.source.pointer}${node.path}/overrideValues/${index}`,
        overrideName: key,
      };
    })
    .filter((o) => o.parts[0]);
}
function resolve(c) {
  if (failure || !data) return { records: [], warnings: [failure || '材质数据尚未载入'] };
  if (cache.has(c.id)) return cache.get(c.id);
  const records = [],
    warnings = [];
  let visits = 0;
  function visit(n, owner, active, ancestors, chain, hiddenParent) {
    if (++visits > 20000) {
      if (!warnings.includes('参照展开超过安全上限，结果不完整。'))
        warnings.push('参照展开超过安全上限，结果不完整。');
      return;
    }
    const direct = active.filter((o) => o.parts.length === 1 && o.parts[0] === n.id);
    const nested = active
      .filter((o) => o.parts.length > 1 && o.parts[0] === n.id)
      .map((o) => ({ ...o, parts: o.parts.slice(1) }));
    let hidden = !!n.hidden,
      symbol = n.symbolID,
      applied = [],
      binding = bindings.get(owner.platform + ':' + n.id),
      shared = binding?.shared || null;
    let recipe = binding ? clone(data.recipes[binding.recipe]) : null;
    for (const o of direct) {
      if (o.prop === 'isVisible') hidden = o.value === false || o.value === 0 || o.value === '0';
      if (o.prop === 'symbolID') symbol = o.value;
      if (o.prop === 'layerStyle') {
        const replacement = styles.get(owner.platform + ':' + o.value);
        if (replacement) {
          recipe = clone(data.recipes[replacement.recipe]);
          shared = replacement;
          applied.push(o);
        } else if (o.value) {
          warnings.push('无法解析共享样式覆盖：' + o.value + ' · ' + o.source);
        } else if (binding) {
          warnings.push('空 layerStyle 覆盖未推断其语义：' + o.source);
        }
      }
    }
    for (const o of direct) {
      const m = /^color:(fill|shadow|border)-(\d+)$/.exec(o.prop);
      if (m && recipe) {
        const array = { fill: 'fills', shadow: 'shadows', border: 'borders' }[m[1]],
          entry = recipe[array]?.[Number(m[2])];
        if (entry) {
          entry.color = clone(o.value);
          applied.push(o);
        } else warnings.push('颜色覆盖未命中效果槽：' + o.source);
      }
      if (o.prop === 'fillColor' && recipe) {
        warnings.push('保留未解释的 fillColor 覆盖：' + o.source);
        applied.push({ ...o, unresolved: true });
      }
    }
    const hiddenEffective = hiddenParent || hidden;
    if (recipe && (binding || shared?.catalog || glass(recipe))) {
      const changed = shared
        ? Object.keys(recipe).filter((k) => !same(recipe[k], data.recipes[shared.recipe][k]))
        : [];
      records.push({
        nodeID: n.id,
        nodeName: clean(n.name) || n.type,
        ownerID: owner.id,
        ownerName: clean(owner.name),
        platform: owner.platform,
        location: source(owner, n),
        chain: [...chain],
        hidden: hiddenEffective,
        shared: shared ? clone(shared) : null,
        originalShared: binding?.shared?.id || null,
        localDifference: changed,
        overrides: applied.map((o) => ({
          field: o.prop,
          value: o.value,
          source: o.source,
          overrideName: o.overrideName,
          ...(o.unresolved ? { unresolved: true } : {}),
        })),
        recipe,
      });
    }
    for (const ch of n.children || [])
      visit(ch, owner, [...active, ...nested], ancestors, chain, hiddenEffective);
    if (n.type === 'symbolInstance' && symbol) {
      const target = refs.get(owner.platform + ':' + symbol);
      if (!target) {
        warnings.push('无法展开 Symbol 引用：' + symbol + ' · ' + clean(n.name));
        return;
      }
      if (ancestors.includes(target.id)) {
        warnings.push('检测到循环 Symbol 引用：' + target.id);
        return;
      }
      if (ancestors.length > 24) {
        warnings.push('Symbol 引用深度超过安全上限。');
        return;
      }
      visit(
        target.root,
        target,
        [...parseOverrides(n.overrides, owner, n), ...nested],
        [...ancestors, target.id],
        [
          ...chain,
          {
            instanceID: n.id,
            name: clean(n.name),
            ownerID: owner.id,
            source: `${owner.source.member}#${owner.source.pointer}${n.path}`,
          },
        ],
        hiddenEffective,
      );
    }
  }
  visit(c.root, c, [], [c.id], [], false);
  const result = { records, warnings: [...new Set(warnings)] };
  cache.set(c.id, result);
  return result;
}

export { initData, resolve, enabled, glass, flatten };
export const getData = () => data;
export const recipeFor = (platform, nodeID) => {
  const b = bindings.get(platform + ':' + nodeID);
  return b ? data.recipes[b.recipe] : null;
};
