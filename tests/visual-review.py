#!/usr/bin/env python3
"""Capture individually reviewed source variants from the built/public app."""
import argparse
import io
import json
import os
import shutil
from pathlib import Path
from urllib.parse import quote
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173/')
parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit'], default='chromium')
parser.add_argument('--focused', action='store_true', help='Cross-engine layout risk cases; Chromium runs the full ledger')
args = parser.parse_args()
out = ROOT / 'test-results' / ('visual-' + args.browser)
out.mkdir(parents=True, exist_ok=True)
cases = json.loads((ROOT / 'tests/visual-cases.json').read_text())
if args.focused:
    cases = [c for c in cases if c['family'] in {'tab-bars','notifications','steppers','checkboxes','radio-buttons','date-time-pickers','popovers','alerts','activity-views','windows'}]
checks, errors = [], []

def check(name, value):
    assert value, name
    checks.append(name)
    print('PASS', name, flush=True)

def changed(a, b):
    a, b = Image.open(io.BytesIO(a)).convert('RGB'), Image.open(io.BytesIO(b)).convert('RGB')
    return sum(1 for p in ImageChops.difference(a, b).getdata() if max(p) > 12)

with sync_playwright() as pw:
    exe = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    options = {'args': ['--no-sandbox']} if args.browser == 'chromium' else {}
    if exe and args.browser == 'chromium':
        options['executable_path'] = exe
    browser = getattr(pw, args.browser).launch(**options)
    page = browser.new_page(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='networkidle')
    page.wait_for_selector('.catalog-card', timeout=30000)

    def open_case(c):
        page.evaluate('(s)=>location.hash=s', '/components/' + c['family'] + '?v=' + quote(c['id'], safe=''))
        page.wait_for_selector('.detail-page')
        canvas = page.locator('.preview-shell:not(.compact) .preview-canvas').first
        canvas.wait_for()
        canvas.locator('[data-node-id="' + c['id'].split(':', 1)[1] + '"]').first.wait_for(state='attached', timeout=30000)
        page.wait_for_timeout(180)
        return canvas

    for i, c in enumerate(cases):
        canvas = open_case(c)
        svg = canvas.locator(':scope>svg')
        check('variant ' + c['id'], svg.count() == 1 and svg.get_attribute('aria-label'))
        canvas.screenshot(path=str(out / f'{i:03}-{c["family"]}-{c["platform"]}.png'))
        if c['id'] == 'macos:26CCF802-2D00-460F-A309-889BC71CE45B':
            check('notification 344x78 with circular 20pt corners', canvas.locator('rect[width="344"][height="78"][rx="20"]').count() > 0)
            page.locator('.anatomy').screenshot(path=str(out / 'notification-dimensions.png'))
        if c['id'] == 'ios:9D65D820-397C-4F6E-9A6E-D2689B0B7BD9':
            root = canvas.locator('[data-node-id="9D65D820-397C-4F6E-9A6E-D2689B0B7BD9"]')
            check('Tab Bar sample canvas is not painted', root.locator('rect').count() == 0)
            check('Tab Bar keeps five captions', all('Tab ' + str(x) in canvas.inner_html() for x in range(1, 6)))
            page.locator('.anatomy').screenshot(path=str(out / 'tab-bar-dimensions.png'))
        if c['family'] in ['checkboxes', 'radio-buttons'] and '/Dark/' in c['name']:
            before = canvas.screenshot()
            canvas.locator('text').evaluate_all('(els)=>els.forEach(e=>e.style.visibility="hidden")')
            check('dark ink is visibly painted ' + c['family'], changed(before, canvas.screenshot()) > 30)
        if c['family'] == 'date-time-pickers' and '/Light/' in c['name']:
            check('two-digit dates remain complete', all('>' + n + '</tspan>' in canvas.inner_html() for n in ['12', '20', '28', '30']))
        if c['family'] == 'steppers' and c['platform'] == 'ios':
            before = canvas.screenshot()
            targets = canvas.locator('g[mask*="frame-clip"]')
            check('Stepper uses capsule clipping', targets.count() > 0)
            # Some saved dark children already fit the capsule. Test the mask
            # using contrasting overflow, not an assumed source-pixel difference.
            canvas.evaluate('''root => {
                const svg=root.querySelector('svg'), target=svg.querySelector('g[mask*="frame-clip"]');
                const probe=document.createElementNS(svg.namespaceURI,'g');
                probe.id='clipping-probe'; probe.setAttribute('mask',target.getAttribute('mask'));
                probe.innerHTML='<rect width="'+svg.viewBox.baseVal.width+'" height="'+svg.viewBox.baseVal.height+'" fill="#ff0055"/>';
                svg.append(probe);
            }''')
            masked=canvas.screenshot()
            canvas.locator('#clipping-probe').evaluate('(e)=>e.removeAttribute("mask")')
            check('Stepper mask clips actual overflow pixels', changed(masked, canvas.screenshot()) > 100)
            canvas.locator('#clipping-probe').evaluate('(e)=>e.remove()')
    check('no browser runtime exceptions', not errors)
    page.set_viewport_size({'width': 390, 'height': 844})
    for fam, cid in [('notifications', 'macos:26CCF802-2D00-460F-A309-889BC71CE45B'), ('tab-bars', 'ios:9D65D820-397C-4F6E-9A6E-D2689B0B7BD9')]:
        open_case({'family': fam, 'id': cid})
        check('mobile width ' + fam, page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        page.screenshot(path=str(out / (fam + '-mobile.png')))
    (out / 'report.json').write_text(json.dumps({'mode': 'production-http', 'browser': args.browser, 'cases': len(cases), 'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2))
    browser.close()
