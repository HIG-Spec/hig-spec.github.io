#!/usr/bin/env python3
"""Rebuild presentation-only metadata from the pinned, locally held Sketch files.

Never changes geometry/material measurements. Stores flags, not Apple artwork.
"""
import argparse
import gzip
import hashlib
import json
import zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def at(value, pointer):
    for key in pointer.strip('/').split('/') if pointer else []:
        value = value[int(key)] if isinstance(value, list) else value[key.replace('~1','/').replace('~0','~')]
    return value

def flatten(node):
    yield node
    for child in node.get('children', []):
        yield from flatten(child)

def build(paths):
    geometry = (ROOT/'public/data/geometry.json.gz').read_bytes()
    db = json.loads(gzip.decompress(geometry))
    manifest = json.loads((ROOT/'public/data/manifest.json').read_text())
    digest = hashlib.sha256(geometry).hexdigest()
    if digest != manifest['geometry']:
        raise ValueError('Geometry snapshot mismatch')
    result = {'format':'hig-render-metadata/2','geometrySHA256':digest,'sources':{},'rows':[]}
    for platform, path in paths.items():
        source_digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        if source_digest != next(s['sha256'] for s in db['sources'] if s['id']==platform):
            raise ValueError('Source snapshot mismatch: '+platform)
        result['sources'][platform] = source_digest
        with zipfile.ZipFile(path) as archive:
            pages={}
            for ci,component in enumerate(db['components']):
                if component['platform'] != platform: continue
                member=component['source']['member']
                if member not in pages: pages[member]=json.loads(archive.read(member))
                root=at(pages[member],component['source']['pointer'])
                for ni,node in enumerate(flatten(component['root'])):
                    raw=at(root,node['path'])
                    if raw.get('do_objectID') != node['id']: raise ValueError('Layer ID mismatch')
                    flags={}
                    if raw.get('_class')=='symbolMaster' and raw.get('includeBackgroundColorInInstance') is False and any(f.get('isEnabled') for f in raw.get('style',{}).get('fills',[])):
                        flags['background']=False
                    if raw.get('hasClippingMask'): flags['mask']=raw.get('clippingMaskMode',0)
                    if ni and raw.get('shouldBreakMaskChain'): flags['breakMask']=True
                    if raw.get('groupBehavior')==2: flags['graphic']=True
                    text={}
                    va=raw.get('style',{}).get('textStyle',{}).get('verticalAlignment',0)
                    if va: text['verticalAlignment']=va
                    if text: flags['text']=text
                    if flags: result['rows'].append([ci,ni,flags])
    result['rows'].sort(key=lambda row:(row[0],row[1]))
    return result

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--ios',required=True);ap.add_argument('--macos',required=True)
    ap.add_argument('--check',action='store_true')
    args=ap.parse_args(); result=build({'ios':args.ios,'macos':args.macos})
    dest=ROOT/'src/rendering/source-metadata.json'
    if args.check:
        old=json.loads(dest.read_text())
        if old!=result:
            a={tuple(r[:2]):r[2] for r in old['rows']};b={tuple(r[:2]):r[2] for r in result['rows']}
            differences=[(k,a.get(k),b.get(k)) for k in a.keys()|b.keys() if a.get(k)!=b.get(k)]
            print('Header', {k:v for k,v in old.items() if k!='rows'}, {k:v for k,v in result.items() if k!='rows'})
            print('Differences',len(differences),differences[:8]);raise SystemExit(1)
    else: dest.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'verified':args.check,'bindings':len(result['rows']),'geometrySHA256':result['geometrySHA256']}))
if __name__=='__main__':main()
