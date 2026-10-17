/* HIG Spec material data + UI. Independent reader; does not render or infer a glass shader. */
(function(root){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/[\uE000-\uF8FF\u{F0000}-\u{10FFFD}]/gu,'').replace(/\s+/g,' ').trim();
const fmt=v=>v===undefined?'未提供':typeof v==='number'?(Number.isInteger(v)?String(v):String(Number(v.toFixed(6)))):String(v);
const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const flatten=n=>[n,...(n.children||[]).flatMap(flatten)];
const glass=r=>(r?.blurs||[]).some(b=>b.type===4);
const enabled=r=>(r?.blurs||[]).some(b=>b.type===4&&b.isEnabled===true);
const source=(c,n)=>`${c.source.member}#${c.source.pointer}${n.path}/style`;
const status=r=>enabled(r)?'玻璃效果启用':glass(r)?'玻璃效果禁用':'未保存玻璃效果';
const label=p=>p==='ios'?'iOS / iPadOS':'macOS';
let db,data,styles=new Map(),bindings=new Map(),refs=new Map(),cache=new Map(),failure=null;
const FIELD_NAMES={radius:'模糊半径',saturation:'饱和度',brightness:'亮度',distortion:'畸变',depth:'深度',chromaticAberrationMultiplier:'色差系数',skipLightingEffects:'跳过内置光照',isEnabled:'效果开关',type:'效果类型',extraSamplingRegion:'额外采样区域',isCustomGlass:'自定义玻璃',isProgressive:'渐进效果',layeringType:'分层类型',center:'中心',motionAngle:'运动角度'};
const FIELD_ORDER=['isEnabled','type','radius','saturation','brightness','distortion','depth','chromaticAberrationMultiplier','skipLightingEffects','extraSamplingRegion','isCustomGlass','isProgressive','layeringType','center','motionAngle'];
function initData(database,payload){
  if(payload.format!=='hig-material-specs/1')throw Error('不支持的材质数据版本');
  db=database;data=payload;styles=new Map();bindings=new Map();refs=new Map();cache=new Map();failure=null;
  for(const s of data.sources){if(db.sources.find(x=>x.id===s.platform)?.sha256!==s.sha256)throw Error('材质与几何的源文件快照不一致');}
  for(const s of data.styles)styles.set(s.platform+':'+s.id,s);
  for(const c of db.components)refs.set(c.platform+':'+c.symbolID,c);
  for(const [ci,rows]of Object.entries(data.bindings)){
    const c=db.components[Number(ci)];if(!c)throw Error('组件索引超出范围');const nodes=flatten(c.root);
    for(const [ni,recipe,shared]of rows){if(!nodes[ni]||!data.recipes[recipe])throw Error('材质图层索引无效');bindings.set(c.platform+':'+nodes[ni].id,{recipe,shared:shared===null?null:data.styles[shared]});}
  }
  return data.counts;
}
async function init(database,encoded){
 try{
  const bytes=Uint8Array.from(atob(root.HIG_MATERIALS_GZIP||''),c=>c.charCodeAt(0));
  const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const payload=JSON.parse(text);
  if(root.crypto?.subtle&&encoded!==undefined){
   const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(encoded));
   if(Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')!==payload.geometryPayloadSHA256)throw Error('几何数据已变化，请重新提取材质绑定');
  }
  return initData(database,payload);
 }catch(e){failure=e.message;console.error('Material specs:',e);return null;}
}
function parseOverrides(values,owner,node){return(values||[]).map((o,index)=>{const key=String(o.overrideName||''),i=key.lastIndexOf('_');return{parts:key.slice(0,i).split('/'),prop:key.slice(i+1),value:o.value,source:`${owner.source.member}#${owner.source.pointer}${node.path}/overrideValues/${index}`,overrideName:key};}).filter(o=>o.parts[0]);}
function resolve(c){
 if(failure||!data)return{records:[],warnings:[failure||'材质数据尚未载入']};
 if(cache.has(c.id))return cache.get(c.id);
 const records=[],warnings=[];let visits=0;
 function visit(n,owner,active,ancestors,chain,hiddenParent){
  if(++visits>20000){if(!warnings.includes('参照展开超过安全上限，结果不完整。'))warnings.push('参照展开超过安全上限，结果不完整。');return;}
  const direct=active.filter(o=>o.parts.length===1&&o.parts[0]===n.id);
  const nested=active.filter(o=>o.parts.length>1&&o.parts[0]===n.id).map(o=>({...o,parts:o.parts.slice(1)}));
  let hidden=!!n.hidden, symbol=n.symbolID, applied=[],binding=bindings.get(owner.platform+':'+n.id),shared=binding?.shared||null;
  let recipe=binding?clone(data.recipes[binding.recipe]):null;
  for(const o of direct){
   if(o.prop==='isVisible')hidden=o.value===false||o.value===0||o.value==='0';
   if(o.prop==='symbolID')symbol=o.value;
   if(o.prop==='layerStyle'){
    const replacement=styles.get(owner.platform+':'+o.value);
    if(replacement){recipe=clone(data.recipes[replacement.recipe]);shared=replacement;applied.push(o);}
    else if(o.value){warnings.push('无法解析共享样式覆盖：'+o.value+' · '+o.source);}
    else if(binding){warnings.push('空 layerStyle 覆盖未推断其语义：'+o.source);}
   }
  }
  for(const o of direct){
   const m=/^color:(fill|shadow|border)-(\d+)$/.exec(o.prop);
   if(m&&recipe){const array={fill:'fills',shadow:'shadows',border:'borders'}[m[1]],entry=recipe[array]?.[Number(m[2])];if(entry){entry.color=clone(o.value);applied.push(o);}else warnings.push('颜色覆盖未命中效果槽：'+o.source);}
   if(o.prop==='fillColor'&&recipe){warnings.push('保留未解释的 fillColor 覆盖：'+o.source);applied.push({...o,unresolved:true});}
  }
  const hiddenEffective=hiddenParent||hidden;
  if(recipe&&(binding||shared?.catalog||glass(recipe))){
   const changed=shared?Object.keys(recipe).filter(k=>!same(recipe[k],data.recipes[shared.recipe][k])):[];
   records.push({nodeID:n.id,nodeName:clean(n.name)||n.type,ownerID:owner.id,ownerName:clean(owner.name),platform:owner.platform,
    location:source(owner,n),chain:[...chain],hidden:hiddenEffective,shared:shared?clone(shared):null,
    originalShared:binding?.shared?.id||null,localDifference:changed,overrides:applied.map(o=>({field:o.prop,value:o.value,source:o.source,overrideName:o.overrideName,...(o.unresolved?{unresolved:true}:{})})),recipe});
  }
  for(const ch of n.children||[])visit(ch,owner,[...active,...nested],ancestors,chain,hiddenEffective);
  if(n.type==='symbolInstance'&&symbol){
   const target=refs.get(owner.platform+':'+symbol);
   if(!target){warnings.push('无法展开 Symbol 引用：'+symbol+' · '+clean(n.name));return;}
   if(ancestors.includes(target.id)){warnings.push('检测到循环 Symbol 引用：'+target.id);return;}
   if(ancestors.length>24){warnings.push('Symbol 引用深度超过安全上限。');return;}
   visit(target.root,target,[...parseOverrides(n.overrides,owner,n),...nested],[...ancestors,target.id],[...chain,{instanceID:n.id,name:clean(n.name),ownerID:owner.id,source:`${owner.source.member}#${owner.source.pointer}${n.path}`}],hiddenEffective);
  }
 }
 visit(c.root,c,[],[c.id],[],false);
 const result={records,warnings:[...new Set(warnings)]};cache.set(c.id,result);return result;
}
function materialURL(s){return '#/materials/liquid-glass?platform='+s.platform+'&style='+encodeURIComponent(s.id);}
function componentURL(c){return (c.family?'#/components/'+c.family:'#/definition')+'?v='+encodeURIComponent(c.id)+'&tab=specs';}
function raw(value){return `<details class="mat-raw"><summary>查看原始参数 JSON · 保留完整精度</summary><pre>${esc(JSON.stringify(value,null,2))}</pre></details>`;}
function table(head,rows){return `<div class="table-wrap mat-table"><table><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function val(v){return `<code title="${esc(JSON.stringify(v))}">${esc(fmt(v))}</code>`;}
function flag(v){return `<span class="mat-state ${v===true?'on':''}">${v===true?'启用':v===false?'禁用':'未声明'}</span>`;}
function color(c){if(!c)return '未提供';const values=['red','green','blue','alpha'].map(k=>fmt(c[k]));const css=['red','green','blue'].map(k=>Math.max(0,Math.min(255,(Number(c[k])||0)*255)));return `<span class="mat-color"><i style="background:rgba(${css.join(',')},${Number.isFinite(c.alpha)?c.alpha:1})"></i><code>${values.join(', ')}</code></span>`;}
function effectStack(r,key,title){
 const effects=r[key];if(!effects?.length)return `<h3 class="subheading">${title}</h3><p class="metric-footnote">源文件未保存 ${key} 项。</p>`;
 const fills=key==='fills',shadows=key==='shadows'||key==='innerShadows';
 const rows=effects.map((e,i)=>[val(i),flag(e.isEnabled),fills?val(e.fillType):shadows?(e.isInnerShadow||key==='innerShadows'?'内阴影':'外阴影'):val(e.position),color(e.color),val(e.contextSettings?.opacity),val(e.contextSettings?.blendMode),...(shadows?[val(e.offsetX),val(e.offsetY),val(e.blurRadius),val(e.spread)]:fills?[val(e.layeringType)]:[val(e.thickness)])]);
 const fields=['源索引','状态',fills?'fillType':shadows?'类型':'位置枚举','RGBA · 0–1','opacity','blendMode',...(shadows?['offsetX','offsetY','blurRadius','spread']:fills?['layeringType']:['thickness'])];
 let extra='';if(fills)extra=effects.map((e,i)=>e.fillType===1?`<details class="mat-raw"><summary>fills[${i}] · 渐变坐标、色标与插值</summary><pre>${esc(JSON.stringify(e.gradient,null,2))}</pre></details>`:'').join('');
 return `<h3 class="subheading">${title} <span class="mat-small">${effects.filter(x=>x.isEnabled===true).length} 启用 / ${effects.length} 已保存</span></h3>${table(fields,rows)}${extra}`;
}
function recipeHTML(r,base){
 const bs=r.blurs||(r.blur?[r.blur]:[]);
 const b=bs.find(x=>x.type===4),highlight=[['radius','模糊半径'],['distortion','畸变'],['depth','深度'],['saturation','饱和度']];
 const metrics=`<div class="mat-metrics">${highlight.map(([k,l])=>`<div><small>${l} <code>${k}</code></small><strong>${fmt(b?.[k])}</strong><span>${b?b.isEnabled?'已声明 · 启用':'已保存 · 禁用':'未保存该效果'}</span></div>`).join('')}</div>`;
 const blurTables=bs.length?bs.map((item,i)=>{const fields=[...FIELD_ORDER.filter(k=>k in item),...Object.keys(item).filter(k=>k!=='_class'&&!FIELD_ORDER.includes(k))];return `<h3 class="subheading">${r.blurs?'blurs['+i+']':'blur'} · ${item.type===4?'Glass':'效果类型 '+fmt(item.type)} ${flag(item.isEnabled)}</h3>${table(['参数','值','源字段','相对共享样式'],fields.map(k=>[esc(FIELD_NAMES[k]||k),val(item[k]),`<code>${r.blurs?'blurs['+i+']':'blur'}.${esc(k)}</code>`,base?(same(item[k],(base.blurs?.[i]||base.blur||{})[k])?'一致':`<span class="mat-changed">覆盖 · 原值 ${esc(fmt((base.blurs?.[i]||base.blur||{})[k]))}</span>`):'声明']))}`;}).join(''):'<div class="note">该样式未保存玻璃效果对象。它仍有填充或阴影参数；不把缺失的 radius、distortion、depth 填成 0。</div>';
 return `${metrics}<div class="mat-params">${blurTables}</div><h3 class="subheading">材质整体合成</h3>${table(['字段','值'],['contextSettings','colorControls','borderOptions'].filter(k=>k in r).map(k=>[`<code>${k}</code>`,`<code class="mat-wrap">${esc(JSON.stringify(r[k]))}</code>`]))}<p class="metric-footnote">alpha 与效果 opacity 分开保存；blendMode / layeringType 为原始枚举。下表保留源数组索引和禁用项，不推断跨数组的渲染顺序。显示数值最多 6 位小数，JSON 保留源精度。</p>${effectStack(r,'fills','填充栈')}${effectStack(r,'shadows','阴影栈 · 内 / 外')}${r.innerShadows?effectStack(r,'innerShadows','独立内阴影栈'):''}${r.borders?.length?effectStack(r,'borders','边框栈'):''}${raw(r)}`;
}
function errorHTML(){return `<div class="note amber">材质数据加载失败：${esc(failure||'尚未载入')}。几何规格仍可使用；此状态不表示该组件没有玻璃材质。</div>`;}
function bindingHTML(record){
 const shared=record.shared,base=shared?data.recipes[shared.recipe]:null;
 const relation=record.overrides.length?'实例覆盖后的参数':record.localDifference.length?'图层保存值 · 与共享样式不同':shared?'图层保存值 · 与共享材质一致':'图层局部材质 · 无共享样式引用';
 return `<div class="mat-binding"><div class="mat-binding-head"><span class="pill ${enabled(record.recipe)&&!record.hidden?'green':''}">${esc(record.hidden?'源图层隐藏 · '+status(record.recipe):status(record.recipe))}</span><span class="mat-small">${relation}</span></div><h3>${esc(record.nodeName)}</h3>${shared?`<p>共享样式：<a class="source-link" href="${materialURL(shared)}">${esc(shared.name)} ↗</a><br><code class="mat-small">${esc(shared.id)}</code></p>`:'<p class="mat-small">此图层无可关联的 Liquid Glass 共享样式，以下为它保存的局部参数。</p>'}${record.localDifference.length?`<div class="note amber">与当前关联共享样式不同的字段：<code>${esc(record.localDifference.join(', '))}</code>。下表展示图层值，而不是用共享预设覆盖它。</div>`:''}${record.overrides.length?`<details class="mat-raw"><summary>实例覆盖记录 · ${record.overrides.length} 项</summary><pre>${esc(JSON.stringify(record.overrides,null,2))}</pre></details>`:''}${record.chain.length?`<p class="mat-small mat-wrap">引用链：${record.chain.map(x=>esc(x.name||x.instanceID)).join(' → ')} → ${esc(record.nodeName)}</p>`:''}<details class="mat-raw"><summary>定位到源图层与共享样式</summary><pre>${esc(JSON.stringify({file:data.sources.find(s=>s.platform===record.platform),layer:record.location,nodeID:record.nodeID,shared:shared?{id:shared.id,path:shared.pointer}:null,referenceChain:record.chain},null,2))}</pre></details><div class="button-row"><button class="outline-button" data-material-action="export-binding">导出此层材质 JSON</button><a class="source-link" href="${componentURL(db.components.find(c=>c.id===record.ownerID))}">查看保存该图层的定义 ↗</a></div>${recipeHTML(record.recipe,base)}</div>`;
}
let selectedBinding=null,currentComponent=null,selectedStyle=null,matMain=null;
function paintComponent(el,c){
 if(!el)return;if(failure||!data){el.innerHTML=errorHTML();return;}
 currentComponent=c;const result=resolve(c);const records=result.records;
 el.innerHTML=`<p class="section-intro">当前定义及其 Symbol 参照中的玻璃参数。实例样式替换与逐项颜色覆盖在独立副本上解析；原始几何数据保持不变。</p>${result.warnings.length?`<details class="mat-raw mat-warning"><summary>有 ${result.warnings.length} 条解析边界提示</summary><pre>${esc(result.warnings.join('\n'))}</pre></details>`:''}${records.length?`<div class="mat-component-controls"><label for="materialLayerSelect">材质所在图层 · ${records.length} 项</label><select id="materialLayerSelect" data-material-change="layer">${records.map((r,i)=>`<option value="${i}">${esc((r.hidden?'[隐藏] ':'')+(r.chain.map(x=>x.name).join(' → ')+(r.chain.length?' → ':'')+r.nodeName)+' · '+(r.shared?.name||'局部材质'))}</option>`).join('')}</select></div><div id="materialBindingDetail"></div>`:'<div class="note">本定义及已解析的 Symbol 参照中没有找到 Liquid Glass 效果或关联样式。这不表示材质参数为 0；也不会根据组件名称猜一个预设。</div>'}<div class="button-row"><a class="outline-button" href="#/materials/liquid-glass?platform=${c.platform}">浏览 Liquid Glass 共享材质规格 ↗</a></div>`;
 if(records.length){const i=Math.max(0,records.findIndex(r=>!r.hidden&&enabled(r.recipe)));document.getElementById('materialLayerSelect').value=String(i);selectedBinding=records[i];document.getElementById('materialBindingDetail').innerHTML=bindingHTML(selectedBinding);}
 else selectedBinding=null;
}
function renderPage(main,params=new URLSearchParams()){
 matMain=main;if(failure||!data){main.innerHTML=`<div class="page">${errorHTML()}</div>`;return;}
 const platform=params.get('platform')==='macos'?'macos':'ios';const catalog=data.styles.filter(s=>s.catalog&&s.platform===platform);
 const style=catalog.find(s=>s.id===params.get('style'))||catalog[0];selectedStyle=style;
 main.innerHTML=`<div class="page source-page mat-page"><header class="page-heading mat-hero"><div class="eyebrow">MATERIALS · SOURCE PARAMETERS</div><h1>Liquid Glass</h1><p class="mat-subtitle">液态玻璃，逐项可查。</p><p>玻璃效果、填充、内外阴影与合成参数。与组件的尺寸和间距一样，都是实现所需的规格。</p><div class="hero-meta"><span class="pill green">38 条共享样式记录</span><span class="pill">iOS / iPadOS 27 · macOS 27</span><span class="pill">源参数 · 非渲染算法</span></div></header><div class="mat-picker"><div class="segmented" role="group" aria-label="材质平台">${['ios','macos'].map(p=>`<a class="mat-platform ${p===platform?'active':''}" href="#/materials/liquid-glass?platform=${p}">${label(p)}</a>`).join('')}</div><label for="materialStyleSelect">材质变体 · ${catalog.length} 条记录</label><select id="materialStyleSelect" data-material-change="style">${catalog.map(s=>`<option value="${esc(s.id)}" ${s.id===style.id?'selected':''}>${esc(s.name)} · ${s.id.slice(0,8)}</option>`).join('')}</select></div><section class="spec-section" id="material-preset"><div class="section-title"><h2>${esc(style.name.replace('Liquid Glass/',''))}</h2><small>${label(platform)}</small></div><div class="mat-source-bar"><span class="badge declared">声明</span><code>${esc(style.id)}</code><code>${esc(style.pointer)}</code></div><p class="metric-footnote">按平台与 ID 识别样式；同名记录不合并。radius 是源模糊字段，不是圆角。未给 depth / distortion 添加物理单位。</p><div class="button-row"><button class="blue-button" data-material-action="export-style">导出材质 JSON</button><button class="outline-button" data-material-action="export-all">导出全部材质与绑定数据</button></div>${recipeHTML(data.recipes[style.recipe])}</section><section class="spec-section" id="material-compare"><div class="section-title"><h2>变体对照</h2><small>同平台 · 全部共享记录</small></div>${table(['共享样式','radius','saturation','distortion','depth','状态'],catalog.map(s=>{const b=data.recipes[s.recipe].blurs?.find(x=>x.type===4);return [`<a class="source-link" href="${materialURL(s)}">${esc(s.name.replace('Liquid Glass/',''))}</a><br><code class="mat-small">${s.id.slice(0,8)}</code>`,...['radius','saturation','distortion','depth'].map(k=>val(b?.[k])),esc(status(data.recipes[s.recipe]))];}))}</section><section class="spec-section" id="material-usage"><div class="section-title"><h2>关联组件定义</h2><small>含 Symbol 参照</small></div><div id="materialUsage"></div></section><section class="spec-section"><h2>来源</h2><p class="paragraph">${esc(data.sources.find(s=>s.platform===platform).filename)}<br>Sketch ${esc(data.sources.find(s=>s.platform===platform).sketchVersion)}</p><code class="mat-wrap">SHA-256: ${esc(data.sources.find(s=>s.platform===platform).sha256)}</code><p class="metric-footnote">参数直接摘录自设计文件。组件中的覆盖值优先单独呈现；本页是共享预设，不替代组件实例记录。禁用项保留，缺失值不填零。</p></section><footer class="content-footer">HIG Spec · 非官方设计文件参数参考 <a href="#/components">返回组件目录 ↗</a></footer></div>`;
 const used=[];let direct=0;
 for(const c of db.components.filter(c=>c.platform===platform)){
  const r=resolve(c).records.filter(r=>r.shared?.id===style.id);if(!r.length)continue;
  if(r.some(r=>r.chain.length===0))direct++;
  used.push({c,hidden:r.every(x=>x.hidden),overrides:r.some(x=>x.localDifference.length||x.overrides.length)});
 }
 const usage=document.getElementById('materialUsage');if(!used.length)usage.innerHTML='<p class="paragraph">当前 Symbol 定义中没有解析到对这个 ID 的引用。Materials 展示页等非 Symbol 画布不计入此关联清单。</p>';
 else usage.innerHTML=`<p class="section-intro">${used.length} 个定义关联此共享样式，其中 ${direct} 个包含直接引用。计数包含隐藏层和内部定义；并不等于运行时控件数量。</p><details class="mat-usage" open><summary>展开 / 收起全部关联定义</summary>${table(['组件 / 源定义','可见性','参数关系'],used.map(({c,hidden,overrides})=>[`<a class="source-link" href="${componentURL(c)}">${esc(clean(c.name))}</a>`,hidden?'仅隐藏图层':'包含可见层',overrides?'含局部差异 / 覆盖':'与共享参数一致']))}</details>`;
}
function exportForComponent(c){const r=resolve(c);return{format:'hig-material-specs/1',source:data?.sources.find(s=>s.platform===c.platform)||null,records:clone(r.records),warnings:[...r.warnings]};}
function markdown(c){const r=resolve(c);let out='\n## 材质与液态玻璃\n\n';if(!r.records.length)return out+'未发现可解析的玻璃效果或关联共享样式。\n'+r.warnings.join('\n');return out+r.records.map((x,i)=>`### ${i+1}. ${x.nodeName}\n\n${x.shared?.name||'图层局部材质'} · ${status(x.recipe)}${x.hidden?' · 隐藏':''}\n\n来源：\`${x.location}\`\n\n\`\`\`json\n${JSON.stringify({shared:x.shared,localDifference:x.localDifference,overrides:x.overrides,recipe:x.recipe},null,2)}\n\`\`\`\n`).join('\n')+(r.warnings.length?'\n解析边界：\n'+r.warnings.join('\n'):'');}
function download(value,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
if(typeof document!=='undefined'){
 document.addEventListener('change',e=>{const key=e.target.dataset.materialChange;
  if(key==='style'&&selectedStyle)location.hash=materialURL(styles.get(selectedStyle.platform+':'+e.target.value));
  if(key==='layer'&&currentComponent){selectedBinding=resolve(currentComponent).records[Number(e.target.value)];document.getElementById('materialBindingDetail').innerHTML=bindingHTML(selectedBinding);}
 });
 document.addEventListener('click',e=>{const el=e.target.closest('[data-material-action]');if(!el)return;e.preventDefault();const action=el.dataset.materialAction;
  if(action==='export-style'&&selectedStyle)download({format:data.format,source:data.sources.find(s=>s.platform===selectedStyle.platform),style:selectedStyle,recipe:data.recipes[selectedStyle.recipe]},'liquid-glass-'+selectedStyle.platform+'-'+selectedStyle.id+'.json');
  if(action==='export-binding'&&selectedBinding)download({format:data.format,source:data.sources.find(s=>s.platform===selectedBinding.platform),record:selectedBinding},'component-material-'+selectedBinding.nodeID+'.json');
  if(action==='export-all')download(data,'hig-material-specs.json');
 });
}
const api={init,initData,resolve,paintComponent,renderPage,exportForComponent,markdown,recipeHTML,flatten,getData:()=>data,getFailure:()=>failure};root.MaterialSpecs=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
