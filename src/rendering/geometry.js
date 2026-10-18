// Dimension annotations and source geometry illustration.
import SymbolPreview from './symbols.js';
import { presentation, initPresentation } from './source-meta';
import { resizeFrame } from './layout';
import { fontWeight, textLines } from './text-layout.js';
const G = (() => {
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const clean = (s) =>
    String(s ?? '')
      .replace(/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  const fmt = (x) => {
    if (x === null || x === undefined || !Number.isFinite(+x)) return '—';
    const n = +x;
    if (Math.abs(n) < 1e-8) return '0';
    if (Math.abs(n) > 1e10) return 'Max';
    return Number(n.toFixed(2)).toLocaleString('en-US', {
      maximumFractionDigits: 2,
      useGrouping: false,
    });
  };
  const rgba = (c) =>
    c
      ? `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3] ?? 1})`
      : 'none';
  const isFlex = (n) => n.layout?._class === 'MSImmutableFlexGroupLayout';
  const icons = {
    arrow: '<path d="M5 10h10m-4-4 4 4-4 4"/>',
    external: '<path d="M8 5H5v10h10v-3M10 4h6v6m0-6-8 8"/>',
    sun: '<circle cx="10" cy="10" r="3.2"/><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6l1.4 1.4m10 10 1.4 1.4M3.6 16.4 5 15m10-10 1.4-1.4"/>',
    moon: '<path d="M16.5 12A7 7 0 0 1 8 3.5 7 7 0 1 0 16.5 12Z"/>',
    grid: '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/>',
    ruler: '<path d="m3 12 9-9 5 5-9 9-5-5Z"/><path d="m7 8 2 2m1-5 2 2m-8 4 2 2"/>',
    layers: '<path d="m2 7 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M2 15l8 4 8-4"/>',
    source: '<path d="m7 5-5 5 5 5m6-10 5 5-5 5m-2-12-2 14"/>',
    download: '<path d="M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4"/>',
    copy: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 7V3H3v9h4"/>',
    phone: '<rect x="5" y="2" width="10" height="16" rx="2"/><path d="M8 4h4m-3 12h2"/>',
    desktop: '<rect x="2" y="3" width="16" height="11" rx="2"/><path d="M7 18h6m-3-4v4"/>',
    check: '<path d="m4 10 4 4 8-8"/>',
    info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v5m0-9v.2"/>',
    chevron: '<path d="m7 4 6 6-6 6"/>',
    back: '<path d="m11 5-5 5 5 5m-5-5h11"/>',
  };
  function icon(name, cls = 'icon') {
    return `<svg class="${esc(cls)}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
  }
  let db = null,
    refs = new Map(),
    serial = 0;
  function init(data) {
    initPresentation(data);
    db = data;
    refs = new Map(data.components.map((c) => [c.platform + ':' + c.symbolID, c]));
  }
  function radius(n) {
    const raw =
      n.style?.corners?.radii ??
      (n.points?.length ? n.points.map((p) => p.cornerRadius ?? 0) : null);
    if (raw?.length)
      return {
        raw,
        values: raw.map((v) => Math.min(Number(v) || 0, n.f[2] / 2, n.f[3] / 2)),
        max: raw.some((v) => v > 1e10),
      };
    return n.fixedRadius
      ? {
          raw: [n.fixedRadius],
          values: [Math.min(n.fixedRadius, n.f[2] / 2, n.f[3] / 2)],
          max: false,
        }
      : null;
  }
  function path(n) {
    const pts = n.points;
    if (!pts?.length) return '';
    const num = (s) =>
      String(s || '0,0')
        .match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi)
        ?.map(Number) || [0, 0];
    const pt = (s) => {
      const v = num(s);
      return [v[0] * n.f[2], v[1] * n.f[3]];
    };
    let d = 'M' + pt(pts[0].point).map(fmt).join(' ');
    const end = n.isClosed ? pts.length : pts.length - 1;
    for (let i = 0; i < end; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length],
        p = pt(b.point);
      if (a.hasCurveTo || b.hasCurveFrom)
        d +=
          ' C' +
          pt(a.hasCurveTo ? a.curveTo : a.point)
            .map(fmt)
            .join(' ') +
          ',' +
          pt(b.hasCurveFrom ? b.curveFrom : b.point)
            .map(fmt)
            .join(' ') +
          ',' +
          p.map(fmt).join(' ');
      else d += ' L' + p.map(fmt).join(' ');
    }
    return d + (n.isClosed ? ' Z' : '');
  }
  function node(n, platform, options = {}, depth = 0, chain = new Set()) {
    if (depth > 14 || n.hidden || n.f[2] <= 0 || n.f[3] < 0) return '';
    const [x, y, w, h] = n.f,
      uid = 'g' + ++serial,
      st = n.style || {};
    let svg = '',
      defs = '',
      fills = (st.fills || []).filter((f) => !f.layeringType);
    let fill = 'none';
    if (fills.length) {
      const f = fills[0];
      fill = rgba(
        f.color ? f.color.map((v, i) => (i === 3 ? v * (f.context?.opacity ?? 1) : v)) : null,
      );
      if (f.type === 1 && f.gradient?.stops?.length) {
        defs = `<defs><linearGradient id="${uid}">${f.gradient.stops.map((v) => `<stop offset="${v[0] * 100}%" stop-color="${rgba(v[1])}"/>`).join('')}</linearGradient></defs>`;
        fill = `url(#${uid})`;
      }
    }
    const border = st.borders?.[0];
    const stroke = border ? rgba(border.color) : 'none';
    const sw = border?.width || 0;
    const r = radius(n)?.values?.[0] || 0;
    let tf = `translate(${x} ${y})`;
    if (n.rotation) tf += ` rotate(${-n.rotation} ${w / 2} ${h / 2})`;
    if (n.isFlippedHorizontal) tf += ` translate(${w} 0) scale(-1 1)`;
    if (n.isFlippedVertical) tf += ` translate(0 ${h}) scale(1 -1)`;
    if (n.type === 'symbolInstance') {
      const ref = refs.get(platform + ':' + n.symbolID);
      if (ref && !chain.has(ref.id) && ref.root.f[2] && ref.root.f[3]) {
        const next = new Set(chain);
        next.add(ref.id);
        let rn = resizeFrame(SymbolPreview.applyOverrides(ref.root, n.overrides), w, h);
        // Only content/color illustrations use the referenced master. Geometry
        // labels and exports never use this affine expansion.
        svg += `<g transform="translate(0 0)">${node(rn, platform, { ...options, selected: null, boxes: false }, depth + 1, next)}</g>`;
      } else
        svg += `<rect width="${w}" height="${h}" rx="${Math.min(6, h / 2)}" fill="#7c9fc314" stroke="#91a3ba" stroke-width=".5" stroke-dasharray="3 2"/>`;
    } else {
      if (n.type === 'oval')
        svg += `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      else if (n.type === 'shapePath')
        svg += `<path d="${path(n)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      else if (fill !== 'none' || stroke !== 'none')
        svg += `<rect width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      if (n.text) {
        const t = n.text,
          size = t.size || 13,
          tc = t.color ? rgba(t.color) : '#222',
          bold = fontWeight(t.font);
        const raw = t.value || '';
        if (/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u.test(raw)) {
          svg += SymbolPreview.renderText(t, w, h, uid);
        } else {
          const lh = t.lineHeight || size * 1.2,
            lines = textLines(t, w, h),
            align = t.alignment || 0,
            xx = align === 2 ? w / 2 : align === 1 ? w : 0,
            anchor = align === 2 ? 'middle' : align === 1 ? 'end' : 'start';
          const va = presentation(n, platform).text?.verticalAlignment ?? 0;
          const yy =
            (va === 1 ? (h - lines.length * lh) / 2 : va === 2 ? h - lines.length * lh : 0) +
            lh / 2;
          svg += `<g><clipPath id="${uid}clip"><rect x="-2" y="-2" width="${w + 4}" height="${h + 4}"/></clipPath><text x="${xx}" y="${yy}" dominant-baseline="central" text-anchor="${anchor}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${bold}" fill="${tc}" clip-path="url(#${uid}clip)">${lines.map((line, i) => `<tspan x="${xx}" dy="${i ? lh : 0}">${esc(line)}</tspan>`).join('')}</text></g>`;
        }
      }
      if (n.type === 'bitmap') {
        const image = db?.previews?.[platform + ':' + n.imageRef];
        if (image)
          svg += `<image href="${esc(image.dataURL)}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
        else
          svg += `<g data-preview-placeholder="image"><title>Image slot · source artwork not included</title><rect width="${w}" height="${h}" rx="${Math.min(w, h) * 0.2}" fill="#9caaba22"/><svg x="${w * 0.24}" y="${h * 0.24}" width="${w * 0.52}" height="${h * 0.52}" viewBox="0 0 24 24" fill="none" stroke="#6e8494" stroke-width="1.4"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="2"/><path d="m3 18 5-5 4 3 5-7 4 8"/></svg></g>`;
      }
      svg += (n.children || []).map((c) => node(c, platform, options, depth + 1, chain)).join('');
    }
    if (options.boxes && depth === 1)
      svg += `<rect width="${w}" height="${h}" rx="1" fill="none" stroke="#8570bd" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`;
    if (options.selected === n.id)
      svg += `<rect width="${w}" height="${h}" fill="#007aff0b" stroke="#007aff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    return `<g transform="${tf}" opacity="${st.opacity ?? 1}">${defs}${svg}</g>`;
  }
  function sample(c, width = 260, height = 130, maxScale = 1.7) {
    if (!c) return '';
    const n = c.root,
      w = n.f[2],
      h = n.f[3],
      s = Math.min((width - 24) / Math.max(w, 1), (height - 18) / Math.max(h, 1), maxScale);
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(clean(c.name))} 几何示意"><g transform="translate(${(width - w * s) / 2} ${(height - h * s) / 2}) scale(${s})">${node(n, c.platform, {}, 0, new Set([c.id]))}</g></svg>`;
  }
  function diagram(c, options = {}, width = 680, height = 320) {
    const root = c.root,
      w = root.f[2],
      h = root.f[3];
    const margin = options.dimensions ? 65 : 28;
    const s = Math.max(
      0.01,
      Math.min((width - 2 * margin) / Math.max(w, 1), (height - 100) / Math.max(h, 1), 3.3),
    );
    const X = (width - w * s) / 2,
      Y = (height - h * s) / 2 + 5;
    let lines = '';
    const D = options.appearance === 'dark' ? '#79b3ff' : '#0b79ef';
    const M = options.appearance === 'dark' ? '#d7b6ff' : '#936fc5';
    const line = (x1, y1, x2, y2, color = D, dash = '') =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
    const label = (x, y, text, color = D, anchor = 'middle') =>
      `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="SFMono-Regular,Consolas,monospace" font-size="10" fill="${color}" paint-order="stroke" stroke="${options.appearance === 'dark' ? '#27292e' : '#ffffff'}" stroke-width="4" stroke-linejoin="round">${esc(text)}</text>`;
    const measureX = (a, b, y, text, color = D) =>
      line(a, y, b, y, color) +
      line(a, y - 4, a, y + 4, color) +
      line(b, y - 4, b, y + 4, color) +
      label((a + b) / 2, y - 10, text, color);
    if (options.dimensions) {
      const YY = Y - 25;
      lines +=
        line(X, Y - 7, X, YY - 4, D, '3 3') +
        line(X + w * s, Y - 7, X + w * s, YY - 4, D, '3 3') +
        measureX(X, X + w * s, YY, fmt(w) + ' pt');
      const XX = X + w * s + 24;
      lines +=
        line(X + w * s + 7, Y, XX + 4, Y, D, '3 3') +
        line(X + w * s + 7, Y + h * s, XX + 4, Y + h * s, D, '3 3') +
        line(XX, Y, XX, Y + h * s) +
        line(XX - 4, Y, XX + 4, Y) +
        line(XX - 4, Y + h * s, XX + 4, Y + h * s) +
        label(XX + 9, Y + (h * s) / 2, fmt(h), D, 'start');
    }
    if (options.padding && isFlex(root) && root.padding) {
      const [t, r, b, l] = root.padding;
      const cx = X + l * s,
        cy = Y + t * s,
        cw = Math.max(0, w - l - r) * s,
        ch = Math.max(0, h - t - b) * s;
      lines += `<rect x="${X}" y="${Y}" width="${w * s}" height="${h * s}" fill="#8767bd0b"/><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="${M}" stroke-width="1" stroke-dasharray="4 3"/>`;
      if (l > 0) lines += measureX(X, cx, Y + h * s + 24, fmt(l), M);
      if (r > 0) lines += measureX(X + (w - r) * s, X + w * s, Y + h * s + 24, fmt(r), M);
      if (t > 0)
        lines +=
          line(X - 13, Y, X - 13, cy, M) +
          line(X - 17, Y, X - 9, Y, M) +
          line(X - 17, cy, X - 9, cy, M) +
          label(X - 23, Y + (t * s) / 2, fmt(t), M, 'end');
      if (b > 0)
        lines +=
          line(X - 13, Y + (h - b) * s, X - 13, Y + h * s, M) +
          line(X - 17, Y + (h - b) * s, X - 9, Y + (h - b) * s, M) +
          line(X - 17, Y + h * s, X - 9, Y + h * s, M) +
          label(X - 23, Y + (h - b / 2) * s, fmt(b), M, 'end');
    }
    if (options.gaps && isFlex(root) && root.layout.flexDirection === 0) {
      const flow = (root.children || [])
        .filter((n) => !n.hidden && !n.flexItem?.ignoreLayout)
        .sort((a, b) => a.f[0] - b.f[0]);
      for (let i = 1; i < Math.min(flow.length, 9); i++) {
        const prev = flow[i - 1],
          next = flow[i],
          left = prev.f[0] + prev.f[2],
          gap = next.f[0] - left;
        if (gap > 0) {
          const color = options.appearance === 'dark' ? '#f1b475' : '#ba6b22';
          const yy = Y + h * s + 43;
          lines += measureX(X + left * s, X + next.f[0] * s, yy, 'Δ' + fmt(gap), color);
        }
      }
    }
    if (options.selected && options.dimensions) {
      let hit = null;
      function find(n, ox = 0, oy = 0) {
        const ax = ox + n.f[0],
          ay = oy + n.f[1];
        if (n.id === options.selected) {
          hit = { n, x: ax, y: ay };
          return;
        }
        for (const child of n.children || []) find(child, ax, ay);
      }
      find(root);
      if (hit) {
        const { n, x, y } = hit;
        if (options.renderIllustration)
          lines += `<rect x="${X + x * s}" y="${Y + y * s}" width="${n.f[2] * s}" height="${n.f[3] * s}" fill="#007aff0b" stroke="#007aff" stroke-width="1.5"/>`;
        lines += measureX(
          X + x * s,
          X + (x + n.f[2]) * s,
          Y - 46,
          fmt(n.f[2]) + ' × ' + fmt(n.f[3]) + ' pt',
          M,
        );
      }
    }
    const illustration = options.renderIllustration
      ? options.renderIllustration({ width, height, placement: [s, 0, 0, s, X, Y] })
      : `<g transform="translate(${X} ${Y}) scale(${s})">${node(root, c.platform, { selected: options.selected, boxes: options.boxes }, 0, new Set([c.id]))}</g>`;
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="组件尺寸标注：宽 ${fmt(w)}，高 ${fmt(h)}，单位 pt">${illustration}${lines}</svg>`;
  }
  function flatten(n, depth = 0) {
    return [{ node: n, depth }, ...(n.children || []).flatMap((c) => flatten(c, depth + 1))];
  }
  return {
    path,
    esc,
    clean,
    fmt,
    rgba,
    icon,
    isFlex,
    init,
    radius,
    sample,
    diagram,
    flatten,
    fragment: node,
    refs: () => refs,
  };
})();

export default G;
