#!/usr/bin/env python3
"""Apply the preview-only repair without changing the compressed measurement data.

Run from the repository root. Idempotent; only Python's standard library is used.
Name metadata and its license must be present locally (no runtime font/CDN dependency).
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / 'index.html'
ASSETS = ROOT / 'assets'
MARKER = '<script>\n/* Geometry drawing only. This is intentionally not a Sketch renderer. */'
SCRIPTS = '<script src="./assets/symbol-names.js?v=1"></script>\n<script src="./assets/symbol-preview.js?v=1"></script>\n'
PATTERN = r'(<script id="geometry-payload"[^>]*>)(.*?)(</script>)'


def payload_digest(html: str) -> str:
    match = re.search(PATTERN, html, re.S)
    if not match:
        raise ValueError('Missing geometry payload; refusing to modify the document.')
    return hashlib.sha256(match.group(2).encode()).hexdigest()


def replace_once(value: str, old: str, new: str) -> str:
    if old not in value and new in value:
        return value
    if value.count(old) != 1:
        raise ValueError(f'Unexpected renderer version: expected one occurrence of {old[:80]!r}')
    return value.replace(old, new, 1)


def main() -> None:
    html = HTML.read_text(encoding='utf-8')
    before = payload_digest(html)
    ASSETS.mkdir(exist_ok=True)
    data_file = ROOT / 'symbol-names.json'
    if not data_file.exists():
        data_file = ASSETS / 'symbol-names.json'
    names = json.loads(data_file.read_text(encoding='utf-8'))
    if not isinstance(names, dict) or not all(re.fullmatch(r'[0-9A-F]{4,6}', k) and (v is None or isinstance(v, str)) for k, v in names.items()):
        raise ValueError('Invalid codepoint/name metadata.')
    json_text = json.dumps(names, indent=2, ensure_ascii=True, sort_keys=True) + '\n'
    (ASSETS / 'symbol-names.json').write_text(json_text, encoding='utf-8')
    (ASSETS / 'symbol-names.js').write_text(
        '// Name/codepoint metadata only; symbolist (MIT). No font data.\n'
        '// Pinned source: marcbouchenoire/symbolist@7fceba11caad84e41bd0428ed35cab66dd39e485\n'
        '// See symbolist-LICENSE.txt.\n'
        'globalThis.HIG_SYMBOL_NAMES = Object.freeze(' + json_text.rstrip() + ');\n', encoding='utf-8')
    license_file = ROOT / 'symbolist-LICENSE.txt'
    if license_file.exists():
        shutil.copyfile(license_file, ASSETS / license_file.name)
    if not (ASSETS / 'symbolist-LICENSE.txt').exists():
        raise ValueError('The name-map license must accompany the metadata.')
    if not (ASSETS / 'symbol-preview.js').exists():
        raise ValueError('Missing semantic SVG renderer.')
    if SCRIPTS not in html:
        html = replace_once(html, MARKER, SCRIPTS + MARKER)
    html, removed = re.subn(r'^  function placeholderIcon\([^\n]+\n', '', html, flags=re.M)
    if removed > 1:
        raise ValueError('Unexpected duplicate fallback implementations.')
    html = replace_once(html, 'svg+=placeholderIcon(0,0,w,h,tc,raw,n.name);', 'svg+=SymbolPreview.renderText(t,w,h,uid);')
    html = replace_once(html, 'let rn=ref.root;', 'let rn=SymbolPreview.applyOverrides(ref.root,n.overrides);')
    note = '符号按已确认的码点名称绘制为独立 SVG 示意，并非 Apple 原生字形；未映射项以淡色虚线框及提示标识，不影响源尺寸。'
    anchor = " common:['样本宽高来自 frame。只有激活的 Flex Stack 才把 Padding 与 Gap 标为布局声明。'"
    if note not in html:
        html = replace_once(html, anchor, " common:['" + note + "','样本宽高来自 frame。只有激活的 Flex Stack 才把 Padding 与 Gap 标为布局声明。'")
    if 'placeholderIcon(' in html:
        raise ValueError('A legacy fallback call remains.')
    if payload_digest(html) != before:
        raise ValueError('Measurement payload changed; refusing to save.')
    HTML.write_text(html, encoding='utf-8')
    print(json.dumps({'repair': 'symbol-previews-v1', 'geometry_payload_sha256': before, 'name_count': len(names)}, indent=2))


if __name__ == '__main__':
    main()
