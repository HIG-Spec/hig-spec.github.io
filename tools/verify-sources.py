#!/usr/bin/env python3
"""Optional full source-parameter verification against locally held UI Kits."""
import argparse, gzip, hashlib, importlib.util, json, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('extract', ROOT/'tools/extract-materials.py')
extract = importlib.util.module_from_spec(spec); spec.loader.exec_module(extract)
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--ios',required=True); ap.add_argument('--macos',required=True); args=ap.parse_args()
    data=ROOT/'public/data'; manifest=json.loads((data/'manifest.json').read_text()); geometry=json.loads(gzip.decompress((data/'geometry.json.gz').read_bytes()))
    recorded=json.loads(gzip.decompress((data/'materials.json.gz').read_bytes()))
    rebuilt=extract.build(geometry,manifest['geometryPayloadSHA256'],{'ios':args.ios,'macos':args.macos})
    assert rebuilt==recorded, 'Material snapshot differs from source'
    checked=0
    for platform,path in {'ios':args.ios,'macos':args.macos}.items():
        with zipfile.ZipFile(path) as z:
            pages={}
            for ci,rows in recorded['bindings'].items():
                c=geometry['components'][int(ci)]
                if c['platform']!=platform:continue
                member=c['source']['member']
                if member not in pages:pages[member]=json.loads(z.read(member))
                rawRoot=extract.at(pages[member],c['source']['pointer']);ns=list(extract.flatten(c['root']))
                for ni,ri,si in rows:
                    raw=extract.at(rawRoot,ns[ni]['path'])
                    assert extract.material(raw['style'])==recorded['recipes'][ri]
                    assert raw['do_objectID']==ns[ni]['id']; checked+=1
    print(json.dumps({'sourceBindingsChecked':checked,'snapshotIdentical':True,'geometrySHA256':manifest['geometry'],'materialSHA256':manifest['materials']},indent=2))
if __name__=='__main__':main()
