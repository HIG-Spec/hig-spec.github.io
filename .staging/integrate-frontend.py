"""One-time, digest-verified source migration on the feature branch."""
import base64, gzip, hashlib, json, lzma, re, shutil
from pathlib import Path

sha256 = lambda b: hashlib.sha256(b).hexdigest()
expected = ['889bd2b71689778e28f01e84e92dd4b117bb53b6','803c4c58232c5e4ae68b880884a6f0b7171e8af9','d4eece59a91a2aae971dd661787f2da0018b6c28','e6e776c59e39c61e9fd037e5196790f87856531a','612c5fe32bef7fa3ea370884ec16969aefdb95bd','f1fd7fcd4c196a6369afc94fb73b947c4c7f670d','6df55400590365a915141b37ccd6121186c86c5c']
parts = []
for i, want in enumerate(expected):
    b = ''.join(Path(f'.staging/frontend-{i:02d}.b64').read_text().split()).encode('ascii')
    actual = hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
    print(i, len(b), actual, flush=True)
    assert actual == want, f'Invalid transfer part {i}'
    parts.append(b)
raw = lzma.decompress(base64.b64decode(b''.join(parts), validate=True))
assert sha256(raw) == '8e929c27a5286bb11abdfb213798969f1e8aa5b5645176c05e0a2df372a57c6f'
files = json.loads(raw)
assert len(files) == 48
html = Path('index.html').read_text(encoding='utf-8')
encoded = re.search(r'<script[^>]*id="geometry-payload"[^>]*>(.*?)</script>', html, re.S).group(1).strip()
geometry = base64.b64decode(encoded, validate=True)
assert sha256(geometry) == '5fcf831e72a3e2e973481e0613bd1a9ab587436c80fcd2d88b3af82ddfb9010d'
scripts = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', html, re.S)
code = next(s for s in scripts if 'const G = (() =>' in s and '// Editorial layer:' in s)
code = code[:code.index('// Editorial layer:')]
assert sha256(code.encode()) == 'c4612f818e261ead6c69609aa205e0d5a7df2090b4125a1e8a194cfab1d5b19f'
old_mat = Path('assets/materials-data.js').read_text()
old_mat = json.loads(gzip.decompress(base64.b64decode(re.search(r'=\s*"([A-Za-z0-9+/=]+)"', old_mat).group(1))))
# Cache every old input before writing any replacement.
bases = {entry['base']: (code if entry['base']=='__geometry_code__' else Path(entry['base']).read_text(encoding='utf-8')) for entry in files.values() if 'base' in entry}
outputs = {}
for name, entry in files.items():
    if name == '__material_delta__': continue
    path = Path(name)
    assert not path.is_absolute() and '..' not in path.parts and path.parts[0] not in ('.github','.staging')
    if 'value' in entry:
        text = entry['value']
    else:
        base = bases[entry['base']]
        assert sha256(base.encode()) == entry['baseSHA256'], name
        text = ''.join(base[op[0]:op[1]] if isinstance(op,list) else op for op in entry['ops'])
    assert isinstance(text,str)
    outputs[name] = text
material = files['__material_delta__']['value']
material['recipes'] = [old_mat['recipes'][r] if isinstance(r,int) else r for r in material['recipes']]
mraw = (json.dumps(material,ensure_ascii=False,separators=(',',':'))+'\n').encode()
assert sha256(mraw) == '39d5d5d2f61b4808110c246fc8617204abd0f966c26d5bd22cc0c5f3998689df'
for name,text in outputs.items():
    path=Path(name);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8')
Path('public/data/geometry.json.gz').write_bytes(geometry)
mcompressed = gzip.compress(mraw,mtime=0)
Path('public/data/materials.json.gz').write_bytes(mcompressed)
manifest = json.loads(Path('public/data/manifest.json').read_text())
manifest['materials'] = sha256(mcompressed)
Path('public/data/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Obsolete generated monolith assets and in-place HTML patching tools.
shutil.rmtree('assets')
for old in ['tools/apply-material-specs.py','tools/apply-symbol-fix.py','tests/materials.test.cjs','tests/symbols.test.cjs']:
    Path(old).unlink()
print('Verified 47 source files and both snapshots. Geometry unchanged. Material support bindings:',material['counts'])
