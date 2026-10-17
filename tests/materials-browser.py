#!/usr/bin/env python3
"""Exercise every family/platform representative, plus composed child states.
Use --offline-bundle only for local screenshots; CI uses the real HTTP build.
"""
import argparse, base64, hashlib, io, json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
ROOT=Path(__file__).resolve().parent.parent
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:4173/');ap.add_argument('--browser',default='chromium',choices=['chromium','firefox','webkit']);ap.add_argument('--offline-bundle');args=ap.parse_args()
report=json.loads((ROOT/'test-results/material-coverage.json').read_text())
out=ROOT/'test-results'/('materials-'+args.browser);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def ok(name,condition):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as pw:
    exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    b=getattr(pw,args.browser).launch(**({'executable_path':exe,'args':['--no-sandbox']} if args.browser=='chromium' and exe else {}))
    p=b.new_page(viewport={'width':1280,'height':940},device_scale_factor=1,accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)))
    if args.offline_bundle:
        base=Path(args.offline_bundle);assets={f.name:base64.b64encode(f.read_bytes()).decode() for f in (base/'data').iterdir()};hashes={hashlib.sha256(f.read_bytes()).hexdigest():len(f.read_bytes()) for f in (base/'data').glob('*.gz')}
        p.set_content('<!doctype html><html><head></head><body><div id="app"></div></body></html>');p.add_style_tag(content=next((base/'assets').glob('*.css')).read_text())
        p.evaluate('''({assets,hashes})=>{window.fetch=async url=>new Response(Uint8Array.from(atob(assets[String(url).split('/').pop()]),c=>c.charCodeAt(0)));if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{digest:async(_,bytes)=>Uint8Array.from(Object.keys(hashes).find(h=>hashes[h]===bytes.byteLength).match(/../g),x=>parseInt(x,16)).buffer}})}''',{'assets':assets,'hashes':hashes})
        p.add_script_tag(content=next((base/'assets').glob('*.js')).read_text())
    else:p.goto(args.url,wait_until='networkidle')
    p.wait_for_selector('.catalog-card')
    def goto(route):
        p.evaluate('(r)=>location.hash=r',route);p.wait_for_selector('.detail-page');p.wait_for_timeout(150)
    tested_pixels=set()
    for c in report['cases']:
        goto(c['route']);tag=c['family']+'-'+c['platform'];canvas=p.locator('.preview-shell:not(.compact) .preview-canvas');svg=canvas.locator(':scope > svg')
        ok(tag+' full preview matches source glass count',int(svg.get_attribute('data-glass-count'))==c['glass'])
        ok(tag+' dimensions share material rendering',int(p.locator('.anatomy svg[data-glass-count]').get_attribute('data-glass-count'))==c['glass'])
        if c['glass']:
            canvas.screenshot(path=str(out/(tag+'.png')))
            if c['family'] not in tested_pixels:
                p.get_by_label('预览背景',exact=True).select_option('grid');p.wait_for_timeout(80);a=Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
                p.get_by_role('button',name='平面',exact=True).click();p.wait_for_timeout(80);flat=Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
                ok(tag+' effect changes real rendered pixels',ImageChops.difference(a,flat).getbbox() is not None)
                p.get_by_role('button',name='折射',exact=True).click();p.get_by_label('预览背景',exact=True).select_option('aurora');tested_pixels.add(c['family'])
    for family in ['sliders','segmented-controls']:
        goto('/components/'+family)
        ok(family+' idle is not forcibly glassified',p.locator('.preview-canvas>svg').get_attribute('data-glass-count')=='0')
        hit=p.locator('.interaction-hit');hit.dispatch_event('pointerdown',{'pointerId':999,'button':0})
        ok(family+' holding selects child press state',int(p.locator('.preview-canvas>svg').get_attribute('data-glass-count'))>0)
        p.evaluate("window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:999}))")
        ok(family+' cancellation restores original',p.locator('.preview-canvas>svg').get_attribute('data-glass-count')=='0')
        p.locator('.interaction-states button').nth(1).click();p.wait_for_timeout(100)
        with p.expect_download() as saved:p.get_by_role('button',name='JSON ↓',exact=True).click()
        data=json.loads(Path(saved.value.path()).read_text());ok(family+' export distinguishes source and composed state',data['component']['id']==data['previewComposition']['sourceComponent'] and bool(data['previewComposition']['substitutions']))
        canvas=p.locator('.preview-shell:not(.compact) .preview-canvas');canvas.screenshot(path=str(out/(family+'-context.png')))
        if family=='segmented-controls':ok('segmented labels survive state swap',all('Item '+str(i) in canvas.inner_html() for i in range(1,6)))
    p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(200);ok('mobile material-state controls do not overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    p.screenshot(path=str(out/'mobile.png'));ok('no runtime errors',not errors);b.close()
(out/'report.json').write_text(json.dumps({'checks':checks,'errors':errors,'familyPlatformCases':len(report['cases']),'pixelCheckedFamilies':sorted(tested_pixels)},indent=2))
print(json.dumps({'checks':len(checks),'pixelCheckedFamilies':len(tested_pixels)}))
