import G from './geometry.js';
import Symbols from './symbols.js';
import { resolve } from '../specs/materials.js';
import { filterDefinition } from './refraction';
import { paintSurface, blendCSS } from './surface';
import { shape, simpleRecipe } from './shape';
import { resizeFrame } from './layout';
import { fitOverriddenText } from './text-layout.js';
import { presentation } from './source-meta';
import { bySymbol } from '../data/store';
import type { Definition, Layer } from '../data/types';
export type Background = 'aurora' | 'grid' | 'plain';
export type Matrix = [number, number, number, number, number, number];
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
    placement?: Matrix;
  } = {},
) {
  const W = options.width ?? 680,
    H = options.height ?? 300,
    base = `scene-${++serial}`,
    dark = c.facets.appearance === 'dark';
  let defs = '',
    content = '',
    visits = 0,
    glassCount = 0,
    backgroundBlurCount = 0;
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
  // Keep paint operations separate: a lens samples only earlier intersecting
  // operations, not recursively duplicated copies of the entire page.
  type Box = [number, number, number, number];
  const ops: { id: string; box: Box }[] = [];
  const boxFor = (m: Matrix, w: number, h: number, pad = 0): Box => {
    const points = [
      [-pad, -pad],
      [w + pad, -pad],
      [w + pad, h + pad],
      [-pad, h + pad],
    ].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
    return [
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
    ];
  };
  const intersects = (a: Box, b: Box) =>
    a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  const append = (markup: string, box: Box) => {
    const id = base + '-op-' + ops.length;
    defs += `<g id="${id}">${markup}</g>`;
    ops.push({ id, box });
  };
  append(content, [0, 0, W, H]);
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
    clips: string[] = [],
  ) {
    if (n.hidden || n.f[2] <= 0 || n.f[3] <= 0 || ++visits > 4000 || ancestors.length > 20) return;
    const paint = (markup: string, box: Box) =>
      append(
        clips.reduce((s, id) => `<g mask="url(#${id})">${s}</g>`, markup),
        box,
      );
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
    const record = (
      options.recipe && n.id === c.root.id
        ? { recipe: options.recipe, hidden: false }
        : map.get([...chain, n.id].join('/'))
    ) as any;
    let recipe = record?.recipe;
    const meta = presentation(n, c.platform);
    const skipBackground = n.type === 'symbolMaster' && meta.background === false;
    if (skipBackground && recipe) recipe = { ...recipe, fills: [] };
    if (record?.hidden) return;
    if (n.type === 'symbolInstance') {
      const ref = bySymbol.get(`${c.platform}:${n.symbolID}`);
      if (ref && !ancestors.includes(ref.id)) {
        const root = fitOverriddenText(
          resizeFrame(Symbols.applyOverrides(ref.root, n.overrides), nw, nh),
        );
        walk(root, ref, m, [...chain, n.id], [...ancestors, ref.id], alpha, clips);
      }
      if (recipe)
        paint(
          `<g transform="${matrix(m)}" opacity="${alpha}">${paintSurface(n, recipe, base + '-instance-' + visits)}</g>`,
          boxFor(m, nw, nh, 32),
        );
      return;
    }
    const backdropEffects = (recipe?.blurs ?? (recipe?.blur ? [recipe.blur] : [])).filter(
      (b: any) => b.isEnabled && (b.type === 3 || (b.type === 4 && options.glass !== false)),
    );
    const leaf: Layer = {
      ...n,
      f: [0, 0, nw, nh],
      children: [],
      rotation: 0,
      isFlippedHorizontal: false,
      isFlippedVertical: false,
      style: {
        ...n.style,
        ...(n.text || skipBackground ? { fills: [], borders: [] } : {}),
        opacity: 1,
      },
    };
    for (const [index, b] of backdropEffects.entries()) {
      if (b.type === 4) glassCount++;
      else backgroundBlurCount++;
      const id = `${base}-backdrop-${visits}-${index}`;
      const r = G.radius(n)?.values?.[0] ?? 0;
      const filter =
        b.type === 4
          ? filterDefinition(id, nw, nh, r, b)
          : `<filter id="${id}" filterUnits="userSpaceOnUse" x="${-nw}" y="${-nh}" width="${nw * 3}" height="${nh * 3}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${Math.max(0, b.radius ?? 0) * 0.45}"/><feColorMatrix type="saturate" values="${b.saturation ?? 1}"/></filter>`;
      // Composite vector groups provide a contour, not additional opaque children.
      const samplingPad = Math.max(
        8,
        (b.radius ?? 0) * 2,
        Math.min(nw, nh) * (b.distortion ?? 0) * 3,
      );
      const sampling = boxFor(m, nw, nh, samplingPad);
      const backdrop = ops
        .filter((op) => intersects(op.box, sampling))
        .map((op) => `<use href="#${op.id}"/>`)
        .join('');
      const compound = n.type === 'shapeGroup';
      const clipping = compound
        ? `<mask id="${id}-clip" maskUnits="userSpaceOnUse" x="${-nw}" y="${-nh}" width="${nw * 3}" height="${nh * 3}" style="mask-type:alpha">${shape(n, 'fill="white"')}</mask>`
        : `<clipPath id="${id}-clip">${shape(n, 'fill="white"')}</clipPath>`;
      defs += `<g id="${id}-source">${backdrop}</g>${filter}${clipping}`;
      paint(
        `<g transform="${matrix(m)}" opacity="${alpha}" data-${b.type === 4 ? 'glass' : 'background-blur'}-layer="${G.esc(n.id)}"><g ${compound ? 'mask' : 'clip-path'}="url(#${id}-clip)"><g filter="url(#${id})"><use href="#${id}-source" transform="${matrix(inverse(m))}"/></g></g></g>`,
        boxFor(m, nw, nh, 2),
      );
    }
    const style = recipe ?? simpleRecipe(skipBackground ? leaf : n);
    const compositeShape = n.type === 'shapeGroup';
    const hasPaint =
      style.fills?.some((f: any) => f.isEnabled) ||
      style.borders?.some((b: any) => b.isEnabled) ||
      style.shadows?.some((v: any) => v.isEnabled) ||
      style.innerShadows?.some((v: any) => v.isEnabled);
    const groupShadow =
      n.type === 'group' &&
      (n.groupBehavior ?? 0) === 0 &&
      !style.fills?.some((f: any) => f.isEnabled && !f.layeringType) &&
      !!n.children?.length;
    const surfaceNode = compositeShape ? n : groupShadow ? { ...n, type: 'shapeGroup' } : leaf;
    const materialMarkup = n.text
      ? (recipe
          ? paintSurface(n, { ...recipe, fills: [], borders: [] }, base + '-text-' + visits)
          : '') + G.fragment(leaf, c.platform)
      : n.type === 'bitmap'
        ? G.fragment(leaf, c.platform)
        : paintSurface(surfaceNode, style, base + '-surface-' + visits);
    paint(
      `<g data-node-id="${G.esc(n.id)}" data-node-size="${nw} ${nh}" transform="${matrix(m)}" opacity="${alpha}" style="mix-blend-mode:${blendCSS[recipe?.contextSettings?.blendMode ?? n.style?.blendMode ?? 0] ?? 'normal'}">${materialMarkup}</g>`,
      boxFor(
        m,
        nw,
        nh,
        Math.max(
          2,
          ...(style.shadows ?? [])
            .filter((e: any) => e.isEnabled)
            .map(
              (e: any) =>
                (e.blurRadius ?? 0) * 2 +
                Math.abs(e.offsetX ?? 0) +
                Math.abs(e.offsetY ?? 0) +
                Math.abs(e.spread ?? 0),
            ),
        ),
      ),
    );
    if (!compositeShape || (!hasPaint && !backdropEffects.length)) {
      let inherited = clips;
      if (n.clippingBehavior === 1) {
        const cid = base + '-frame-clip-' + visits;
        defs += `<mask id="${cid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" style="mask-type:alpha"><g transform="${matrix(m)}">${shape(n, 'fill="white"')}</g></mask>`;
        inherited = [...clips, cid];
      }
      let siblingClips = inherited;
      for (const ch of n.children ?? []) {
        const cm = presentation(ch, c.platform);
        if (cm.breakMask) siblingClips = inherited;
        walk(ch, owner, m, chain, ancestors, alpha, siblingClips);
        if (cm.mask !== undefined && !ch.hidden) {
          const cid = base + '-mask-chain-' + visits;
          let t = `translate(${ch.f[0]} ${ch.f[1]})`;
          if (ch.rotation) t += ` rotate(${-ch.rotation} ${ch.f[2] / 2} ${ch.f[3] / 2})`;
          defs += `<mask id="${cid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" style="mask-type:alpha"><g transform="${matrix(m)}"><g transform="${t}">${shape(ch, 'fill="white"')}</g></g></mask>`;
          siblingClips = [...inherited, cid];
        }
      }
    }
  }
  walk(c.root, c, options.placement ?? [s, 0, 0, s, (W - w * s) / 2, (H - h * s) / 2], [], [c.id]);
  content = ops.map((op) => `<use href="#${op.id}"/>`).join('');
  if (options.label)
    content += `<text x="20" y="${H - 16}" font-size="10" fill="${dark ? '#adc1d4' : '#5d7286'}" font-family="sans-serif">${options.glass === false ? '几何视图' : glassCount ? 'Liquid Glass · Web' : '静态状态'}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${G.esc(G.clean(c.name))}" data-glass-count="${glassCount}" data-background-blur-count="${backgroundBlurCount}"><defs>${defs}</defs>${content}</svg>`;
}
