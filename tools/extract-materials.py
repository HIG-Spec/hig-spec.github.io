#!/usr/bin/env python3
"""Extract material specs without artwork or fonts. Standard library only.

Usage: python tools/extract-materials.py --ios '...sketch' --macos '...sketch'
Runs against index.html's existing geometry snapshot and never rewrites that payload.
"""
import argparse, base64, copy, gzip, hashlib, json, re, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def flatten(n):
    yield n
    for child in n.get('children', []):
        yield from flatten(child)

def at(root, pointer):
    for key in pointer.strip('/').split('/') if pointer else []:
        root = root[int(key)] if isinstance(root, list) else root[key.replace('~1', '/').replace('~0', '~')]
    return root

def material(style):
    # Full raw effect objects, including disabled effects, exact floats and enums.
    return {key: copy.deepcopy(style[key]) for key in ('blurs', 'blur', 'fills', 'shadows', 'innerShadows', 'borders', 'contextSettings', 'colorControls', 'borderOptions') if key in style}

def build(html, paths):
    encoded = re.search(r'<script id="geometry-payload"[^>]*>(.*?)</script>', html, re.S).group(1)
    db = json.loads(gzip.decompress(base64.b64decode(encoded)))
    result = {'format':'hig-material-specs/1', 'geometryPayloadSHA256':hashlib.sha256(encoded.encode()).hexdigest(),
              'sources':[], 'styles':[], 'recipes':[], 'bindings':{}, 'notes':[
                  'Exact serialized Sketch effect fields, not shader algorithms.',
                  'Array order and disabled records are preserved; no inferred rendering order across different effect arrays.',
                  'Bindings use component and preorder node indices in the hashed geometry snapshot.',
                  'No runtime layout reflow, fonts, images or vector artwork included.']}
    pool = {}
    def intern(value):
        key = json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
        if key not in pool:
            pool[key]=len(result['recipes']);result['recipes'].append(value)
        return pool[key]
    for platform, path in paths.items():
        path=Path(path); digest=hashlib.sha256(path.read_bytes()).hexdigest()
        src=next(x for x in db['sources'] if x['id']==platform)
        if digest != src['sha256']: raise ValueError('Source does not match geometry snapshot: '+platform)
        z=zipfile.ZipFile(path); document=json.loads(z.read('document.json'))
        shared=document['layerStyles']['objects'];lookup={x['do_objectID']:x for x in shared}
        required={o['value'] for c in db['components'] if c['platform']==platform for n in flatten(c['root']) for o in n.get('overrides',[]) if o.get('overrideName','').endswith('_layerStyle') and isinstance(o.get('value'),str)}
        glassIDs={s['do_objectID'] for s in shared if s['name'].startswith('Liquid Glass/')}
        styleidx={}
        for i,s in enumerate(shared):
            if s['do_objectID'] not in glassIDs|required:continue
            styleidx[s['do_objectID']]=len(result['styles'])
            result['styles'].append({'platform':platform,'id':s['do_objectID'],'name':s['name'],'pointer':f'document.json#/layerStyles/objects/{i}', 'recipe':intern(material(s['value'])),'catalog':s['do_objectID'] in glassIDs})
        pages={}
        for ci,c in enumerate(db['components']):
            if c['platform']!=platform:continue
            member=c['source']['member']
            if member not in pages:pages[member]=json.loads(z.read(member))
            rawRoot=at(pages[member],c['source']['pointer'])
            if rawRoot.get('do_objectID') != c['root']['id']:raise ValueError('Mismatched root ID')
            rows=[]
            for ni,n in enumerate(flatten(c['root'])):
                raw=at(rawRoot,n['path']);sid=raw.get('sharedStyleID');v=raw.get('style',{})
                if raw.get('do_objectID')!=n['id']:raise ValueError('Mismatched layer ID')
                isglass=any(b.get('type')==4 for b in v.get('blurs',[])) or sid in glassIDs
                if isglass:
                    rows.append([ni,intern(material(v)),styleidx.get(sid)])
            if rows:result['bindings'][str(ci)]=rows
        result['sources'].append({'platform':platform,'filename':path.name,'sha256':digest,'sketchVersion':src['sketchVersion']})
    result['counts']={'catalogStyles':sum(s['catalog'] for s in result['styles']),'supportStyles':sum(not s['catalog'] for s in result['styles']),'recipes':len(result['recipes']),'directDefinitions':len(result['bindings']),'directLayers':sum(map(len,result['bindings'].values()))}
    return result

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--ios',required=True);ap.add_argument('--macos',required=True);args=ap.parse_args()
    result=build((ROOT/'index.html').read_text(),{'ios':args.ios,'macos':args.macos})
    out=ROOT/'assets'/'materials.json';out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    encoded=base64.b64encode(gzip.compress(out.read_bytes(),mtime=0)).decode()
    (ROOT/'assets'/'materials-data.js').write_text('// Extracted material parameters only. Source identities are in the payload. No artwork or fonts.\n'+'globalThis.HIG_MATERIALS_GZIP = '+json.dumps(encoded)+';\n')
    print(json.dumps(result['counts'],indent=2));print('Wrote',out)
