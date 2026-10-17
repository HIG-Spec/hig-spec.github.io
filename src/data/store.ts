import { shallowRef, computed } from 'vue';
import type { Database, Definition, MaterialData, Platform } from './types';
import { initData, resolve } from '../specs/materials.js';
import G from '../rendering/geometry.js';
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
export function statePartner(c: Definition, pressed: boolean) {
  if (c.family !== 'switches') return undefined;
  const prefix = c.name.replace(/\d+ - (Idle|Pressed|Clicked)$/, '');
  return familyDefinitions(c.family, c.platform).find(
    (x) =>
      x.name.replace(/\d+ - (Idle|Pressed|Clicked)$/, '') === prefix &&
      (pressed ? /\d+ - (Pressed|Clicked)$/.test(x.name) : /\d+ - Idle$/.test(x.name)),
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
