#!/usr/bin/env python3
"""Integrate material specs into the existing static site; never rewrite geometry data."""
from pathlib import Path
import hashlib,re,json
ROOT=Path(__file__).resolve().parent.parent

def replace_one(s,old,new):
    if old not in s and new in s:return s
    if s.count(old)!=1:raise ValueError('Unexpected HTML version at '+old[:95])
    return s.replace(old,new,1)

def digest(s):
    return hashlib.sha256(re.search(r'<script id="geometry-payload"[^>]*>(.*?)</script>',s,re.S)[1].encode()).hexdigest()

def main():
    p=ROOT/'index.html';h=p.read_text();before=digest(h)
    if 'data-material-specs-version="1"' in h:
        print('Material specs integration already applied.');return
    for name in ['materials-data.js','materials-specs.js','materials-specs.css']:
        if not (ROOT/'assets'/name).is_file():raise ValueError('Missing material asset: '+name)
    h=replace_one(h,'<meta name="color-scheme" content="light dark">','<meta name="color-scheme" content="light dark">\n<meta data-material-specs-version="1" name="hig-materials" content="Source material parameter specifications">\n<link rel="stylesheet" href="./assets/materials-specs.css?v=1">')
    h=replace_one(h,'<script src="./assets/symbol-preview.js?v=1"></script>','<script src="./assets/symbol-preview.js?v=1"></script>\n<script src="./assets/materials-data.js?v=1"></script>\n<script src="./assets/materials-specs.js?v=1"></script>')
    h=replace_one(h,'G.init(db);byID=',"await MaterialSpecs.init(db,document.getElementById('geometry-payload').textContent);\nG.init(db);byID=")
    h=replace_one(h,'<a href="#/foundations" data-nav="foundations">基础度量</a>','<a href="#/foundations" data-nav="foundations">基础度量</a>\n<a href="#/materials/liquid-glass" data-nav="materials">材质</a>')
    h=replace_one(h,"</span></a>`+E.categories.filter", "</span></a><div class=\"side-group\">材质 · Materials</div><a class=\"side-link ${active==='materials'?'active':''}\" href=\"#/materials/liquid-glass\">液态玻璃 · Liquid Glass</a>`+E.categories.filter")
    h=replace_one(h,"['metrics','尺寸与间距'],['layout','布局关系']","['metrics','尺寸与间距'],['materials','材质与液态玻璃'],['layout','布局关系']")
    h=replace_one(h,"['specs','ruler','Specs 几何规格']","['specs','ruler','Specs 组件规格']")
    h=replace_one(h,'<section class="spec-section" id="layout">','<section class="spec-section" id="materials"><div class="section-title"><h2>材质与液态玻璃</h2><small>Material specs</small></div><div id="materialSpecsBody"></div></section><section class="spec-section" id="layout">')
    h=replace_one(h,'paintAnatomy(c);paintMetrics(c);paintLayout(c);','paintAnatomy(c);paintMetrics(c);MaterialSpecs.paintComponent(document.getElementById(\'materialSpecsBody\'),c);paintLayout(c);')
    h=replace_one(h,"else if(path==='/foundations'){state.component=null;foundations();}","else if(path==='/foundations'){state.component=null;foundations();}else if(path.startsWith('/materials')){state.component=null;sidebar('materials');MaterialSpecs.renderPage(main,params);}")
    h=replace_one(h,"path==='/foundations'?'基础度量 · ':'')+'Apple Geometry Specs'", "path==='/foundations'?'基础度量 · ':path.startsWith('/materials')?'Liquid Glass · ':'')+'Apple Geometry Specs'")
    h=replace_one(h,"'Symbol overrides are preserved, not reflowed.'],component:c}","'Symbol overrides are preserved, not reflowed.','Material styles and supported color overrides are resolved separately.'],component:c,materials:MaterialSpecs.exportForComponent(c)}")
    h=replace_one(h,"## Rust 几何快照\\n\\n\\`\\`\\`rust\\n${rust(c)}\\n\\`\\`\\`\\n`;}","## Rust 几何快照\\n\\n\\`\\`\\`rust\\n${rust(c)}\\n\\`\\`\\`\\n${MaterialSpecs.markdown(c)}`;}")
    h=replace_one(h,'尺寸、内边距、间距与变体，汇集于此。','尺寸、内边距、间距、材质参数与变体，汇集于此。')
    if digest(h)!=before:raise ValueError('Geometry payload changed')
    p.write_text(h);print(json.dumps({'integration':'material-specs-v1','geometryPayloadSHA256':before},indent=2))

if __name__=='__main__':main()
