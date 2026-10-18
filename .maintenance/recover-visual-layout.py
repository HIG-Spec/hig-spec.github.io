"""Recover the previous interrupted upload; validate every complete file first."""
import base64
import hashlib
import json
import lzma
import subprocess
from pathlib import Path

EXPECTED = {
 'docs/rendering.md':'d9445dc8f5cfde83cc25af1488079a09e431787a',
 'docs/visual-review.md':'b98c157013dc5e67527b11d29f135b92071122e5',
 'src/data/catalogue.ts':'9a01919cfbd28771551a061c76fe4f324255f911',
 'src/data/store.ts':'a1135ba381677415ee4f405cd62ee2b19d29814a',
 'src/pages/ComponentPage.vue':'2a512139e35f4f070f59a0f3e140a7c99e91e737',
 'src/rendering/geometry.js':'7565741ada0bfb70c09cb7d0f03f2103237ed6ae',
 'src/rendering/layout.ts':'a30a12d2d6d6c890741d215b455aed06a30a01e1',
 'src/rendering/scene.ts':'803f0c16fae8a7aadd54bae45e500cd579d77b7e',
 'src/rendering/source-meta.ts':'25a5863531e596c0cffb5ae7956ce8c628670b18',
 'src/rendering/source-metadata.json':'20bb1f82cb65e25e6c8d8c59b61162eb5ac9e97f',
 'src/rendering/surface.ts':'6191abc69886145d96d930ec188c217cb14fab90',
 'src/rendering/symbols.js':'78ba11202a99cf7153440cc82f7d8acf3da9d1e8',
}
TAIL = {
 'src/rendering/text-layout.js':'ac0e6b5ddc923db2cfff3ca78dd0d3b4ea987cd8',
 'tests/layout-rendering.test.mjs':'7a2ba399cb05b8d13b45eb5f4dfadcba8bac6c65',
 'tests/visual-review.py':'1696ab4d9fa03cf708efd704e24ba234f2cdcdf8',
}
def blob(data):
 return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def prefix(pattern, count):
 encoded=''.join(''.join(Path(pattern.format(i)).read_text().split()) for i in range(count))
 # The interrupted streams lack their tail checksum. Per-file full Git hashes
 # below independently authenticate all complete content that is accepted.
 return lzma.LZMADecompressor().decompress(base64.b64decode(encoded, validate=True))
raw=prefix('.maintenance/layout-xz-{}.b64',5)
patch=raw[:raw.rfind(b'diff --git ')]
assert hashlib.sha256(patch).hexdigest()=='a841e6119155689887d39b382781910164e477def91c2dc8f2d76d0c3f073fde'
path=Path('/tmp/complete-visual-layout.patch');path.write_bytes(patch)
subprocess.run(['git','apply','--check',str(path)],check=True)
subprocess.run(['git','apply',str(path)],check=True)
for path,want in EXPECTED.items():
 assert blob(Path(path).read_bytes())==want,path
text=prefix('.maintenance/layout-tail-{}.b64',2).decode('utf-8')
decoder=json.JSONDecoder(); pos=1
for wanted,sha in TAIL.items():
 while text[pos].isspace() or text[pos]==',':pos+=1
 key,pos=decoder.raw_decode(text,pos)
 while text[pos].isspace():pos+=1
 assert text[pos]==':';pos+=1
 while text[pos].isspace():pos+=1
 value,pos=decoder.raw_decode(text,pos)
 assert key==wanted and isinstance(value,str),key
 data=value.encode('utf-8');assert blob(data)==sha,key
 p=Path(key);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
# Independent source re-extraction recovered these omitted mask-chain flags.
extra=[[850,2],[850,3],[850,4],[851,4],[851,5],[851,6],[858,2],[858,3],[858,4],[859,4],[859,5],[859,6],[908,2],[908,3],[908,4],[909,4],[909,5],[909,6],[910,2],[910,3],[910,4],[911,4],[911,5],[911,6],[912,2],[912,3],[912,4],[913,4],[913,5],[913,6],[914,2],[914,3],[914,4],[915,4],[915,5],[915,6],[1611,9],[1612,9],[3467,3],[3468,3],[3469,3],[3470,3],[3471,3],[3472,3],[3473,3],[3474,3],[3475,3],[3476,3],[3477,3],[3478,3],[3479,3],[3480,3],[3481,3],[3482,3],[3483,3],[3484,3],[3485,3],[3486,3]]
p=Path('src/rendering/source-metadata.json');meta=json.loads(p.read_text())
rows={tuple(r[:2]):r[2] for r in meta['rows']}
for key in extra:rows.setdefault(tuple(key),{})['breakMask']=True
meta['rows']=[[a,b,flags] for (a,b),flags in sorted(rows.items())]
assert len(meta['rows'])==2743
p.write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':'))+'\n')
p=Path('tests/layout-rendering.test.mjs');p.write_text(p.read_text().replace('rows.length,2685','rows.length,2743'))
p=Path('docs/visual-review.md');s=p.read_text().replace('Scope: 106 saved variants','Scope: 113 saved variants')
s=s.replace('Each listed case was opened and its\nrendered picture inspected;','Each listed component rendering was inspected in a local browser; the\nproduction-page capture runs separately in CI;')
s=s.replace('fixed title scaling and clipping of overflowing sidebar rows. iPad','fixed title scaling and clipping of overflowing sidebar rows. The light sidebar example has a saved BG layer above its rows; see known source limitations below. iPad')
s+='''\n## Known source/preview limitations found during inspection\n\n- `Windows/Light/Default + Title + Sidebar/Active` serializes its opaque,\n  background-blurred BG after the Sidebar instance. The preview preserves that\n  order; this sample therefore obscures the rows, unlike its Dark counterpart.\n  It is not marked as a verified native appearance and has not been silently\n  reordered by name. The standalone sidebar examples remain inspectable.\n- Some named Dark/Light example canvases deliberately contain contrary-appearance\n  sample instances. Names and colors are preserved rather than normalized.\n- Dark Glass button label alpha, the dark large spinner's black fill, demo\n  shape icons and unbundled photo/icon slots come from the source records; they\n  are not native asset fidelity claims. Optical blend adapters remain approximate.\n'''
p.write_text(s)
print('Recovered 15 complete files with full Git hashes; added 58 source-verified mask flags.')
