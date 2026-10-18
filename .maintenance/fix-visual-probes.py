"""Make pixel regressions test clipping/refraction, not backdrop contrast luck."""
from pathlib import Path
p=Path('tests/visual-review.py');s=p.read_text()
s=s.replace("args = parser.parse_args()", "parser.add_argument('--focused', action='store_true', help='Cross-engine layout risk cases; Chromium runs the full ledger')\nargs = parser.parse_args()")
s=s.replace("checks, errors = [], []", "if args.focused:\n    cases = [c for c in cases if c['family'] in {'tab-bars','notifications','steppers','checkboxes','radio-buttons','date-time-pickers','popovers','alerts','activity-views','windows'}]\nchecks, errors = [], []")
old="""            targets.evaluate_all('(els)=>els.forEach(e=>e.removeAttribute(\"mask\"))')
            check('Stepper clipping changes actual pixels', changed(before, canvas.screenshot()) > 5)"""
new="""            # Some saved dark children already fit the capsule. Test the mask
            # using contrasting overflow, not an assumed source-pixel difference.
            canvas.evaluate('''root => {
                const svg=root.querySelector('svg'), target=svg.querySelector('g[mask*=\"frame-clip\"]');
                const probe=document.createElementNS(svg.namespaceURI,'g');
                probe.id='clipping-probe'; probe.setAttribute('mask',target.getAttribute('mask'));
                probe.innerHTML='<rect width=\"'+svg.viewBox.baseVal.width+'\" height=\"'+svg.viewBox.baseVal.height+'\" fill=\"#ff0055\"/>';
                svg.append(probe);
            }''')
            masked=canvas.screenshot()
            canvas.locator('#clipping-probe').evaluate('(e)=>e.removeAttribute(\"mask\")')
            check('Stepper mask clips actual overflow pixels', changed(masked, canvas.screenshot()) > 100)
            canvas.locator('#clipping-probe').evaluate('(e)=>e.remove()')"""
assert old in s;s=s.replace(old,new);p.write_text(s)
p=Path('tests/materials-browser.py');s=p.read_text()
s=s.replace('    tested_pixels=set()','    tested_pixels=set(); probe_pixels=set()')
old="""                ok(tag+' effect changes real rendered pixels',ImageChops.difference(a,flat).getbbox() is not None)
                p.get_by_role('button',name='折射',exact=True).click();p.get_by_label('预览背景',exact=True).select_option('aurora');tested_pixels.add(c['family'])"""
new="""                natural=ImageChops.difference(a,flat).getbbox() is not None
                p.get_by_role('button',name='折射',exact=True).click();p.wait_for_timeout(80)
                if not natural:
                    # A lens over an opaque uniform child may have no visible
                    # displacement. Supply texture to the same sampled backdrop,
                    # keeping the real filter, clipping, fills and blur unchanged.
                    count=canvas.evaluate('''root=>{
                        const svg=root.querySelector('svg');
                        svg.querySelector('defs').insertAdjacentHTML('beforeend','<pattern id=\"contrast-probe\" patternUnits=\"userSpaceOnUse\" width=\"12\" height=\"12\"><rect width=\"12\" height=\"12\" fill=\"white\"/><path d=\"M0 0h6v6H0z M6 6h6v6H6z\" fill=\"black\"/></pattern>');
                        let n=0;
                        for(const lens of svg.querySelectorAll('[data-glass-layer]')){
                            const use=lens.querySelector('g[filter] use');
                            if(!use)continue;
                            const source=svg.querySelector(use.getAttribute('href'));
                            if(!source)continue;
                            source.innerHTML='<rect width=\"'+svg.viewBox.baseVal.width+'\" height=\"'+svg.viewBox.baseVal.height+'\" fill=\"url(#contrast-probe)\"/>';n++;
                        }return n;
                    }''')
                    ok(tag+' contrast probe reaches the sampled backdrop',count>0)
                    textured=Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
                    canvas.locator('feDisplacementMap').evaluate_all('(els)=>els.forEach(e=>e.setAttribute(\"scale\",\"0\"))')
                    zero=Image.open(io.BytesIO(canvas.screenshot())).convert('RGB')
                    ok(tag+' refraction changes textured pixels with blur fixed',ImageChops.difference(textured,zero).getbbox() is not None)
                    probe_pixels.add(c['family'])
                else:ok(tag+' effect changes real rendered pixels',True)
                p.get_by_label('预览背景',exact=True).select_option('aurora');tested_pixels.add(c['family'])"""
assert old in s;s=s.replace(old,new)
s=s.replace("'pixelCheckedFamilies':sorted(tested_pixels)","'pixelCheckedFamilies':sorted(tested_pixels),'contrastProbeFamilies':sorted(probe_pixels)")
p.write_text(s)
print('Pixel tests now explicitly exercise clipping overflow and refraction on contrasting backdrops.')
