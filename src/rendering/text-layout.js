export const previewFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
export function fontWeight(font = '') {
  if (/black|heavy/i.test(font)) return 800;
  if (/semibold|demibold/i.test(font)) return 600;
  if (/bold/i.test(font)) return 700;
  if (/medium/i.test(font)) return 500;
  if (/ultralight|thin/i.test(font)) return 200;
  if (/light/i.test(font)) return 300;
  return 400;
}
let context;
export function measureText(text, size, weight) {
  if (!context && typeof document !== 'undefined')
    context = document.createElement('canvas').getContext('2d');
  if (!context)
    return Array.from(text).reduce(
      (w, c) => w + size * (/\s/.test(c) ? 0.28 : /[\u2e80-\uffff]/.test(c) ? 1 : 0.55),
      0,
    );
  context.font = `${weight} ${size}px ${previewFont}`;
  return context.measureText(text).width;
}
/** Fit-width text is laid out after a saved string override, not squeezed into
 * the old string's advance box. The measured source object is never modified. */
export function fitOverriddenText(n) {
  let result = n;
  if (n.text?.previewOriginalValue !== undefined && n.horizontalSizing === 1) {
    const t = n.text,
      size = Number(t.size) || 13;
    const width = Math.max(
      ...String(t.value)
        .split('\n')
        .map((line) => measureText(line, size, fontWeight(t.font))),
    );
    const alignment = t.alignment === 2 ? 0.5 : t.alignment === 1 ? 1 : 0;
    result = { ...n, f: [n.f[0] + (n.f[2] - width) * alignment, n.f[1], width, n.f[3]] };
  }
  if (n.children) {
    const children = n.children.map(fitOverriddenText);
    if (children.some((v, i) => v !== n.children[i])) result = { ...result, children };
  }
  return result;
}
export function textLines(t, width, height) {
  const raw = String(t.value ?? ''),
    size = Number(t.size) || 13,
    lh = Number(t.lineHeight) || size * 1.2,
    weight = fontWeight(t.font);
  const max = Math.max(1, Math.floor((height + 0.5) / lh));
  // The design file already proves a single line fits its unchanged frame.
  // Fallback font advances are not a reason to invent an ellipsis there.
  const sourceWidth = t.previewOriginalWidth ?? width;
  const g = t.glyphBounds;
  const unchangedSingle =
    !raw.includes('\n') &&
    t.previewOriginalValue === undefined &&
    max === 1 &&
    width >= sourceWidth - 0.1 &&
    (!Array.isArray(g) || g[2] <= sourceWidth + 1);
  if (unchangedSingle) return [raw];
  const lines = [];
  for (const paragraph of raw.split('\n')) {
    if (measureText(paragraph, size, weight) <= width + 0.5) {
      lines.push(paragraph);
      continue;
    }
    let line = '';
    const words = paragraph.match(/\S+\s*|\s+/g) ?? [''];
    for (const word of words) {
      if (line && measureText(line + word.trimEnd(), size, weight) > width + 0.5) {
        lines.push(line.trimEnd());
        line = '';
      }
      if (measureText(word.trimEnd(), size, weight) > width + 0.5) {
        for (const ch of word) {
          if (line && measureText(line + ch, size, weight) > width + 0.5) {
            lines.push(line);
            line = '';
          }
          line += ch;
        }
      } else line += word;
    }
    if (line || !paragraph) lines.push(line.trimEnd());
  }
  if (lines.length <= max) return lines;
  const result = lines.slice(0, max);
  let last = result[max - 1] ?? '';
  while (last && measureText(last + '…', size, weight) > width) last = last.slice(0, -1);
  result[max - 1] = last + '…';
  return result;
}
