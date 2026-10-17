/** Web preview adapter. Source controls are never rewritten to renderer units.
 * Uses an SDF rim displacement map and ordinary SVG filters on an explicit scene.
 * References and the intentionally non-normative mapping are in docs/rendering.md.
 */
export interface GlassControls {
  radius?: number;
  distortion?: number;
  depth?: number;
  saturation?: number;
  brightness?: number;
  chromaticAberrationMultiplier?: number;
  isEnabled?: boolean;
  type?: number;
  [key: string]: unknown;
}
const cache = new Map<string, string>();
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function sdf(x: number, y: number, w: number, h: number, r: number) {
  const qx = Math.abs(x - w / 2) - (w / 2 - r),
    qy = Math.abs(y - h / 2) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
export function offsetAt(x: number, y: number, w: number, h: number, r: number) {
  const d = sdf(x, y, w, h, r),
    bevel = Math.max(2, Math.min(w, h) * 0.24);
  if (d > 1 || d < -bevel) return [0, 0];
  const nx = sdf(x + 0.15, y, w, h, r) - sdf(x - 0.15, y, w, h, r),
    ny = sdf(x, y + 0.15, w, h, r) - sdf(x, y - 0.15, w, h, r);
  const length = Math.hypot(nx, ny) || 1,
    rim = clamp(1 + d / bevel);
  // Smooth lip: bend strongly at the edge, return to zero in the flat centre.
  const amplitude = Math.sin(rim * Math.PI * 0.92) * rim;
  return [(-nx / length) * amplitude, (-ny / length) * amplitude];
}
function displacementMap(w: number, h: number, r: number): string {
  const key = [w, h, r].map((v) => v.toFixed(2)).join(':');
  const saved = cache.get(key);
  if (saved) return saved;
  const canvas = document.createElement('canvas');
  const k = Math.min(2, 240 / Math.max(w, h));
  canvas.width = Math.max(2, Math.ceil(w * k));
  canvas.height = Math.max(2, Math.ceil(h * k));
  const context = canvas.getContext('2d');
  if (!context) return '';
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const [dx, dy] = offsetAt((x + 0.5) / k, (y + 0.5) / k, w, h, r),
        i = (y * canvas.width + x) * 4;
      image.data[i] = Math.round(127.5 + 127.5 * dx);
      image.data[i + 1] = Math.round(127.5 + 127.5 * dy);
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  context.putImageData(image, 0, 0);
  const url = canvas.toDataURL();
  if (cache.size >= 96) cache.delete(cache.keys().next().value!);
  cache.set(key, url);
  return url;
}
export function filterDefinition(
  id: string,
  w: number,
  h: number,
  r: number,
  b: GlassControls,
): string {
  const blur = Math.max(0, Number(b.radius ?? 0)) * 0.45;
  const scale =
    2 * Math.min(w, h) * Math.max(0, Number(b.distortion ?? 0)) * (0.5 + Number(b.depth ?? 0));
  const chroma = clamp(Number(b.chromaticAberrationMultiplier ?? 0));
  const padding = Math.max(8, blur * 3, scale);
  const saturation = Number(b.saturation ?? 1),
    brightness = Number(b.brightness ?? 1);
  let operations = `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blurred"/><feColorMatrix in="blurred" type="saturate" values="${saturation}" result="saturated"/><feComponentTransfer in="saturated" result="lit"><feFuncR type="linear" slope="${brightness}"/><feFuncG type="linear" slope="${brightness}"/><feFuncB type="linear" slope="${brightness}"/></feComponentTransfer>`;
  operations += `<feImage href="${displacementMap(w, h, r)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
  if (chroma > 0 && scale > 0) {
    for (let i = 0; i < 3; i++) {
      const channel = ['r', 'g', 'b'][i];
      const matrix = Array.from({ length: 20 }, (_, j) =>
        j === i * 5 + i || j === 18 ? 1 : 0,
      ).join(' ');
      operations += `<feDisplacementMap in="lit" in2="map" scale="${scale * (1 + (i - 1) * chroma * 0.14)}" xChannelSelector="R" yChannelSelector="G" result="d${channel}"/><feColorMatrix in="d${channel}" type="matrix" values="${matrix}" result="${channel}"/>`;
    }
    operations +=
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>';
  } else
    operations += `<feDisplacementMap in="lit" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`;
  return `<filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${-padding}" y="${-padding}" width="${w + padding * 2}" height="${h + padding * 2}" color-interpolation-filters="sRGB">${operations}</filter>`;
}
