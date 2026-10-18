import { fontWeight } from './text-layout.js';
import names from './symbol-names.json' with { type: 'json' };
/* Independent semantic SVG illustrations, NOT Apple font outlines.
 * Codepoint/name metadata: symbolist (MIT); see symbolist-LICENSE.txt.
 * Source layout/measurement objects must never be mutated by this renderer. */
const SymbolPreview = (() => {
  'use strict';
  const PUA = /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const path = (d, fill = false) =>
    `<path d="${d}"${fill ? ' fill="currentColor" stroke="none"' : ''}/>`;
  const circle = (x = 12, y = 12, r = 9, fill = false) =>
    `<circle cx="${x}" cy="${y}" r="${r}"${fill ? ' fill="currentColor" stroke="none"' : ''}/>`;
  const rect = (x = 3, y = 3, w = 18, h = 18, r = 2) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  const text = (value, size = 16) =>
    `<text x="12" y="12" dominant-baseline="central" text-anchor="middle" font-size="${size}" font-family="Arial,sans-serif" stroke="none" fill="currentColor">${escape(value)}</text>`;
  const shapes = {
    circle: () => circle(),
    square: () => rect(),
    app: () => rect(),
    diamond: () => path('M12 2 22 12 12 22 2 12Z'),
    triangle: () => path('M12 3 22 21H2Z'),
    plus: () => path('M12 4v16M4 12h16'),
    minus: () => path('M4 12h16'),
    equal: () => path('M4 8h16M4 16h16'),
    multiply: () => path('m5 5 14 14M19 5 5 19'),
    xmark: () => path('m5 5 14 14M19 5 5 19'),
    checkmark: () => path('m3 12 6 6L21 5'),
    'chevron.up': () => path('m4 16 8-8 8 8'),
    'chevron.down': () => path('m4 8 8 8 8-8'),
    'chevron.left': () => path('m16 4-8 8 8 8'),
    'chevron.right': () => path('m8 4 8 8-8 8'),
    'chevron.up.chevron.down': () => path('m6 8 6-5 6 5M6 16l6 5 6-5'),
    'arrow.up': () => path('M12 21V3M5 10l7-7 7 7'),
    'arrow.down': () => path('M12 3v18M5 14l7 7 7-7'),
    'arrow.left': () => path('M21 12H3m7-7-7 7 7 7'),
    'arrow.right': () => path('M3 12h18m-7-7 7 7-7 7'),
    'arrow.right.to.line': () => path('M2 12h16m-6-6 6 6-6 6M22 3v18'),
    return: () => path('M21 4v9H3m6-6-6 6 6 6'),
    'arrow.uturn.left': () => path('M20 20V10a6 6 0 0 0-12 0v4m-5-5 5 5 5-5'),
    'arrow.uturn.right': () => path('M4 20V10a6 6 0 0 1 12 0v4m-5-5 5 5 5-5'),
    'arrowshape.turn.up.left': () => path('M3 10 11 3v5c7 0 10 4 10 12-3-5-5-6-10-6v4Z'),
    play: () => path('M5 2 22 12 5 22Z', true),
    pause: () => path('M5 3h5v18H5Zm9 0h5v18h-5Z', true),
    backward: () => path('M12 3 1 12l11 9Zm11 0L12 12l11 9Z', true),
    forward: () => path('M1 3 12 12 1 21Zm11 0 11 9-11 9Z', true),
    magnifyingglass: () => circle(10, 10, 7) + path('m15 15 7 7'),
    heart: () => path('M12 21 3 12C-3 5 7-2 12 5c5-7 15 0 9 7Z'),
    star: () => path('m12 2 3.1 6.5 7.2 1-5.2 5.1 1.3 7.1-6.4-3.4-6.4 3.4 1.3-7.1-5.2-5.1 7.2-1Z'),
    mic: () => rect(9, 2, 6, 13, 3) + path('M6 11v2a6 6 0 0 0 12 0v-2M12 19v3M8 22h8'),
    folder: () => path('M2 6h8l2 3h10v12H2ZM2 6V3h8l2 3h10v3'),
    doc: () => path('M5 2h9l6 6v14H5ZM14 2v6h6M8 12h9M8 16h9'),
    'doc.on.doc': () => path('M8 2h9l4 4v12H8ZM3 6v16h13M17 2v4h4'),
    'doc.on.clipboard': () => rect(5, 5, 15, 17) + rect(8, 2, 9, 5, 1) + path('M8 11h9M8 15h9'),
    'square.and.arrow.up': () => path('M5 10H2v12h20V10h-3M12 16V2m-5 5 5-5 5 5'),
    person: () => circle(12, 7, 4) + path('M4 22v-3a8 8 0 0 1 16 0v3Z'),
    'person.2': () =>
      circle(9, 7, 4) + path('M2 22v-3a7 7 0 0 1 14 0v3ZM17 3a4 4 0 0 1 0 8m2 3c3 1 4 4 4 8h-4'),
    info: () => circle(12, 5, 1, true) + path('M12 10v10'),
    'line.3.horizontal': () => path('M3 5h18M3 12h18M3 19h18'),
    'line.3.horizontal.decrease': () => path('M2 5h20M6 12h12M9 19h6'),
    ellipsis: () =>
      circle(4, 12, 1.7, true) + circle(12, 12, 1.7, true) + circle(20, 12, 1.7, true),
    command: () =>
      path('M8 8H5a3 3 0 1 1 3-3v14a3 3 0 1 1-3-3h14a3 3 0 1 1-3 3V5a3 3 0 1 1 3 3ZM8 8h8v8H8Z'),
    option: () => path('M2 4h6l8 16h6M14 4h8'),
    shift: () => path('m2 12 10-10 10 10h-6v10H8V12Z'),
    capslock: () => path('m3 10 9-8 9 8h-5v6H8v-6ZM8 20h8'),
    'delete.left': () => path('M8 4h14v16H8L1 12ZM12 8l6 8m0-8-6 8'),
    power: () => path('M12 2v10M6 5a9 9 0 1 0 12 0'),
    'sun.max': () =>
      circle(12, 12, 5) + path('M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2'),
    moon: () => path('M17 2a10 10 0 1 0 5 15A10 10 0 0 1 17 2Z'),
    sunset: () => path('M1 18h22M4 18a8 8 0 0 1 16 0M12 2v4M2 7l3 3m14 0 3-3M4 22h16'),
    'cloud.sun': () =>
      circle(8, 8, 5) + path('M2 17a4 4 0 0 1 4-4 6 6 0 0 1 12 1 4 4 0 1 1 1 8H6a4 4 0 0 1-4-5Z'),
    pencil: () => path('m3 16 13-13 5 5L8 21l-6 1ZM13 6l5 5M3 16l5 5'),
    'square.and.pencil': () => path('M11 3H2v19h19V12M9 15l1-5L19 1l4 4-9 9Z'),
    highlighter: () => path('m5 14 9-12 8 6-10 12ZM5 14l7 6-3 3-7-3Z'),
    eyedropper: () => path('M13 4 20 11m-7-7 3-3 7 7-3 3M14 5 3 16l-1 6 6-2L19 10Z'),
    trash: () => path('M3 6h18M9 6V2h6v4M5 6l1 16h12l1-16M10 10v8m4-8v8'),
    archivebox: () => rect(2, 3, 20, 5, 1) + path('M4 8v14h16V8M9 12h6'),
    tray: () => path('m2 15 4-12h12l4 12v7H2ZM2 15h6v3h8v-3h6'),
    flag: () => path('M4 23V2m0 1c6-5 9 5 16 0v11c-7 5-10-5-16 0'),
    camera: () => path('M2 6h5l2-4h6l2 4h5v15H2Z') + circle(12, 13, 5),
    lock: () => rect(4, 10, 16, 12, 2) + path('M7 10V6a5 5 0 0 1 10 0v4M12 15v3'),
    'lock.open.rotation': () =>
      rect(7, 11, 10, 10, 2) + path('M9 11V8a3 3 0 0 1 6 0M2 12A10 10 0 1 1 3 19M2 5v7h6'),
    'sidebar.left': () => rect(1, 3, 22, 18, 2) + path('M9 3v18M4 7h2M4 11h2M4 15h2'),
    clock: () => circle() + path('M12 6v7l4 2'),
    airplane: () =>
      path('M10 9 2 13v3l8-2v5l-3 2v2l5-1 5 1v-2l-3-2v-5l8 2v-3-0l-8-4V4a2 2 0 0 0-4 0Z'),
    wifi: () =>
      path('M1 7a17 17 0 0 1 22 0M5 11a11 11 0 0 1 14 0M9 15a5 5 0 0 1 6 0') +
      circle(12, 20, 1, true),
    lightbulb: () => path('M8 17c0-4-4-4-4-9a8 8 0 0 1 16 0c0 5-4 5-4 9ZM9 20h6M10 23h4'),
    globe: () => circle() + path('M3 12h18M12 3c-6 4-6 14 0 18 6-4 6-14 0-18'),
    keyboard: () =>
      rect(1, 5, 22, 14, 2) +
      path('M4 9h1m3 0h1m3 0h1m3 0h1m3 0h1M4 12h1m3 0h1m3 0h1m3 0h1m3 0h1M5 16h14'),
    abc: () => text('ABC', 10),
    textformat: () => text('Aa', 17),
    'bold.italic.underline': () => text('BIU', 12) + path('M16 20h6'),
    'character.textbox': () => rect() + text('A', 14),
    'character.cursor.ibeam': () => text('A', 14) + path('M20 2v20m-2-20h4m-4 20h4'),
    'exclamationmark.triangle': () => path('M12 2 23 22H1Z M12 8v7') + circle(12, 19, 1, true),
    calendar: () => rect(2, 4, 20, 18, 2) + path('M2 10h20M7 1v6M17 1v6M7 14h2m6 0h2M7 18h2m6 0h2'),
    book: () => path('M12 5c-4-3-7-3-11-2v17c4-1 7-1 11 2 4-3 7-3 11-2V3c-4-1-7-1-11 2Zm0 0v17'),
    paperclip: () => path('m8 16 9-9a3 3 0 0 0-4-4L3 13a6 6 0 0 0 8 8L22 10M6 15l9-9'),
    paperplane: () => path('m2 9 21-8-8 21-4-9ZM11 13 23 1'),
    scissors: () => circle(5, 18, 4) + circle(19, 18, 4) + path('M7 14 20 2M17 14 4 2'),
    bell: () => path('M3 18h18l-3-5V8A6 6 0 0 0 6 8v5ZM9 21a3 3 0 0 0 6 0'),
    tag: () => path('M2 3h10l10 10-9 9L2 11Z') + circle(7, 7, 1, true),
    'slider.horizontal.3': () =>
      path('M2 5h20M2 12h20M2 19h20') +
      circle(8, 5, 2, true) +
      circle(16, 12, 2, true) +
      circle(10, 19, 2, true),
    'bubble.left': () => path('M2 3h20v15H8l-6 5Z'),
    'bubble.middle.bottom': () => path('M2 3h20v15h-7l-3 5-3-5H2Z'),
    photo: () => rect() + path('m3 19 7-8 5 5 3-3 3 5') + circle(17, 8, 2),
    'face.smiling': () =>
      circle() + circle(8, 9, 1, true) + circle(16, 9, 1, true) + path('M7 15a5 5 0 0 0 10 0'),
    'qrcode.viewfinder': () =>
      path('M1 7V1h6m10 0h6v6M1 17v6h6m10 0h6v-6') +
      rect(5, 5, 5, 5, 0) +
      rect(14, 5, 5, 5, 0) +
      rect(5, 14, 5, 5, 0) +
      path('M14 14h5v5h-3v-2'),
    faceid: () => path('M1 7V1h6m10 0h6v6M1 17v6h6m10 0h6v-6M7 8v2m10-2v2M12 8v6h-2M7 17q5 5 10 0'),
    pin: () => path('M7 2h10l-1 7 5 5H3l5-5ZM12 14v9'),
    printer: () => rect(2, 8, 20, 10, 2) + path('M6 8V2h12v6M6 14h12v8H6Z'),
    eyeglasses: () =>
      circle(6, 14, 5) + circle(18, 14, 5) + path('M11 14h2M1 14l2-10h3M23 14 21 4h-3'),
    umbrella: () => path('M1 12a11 11 0 0 1 22 0ZM12 12v7a3 3 0 0 0 6 0'),
    flashlight: () => path('M4 2h16v5l-5 6v9H9v-9L4 7ZM4 7h16M11 15h2'),
    paintpalette: () =>
      path('M12 2a10 10 0 0 0 0 20c4 0 0-5 4-5h3c6-4 3-15-7-15Z') +
      circle(7, 7, 1, true) +
      circle(14, 6, 1, true) +
      circle(18, 11, 1, true) +
      circle(5, 13, 1, true),
    hare: () => path('M2 16c1-6 6-8 10-3l4-4-2-7 3 1 2 6 3 2-1 4-6 1-3 4H3ZM4 19h7m6-3 4 4'),
    tortoise: () =>
      path('M4 17a8 8 0 0 1 16 0ZM5 18l-2 4m13-4 3 4M20 15l3-2v4h-3') + path('m9 10-2 7m7-7 3 7'),
    scroll: () =>
      path('M5 3h16v4H5a2 2 0 0 1 0-4ZM5 7v13a2 2 0 0 0 4 0V3M9 21h11V7M12 11h5m-5 4h5'),
    'switch.2': () =>
      rect(1, 3, 22, 7, 3.5) +
      rect(1, 14, 22, 7, 3.5) +
      circle(6, 6.5, 2, true) +
      circle(18, 17.5, 2, true),
    'rectangle.split.1x2': () => rect(2, 3, 20, 18, 2) + path('M2 12h20'),
    'button.horizontal': () => rect(1, 7, 22, 10, 5),
    'apps.iphone': () =>
      rect(6, 1, 12, 22, 2) +
      path('M10 4h4M10 21h4') +
      rect(8, 7, 3, 3, 0) +
      rect(13, 7, 3, 3, 0) +
      rect(8, 12, 3, 3, 0) +
      rect(13, 12, 3, 3, 0),
    'apps.ipad.landscape': () =>
      rect(1, 4, 22, 16, 2) + rect(5, 8, 4, 4, 0) + rect(11, 8, 4, 4, 0) + path('M19 10v4'),
    'macwindow.on.rectangle': () => rect(1, 1, 18, 15, 2) + path('M1 5h18M21 8h2v15H5v-5'),
    'macbook.gen2': () => rect(4, 2, 16, 14, 1) + path('M4 16 1 21h22l-3-5ZM9 19h6'),
    'squareshape.split.3x3': () => rect(1, 1, 22, 22, 2) + path('M8 1v22m8-22v22M1 8h22M1 16h22'),
    'filemenu.and.selection': () =>
      rect(2, 1, 17, 22, 2) + path('M6 5h9M6 9h9M6 13h4m4 1 8 5-4 1-1 4Z'),
    'signpost.right.and.left': () => path('M12 1v22M3 3h15l5 4-5 4H3ZM21 13H6l-5 4 5 4h15Z'),
    'wrench.and.screwdriver': () =>
      path(
        'm4 2 4 4-2 2-4-4c-3 7 4 9 6 7l10 11 4-4L11 8c2-3 0-7-4-7M19 2l3 3-8 8m-4 3-6 6-3-3 6-6',
      ),
    'rectangle.portrait.bottomhalf.inset.filled': () =>
      rect(4, 1, 16, 22, 2) + path('M7 13h10v7H7Z', true),
    'capsule.righthalf.filled': () =>
      rect(1, 5, 22, 14, 7) + path('M12 5h4a7 7 0 0 1 0 14h-4Z', true),
    cursorarrow: () => path('m3 1 18 12-9 1-4 8Z'),
    seal: () => path('m12 1 3 3 4 0 1 4 3 4-3 4-1 4-4 0-3 3-3-3-4 0-1-4-3-4 3-4 1-4 4 0Z'),
  };
  const aliases = {
    'chevron.backward': 'chevron.left',
    'chevron.forward': 'chevron.right',
    control: 'chevron.up',
    'arrow.forward': 'arrow.right',
    'return.left': 'return',
    'arrow.uturn.backward': 'arrow.uturn.left',
    'arrow.uturn.forward': 'arrow.uturn.right',
    'delete.backward': 'delete.left',
    'sidebar.leading': 'sidebar.left',
    'eyedropper.halffull': 'eyedropper',
    'flashlight.off': 'flashlight',
    'photo.artframe': 'photo',
    'pencil.line': 'pencil',
    'lightbulb.max': 'lightbulb',
  };
  function illustration(name) {
    if (!name) return null;
    let key = aliases[name] || name,
      fill = false;
    if (key.endsWith('.fill')) {
      fill = true;
      key = key.slice(0, -5);
    }
    key = aliases[key] || key;
    if (shapes[key])
      return `<g${fill && !['xmark', 'checkmark', 'mic', 'doc', 'camera', 'person.2', 'hare', 'tortoise', 'sun.max', 'cloud.sun'].includes(key) ? ' fill="currentColor"' : ''}>${shapes[key]()}</g>`;
    if (key === 'diamond.righthalf.filled')
      return shapes.diamond() + path('M12 2 22 12 12 22Z', true);
    if (/^(circle|square|app)\.dashed$/.test(key))
      return `<g stroke-dasharray="2.6 2.6">${shapes[key.split('.')[0]]()}</g>`;
    if (key.endsWith('.circle')) {
      const inner = illustration(key.slice(0, -7));
      if (inner) return circle() + `<g transform="translate(5 5) scale(.58333)">${inner}</g>`;
    }
    if (key.endsWith('.app')) {
      const inner = illustration(key.slice(0, -4));
      if (inner) return rect() + `<g transform="translate(5 5) scale(.58333)">${inner}</g>`;
    }
    if (key.endsWith('.slash')) {
      const inner = illustration(key.slice(0, -6));
      if (inner) return inner + path('M2 2 22 22');
    }
    if (key === 'keyboard.chevron.compact.down')
      return `<g transform="scale(1 .75)">${shapes.keyboard()}</g>` + path('m8 20 4 3 4-3');
    if (key === 'pencil.tip.crop.circle') return circle() + path('m7 17 5-11 5 11ZM10 11h4');
    if (key === 'tray.2') return shapes.tray() + path('M2 22h20');
    if (key === 'rectangle.and.pencil.and.ellipsis') return shapes['square.and.pencil']();
    return null;
  }
  function nameFor(char) {
    return (names || {})[char.codePointAt(0).toString(16).toUpperCase()] || null;
  }
  function symbol(char, x, y, w, h, color, weight = 1.8) {
    const name = nameFor(char),
      body = illustration(name),
      code = char.codePointAt(0).toString(16).toUpperCase();
    const label = body
      ? `${name} · 语义 SVG 示意`
      : `未映射符号 ${name || 'U+' + code}；保留布局框`;
    return `<g transform="translate(${x} ${y}) scale(${Math.max(0, w) / 24} ${Math.max(0, h) / 24})" class="symbol-preview${body ? '' : ' symbol-unmapped'}" data-symbol-code="${code}" data-symbol-name="${escape(name || 'unknown')}" data-symbol-status="${body ? 'mapped' : 'unmapped'}" style="color:${escape(color)}" fill="none" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"><title>${escape(label)}</title>${body || '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3" opacity=".35"/>'}</g>`;
  }
  let canvas;
  function measure(value, size, weight) {
    if (typeof document !== 'undefined') {
      canvas ??= document.createElement('canvas').getContext('2d');
      if (canvas) {
        canvas.font = `${weight} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif`;
        return canvas.measureText(value).width;
      }
    }
    return Array.from(value).reduce(
      (w, c) => w + size * (/\s/.test(c) ? 0.3 : c.codePointAt(0) > 255 ? 1 : 0.55),
      0,
    );
  }
  function renderText(t, w, h, uid = 'symbol-text') {
    const raw = String(t.value ?? ''),
      size = Number(t.size) || 13,
      lh = Number(t.lineHeight) || size * 1.2,
      align = t.alignment || 0;
    const weight = fontWeight(t.font);
    const color = t.color
      ? `rgba(${t.color
          .slice(0, 3)
          .map((v) => Math.round(v * 255))
          .join(',')},${t.color[3] ?? 1})`
      : '#222';
    const chars = Array.from(raw.trim());
    if (chars.length === 1 && PUA.test(chars[0])) {
      const b = t.glyphBounds,
        valid =
          Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[2] > 0 && b[3] > 0;
      const gw = valid ? b[2] : Math.min(w, size),
        gh = valid ? b[3] : Math.min(h, size);
      const x = valid
        ? b[0] + (w - (t.previewOriginalWidth ?? w)) * (align === 2 ? 0.5 : align === 1 ? 1 : 0)
        : align === 2
          ? (w - gw) / 2
          : align === 1
            ? w - gw
            : 0;
      const y = valid ? (h - lh) / 2 + b[1] : (h - gh) / 2;
      return symbol(chars[0], x, y, gw, gh, color, weight === 600 ? 2.1 : 1.7);
    }
    const lines = raw.split('\n').slice(0, 30),
      clip = escape(uid) + '-mixed-clip';
    let result = `<defs><clipPath id="${clip}"><rect x="-2" y="-2" width="${w + 4}" height="${h + 4}"/></clipPath></defs><g clip-path="url(#${clip})">`;
    lines.forEach((line, li) => {
      const tokens = [];
      let ordinary = '';
      for (const c of line) {
        if (PUA.test(c)) {
          if (ordinary) {
            tokens.push({ text: ordinary });
            ordinary = '';
          }
          tokens.push({ char: c });
        } else ordinary += c;
      }
      if (ordinary) tokens.push({ text: ordinary });
      const advances = tokens.map((token) =>
          token.char ? size : measure(token.text, size, weight),
        ),
        total = advances.reduce((a, b) => a + b, 0);
      // Overflow is clipped; glyphs must never be horizontally squeezed to fit.
      const fit = 1;
      let x = align === 2 ? (w - total * fit) / 2 : align === 1 ? w - total * fit : 0;
      result += `<g transform="translate(${x} 0) scale(${fit} 1)">`;
      x = 0;
      const y = (lines.length === 1 ? h / 2 : Math.min(lh / 2, h / 2)) + li * lh;
      tokens.forEach((token, i) => {
        if (token.char)
          result += symbol(
            token.char,
            x,
            y - size / 2,
            size,
            size,
            color,
            weight === 600 ? 2.1 : 1.7,
          );
        else
          result += `<text x="${x}" y="${y}" dominant-baseline="central" xml:space="preserve" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${escape(color)}">${escape(token.text)}</text>`;
        x += advances[i];
      });
      result += '</g>';
    });
    return result + '</g>';
  }
  function applyOverrides(rootNode, values = []) {
    if (!values?.length) return rootNode;
    const records = values
      .map((o) => {
        const key = String(o.overrideName || ''),
          split = key.lastIndexOf('_');
        return {
          parts: key.slice(0, split).split('/'),
          prop: key.slice(split + 1),
          value: o.value,
        };
      })
      .filter((o) => ['stringValue', 'symbolID', 'isVisible'].includes(o.prop));
    function visit(node, active) {
      let out = node;
      const copy = () => {
        if (out === node) out = { ...node };
      };
      for (const o of active.filter((o) => o.parts.length === 1 && o.parts[0] === node.id)) {
        copy();
        if (o.prop === 'stringValue' && node.text) {
          out.text = {
            ...node.text,
            value: String(o.value ?? ''),
            previewOriginalValue: node.text.previewOriginalValue ?? node.text.value,
          };
          if (out.text.value === node.text.value) continue;
          delete out.text.glyphBounds;
        } else if (o.prop === 'symbolID') out.symbolID = o.value;
        else if (o.prop === 'isVisible')
          out.hidden = o.value === false || o.value === 0 || o.value === '0';
      }
      const nested = active
        .filter((o) => o.parts.length > 1 && o.parts[0] === node.id)
        .map((o) => ({ ...o, parts: o.parts.slice(1) }));
      if (node.type === 'symbolInstance' && nested.length) {
        copy();
        out.overrides = [
          ...(node.overrides || []),
          ...nested.map((o) => ({
            overrideName: o.parts.join('/') + '_' + o.prop,
            value: o.value,
          })),
        ];
      }
      if (node.children) {
        const children = node.children.map((child) => visit(child, [...active, ...nested]));
        if (children.some((c, i) => c !== node.children[i])) {
          copy();
          out.children = children;
        }
      }
      return out;
    }
    return visit(rootNode, records);
  }
  const api = {
    renderText,
    symbol,
    nameFor,
    illustration,
    applyOverrides,
    isPUA: (value) => PUA.test(value),
  };
  return Object.freeze(api);
})();
export default SymbolPreview;
