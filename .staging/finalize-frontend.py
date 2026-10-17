from pathlib import Path
import json

p = Path('README.md')
p.write_text(p.read_text().replace('pythontests/', 'python tests/').replace('pythontools/', 'python tools/').replace('-rtests/', '-r tests/'))
p = Path('package.json')
data = json.loads(p.read_text())
data['devDependencies']['vite'] = '7.3.7'
data['scripts']['dev'] = 'vite --host 127.0.0.1'
data['scripts']['preview'] = 'vite preview --host 127.0.0.1'
p.write_text(json.dumps(data, indent=2) + '\n')

p = Path('src/components/LivePreview.vue')
text = p.read_text()
old = "function press(e:PointerEvent) {if(!switchable.value)return;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);previous=props.component;active.value=true;const p=statePartner(previous,true);if(p)emit('state',p);}"
new = """let activePointer:number|undefined;
function press(e:PointerEvent) {
 if(!switchable.value||e.button!==0||active.value)return;
 // Capture is optional: WebKit may already have retired this pointer ID.
 // Window-level release/cancel listeners keep an uncaptured drag from sticking.
 try {(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);}
 catch(error) {if(!(error instanceof DOMException)||error.name!=='NotFoundError')throw error;}
 activePointer=e.pointerId;previous=props.component;active.value=true;
 const p=statePartner(previous,true);if(p)emit('state',p);
}
function finishPointer(e:PointerEvent){if(e.pointerId===activePointer)release(e.type==='pointercancel');}
function cancelPress(){release(true);}
"""
assert old in text
text = text.replace(old,new)
text = text.replace("active.value=false;emit('state',null);", "active.value=false;activePointer=undefined;emit('state',null);")
text = text.replace("onMounted(()=>{observer=", "onMounted(()=>{window.addEventListener('pointerup',finishPointer);window.addEventListener('pointercancel',finishPointer);window.addEventListener('blur',cancelPress);observer=")
text = text.replace("onBeforeUnmount(()=>{observer?.disconnect();intersection?.disconnect();});", "onBeforeUnmount(()=>{window.removeEventListener('pointerup',finishPointer);window.removeEventListener('pointercancel',finishPointer);window.removeEventListener('blur',cancelPress);cancelAnimationFrame(resizeFrame);observer?.disconnect();intersection?.disconnect();});")
assert "window.removeEventListener('pointerup',finishPointer)" in text
old_resize = "new ResizeObserver(entries=>{width.value=Math.max(120,Math.floor(entries[0].contentRect.width));})"
new_resize = """new ResizeObserver(entries=>{
 const nextWidth=Math.max(120,Math.floor(entries[0].contentRect.width));
 if(nextWidth===width.value)return;
 // The SVG depends on this width. Never resize it inside an observer delivery.
 cancelAnimationFrame(resizeFrame);
 resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;width.value=nextWidth;});
})"""
assert old_resize in text
text = text.replace(old_resize,new_resize).replace('let intersection:IntersectionObserver|undefined;', 'let resizeFrame=0;\nlet intersection:IntersectionObserver|undefined;')
p.write_text(text)

p = Path('tests/browser.py')
text = p.read_text()
text = text.replace("errors=[];p.on('pageerror',lambda e:errors.append(str(e)))", """errors=[]
    def page_error(error):
        detail = {'message':str(error), 'stack':error.stack, 'url':p.url}
        errors.append(detail)
        print('PAGE_ERROR',json.dumps(detail,ensure_ascii=False),flush=True)
        (out/'page-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
    p.on('pageerror',page_error)""")
assert "def page_error(error):" in text
text = text.replace("ok('no runtime exceptions',not errors)", "print('PAGE_ERRORS',json.dumps(errors,ensure_ascii=False),flush=True)\n    ok('no runtime exceptions',not errors)")
needle = "    p.locator('.under-preview button').click();p.wait_for_timeout(180)"
replacement = """    # A synthetic pointer has no native active ID. Capture failure must not break the state preview.
    p.locator('.switch-hit').dispatch_event('pointerdown',{'pointerId':999,'button':0,'isPrimary':True})
    p.wait_for_timeout(150)
    ok('inactive pointer capture safely falls back',lenses()=='1')
    p.evaluate("window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:999}))")
    p.wait_for_timeout(150)
    ok('uncaptured pointer cancellation restores idle without toggling',lenses()=='0' and '/On/' in p.locator('.preview-canvas>svg').get_attribute('aria-label'))
    b=p.locator('.switch-hit').bounding_box();p.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);p.mouse.down();p.wait_for_timeout(100)
    p.mouse.move(10,10);p.mouse.up();p.wait_for_timeout(150)
    ok('release outside the switch does not leave a stuck pressed state',lenses()=='0')
    p.locator('.under-preview button').click();p.wait_for_timeout(180)"""
assert needle in text
text = text.replace(needle,replacement)
p.write_text(text)
