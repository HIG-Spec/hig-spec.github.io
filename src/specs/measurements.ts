import type { Layer, Definition } from '../data/types';
export const number = (v: unknown) =>
  v === undefined || v === null
    ? '—'
    : typeof v === 'number'
      ? String(Number(v.toFixed(6)))
      : String(v);
export const isStack = (n: Layer) => n.layout?._class === 'MSImmutableFlexGroupLayout';
export function flatten(n: Layer, depth = 0): { node: Layer; depth: number }[] {
  return [{ node: n, depth }, ...(n.children ?? []).flatMap((c) => flatten(c, depth + 1))];
}
export function metrics(n: Layer) {
  const rows: [string, string, string][] = [
    ['宽度', number(n.f[2]) + ' pt', 'frame.width'],
    ['高度', number(n.f[3]) + ' pt', 'frame.height'],
  ];
  const r = n.style?.corners?.radii ?? (n.fixedRadius !== undefined ? [n.fixedRadius] : undefined);
  if (r)
    rows.push([
      '圆角',
      r.map((x: number) => (x > 1e10 ? '最大' : number(x))).join(' / ') + ' pt',
      'corners.radii',
    ]);
  if (isStack(n)) {
    if (n.padding)
      n.padding.forEach((x, i) =>
        rows.push([
          ['上内边距', '右内边距', '下内边距', '左内边距'][i],
          number(x) + ' pt',
          ['topPadding', 'rightPadding', 'bottomPadding', 'leftPadding'][i],
        ]),
      );
    rows.push(['元素间距', number(n.layout?.allGuttersGap) + ' pt', 'allGuttersGap']);
    rows.push(['排列方向', n.layout?.flexDirection === 1 ? '垂直' : '水平', 'flexDirection']);
  }
  for (const [key, label] of [
    ['horizontalSizing', '水平尺寸模式'],
    ['verticalSizing', '垂直尺寸模式'],
    ['horizontalPins', '水平约束'],
    ['verticalPins', '垂直约束'],
  ] as const) {
    if (n[key] !== undefined) rows.push([label, number(n[key]), key]);
  }
  if (n.minSize && n.minSize !== '{0, 0}') rows.push(['最小尺寸', n.minSize, 'minSize']);
  if (n.maxSize && n.maxSize !== '{0, 0}') rows.push(['最大尺寸', n.maxSize, 'maxSize']);
  if (n.text) {
    rows.push(['字号', number(n.text.size) + ' pt', 'fontSize']);
    if (n.text.lineHeight !== undefined)
      rows.push(['行高', number(n.text.lineHeight) + ' pt', 'lineHeight']);
    rows.push(['字体', n.text.font ?? '—', 'fontName']);
  }
  return rows;
}
export function locationOf(c: Definition, n = c.root) {
  return `${c.source.member}#${c.source.pointer}${n.path}`;
}
