"""Apply audited source border additions and the shared per-side painter."""
import base64, gzip, hashlib, json, re
from pathlib import Path

DELTA = 'H4sIAAAAAAAC/+1c227bOBD9lYVe1wo4vIhk3iRfgCxabIH0rSgWis3EwiqSISnbBoX/fSnJlsmYSFpst+hl8qQ5M5rhDMkztCznU9SYdbEzbXT57lN0Uz40/dX7WXRblOUI/rUu89ZeDlA0i4p2WeU3pdlEl13zYEbTt487E12SWbSuy7qJLp3bRmQW5eVum0eXMOvDmOHirjGmGq6a3h3s+/urznzsrk3XFdVd63m6a/Ldtli38yc2vUdTbV7Xm3EM9S5fF93j4Lho3zS1jdO2xT9We5uXrdn3kfNNYaruqf8RPKRxZcM0u7rMu6KuBs+mLHateWWqu247ALdNfW/v/EQuxOw3so9OnqeKdPVkAL1B29W7J5U93nNtVdZiV7fFFPK/FXQ/+5ww8CVhyBSGHMKQ/f69rWlVF625qjbm46A6iJ2p2mEyLLTLO1vRajUtGJiwt0Vprtd5OYJl/mgaO7ejFd3bBdlu80394bA6b+pmY5onVRzBr7hCyQWlkguiFWGagpCnzC8o6IRIxRkwSYU4VuIcbz/k3Xp7tbBxFJurzDqMFeFZzLkksWYqiTMg1n5JeUp4hHvgR94Dnr/OTtTflek99alHbbEx/my+vr66v3/o+sV63T2WJhuW8PVgZ3eBue2uqtbYGWIXnFBFGU8SpgRV2vzOlA1d3G1fMLF5Pm9wU3ddfX+w6dP4ZgtwqG7vp6nL9rzuk8bb0cPNNtiQ+qG444ibvO2GcNvDFLV599AcFm7fW0aC+HPXI348XxNgkE3ebt+MTDUy0Nr0G2Nh4X5KR6OyqMw83w0zOQygB/6oi+qIDEsRmywSDDZZp8lO3ZJrYrun02SlTGyTFMqSlqCaT032DHeaLJvPAcSCxCsCIuaKk1jRhYiXhM4TzeecLzJssthksclik8UmiwTzMzdZcgH0mZp6fTOVaSYXKcSZXKYxn8+zOOUkjcUipSlZZAuSEeyb2Dexb2LfxL6JBPOr9M1Asl7f1CulUvvZMk4Taj9vziGLM5DLWJJE8iXT88Uyxb6JfRP75i/WN/E7K6Q3pLfn6Y18KZUFbZDefiF6w28LkN6Q3pDefiZ6w+e0yFhBxqIeYwF+2kS++t74Cp+PIV8hXyFfIV8hXyFfIV9NWxTpCukK6ep/fICFdIXHK3x8hXyFxyvkqx+Eryier5CvkK+Qr5Cvvoyv8JXpr0s+L5T069HPS4Gef0MhsX/IQvgp7/tgISI+99QElKQaliIWGZcxXle4yK8VrA=='
# The complete delta is read from a separately verified payload below.
DATA_PATH = Path('public/data/materials.json.gz')
OLD = 'b69476cb95516e6f02932dd0aedc38cbad105efa6601971496887fd0adf9a71e'
NEW = '09adc6f9d5a126e1ac0547404832c98107f771c47bf9e1d58f152a211bc02e62'
encoded = ''.join(Path('.maintenance/border-delta.b64').read_text().split())
raw = DATA_PATH.read_bytes()
if hashlib.sha256(raw).hexdigest() != NEW:
    assert hashlib.sha256(raw).hexdigest() == OLD
    delta = json.loads(gzip.decompress(base64.b64decode(encoded, validate=True)))
    data = json.loads(gzip.decompress(raw))
    assert len(data['recipes']) == 198
    data['recipes'].extend(delta['recipes'])
    data['bindings'].update(delta['bindings'])
    data['counts'] = delta['counts']
    raw = gzip.compress((json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode(),mtime=0)
    assert hashlib.sha256(raw).hexdigest() == NEW
    DATA_PATH.write_bytes(raw)
manifest = Path('public/data/manifest.json')
m = json.loads(manifest.read_text()); m['materials'] = NEW
manifest.write_text(json.dumps(m,indent=2)+'\n')

def edit(path, old, new):
    p=Path(path); text=p.read_text()
    if new in text: return
    assert old in text, path
    p.write_text(text.replace(old,new))

edit('tools/extract-materials.py','    pool = {}','    pool = {}\n    per_side = []')
edit('tools/extract-materials.py', '                if isglass or has_effect or complex_border:\n', "                if any(b.get('isEnabled') and b.get('sides') for b in v.get('borders', [])) and not (isglass or has_effect or complex_border):\n                    per_side.append((ci, ni, material(v), styleidx.get(sid)))\n                if isglass or has_effect or complex_border:\n")
edit('tools/extract-materials.py', "    result['counts']=", "    # Append supplementary border recipes without renumbering existing bindings.\n    for ci, ni, value, sid in per_side:\n        rows = result['bindings'].setdefault(str(ci), [])\n        rows.append([ni, intern(value), sid])\n        rows.sort(key=lambda row: row[0])\n    result['counts']=")
edit('tests/materials.test.mjs','assert.equal(n, 1933)','assert.equal(n, 2043)')
edit('tests/materials.test.mjs','Object.keys(data.bindings).length, 1342','Object.keys(data.bindings).length, 1398')
edit('docs/material-specs.md','198 distinct effect recipes and 1,933 directly bound effect-bearing layers in 1,342 definitions','214 distinct effect recipes and 2,043 directly bound effect-bearing layers in 1,398 definitions')
edit('docs/material-specs.md','**1,933 is not','**2,043 is not')

p=Path('src/rendering/surface.ts');text=p.read_text()
if 'data-border-side' not in text:
    start=text.index('    body += rect(', text.index('(recipe.borders ?? [])'))
    end=text.index('\n  });',start)
    text=text[:start]+'''    if (b.sides && ['rectangle', 'group', 'symbolMaster', 'bitmap'].includes(n.type)) {
      // These snapshots use zero for an enabled side and FLT_MAX for a disabled one.
      // Keep saved side fields in specs; never close a one-sided border.
      const w=n.f[2], h=n.f[3];
      const sides=[['top', `M0 ${inset}H${w}`], ['right', `M${w-inset} 0V${h}`],
        ['bottom', `M0 ${h-inset}H${w}`], ['left', `M${inset} 0V${h}`]];
      for (const [side,d] of sides) {
        const offset=b.sides[side+'Inset'] ?? 0;
        const thickness=Math.max(0,t-offset);
        if (thickness>0) body+=`<path d="${d}" data-border-side="${side}" fill="none" stroke="${paint(b,'b'+i+'-'+side)}" stroke-width="${thickness}" ${blend(b)}/>`;
      }
    } else body += rect(
      `fill="none" stroke="${paint(b, 'b' + i)}" stroke-width="${t}" ${blend(b)}`,
      inset,
    );'''+text[end:]
    p.write_text(text)
p=Path('tests/all-materials.test.mjs');text=p.read_text()
if 'source per-side borders' not in text:
    text+='''\ntest('source per-side borders are retained and never painted as a closed outline',()=>{
 const c=named('Sliders/Light/Glyphs/Mid - 1 - Enabled');
 const record=M.resolve(c).records.find(r=>r.recipe.borders?.some(b=>b.sides));
 assert.ok(record);assert.equal(record.recipe.borders[0].sides.bottomInset,0);
 assert.ok(record.recipe.borders[0].sides.leftInset>1e30);
 const svg=renderScene(c);assert.match(svg,/data-border-side="bottom"/);
 assert.doesNotMatch(svg,/data-border-side="top"/);
});\n'''
    p.write_text(text)
p=Path('docs/rendering.md');text=p.read_text()
if 'per-side border fields on 122 layers' not in text:
    p.write_text(text+'\nThe source audit also retains per-side border fields on 122 layers. Missing\nside metadata previously turned single bottom/right separators into rectangular\noutlines. The material snapshot adds the 110 missing bindings; existing source\ngeometry, glass recipes and parameter values remain unchanged.\n')
print('Source-backed per-side borders integrated; geometry and glass values unchanged.')
