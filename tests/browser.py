#!/usr/bin/env python3
"""Browser regression checks. Normal mode exercises the built site over HTTP.
--offline-bundle allows rendering in a no-navigation environment; it substitutes
only the two local snapshot responses and digest calls, never the renderer.
"""
import argparse, base64, hashlib, io, json, os, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:4173/');ap.add_argument('--offline-bundle');ap.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium');args=ap.parse_args()
out=ROOT/'test-results'/args.browser;out.mkdir(parents=True,exist_ok=True)
checks=[]
def ok(name,condition):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as pw:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser=getattr(pw,args.browser).launch(**({'executable_path':executable} if executable and args.browser=='chromium' else {}),**({'args':['--no-sandbox']} if args.browser=='chromium' else {}))
    p=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
    errors=[]
    def page_error(error):
        detail = {'message':str(error), 'stack':error.stack, 'url':p.url}
        errors.append(detail)
        print('PAGE_ERROR',json.dumps(detail,ensure_ascii=False),flush=True)
        (out/'page-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
    p.on('pageerror',page_error)
    if args.offline_bundle:
        base=Path(args.offline_bundle)
        assets={f.name:base64.b64encode(f.read_bytes()).decode() for f in (base/'data').iterdir()}
        hashes={hashlib.sha256(f.read_bytes()).hexdigest():len(f.read_bytes()) for f in (base/'data').glob('*.gz')}
        p.set_content('<!doctype html><html lang="zh-CN"><head></head><body><div id="app"></div></body></html>')
        p.add_style_tag(content=next((base/'assets').glob('*.css')).read_text())
        p.evaluate('''({assets,hashes})=>{window.fetch=async url=>{const name=String(url).split('/').pop();if(!assets[name])throw Error('Unexpected offline request '+url);return new Response(Uint8Array.from(atob(assets[name]),c=>c.charCodeAt(0)),{status:200});};if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{digest:async(alg,bytes)=>{const h=Object.keys(hashes).find(h=>hashes[h]===bytes.byteLength);if(!h)throw Error('Unknown offline dataset');return Uint8Array.from(h.match(/../g),x=>parseInt(x,16)).buffer;}}});}''',{'assets':assets,'hashes':hashes})
        p.add_script_tag(content=next((base/'assets').glob('*.js')).read_text(),type='module')
    else:p.goto(args.url,wait_until='networkidle')
    p.wait_for_selector('.catalog-card',timeout=30000);p.wait_for_timeout(400)
    ok('36 component families',p.locator('.catalog-card').count()==36)
    ok('catalogue previews are lazy',p.locator('.catalog-card .preview-canvas>svg').count()<36)
    p.screenshot(path=str(out/'catalog-desktop.png'))
    p.get_by_label('筛选组件',exact=True).fill('开关');ok('family search',p.locator('.catalog-card').count()==1)
    p.get_by_label('筛选组件',exact=True).fill('')
    p.keyboard.press('Control+k');p.get_by_label('搜索全部规格').fill('Switch');p.keyboard.press('Enter');p.wait_for_selector('.detail-page')
    ok('keyboard global search navigates',p.locator('h1').inner_text()=='开关')
    def goto(path):
        p.evaluate('(s)=>location.hash=s',path);p.wait_for_timeout(240)
    def lenses():return p.locator('.preview-shell:not(.compact) .preview-canvas>svg').get_attribute('data-glass-count')
    goto('/components/switches?v=ios%3AC9E2DB96-FF45-4D0A-B39D-0BD026C86DD0')
    ok('source idle switch stays opaque',lenses()=='0')
    hit=p.locator('.switch-hit');b=hit.bounding_box();p.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);p.mouse.down();p.wait_for_timeout(150)
    ok('holding switch shows true pressed glass',lenses()=='1')
    p.screenshot(path=str(out/'switch-pressed-desktop.png'))
    p.mouse.up();p.wait_for_timeout(200)
    ok('release toggles and returns idle',lenses()=='0' and '/Off/' in p.locator('.preview-canvas>svg').get_attribute('aria-label'))
    p.locator('.switch-hit').focus();p.keyboard.press('Enter');p.wait_for_timeout(150)
    ok('switch is keyboard operable','/On/' in p.locator('.preview-canvas>svg').get_attribute('aria-label'))
    # A synthetic pointer has no native active ID. Capture failure must not break the state preview.
    p.locator('.switch-hit').dispatch_event('pointerdown',{'pointerId':999,'button':0,'isPrimary':True})
    p.wait_for_timeout(150)
    ok('inactive pointer capture safely falls back',lenses()=='1')
    p.evaluate("window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:999}))")
    p.wait_for_timeout(150)
    ok('uncaptured pointer cancellation restores idle without toggling',lenses()=='0' and '/On/' in p.locator('.preview-canvas>svg').get_attribute('aria-label'))
    b=p.locator('.switch-hit').bounding_box();p.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);p.mouse.down();p.wait_for_timeout(100)
    p.mouse.move(10,10);p.mouse.up();p.wait_for_timeout(150)
    ok('release outside the switch does not leave a stuck pressed state',lenses()=='0')
    p.locator('.under-preview button').click();p.wait_for_timeout(180)
    ok('pressed state is directly selectable',lenses()=='1' and 'Pressed' in p.locator('.under-preview').inner_text())
    ok('source optics are visible',p.locator('.optics-grid').first.inner_text().find('0.075')>=0)
    ok('dimension illustration has the same lens as the main preview',p.locator('.anatomy [data-glass-layer]').count()==1)
    ok('dimension illustration keeps the shadow blur',p.locator('.anatomy feGaussianBlur[stdDeviation="1.5"]').count()>0)
    p.locator('.anatomy').screenshot(path=str(out/'switch-dimensions.png'))
    p.get_by_label('预览背景',exact=True).select_option('plain');p.wait_for_timeout(150)
    p.locator('.preview-shell:not(.compact)').screenshot(path=str(out/'switch-pressed-plain.png'))
    ok('zero-blur lens still samples the actual switch track',lenses()=='1' and p.locator('.preview-canvas feDisplacementMap').count()==1)
    p.get_by_label('预览背景',exact=True).select_option('grid')
    # Displacement-only pixel regression: same blur, tint and shadows, zero just the refraction scale.
    p.wait_for_timeout(150)
    a=p.locator('.preview-canvas').screenshot()
    scales=p.locator('.preview-canvas feDisplacementMap').evaluate_all('(els)=>els.map(e=>e.getAttribute("scale"))')
    p.locator('.preview-canvas feDisplacementMap').evaluate_all('(els)=>els.forEach(e=>e.setAttribute("scale","0"))')
    p.wait_for_timeout(100);b=p.locator('.preview-canvas').screenshot()
    ok('actual refraction changes rendered pixels with blur held at zero',a!=b and any(float(x)>0 for x in scales))
    (out/'refraction-on.png').write_bytes(a);(out/'refraction-zero.png').write_bytes(b)
    p.get_by_role('button',name='平面',exact=True).click();ok('flat mode removes refraction filter',p.locator('.preview-canvas feDisplacementMap').count()==0)
    p.get_by_role('button',name='折射',exact=True).click();p.get_by_label('预览背景',exact=True).select_option('aurora')
    before=p.locator('.preview-canvas').inner_html();p.get_by_label('预览背景位置').fill('60');p.wait_for_timeout(100)
    ok('backdrop can move beneath the lens',before!=p.locator('.preview-canvas').inner_html())
    with p.expect_download() as d:p.get_by_role('button',name='JSON ↓',exact=True).click()
    path=d.value.path();saved=json.loads(Path(path).read_text());r=next(r for r in saved['materials']['records'] if any(b['type']==4 and b['isEnabled'] for b in r['recipe'].get('blurs',[])))
    ok('component export preserves zero blur and nested provenance',r['recipe']['blurs'][0]['radius']==0 and bool(r['chain']) and saved['source']['id']=='ios')
    goto('/components/sliders');p.locator('#materials').scroll_into_view_if_needed();p.wait_for_timeout(150)
    ok('slider glass states are linked',p.locator('#materials .inline-links button').count()>0)
    p.locator('#materials .inline-links button').first.click();p.wait_for_timeout(150)
    ok('slider pressed subpart renders glass',int(lenses())>=1)
    goto('/materials/liquid-glass?platform=ios');p.wait_for_selector('.material-page')
    options=p.get_by_label('共享材质预设');ok('19 iOS shared presets',options.locator('option').count()==19)
    options.select_option(label='Light / Regular - Medium');p.wait_for_timeout(120)
    ok('iOS Medium source radius is 15',p.locator('.optics-grid strong').first.inner_text()=='15')
    p.get_by_role('button',name='macOS',exact=True).click();p.get_by_label('共享材质预设').select_option(label='Light / Regular - Medium');p.wait_for_timeout(150)
    ok('macOS Medium source radius is 30',p.locator('.optics-grid strong').first.inner_text()=='30')
    ok('19 macOS records including duplicate names',p.get_by_label('共享材质预设').locator('option').count()==19)
    p.screenshot(path=str(out/'materials-desktop.png'))
    p.get_by_label('共享材质预设').select_option(label='Light / Regular - Small - Inactive');p.wait_for_timeout(150)
    ok('inactive material does not fabricate glass',lenses()=='0')
    goto('/materials/liquid-glass?platform=ios');p.get_by_label('搜索局部材质').fill('Toggles');p.locator('.local-material').first.click();p.wait_for_timeout(150)
    ok('local switch material is independently selectable','组件局部材质' in p.locator('.material-preview-heading').inner_text())
    # All public family routes, with controlled waiting and no legacy page HTML.
    goto('/components');p.wait_for_selector('.catalog-card')
    links=p.locator('.catalog-card').evaluate_all('(els)=>els.map(e=>e.getAttribute("href").slice(1))')
    for link in links:
        goto(link);ok('route '+link,p.locator('.detail-page').count()==1)
    goto('/typography');ok('typography table retained',p.locator('tbody tr').count()>10)
    goto('/sources');ok('process notes are collapsed into useful source reference',p.locator('.reading h1').inner_text()=='来源与单位')
    goto('/components/switches?v=ios%3A2637E1F2-0B94-437F-8970-32446A4EBEFF');p.get_by_label('切换深浅色').click();p.wait_for_timeout(150)
    ok('dark shell',p.locator('html').get_attribute('data-theme')=='dark');p.screenshot(path=str(out/'dark-desktop.png'))
    p.get_by_label('切换深浅色').click();p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(250)
    ok('mobile has no document overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    p.screenshot(path=str(out/'switch-mobile.png'))
    p.get_by_label('组件导航',exact=True).click();ok('mobile sidebar opens',p.locator('.sidebar').get_attribute('class').find('open')>=0)
    p.locator('.sidebar a[href="#/components/buttons"]').click();p.wait_for_timeout(150)
    ok('mobile navigation closes after selection','open' not in p.locator('.sidebar').get_attribute('class'))
    goto('/materials/liquid-glass');ok('mobile material page no overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    p.screenshot(path=str(out/'materials-mobile.png'))
    goto('/does-not-exist');ok('unknown route has readable fallback','未找到' in p.locator('h1').inner_text())
    print('PAGE_ERRORS',json.dumps(errors,ensure_ascii=False),flush=True)
    ok('no runtime exceptions',not errors)
    report={'browser':args.browser,'mode':'offline-render' if args.offline_bundle else 'production-http','checks':len(checks),'passed':checks,'errors':errors}
    (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'checks':len(checks),'errors':errors,'mode':report['mode']},ensure_ascii=False));browser.close()
