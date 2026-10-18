import type { Layer } from '../data/types';

/** Resize a Symbol frame, not its painted pixels. Sizes and positions here are
 * ephemeral preview layout. Source measurements and exported masters stay intact.
 * Sketch: Fixed=0, Fit=1, Fill=2, Relative=3; Min pin=1, Max pin=4. */
export function resizeFrame(n: Layer, width: number, height: number): Layer {
  const ow = n.f[2],
    oh = n.f[3];
  if (Math.abs(width - ow) < 1e-7 && Math.abs(height - oh) < 1e-7) return n;
  const result: Layer = { ...n, f: [n.f[0], n.f[1], Math.max(0, width), Math.max(0, height)] };
  if (n.text)
    result.text = {
      ...n.text,
      previewOriginalWidth: n.text.previewOriginalWidth ?? ow,
      previewOriginalHeight: n.text.previewOriginalHeight ?? oh,
    };
  if (!n.children?.length) return result;
  const delta = [width - ow, height - oh],
    previous = [ow, oh],
    target = [width, height];
  const children: Layer[] = n.children.map((ch) => ({ ...ch, f: [...ch.f] as Layer['f'] }));
  const keys = ['horizontalSizing', 'verticalSizing'],
    pins = ['horizontalPins', 'verticalPins'];
  const isStack = n.layout?._class === 'MSImmutableFlexGroupLayout';
  const axis = n.layout?.flexDirection === 1 ? 1 : 0;
  // A Graphic is explicitly proportional; a Frame is explicitly constraint-based.
  const graphic = n.groupBehavior === 2;
  for (const ch of children)
    for (let a = 0; a < 2; a++) {
      const pos = ch.f[a],
        size = ch.f[a + 2],
        P = previous[a],
        Q = target[a];
      const pin = ch[pins[a]] ?? 0,
        sizing = ch[keys[a]] ?? 3;
      let start = pos,
        extent = size;
      if (graphic) {
        start = P ? (pos * Q) / P : pos;
        extent = P ? (size * Q) / P : size;
      } else if (pin & 1 && pin & 4) {
        extent = Math.max(0, size + delta[a]);
      } else if (sizing === 3) {
        extent = P ? (size * Q) / P : size;
        start = P ? (pos * Q) / P : pos;
      } else if (pin & 4) start = pos + delta[a];
      else if (!(pin & 1)) start = pos + delta[a] / 2;
      ch.f[a] = start;
      ch.f[a + 2] = extent;
    }
  if (isStack) {
    const pad = n.padding ?? [0, 0, 0, 0],
      lead = axis === 0 ? pad[3] : pad[0],
      trail = axis === 0 ? pad[1] : pad[2];
    // Saved paint order can be opposite to visual stack order. Never reverse paint.
    const items = children
      .filter(
        (ch) => !ch.flexItem?.ignoreLayout && (!ch.hidden || ch.flexItem?.preserveSpaceWhenHidden),
      )
      .sort((a, b) => a.f[axis] - b.f[axis]);
    const gap = n.layout?.justifyContent === 3 ? 0 : (n.layout?.allGuttersGap ?? 0);
    const original = new Map(n.children.map((ch) => [ch.id, ch]));
    const fill = items.filter((ch) => ch[keys[axis]] === 2);
    const fixed = items
      .filter((ch) => ch[keys[axis]] !== 2)
      .reduce((s, ch) => s + (original.get(ch.id)?.f[axis + 2] ?? 0), 0);
    const available = Math.max(
      0,
      target[axis] - lead - trail - gap * Math.max(0, items.length - 1) - fixed,
    );
    for (const ch of items) {
      ch.f[axis + 2] = fill.includes(ch)
        ? available / Math.max(1, fill.length)
        : original.get(ch.id)!.f[axis + 2];
      const cross = 1 - axis,
        cl = cross === 0 ? pad[3] : pad[0],
        ct = cross === 0 ? pad[1] : pad[2];
      if (ch[keys[cross]] === 2) {
        ch.f[cross] = cl;
        ch.f[cross + 2] = Math.max(0, target[cross] - cl - ct);
      } else {
        ch.f[cross + 2] = original.get(ch.id)!.f[cross + 2];
        const align =
          ch.flexItem?.alignSelf === 5
            ? n.layout?.alignItems
            : (ch.flexItem?.alignSelf ?? n.layout?.alignItems);
        ch.f[cross] =
          align === 1
            ? (target[cross] - cl - ct - ch.f[cross + 2]) / 2 + cl
            : align === 2
              ? target[cross] - ct - ch.f[cross + 2]
              : cl;
      }
    }
    const occupied =
      items.reduce((s, ch) => s + ch.f[axis + 2], 0) + gap * Math.max(0, items.length - 1);
    const slack = Math.max(0, target[axis] - lead - trail - occupied),
      justify = n.layout?.justifyContent ?? 0;
    let cursor = lead + (justify === 1 ? slack / 2 : justify === 2 ? slack : 0);
    const extra = justify === 3 && items.length > 1 ? slack / (items.length - 1) : 0;
    for (const ch of items) {
      ch.f[axis] = cursor;
      cursor += ch.f[axis + 2] + gap + extra;
    }
  }
  result.children = children.map((ch, i) => {
    const resized = resizeFrame(n.children![i], ch.f[2], ch.f[3]);
    return { ...resized, f: ch.f };
  });
  return result;
}
