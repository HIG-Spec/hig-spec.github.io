import G from './geometry.js';
import type { Layer } from '../data/types';

/** The same contour is used by refraction, fills, borders and shadow masks. */
export function shape(n: Layer, attrs = '', inset = 0): string {
  const w = Math.max(0, n.f[2] - 2 * inset),
    h = Math.max(0, n.f[3] - 2 * inset);
  if (n.type === 'shapeGroup') {
    // Apply a translucent paint once to the union, not once per overlapping path.
    attrs = attrs.replace(
      /(fill|stroke)="rgba\(([^,]+),([^,]+),([^,]+),([^\)]+)\)"/,
      (_m, key, r, g, b, a) => `${key}="rgb(${r},${g},${b})" opacity="${a}"`,
    );
    return `<g ${attrs}>${(n.children ?? [])
      .filter((c) => !c.hidden)
      .map((c) => {
        const [x, y, cw, ch] = c.f;
        let t = `translate(${x} ${y})`;
        if (c.rotation) t += ` rotate(${-c.rotation} ${cw / 2} ${ch / 2})`;
        if (c.isFlippedHorizontal) t += ` translate(${cw} 0) scale(-1 1)`;
        if (c.isFlippedVertical) t += ` translate(0 ${ch}) scale(1 -1)`;
        return `<g transform="${t}">${shape(c)}</g>`;
      })
      .join('')}</g>`;
  }
  if (n.type === 'oval')
    return `<ellipse cx="${n.f[2] / 2}" cy="${n.f[3] / 2}" rx="${w / 2}" ry="${h / 2}" ${attrs}/>`;
  if (n.type === 'shapePath' && n.points?.length) {
    return `<path d="${G.path(n)}" ${attrs}/>`;
  }
  if (n.text) {
    const leaf = {
      ...n,
      f: [0, 0, ...n.f.slice(2)],
      children: [],
      style: {},
      text: { ...n.text, color: [1, 1, 1, 1] },
    };
    const markup = G.fragment(leaf, 'ios').replace(/ fill="[^"]*"/g, '');
    return `<g ${attrs}>${markup}</g>`;
  }
  const radii: number[] = (G.radius(n)?.values ?? [0]).map((r: number) => Math.max(0, r - inset));
  if (radii.length >= 4 && new Set(radii).size > 1) {
    const [tl, tr, br, bl] = radii,
      x = inset,
      y = inset;
    return `<path d="M${x + tl} ${y}H${x + w - tr}Q${x + w} ${y} ${x + w} ${y + tr}V${y + h - br}Q${x + w} ${y + h} ${x + w - br} ${y + h}H${x + bl}Q${x} ${y + h} ${x} ${y + h - bl}V${y + tl}Q${x} ${y} ${x + tl} ${y}Z" ${attrs}/>`;
  }
  return `<rect x="${inset}" y="${inset}" width="${w}" height="${h}" rx="${radii[0]}" ${attrs}/>`;
}

/** Convert already-extracted simple styles without inventing new source effects. */
export function simpleRecipe(n: Layer) {
  const s = n.style ?? {},
    color = (c: number[] | undefined) =>
      c ? { red: c[0], green: c[1], blue: c[2], alpha: c[3] ?? 1 } : undefined;
  return {
    fills: (s.fills ?? []).map((f: any) => ({
      isEnabled: true,
      fillType: f.type,
      color: color(f.color),
      layeringType: f.layeringType,
      contextSettings: f.context,
      ...(f.gradient
        ? {
            gradient: {
              from: f.gradient.from ?? '{0, 0}',
              to: f.gradient.to ?? '{1, 0}',
              gradientType: f.gradient.type ?? 0,
              stops: f.gradient.stops.map((v: any) => ({ position: v[0], color: color(v[1]) })),
            },
          }
        : {}),
    })),
    borders: (s.borders ?? []).map((b: any) => ({
      isEnabled: true,
      thickness: b.width,
      position: b.position,
      color: color(b.color),
      contextSettings: b.context,
    })),
  };
}
