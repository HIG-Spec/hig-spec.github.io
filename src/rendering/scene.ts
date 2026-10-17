import G from './geometry.js';
import Symbols from './symbols.js';
import { resolve } from '../specs/materials.js';
import { filterDefinition } from './refraction';
import { paintSurface } from './surface';
import { bySymbol } from '../data/store';
import type { Definition, Layer } from '../data/types';
export type Background = 'aurora' | 'grid' | 'plain';
type Matrix = [number, number, number, number, number, number];
const mul = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const inverse = (m: Matrix): Matrix => {
  const d = m[0] * m[3] - m[1] * m[2];
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
};
const matrix = (m: Matrix) => `matrix(${m.join(' ')})`;
let serial = 0;
export function renderScene(
  c: Definition,
  options: {
    width?: number;
    height?: number;
    background?: Background;
    glass?: boolean;
    maxScale?: number;
    label?: boolean;
    phase?: number;
    recipe?: any;
  } = {},
) {
  const W = options.width ?? 680,
    H = options.height ?? 300,
    base = `scene-${++serial}`,
    dark = c.facets.appearance === 'dark';
  let defs = '',
    content = '',
    visits = 0,
    glassCount = 0;
  const records = resolve(c).records;
  const map = new Map(
    records.map((r: any) => [[...r.chain.map((v: any) => v.instanceID), r.nodeID].join('/'), r]),
  );
  const bg = options.background ?? 'aurora';
  defs += `<linearGradient id="${base}-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark ? '#1f3450' : '#c7ddf4'}"/><stop offset=".52" stop-color="${dark ? '#39576b' : '#d7ebe5'}"/><stop offset="1" stop-color="${dark ? '#64504d' : '#f4d9c2'}"/></linearGradient><pattern id="${base}-grid" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="translate(${options.phase ?? 0} 0)"><path d="M28 0H0V28" fill="none" stroke="${dark ? '#71849b' : '#c2cbd8'}" stroke-width=".7"/></pattern>`;
  content = `<rect width="${W}" height="${H}" fill="${bg === 'aurora' ? `url(#${base}-bg)` : dark ? '#24262d' : '#f6f7fa'}"/>`;
  if (bg === 'aurora')
    content += `<g opacity="${dark ? 0.25 : 0.5}" transform="translate(${options.phase ?? 0} 0)"><path d="M-70 ${H * 0.9} C${W * 0.2} ${-H * 0.8} ${W * 0.48} ${H * 1.55} ${W + 100} ${H * 0.04}" fill="none" stroke="${dark ? '#8ec6da' : '#f7fbff'}" stroke-width="${H * 0.24}"/><path d="M-70 ${H * 1.2} C${W * 0.25} ${-H * 0.5} ${W * 0.55} ${H * 1.75} ${W + 100} ${H * 0.32}" fill="none" stroke="${dark ? '#bdadf6' : '#afbbeb'}" stroke-width="${H * 0.18}"/></g>`;
  if (bg === 'grid')
    content += `<rect width="${W}" height="${H}" fill="url(#${base}-grid)"/><text x="${W * 0.12}" y="${H * 0.5}" fill="${dark ? '#8d9db6' : '#a5b3c6'}" font-size="28" font-family="sans-serif">Aa · 123 · HIG Spec</text>`;
  const w = c.root.f[2],
    h = c.root.f[3],
    s = Math.min((W - 90) / Math.max(w, 1), (H - 75) / Math.max(h, 1), options.maxScale ?? 3.8);
  function walk(
    n: Layer,
    owner: Definition,
    parent: Matrix,
    chain: string[],
    ancestors: string[],
    opacity = 1,
  ) {
    if (n.hidden || n.f[2] <= 0 || n.f[3] <= 0 || ++visits > 4000 || ancestors.length > 20) return;
    const [x, y, nw, nh] = n.f;
    let m = mul(parent, [1, 0, 0, 1, x, y]);
    if (n.rotation) {
      const a = (-n.rotation * Math.PI) / 180,
        cos = Math.cos(a),
        sin = Math.sin(a);
      m = mul(
        m,
        mul(
          [1, 0, 0, 1, nw / 2, nh / 2],
          mul([cos, sin, -sin, cos, 0, 0], [1, 0, 0, 1, -nw / 2, -nh / 2]),
        ),
      );
    }
    if (n.isFlippedHorizontal) m = mul(m, [-1, 0, 0, 1, nw, 0]);
    if (n.isFlippedVertical) m = mul(m, [1, 0, 0, -1, 0, nh]);
    const alpha = opacity * (n.style?.opacity ?? 1);
    if (n.type === 'symbolInstance') {
      const ref = bySymbol.get(`${c.platform}:${n.symbolID}`);
      if (ref && !ancestors.includes(ref.id)) {
        const root = Symbols.applyOverrides(ref.root, n.overrides);
        walk(
          root,
          ref,
          mul(m, [nw / root.f[2], 0, 0, nh / root.f[3], 0, 0]),
          [...chain, n.id],
          [...ancestors, ref.id],
          alpha,
        );
      }
      return;
    }
    const record = (
      options.recipe && n.id === c.root.id
        ? { recipe: options.recipe, hidden: false }
        : map.get([...chain, n.id].join('/'))
    ) as any;
    const recipe = record?.recipe;
    const b = recipe?.blurs?.find((b: any) => b.type === 4 && b.isEnabled);
    const leaf: Layer = {
      ...n,
      f: [0, 0, nw, nh],
      children: [],
      rotation: 0,
      isFlippedHorizontal: false,
      isFlippedVertical: false,
      style: { ...n.style, opacity: 1 },
    };
    if (b && options.glass !== false && !record.hidden) {
      const id = `${base}-glass-${glassCount++}`,
        r = G.radius(n)?.values?.[0] ?? Math.min(nw, nh) / 2;
      defs += `<g id="${id}-backdrop">${content}</g>${filterDefinition(id, nw, nh, r, b)}<clipPath id="${id}-clip"><rect width="${nw}" height="${nh}" rx="${r}"/></clipPath>`;
      content = `<use href="#${id}-backdrop"/><g transform="${matrix(m)}" opacity="${alpha}" data-glass-layer="${G.esc(n.id)}"><g clip-path="url(#${id}-clip)"><g filter="url(#${id})"><use href="#${id}-backdrop" transform="${matrix(inverse(m))}"/></g></g>${paintSurface(n, recipe, id)}</g>`;
    } else
      content += `<g transform="${matrix(m)}" opacity="${alpha}">${recipe && !n.text && ['rectangle', 'group', 'symbolMaster'].includes(n.type) ? paintSurface(leaf, recipe, base + '-surface-' + visits) : G.fragment(leaf, c.platform)}</g>`;
    for (const ch of n.children ?? []) walk(ch, owner, m, chain, ancestors, alpha);
  }
  walk(c.root, c, [s, 0, 0, s, (W - w * s) / 2, (H - h * s) / 2], [], [c.id]);
  if (options.label)
    content += `<text x="20" y="${H - 16}" font-size="10" fill="${dark ? '#adc1d4' : '#5d7286'}" font-family="sans-serif">${options.glass === false ? '几何视图' : glassCount ? 'Liquid Glass · Web' : '静态状态'}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${G.esc(G.clean(c.name))}" data-glass-count="${glassCount}"><defs>${defs}</defs>${content}</svg>`;
}
