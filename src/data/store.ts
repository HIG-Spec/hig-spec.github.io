import { shallowRef, computed } from 'vue';
import type { Database, Definition, MaterialData, Platform } from './types';
import { initData, resolve, flatten } from '../specs/materials.js';
import G from '../rendering/geometry.js';
import Symbols from '../rendering/symbols.js';
export const database = shallowRef<Database>();
export const materials = shallowRef<MaterialData>();
export const loadError = shallowRef('');
export const ready = computed(() => !!database.value && !!materials.value);
export const byID = new Map<string, Definition>();
export const bySymbol = new Map<string, Definition>();
let pending: Promise<void> | null = null;
async function compressedJSON(name: string, expected: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json.gz`);
  if (!response.ok) throw new Error(`无法加载规格数据（${response.status}）`);
  const bytes = await response.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const actual = [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (actual !== expected) throw new Error('规格数据版本不一致，请刷新后重试。');
  return JSON.parse(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
    ).text(),
  );
}
export function loadData() {
  return (pending ??= (async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`);
      if (!response.ok) throw new Error('无法加载规格索引。');
      const manifest = await response.json();
      const [db, mat] = await Promise.all([
        compressedJSON('geometry', manifest.geometry),
        compressedJSON('materials', manifest.materials),
      ]);
      if (mat.geometryPayloadSHA256 !== manifest.geometryPayloadSHA256)
        throw new Error('材质与布局版本不一致。');
      initData(db, mat);
      G.init(db);
      for (const c of db.components) {
        byID.set(c.id, c);
        bySymbol.set(`${c.platform}:${c.symbolID}`, c);
      }
      materials.value = mat;
      database.value = db;
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e);
      pending = null;
    }
  })());
}
export function familyDefinitions(family: string, platform?: Platform) {
  return (
    database.value?.components.filter(
      (c) => c.family === family && (!platform || c.platform === platform),
    ) ?? []
  );
}
export const clean = (s: string) =>
  String(s ?? '')
    .replace(/[\uE000-\uF8FF\u{F0000}-\u{10FFFD}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
export const platformName = (p: string) => (p === 'ios' ? 'iOS / iPadOS' : 'macOS');
export const categories = [
  ['action', '操作'],
  ['selection', '选择'],
  ['input', '输入'],
  ['navigation', '导航'],
  ['containment', '容器'],
  ['feedback', '反馈'],
];
export function defaultDefinition(
  family: string,
  platform: Platform = 'ios',
): Definition | undefined {
  const all = familyDefinitions(family);
  const candidates = all.filter((c) => c.platform === platform && !c.internal);
  const score = (c: Definition) =>
    (c.facets.appearance === 'light' ? 100 : 0) +
    (/Idle|Enabled|Default/.test(c.name) ? 40 : 0) +
    (/3 Rg|Large|Regular/.test(c.name) ? 15 : 0) +
    (/Content Area/.test(c.name) ? 10 : 0) +
    (/On\//.test(c.name) ? 5 : 0) +
    (/Glass/.test(c.name) ? 8 : 0) +
    (c.family === 'date-time-pickers' &&
    c.name === 'Date and Time Pickers/Compact Picker/Light/Date and Time'
      ? 200
      : 0) -
    (/Disabled|Inactive/.test(c.name) ? 100 : 0) -
    (c.internal ? 1000 : 0);
  return (candidates.length ? candidates : all).slice().sort((a, b) => score(b) - score(a))[0];
}
export function glassRecords(c: Definition) {
  return resolve(c).records.filter(
    (r: any) => !r.hidden && r.recipe.blurs?.some((b: any) => b.type === 4 && b.isEnabled),
  );
}
// Keep material-bearing interaction states discoverable even when the idle state is opaque.
export function glassVariants(c: Definition) {
  return familyDefinitions(c.family, c.platform)
    .filter((d) => d.facets.appearance === c.facets.appearance && glassRecords(d).length)
    .sort((a, b) => Number(a.internal) - Number(b.internal));
}
// Match a saved interaction state without crossing size, platform, selection or appearance.
const statePattern =
  /(?:\d+\s*-\s*)?\b(Idle|Enabled|Default|Pressed|Clicked|Touch|Highlighted|Selected|Unselected)\b/g;
const pressPattern = /\b(Pressed|Clicked|Touch|Highlighted)\b/;
const stateKey = (c: Definition) =>
  `${c.platform}:${c.family}:${c.name.replace(statePattern, '{state}')}`;
const stateCache = new Map<string, Definition[]>();
let stateDatabase: Database | undefined;
const stateIndex = new Map<string, Definition[]>();
const catalogueCache = new Map<string, Definition | undefined>();
function prepareStates() {
  if (stateDatabase === database.value) return;
  stateDatabase = database.value;
  stateCache.clear();
  stateIndex.clear();
  catalogueCache.clear();
  for (const d of database.value?.components ?? []) {
    const k = stateKey(d);
    const rows = stateIndex.get(k) ?? [];
    rows.push(d);
    stateIndex.set(k, rows);
  }
}
function directPartner(c: Definition, pressed: boolean) {
  prepareStates();
  if (/Disabled|Inactive/.test(c.name)) return;
  const key = stateKey(c);
  return (stateIndex.get(key) ?? []).find(
    (d) =>
      d.id !== c.id &&
      (pressed
        ? pressPattern.test(d.name)
        : /\b(Idle|Enabled|Default|Selected|Unselected)\b/.test(d.name)),
  );
}

/** Saved child states shown in their real parent context; source definitions stay immutable. */
export function interactionVariants(component: Definition): Definition[] {
  prepareStates();
  const c = byID.get(component.previewOf ?? component.id) ?? component;
  if (stateCache.has(c.id)) return stateCache.get(c.id)!;
  const variants: Definition[] = [];
  const direct = directPartner(c, true);
  if (direct) variants.push(direct);
  if (/Disabled|Inactive/.test(c.name)) {
    stateCache.set(c.id, variants);
    return variants;
  }
  let visits = 0;
  function visit(n: any, chain: string[], names: string[], ancestors: string[]) {
    if (n.hidden || ++visits > 20000 || ancestors.length > 20) return;
    if (n.type === 'symbolInstance') {
      const target = bySymbol.get(`${c.platform}:${n.symbolID}`);
      if (!target || ancestors.includes(target.id)) return;
      const path = [...chain, n.id],
        labels = [...names, clean(n.name)];
      const partner = directPartner(target, true);
      if (partner && glassRecords(partner).length) {
        const root = structuredClone(c.root);
        const top = flatten(root).find((v: any) => v.id === path[0]);
        if (top) {
          // Instance overrides are addressed by source node IDs. Translate matching text
          // slots across state masters so e.g. Item 3 never becomes the default Label.
          const oldNodes = flatten(target.root),
            newNodes = flatten(partner.root);
          const mapping = new Map(
            oldNodes.map((old: any) => [
              old.id,
              newNodes.find((v: any) => v.name === old.name && v.type === old.type)?.id ?? old.id,
            ]),
          );
          if (path.length === 1) {
            top.symbolID = partner.symbolID;
            top.overrides = (top.overrides ?? []).map((o: any) => ({
              ...o,
              overrideName: String(o.overrideName).replace(
                /[A-F0-9-]{36}/g,
                (id: string) => (mapping.get(id) as string) ?? id,
              ),
            }));
          } else {
            const overrideName = path.slice(1).join('/') + '_symbolID';
            top.overrides = [
              ...(top.overrides ?? []).filter((o: any) => o.overrideName !== overrideName),
              { overrideName, value: partner.symbolID },
            ];
          }
          const key = path.join('/') + ':' + partner.symbolID;
          variants.push({
            ...c,
            id: c.id + '@' + key,
            root,
            previewOf: c.id,
            previewKey: key,
            previewLabel: labels.join(' / ') + ' · ' + clean(partner.name).split('/').pop(),
            substitutions: [{ instances: path, from: target.id, to: partner.id }],
          });
        }
      }
      visit(Symbols.applyOverrides(target.root, n.overrides), path, labels, [
        ...ancestors,
        target.id,
      ]);
    } else for (const child of n.children ?? []) visit(child, chain, names, ancestors);
  }
  visit(c.root, [], [], [c.id]);
  // Selected segments/knobs are better first examples than unselected siblings.
  variants.sort(
    (a, b) =>
      Number(/Unselected/.test(a.previewLabel ?? a.name)) -
      Number(/Unselected/.test(b.previewLabel ?? b.name)),
  );
  stateCache.set(c.id, variants);
  return variants;
}
export function statePartner(c: Definition, pressed: boolean): Definition | undefined {
  if (!pressed && c.previewOf) return byID.get(c.previewOf);
  return directPartner(c, pressed) ?? (pressed ? interactionVariants(c)[0] : undefined);
}
export function catalogueDefinition(family: string, platform: Platform = 'ios') {
  prepareStates();
  const key = family + ':' + platform;
  if (catalogueCache.has(key)) return catalogueCache.get(key);
  const save = (d: Definition | undefined) => {
    catalogueCache.set(key, d);
    return d;
  };
  const c = defaultDefinition(family, platform);
  if (!c || glassRecords(c).length) return save(c);
  const pressed = interactionVariants(c).find((v) => glassRecords(v).length);
  if (pressed) return save(pressed);
  // Prefer a complete saved control, never a disconnected internal glass swatch.
  return save(
    familyDefinitions(family, c.platform)
      .filter(
        (v) => !v.internal && v.facets.appearance === c.facets.appearance && glassRecords(v).length,
      )
      .sort((a, b) => a.name.length - b.name.length)[0] ?? c,
  );
}
export function togglePartner(c: Definition) {
  const name = /\/On\//.test(c.name)
    ? c.name.replace('/On/', '/Off/')
    : /\/Off\//.test(c.name)
      ? c.name.replace('/Off/', '/On/')
      : /, On,/.test(c.name)
        ? c.name.replace(', On,', ', Off,')
        : c.name.replace(', Off,', ', On,');
  return familyDefinitions(c.family, c.platform).find((x) => x.name === name);
}
