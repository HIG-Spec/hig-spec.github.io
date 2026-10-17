import { shape } from './shape';
import type { Layer } from '../data/types';
export const blendNames: Record<number, string> = {
  0: 'Normal',
  1: 'Darken',
  2: 'Multiply',
  3: 'Color burn',
  4: 'Lighten',
  5: 'Screen',
  6: 'Color dodge',
  7: 'Overlay',
  8: 'Soft light',
  9: 'Hard light',
  10: 'Difference',
  11: 'Exclusion',
  12: 'Hue',
  13: 'Saturation',
  14: 'Color',
  15: 'Luminosity',
  16: 'Plus darker',
  17: 'Plus lighter',
};
// Preview fallbacks: SVG compositing does not implement Sketch's plus-darker operator.
export const blendCSS: Record<number, string> = {
  0: 'normal',
  1: 'darken',
  2: 'multiply',
  3: 'color-burn',
  4: 'lighten',
  5: 'screen',
  6: 'color-dodge',
  7: 'overlay',
  8: 'soft-light',
  9: 'hard-light',
  10: 'difference',
  11: 'exclusion',
  12: 'hue',
  13: 'saturation',
  14: 'color',
  15: 'luminosity',
  16: 'multiply',
  17: 'screen',
};
export const rgba = (c: any, opacity = 1) =>
  c ? `rgba(${c.red * 255},${c.green * 255},${c.blue * 255},${(c.alpha ?? 1) * opacity})` : 'none';
const point = (s: string) =>
  String(s ?? '')
    .replace(/[{}]/g, '')
    .split(',')
    .map(Number);
export function paintSurface(n: Layer, recipe: any, id: string) {
  let defs = '',
    body = '';
  const rect = (attrs: string, inset = 0) => shape(n, attrs, inset);
  const blend = (e: any) =>
    `style="mix-blend-mode:${blendCSS[e.contextSettings?.blendMode ?? 0] ?? 'normal'}"`;
  function paint(e: any, i: string) {
    if (e.fillType === 1 && e.gradient?.stops) {
      const g = e.gradient,
        from = point(g.from),
        to = point(g.to);
      const gid = id + '-' + i;
      const stops = g.stops
        .map(
          (s: any) =>
            `<stop offset="${s.position * 100}%" stop-color="${rgba(s.color, e.contextSettings?.opacity ?? 1)}"/>`,
        )
        .join('');
      defs +=
        g.gradientType === 1
          ? `<radialGradient id="${gid}" cx="${from[0] ?? 0.5}" cy="${from[1] ?? 0.5}" r="${Math.hypot((to[0] ?? 1) - (from[0] ?? 0.5), (to[1] ?? 1) - (from[1] ?? 0.5))}">${stops}</radialGradient>`
          : `<linearGradient id="${gid}" x1="${from[0] ?? 0}" y1="${from[1] ?? 0}" x2="${to[0] ?? 1}" y2="${to[1] ?? 1}">${stops}</linearGradient>`;
      return `url(#${gid})`;
    }
    return rgba(e.color, e.contextSettings?.opacity ?? 1);
  }
  const shadows = [
    ...(recipe.shadows ?? []),
    ...(recipe.innerShadows ?? []).map((s: any) => ({ ...s, isInnerShadow: true })),
  ];
  function shadow(s: any, i: number) {
    const sid = id + '-s' + i,
      inner = !!s.isInnerShadow,
      spread = s.spread ?? 0;
    const alpha = inner
      ? '<feFlood flood-color="white" result="all"/><feComposite in="all" in2="SourceAlpha" operator="out" result="mask"/>'
      : '<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="mask"/>';
    defs += `<filter id="${sid}" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB">${alpha}${spread ? `<feMorphology in="mask" operator="${spread > 0 ? 'dilate' : 'erode'}" radius="${Math.abs(spread)}" result="mask"/>` : ''}<feGaussianBlur in="mask" stdDeviation="${Math.max(0, (s.blurRadius ?? 0) / 2)}" result="blur"/><feOffset in="blur" dx="${s.offsetX ?? 0}" dy="${s.offsetY ?? 0}" result="shift"/>${inner ? '<feComposite in="shift" in2="SourceAlpha" operator="in" result="shift"/>' : '<feComposite in="shift" in2="SourceAlpha" operator="out" result="shift"/>'}<feFlood flood-color="${rgba(s.color, s.contextSettings?.opacity ?? 1)}" result="color"/><feComposite in="color" in2="shift" operator="in"/></filter>`;
    return rect(`fill="black" filter="url(#${sid})" ${blend(s)}`);
  }
  shadows.forEach((s: any, i: number) => {
    if (s.isEnabled && !s.isInnerShadow) body += shadow(s, i);
  });
  (recipe.fills ?? []).forEach((f: any, i: number) => {
    if (f.isEnabled && !f.layeringType) body += rect(`fill="${paint(f, 'f' + i)}" ${blend(f)}`);
  });
  shadows.forEach((s: any, i: number) => {
    if (s.isEnabled && s.isInnerShadow) body += shadow(s, i);
  });
  (recipe.borders ?? []).forEach((b: any, i: number) => {
    if (!b.isEnabled) return;
    const t = b.thickness ?? 0,
      inset = b.position === 1 ? t / 2 : b.position === 2 ? -t / 2 : 0;
    if (b.sides && ['rectangle', 'group', 'symbolMaster', 'bitmap'].includes(n.type)) {
      // These snapshots use zero for an enabled side and FLT_MAX for a disabled one.
      // Keep saved side fields in specs; never close a one-sided border.
      const w = n.f[2],
        h = n.f[3];
      const sides = [
        ['top', `M0 ${inset}H${w}`],
        ['right', `M${w - inset} 0V${h}`],
        ['bottom', `M0 ${h - inset}H${w}`],
        ['left', `M${inset} 0V${h}`],
      ];
      for (const [side, d] of sides) {
        const offset = b.sides[side + 'Inset'] ?? 0;
        const thickness = Math.max(0, t - offset);
        if (thickness > 0)
          body += `<path d="${d}" data-border-side="${side}" fill="none" stroke="${paint(b, 'b' + i + '-' + side)}" stroke-width="${thickness}" ${blend(b)}/>`;
      }
    } else
      body += rect(
        `fill="none" stroke="${paint(b, 'b' + i)}" stroke-width="${t}" ${blend(b)}`,
        inset,
      );
  });
  const b = (recipe.blurs ?? []).find((b: any) => b.isEnabled && b.type === 0);
  if (b) {
    defs += `<filter id="${id}-blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${(b.radius ?? 0) / 2}"/></filter>`;
    body = `<g filter="url(#${id}-blur)">${body}</g>`;
  }
  return `<defs>${defs}</defs>${body}`;
}
