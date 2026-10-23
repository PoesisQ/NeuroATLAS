/* v2: native coordinate spaces and reversible observation state. */
Object.assign(QLABEL,{segmented:'原始标签等值面',mesh:'源解剖网格',missing:'缺少可核验几何',probability:'概率图谱标签',cavity:'CT 孔腔分割边界'});
const SPACES={legacy:{title:'Z-Anatomy 参考脑',short:'参考脑',overview:'brain',type:'参考解剖网格',description:'原有大体脑结构、部分脑神经和颅骨参考网格。配准纤维和核团另有精度标识。',sides:['left','right','both'],unit:'mm'},...JSON.parse($('nativeMetadata').textContent)};
const EVIDENCE=JSON.parse($('nativeEvidence').textContent);
CAT.native_tissue=['同源邻近组织','foramen','#a5b79a'];
Object.assign(state,{space:'legacy',future:[],pins:[],lockView:false,fitRelations:false,showDiagrams:false,savedView:null});
let poseTween=null,transitionSerial=0,lastSearchKey='',searchComposing=false;
const recordSpace=r=>r.space||'legacy';
const isNative=r=>Boolean(r.space);
const initialMatchObject=matchObject;
function matchesRecord(r,t,space=state.space){
 if(recordSpace(r)!==space)return false;
 if(r.termIds?.includes(t.id))return true;
 if(t.space&&t.space!==space)return false;
 if(r.ownerTerm)return r.ownerTerm===t.id;
 if(t.synthetic||t.derived)return false;
 if(r.space)return t.names?.includes(r.name)||t.includeNames?.includes(r.name);
 return t.names?.includes(r.name)||t.includeNames?.includes(r.name)||t.category?.includes(r.category)||(t.region&&r.category==='cortex'&&r.region===t.region);
}
matchObject=(o,t,space=state.space)=>matchesRecord(o.r,t,space);
function spacesFor(t){return Object.keys(SPACES).filter(s=>RAW.some(r=>matchesRecord(r,t,s)));}
function resolveSpace(t,requested){
 if(requested&&SPACES[requested])return requested;
 const available=spacesFor(t);
 if(t.preferredSpace&&available.includes(t.preferredSpace))return t.preferredSpace;
 if(available.includes(state.space))return state.space;
 return available[0]||'legacy';
}
const originalSideFor=sideFor;
sideFor=function(t=byId.get(state.id)){
 if(SPACES[state.space]?.singleHemisphere)return'both';
 return originalSideFor(t);
};
sideMatches=function(o,t){const s=sideFor(t);return s==='both'||['median','single','both'].includes(o.r.side)||o.r.side===s;};
setSelectionSets=function(){
 const t=byId.get(state.id);state.selected=new Set(objects.filter(o=>matchObject(o,t)&&sideMatches(o,t)));state.related=new Map();state.broadRelated=new Set();
 const relations=[...(t.rel||[]),...state.pins.filter(id=>id!==t.id).map(id=>[id,'保留对照'])];
 relations.forEach(([id],i)=>{const rt=byId.get(id);if(!rt)return;for(const o of objects){if(!state.selected.has(o)&&matchObject(o,rt)&&sideMatches(o,t)&&!state.related.has(o)){state.related.set(o,i%RELCOLORS.length);if(rt.overview||rt.category||rt.region||rt.names?.length>10)state.broadRelated.add(o);}}});
};
qualityOf=function(t){
 const parts=[...state.selected];
 if(!parts.length)return t.view==='schematic'&&state.showDiagrams?'schematic':'missing';
 if(parts.some(o=>o.r.quality==='cavity'))return'cavity';
 if(parts.some(o=>o.r.quality==='probability'))return'probability';
 if(parts.some(o=>o.r.quality==='segmented'))return'segmented';
 if(parts.every(o=>o.r.space==='bp3d'))return t.quality==='functional'?'functional':'mesh';
 if(t.quality!=='mesh'&&t.quality!=='group')return t.quality;
 return parts.some(o=>!o.r.source.startsWith('Z-Anatomy')&&!o.r.space)?'registered':t.quality;
};
// Unsupported structures deliberately have no fabricated rings, spheres or capsule envelopes.
buildTeachingGeometry=function(){
 buildMicro();buildCSF();
};
const oldDisplacement=displacement;
displacement=function(o,t){
 if(recordSpace(o.r)!==state.space)return new THREE.Vector3();
 if(!isNative(o.r))return oldDisplacement(o,t);
 const v=new THREE.Vector3(),k=state.open;
 if(!k||o.selected||o.r.space==='uw')return v;
 if(o.r.category==='cortex'){
  const s=o.r.side==='right'?-1:o.r.side==='left'?1:o.center.x>=0?1:-1;
  v.set(s*k*(t.view==='insular'?32:46),k*(o.r.region==='Temporal lobe'?-18:12),0);
 }
 if(o.r.category==='cerebellum'&&t.group==='stem')v.set(0,-k*8,-k*32);
 if(o.r.role==='white-context')v.set(o.center.x>=0?k*30:-k*30,k*8,0);
 return v;
};
const oldUpdateAppearance=updateAppearance;
updateAppearance=function({instant=false}={}){
 const from=objects.map(o=>({o,alpha:o.alpha,pos:o.group.position.clone(),color:o.meshes[0]?.material.color.clone()||o.targetColor.clone()}));
 oldUpdateAppearance();
 const t=byId.get(state.id),micro=t.view==='schematic'&&state.showDiagrams;
 if(root){root.visible=!micro;microRoot.visible=micro;}
 for(const [id,g] of Object.entries(microGroups))g.visible=micro&&id===t.synthetic;
 for(const o of objects){
  if(recordSpace(o.r)!==state.space){o.targetAlpha=0;o.alpha=0;o.group.visible=false;}
  else if(t.view==='schematic'&&!state.showDiagrams&&o.relatedIndex>=0)o.targetAlpha=Math.min(.3,o.targetAlpha||.3);
  if(isNative(o.r)&&o.r.category==='skull'&&!o.selected)o.targetAlpha=state.reveal==='isolate'?0:Math.min(.28,state.context*1.2);
  if(o.r.quality==='unverified'&&!o.selected)o.targetAlpha=0;
 }
 if(csfGroup)csfGroup.visible=state.space==='legacy'&&state.tour==='csf'&&state.showDiagrams;
 poseTween={serial:++transitionSerial,start:performance.now(),duration:instant||state.reduced?0:720,from};
 syncControls();updateNotice();
};
function stepPose(now,dt,k){
 const p=poseTween?(poseTween.duration?Math.min(1,(now-poseTween.start)/poseTween.duration):1):1;
 const e=p*p*(3-2*p);
 for(let i=0;i<objects.length;i++){
  const o=objects[i],start=poseTween?.from[i];
  if(recordSpace(o.r)!==state.space){o.alpha=0;o.group.visible=false;continue;}
  o.alpha=start?THREE.MathUtils.lerp(start.alpha,o.targetAlpha,e):o.targetAlpha;
  if(start)o.group.position.lerpVectors(start.pos,o.targetPos,e);else o.group.position.copy(o.targetPos);
  o.group.visible=o.alpha>.006||o.targetAlpha>.006;
  for(const m of o.meshes){m.material.opacity=o.alpha;if(start)m.material.color.lerpColors(start.color,o.targetColor,e);else m.material.color.copy(o.targetColor);m.material.depthWrite=o.alpha>.94;}
 }
 if(p===1)poseTween=null;
}
const oldDesiredDirection=desiredDirection;
desiredDirection=function(view,t){if(view==='left')return[1,.08,.05];return oldDesiredDirection(view,t);};
function safeViewport(){
 const w=stage.clientWidth,h=stage.clientHeight;
 const top=Math.min(h*.36,document.querySelector('.scene-top').offsetHeight+25),bottom=Math.min(h*.45,document.querySelector('.scene-bottom').offsetHeight+16);
 return {w,h,left:18,right:Math.min(94,w*.18),top,bottom};
}
resize=function(){
 if(!renderer)return;const a=safeViewport(),w=a.w,h=a.h;if(!w||!h)return;
 renderer.setSize(w,h,false);camera.aspect=w/h;
 const cx=(a.left+w-a.right)/2,cy=(a.top+h-a.bottom)/2;
 camera.setViewOffset(w,h,w/2-cx,h/2-cy,w,h);camera.updateProjectionMatrix();
};
function tweenCamera(dest,animate=true){
 if(!animate||state.reduced){cameraState.target.copy(dest.target);cameraState.q.copy(dest.q);cameraState.distance=dest.distance;camTween=null;syncCamera();return;}
 camTween={start:performance.now(),duration:720,from:{target:cameraState.target.clone(),q:cameraState.q.clone(),distance:cameraState.distance},to:dest};
}
focus=function(view,animate=true){
 if(!camera)return;resize();const t=byId.get(state.id),q=view?viewQuaternion(view,t):cameraState.q.clone();
 let selected=state.fitRelations?new Set([...state.selected,...state.related.keys()]):state.selected;
 let box=t.view==='schematic'&&state.showDiagrams?new THREE.Box3().setFromObject(microGroups[t.synthetic]):boundsOf(selected);
 if(box.isEmpty())box=boundsOf(state.related.keys());
 if(box.isEmpty())box=boundsOf(sourceObjects.filter(o=>recordSpace(o.r)===state.space));
 if(box.isEmpty())return;
 if(state.cutAxis!=='off'){
  const axis=state.cutAxis;if(state.cutSign>0)box.min[axis]=Math.max(box.min[axis],state.cut);else box.max[axis]=Math.min(box.max[axis],state.cut);
  if(box.isEmpty()){toast('所选结构已被裁去；点击“到目标”把裁切面移回结构内部。');return;}
 }
 const sz=box.getSize(new THREE.Vector3());box.expandByScalar(Math.min(3,Math.max(.25,sz.length()*.025)));
 const target=box.getCenter(new THREE.Vector3()),inv=q.clone().invert();let ex=0,ey=0,ez=0;
 for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const v=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inv);ex=Math.max(ex,Math.abs(v.x));ey=Math.max(ey,Math.abs(v.y));ez=Math.max(ez,Math.abs(v.z));}
 const a=safeViewport(),half=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),usableX=Math.max(.3,(a.w-a.left-a.right)/a.h),usableY=Math.max(.2,(a.h-a.top-a.bottom)/a.h);
 const distance=Math.min(2400,Math.max(5,Math.max(ex/(half*usableX*.84),ey/(half*usableY*.84))+ez));
 tweenCamera({target,q,distance},animate);
};
function captureView(){return{id:state.id,space:state.space,side:state.side,reveal:state.reveal,open:state.open,context:state.context,layers:[...state.layers],fine:state.fine,labels:state.labels,cutAxis:state.cutAxis,cut:state.cut,cutSign:state.cutSign,pins:state.pins.slice(),lockView:state.lockView,fitRelations:state.fitRelations,showDiagrams:state.showDiagrams,tour:state.tour,tourIndex:state.tourIndex,camera:{target:cameraState.target.toArray(),q:cameraState.q.toArray(),distance:cameraState.distance}};}
function pushHistory(){state.history.push(captureView());if(state.history.length>80)state.history.shift();state.future=[];}
function refreshAll(){renderList();renderDetail();renderHeading();syncControls();resize();}
function replaceHash(){try{history.replaceState(null,'','#'+encodeURIComponent(state.id));}catch(_){} }
function restoreView(v,{animate=true}={}){
 if(!v||!byId.has(v.id)||!SPACES[v.space])return;
 camTween=null;const keys=['id','space','side','reveal','open','context','fine','labels','cutAxis','cut','cutSign','lockView','fitRelations','showDiagrams','tour','tourIndex'];
 for(const key of keys)state[key]=v[key];state.layers=new Set(v.layers);state.pins=v.pins.slice();
 state.expanded.add(byId.get(v.id).group);updateAppearance();refreshAll();
 tweenCamera({target:new THREE.Vector3(...v.camera.target),q:new THREE.Quaternion(...v.camera.q),distance:v.camera.distance},animate);replaceHash();
}
select=function(id,{push=true,side,space,keepTour=false,animate=true}={}){
 clearTimeout(searchTimer);const t=byId.get(id);if(!t)return;
 const nextSpace=resolveSpace(t,space),changed=nextSpace!==state.space;
 if(push&&(state.id!==id||changed||(side&&side!==state.side)))pushHistory();
 if(changed){state.pins=[];state.cutAxis='off';state.cut=0;state.side='auto';state.showDiagrams=false;for(const o of objects){o.alpha=0;o.group.visible=false;}camTween=null;}
 state.space=nextSpace;state.id=id;if(side)state.side=side;if(!keepTour)state.tour=null;
 state.fitRelations=false;state.open=state.cutAxis==='off'&&!SPACES[nextSpace].fixed?(t.open||0):0;state.expanded.add(t.group);
 if(state.ready){updateAppearance({instant:!animate});refreshAll();focus(state.lockView&&!changed?undefined:t.view,animate&&!changed);}else{setSelectionSets();refreshAll();}
 if(changed&&push)toast('已切换至 '+SPACES[nextSpace].title+'；不同来源的模型保持各自原生空间。');
 replaceHash();if(innerWidth<=760)$('sidebar').classList.remove('open');
};
goBack=function(){const v=state.history.pop();if(!v)return;state.future.push(captureView());restoreView(v);};
function goForward(){const v=state.future.pop();if(!v)return;state.history.push(captureView());restoreView(v);}
reset=function(){pushHistory();state.side='auto';state.space='legacy';state.reveal='smart';state.context=.18;state.cutAxis='off';state.cut=0;state.cutSign=1;state.layers=new Set(DEFAULT_LAYERS);state.fine=false;state.labels=true;state.pins=[];state.showDiagrams=false;state.fitRelations=false;state.query='';$('search').value='';state.tab='course';state.tour=null;select('brain',{push:false});$('cutPanel').hidden=true;};
const oldSyncControls=syncControls;
syncControls=function(){
 oldSyncControls();const space=SPACES[state.space],single=space.singleHemisphere;
 $('datasetSelect').value=state.space;$('forwardButton').disabled=!state.future.length;$('lockView').checked=state.lockView;
 $('restoreViewButton').disabled=!state.savedView;$('cutReadout').textContent=state.cut.toFixed(1)+' mm';
 $('openSlider').disabled=!state.ready||space.fixed||byId.get(state.id).view==='schematic';
 $('revealTargetButton').disabled=$('openSlider').disabled;$('inSituButton').disabled=!state.ready;
 const pairedOnly=state.selected.size>0&&[...state.selected].every(o=>o.r.side==='both');
 document.querySelectorAll('[data-side]').forEach(b=>{b.disabled=!state.ready||single||pairedOnly||byId.get(state.id).view==='schematic';});
 $('evidenceButton').disabled=!evidenceKeys().length;
 const box=boundsOf(sourceObjects.filter(o=>recordSpace(o.r)===state.space));if(!box.isEmpty()&&state.cutAxis!=='off'){$('cutSlider').min=Math.floor(box.min[state.cutAxis]);$('cutSlider').max=Math.ceil(box.max[state.cutAxis]);$('cutSlider').step=.1;$('cutSlider').value=state.cut;}
};
const oldRenderHeading=renderHeading;
renderHeading=function(){oldRenderHeading();$('sceneEyebrow').textContent=SPACES[state.space].short+' · '+(SPACES[state.space].singleHemisphere?'单半球参考':'原生比例');renderCompareBar();};
function renderCompareBar(){const el=$('compareBar');el.hidden=!state.pins.length;el.innerHTML=state.pins.map(id=>`<button data-unpin="${esc(id)}">${esc(byId.get(id)?.zh.split(' · ')[0])} ×</button>`).join('');el.querySelectorAll('[data-unpin]').forEach(b=>b.onclick=()=>{state.pins=state.pins.filter(id=>id!==b.dataset.unpin);updateAppearance();renderCompareBar();renderDetail();});}
function pinCurrent(){if(!state.selected.size){toast('此条没有独立几何，无法固定为三维对照。');return;}if(state.pins.includes(state.id))state.pins=state.pins.filter(id=>id!==state.id);else if(state.pins.length<4)state.pins.push(state.id);else{toast('最多保留 4 个对照结构；可点击上方标签移除。');return;}updateAppearance();renderCompareBar();renderDetail();}
const oldRenderDetail=renderDetail;
renderDetail=function(){
 oldRenderDetail();const t=byId.get(state.id),sp=SPACES[state.space],parts=[...state.selected],q=qualityOf(t);
 if(sp.singleHemisphere)$('detail').querySelector('.entry-side').textContent='单半球图谱 · 不生成另一侧';
 if(parts.length&&parts.every(o=>o.r.side==='both'))$('detail').querySelector('.entry-side').textContent='源标签含双侧 · 未单独拆分';
 const block=document.createElement('section');block.className='evidence-card';
 const limits=[...new Set(parts.map(o=>o.r.limitations).filter(Boolean))];
 block.innerHTML=`<details><summary>${esc(sp.title)} · 证据说明</summary><p>${esc(sp.description)}</p>${limits.map(s=>`<p class="evidence-limit">${esc(s)}</p>`).join('')}</details>${q==='missing'?'<p class="missing-status">缺少可核验的独立边界；只显示已有邻近结构。</p>':''}<div class="detail-buttons"><button id="pinCurrent">${state.pins.includes(t.id)?'取消保留':'保留作对照'}</button><button id="detailEvidence" ${!evidenceKeys().length?'disabled':''}>查原始证据</button></div>`;
 $('detail').querySelector('.entry-meta').after(block);$('pinCurrent').onclick=pinCurrent;$('detailEvidence').onclick=showEvidence;
 if(state.space!=='legacy'){
  const sources=$('detail').querySelector('.detail-sources'),keys=[...new Set([state.space,...(t.refs||[])])];
  sources.innerHTML='<summary>网格来源与参考资料</summary>'+keys.filter(k=>!['atlas','za','registration'].includes(k)&&SOURCES[k]).map(k=>`<a href="${esc(SOURCES[k][1])}" target="_blank" rel="noopener noreferrer">${esc(SOURCES[k][0])} ↗</a>`).join('')+`<div class="source-note">${esc([...new Set(parts.map(o=>o.r.source))].join('；'))}<br>${esc(sp.license||'')}</div>`;
 }
 const available=spacesFor(t);if(available.length>1){const alternatives=document.createElement('div');alternatives.className='source-alternatives';alternatives.innerHTML='同名结构可用来源：'+available.map(s=>`<button data-space-choice="${s}" ${s===state.space?'disabled':''}>${esc(SPACES[s].short)}</button>`).join('');block.append(alternatives);alternatives.querySelectorAll('[data-space-choice]').forEach(b=>b.onclick=()=>select(t.id,{space:b.dataset.spaceChoice}));}
 if(t.view==='schematic'){const button=document.createElement('button');button.className='diagram-optin';button.textContent=state.showDiagrams?'关闭独立教学示意':'另看独立教学示意（非精确模型）';button.onclick=()=>{state.showDiagrams=!state.showDiagrams;updateAppearance();renderDetail();focus('schematic');};block.append(button);}
 $('detail').querySelectorAll('[data-select]').forEach(b=>{const dest=byId.get(b.dataset.select);if(dest&&!spacesFor(dest).includes(state.space))b.title='此来源没有该结构；点击切换到它的可用参考空间';});
};
updateNotice=function(){
 const t=byId.get(state.id),q=qualityOf(t),sp=SPACES[state.space],notes=[];
 if(q==='missing')notes.push('独立几何缺项：未用定位环或虚构曲面补齐。');
 if(q==='registered')notes.push('跨图谱配准参考；不能据此精确测量小核团。');
 if(q==='cavity')notes.push('高亮为 CT 孔腔标签的边界，不是单独分割的骨性孔缘。');
 if(q==='probability')notes.push('最大概率标签等值面；网格间距不等于解剖准确度。');
 if(q==='functional')notes.push('以脑回／脑沟作功能定位参考，未分割个体功能边界。');
 if(t.view==='schematic'&&state.showDiagrams)notes.push('独立教学示意，未加入精确解剖模型。');
 if(sp.singleHemisphere)notes.push('源数据为单半球，不镜像补全。');
 if(state.open>.01)notes.push(`观察展开 ${Math.round(state.open*100)}%；点击“原位观察”复核自然关系。`);
 if(state.cutAxis!=='off')notes.push('表面裁切；截面未补绘组织。');
 $('sceneNotice').hidden=!notes.length;$('sceneNotice').textContent=notes.join(' ');$('sceneNotice').style.bottom=(document.querySelector('.scene-bottom').offsetHeight+8)+'px';
 const overview=t.overview||t.id==='brain';$('legend').innerHTML=overview?`<span>颜色区分源解剖结构 · ${esc(sp.short)}</span>`:`<span><i style="background:#e1825e"></i>${state.selected.size?'所选':'所选几何缺项'}</span>${(t.rel||[]).filter(([id])=>[...state.related.keys()].some(o=>matchesRecord(o.r,byId.get(id)))).slice(0,4).map(([id],i)=>`<span><i style="background:${RELCOLORS[i]}"></i>${esc(byId.get(id)?.zh.replace(/ · .*/,''))}</span>`).join('')}`;
};
updateClipping=function(){
 const enabled=state.cutAxis!=='off';clipPlane.normal.set(state.cutAxis==='x'?state.cutSign:0,state.cutAxis==='y'?state.cutSign:0,state.cutAxis==='z'?state.cutSign:0);clipPlane.constant=-state.cut*state.cutSign;
 for(const o of objects)for(const m of o.meshes){const planes=[];if(!o.r.space&&o.r.category==='skull')planes.push(skullRoof);if(enabled)planes.push(clipPlane);m.material.clippingPlanes=planes.length?planes:null;}
};
const oldBuildLabels=buildLabels;
buildLabels=function(){oldBuildLabels();if(byId.get(state.id).view==='schematic'&&!state.showDiagrams){$('worldLabels').innerHTML='';labelNodes=[];}};
updateLabels=function(){
 if(!state.labels||!camera)return;const a=safeViewport(),placed=[];
 for(const l of labelNodes){const box=l.point?null:boundsOf(l.set,false);if(box?.isEmpty()){l.el.hidden=true;continue;}const p=l.point?.clone()||box.getCenter(new THREE.Vector3());p.project(camera);let x=(p.x+1)/2*a.w,y=(1-p.y)/2*a.h;const width=l.el.offsetWidth||110;
  let visible=p.z<1&&p.z>-1&&x>0&&x<a.w-20&&y>a.top&&y<a.h-a.bottom;
  if(visible){x=Math.max(5,Math.min(x,a.w-width-a.right));for(let i=0;i<5;i++){if(!placed.some(r=>x<r.x+r.w&&x+width>r.x&&Math.abs(y-r.y)<27))break;y+=28;}if(y>a.h-a.bottom)visible=false;else placed.push({x,y,w:width});}l.el.hidden=!visible;if(visible){l.el.style.left=x+'px';l.el.style.top=y+'px';}
 }
};
// Side tokens are parsed independently; IME composition never triggers a premature camera move.
function cleanQuery(q){return q.replace(/左侧|右侧|左|右|\b(left|right|bilateral)\b/gi,'').trim();}
const oldScore=score;score=(t,q)=>oldScore(t,cleanQuery(q));
searchInput=function(){state.query=$('search').value.trim();renderList();clearTimeout(searchTimer);if(searchComposing||!cleanQuery(state.query))return;const raw=state.query;searchTimer=setTimeout(()=>{if(state.query!==raw||!visibleSearch.length)return;const first=visibleSearch[0];if(score(first,raw)>=50&&norm(cleanQuery(raw)).length>=2){const key=first.id+'|'+(querySide(raw)||'');if(key!==lastSearchKey){lastSearchKey=key;select(first.id,{side:querySide(raw)});}}},600);};
function evidenceKeys(){const keys=[...state.selected].map(o=>o.r.evidenceKey).filter(k=>k&&EVIDENCE[k]);return[...new Set(keys)];}
function showEvidence(){
 const keys=evidenceKeys();if(!keys.length){toast('此结构没有附带原始分割切片；可在资料页查看网格来源。');return;}
 modal(`<h2>核对模型与原始数据</h2><p>这里收录源几何、剖面或影像证据，具体类型见图注。分辨率、分割方法和个体差异仍限制解剖精度。</p><div class="evidence-tabs">${keys.map((k,i)=>`<button data-evidence="${esc(k)}" class="${i?'':'active'}">${esc(EVIDENCE[k].title)}</button>`).join('')}</div><div id="evidenceBody"></div>`);
 const render=k=>{const e=EVIDENCE[k];$('evidenceBody').innerHTML=`<h3>${esc(e.title)}</h3><p>${esc(e.description||'')}</p><div class="evidence-images">${(e.images||[]).map(im=>`<figure><img src="${im.data}" alt="${esc(im.caption)}"><figcaption>${esc(im.caption)}</figcaption></figure>`).join('')}</div><dl class="evidence-numbers">${Object.entries(e.metrics||{}).map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(typeof b==='object'?JSON.stringify(b):b)}</dd>`).join('')}</dl><p>${esc(e.limits||'')}</p>`;$('modalContent').querySelectorAll('[data-evidence]').forEach(b=>b.classList.toggle('active',b.dataset.evidence===k));};
 $('modalContent').querySelectorAll('[data-evidence]').forEach(b=>b.onclick=()=>render(b.dataset.evidence));render(keys[0]);
}
const oldBindUI=bindUI;
bindUI=function(){
 oldBindUI();$('datasetSelect').innerHTML=Object.entries(SPACES).map(([s,m])=>`<option value="${s}">${esc(m.title)}</option>`).join('');
 $('datasetSelect').onchange=()=>{const s=$('datasetSelect').value,t=byId.get(state.id);select(spacesFor(t).includes(s)?t.id:SPACES[s].overview,{space:s});};
 $('evidenceButton').onclick=showEvidence;$('forwardButton').onclick=goForward;$('lockView').onchange=()=>state.lockView=$('lockView').checked;
 $('inSituButton').onclick=()=>{pushHistory();state.open=0;state.cutAxis='off';state.fitRelations=false;updateAppearance();focus();};
 $('revealTargetButton').onclick=()=>{pushHistory();state.cutAxis='off';state.open=byId.get(state.id).open||.75;state.reveal='smart';updateAppearance();focus();};
 $('fitRelationsButton').onclick=()=>{state.fitRelations=true;focus();};$('focusButton').onclick=()=>{state.fitRelations=false;focus();};
 $('saveViewButton').onclick=()=>{state.savedView=captureView();syncControls();toast('当前视图已保存：包括角度、缩放、展开、侧别、裁切和对照。');};
 $('restoreViewButton').onclick=()=>{if(state.savedView){pushHistory();restoreView(state.savedView);}};
 $('cutCenter').onclick=()=>{if(state.cutAxis==='off'){toast('先选择裁切方向。');return;}const box=boundsOf(state.selected);if(!box.isEmpty()){state.cut=box.getCenter(new THREE.Vector3())[state.cutAxis];syncControls();focus();}};
 $('cutSlider').oninput=()=>{state.cut=Number($('cutSlider').value);$('cutReadout').textContent=state.cut.toFixed(1)+' mm';};
 $('cutAxis').onchange=()=>{state.cutAxis=$('cutAxis').value;if(state.cutAxis!=='off'){state.open=0;const box=boundsOf(state.selected);state.cut=box.isEmpty()?0:box.getCenter(new THREE.Vector3())[state.cutAxis];}updateAppearance();resize();};
 $('search').oncompositionstart=()=>{searchComposing=true;clearTimeout(searchTimer);};$('search').oncompositionend=()=>{searchComposing=false;lastSearchKey='';searchInput();};
 const clear=$('clearSearch').onclick;$('clearSearch').onclick=()=>{lastSearchKey='';clear();};
 document.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{pushHistory();state.side=b.dataset.side;updateAppearance();renderDetail();focus(state.lockView?undefined:byId.get(state.id).view);});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.fitRelations=false;focus(b.dataset.view);});
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||$('modal').open)return;if(e.altKey&&e.key==='ArrowRight'){e.preventDefault();goForward();}if(e.altKey&&e.key==='ArrowLeft'){e.preventDefault();goBack();}});
};
startTour=function(id){const t=TOURS.find(x=>x.id===id);if(!t)return;pushHistory();state.tour=id;state.tourIndex=0;state.reveal='smart';state.side='auto';select(t.steps[0],{keepTour:true,push:false});};
tourMove=function(delta){const t=TOURS.find(x=>x.id===state.tour);if(!t)return;const next=THREE.MathUtils.clamp(state.tourIndex+delta,0,t.steps.length-1);if(next===state.tourIndex)return;pushHistory();state.tourIndex=next;select(t.steps[next],{keepTour:true,push:false});};
const oldShowHelp=showHelp;
showHelp=function(){oldShowHelp();$('modalContent').insertAdjacentHTML('afterbegin','<p class="v2-help"><b>新版观察逻辑：</b>返回／前进恢复完整视图；窗口变化保留方向；“保持视角”允许在相邻结构间连续观察。先用“原位观察”看自然位置，再用“移开遮挡”展开；“保留作对照”最多保留 4 个同源结构。不同来源独立显示，可从“参考空间”切换。没有真实几何的条目保持缺项，不再用环、球或截取纤维替代。</p>');};
const oldShowSources=showSources;
showSources=function(){
 oldShowSources();
 const body=$('modalContent');body.innerHTML=`<h2>数据来源与逐项核验</h2><p>本次新增 BP3D、UW CT、P41 分别保留原生空间，彼此及与原有参考脑不叠加。原有参考脑仍包含上游配准组件，另标为图谱配准。模型不是独立专家验收的精确标准脑；源标签或网格存在分辨率、分区和变异限制。</p>${Object.entries(SPACES).map(([key,s])=>`<section class="source-card"><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><p>${esc(s.limits||'')}</p><p>${esc(s.license||'原网格及派生数据保持随附许可证。')}</p>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">官方来源 ↗</a>`:''}<button data-source-open="${key}" class="download">在原生空间打开</button></section>`).join('')}<h3>没有用示意代替的缺项</h3><p>缺少可核验边界的孔道、脑室开口和小核团不生成替代几何。侧脑室角的简单截取、内囊的纤维截段与手画孔环已停用。显微形态示意仅在用户单独开启时显示，始终标注独立尺度。</p><h3>核对入口</h3><p>词条的“查分割证据”可查看随附的源切片和体素／网格统计；“保留作对照”用于同源相邻关系比较。只用同一空间、合拢状态检查位置；展开距离不是真实距离。</p><button id="openAudit" class="download">查看逐条覆盖清单</button><button id="downloadAudit" class="download">下载覆盖清单</button><button id="diagnosticButton" class="download">运行诊断</button><h3>许可与转发</h3><p>单文件内嵌模型、切片、讲解和许可证。各来源分别保留许可；包含 UW CT 数据的本文件含 CC BY-NC-SA 3.0 US 组件，仅按相应非商业与相同方式共享条款再分发。NextBrain 数据 CC0；其他模型见内嵌完整许可。主动打开参考链接才需要联网。</p>`;
 body.querySelectorAll('[data-source-open]').forEach(b=>b.onclick=()=>{$('modal').close();select(SPACES[b.dataset.sourceOpen].overview,{space:b.dataset.sourceOpen});});
 $('openAudit').onclick=showAudit;$('downloadAudit').onclick=()=>download('NeuroAtlas-v2-coverage.json',JSON.stringify(audit(),null,2),'application/json');$('diagnosticButton').onclick=showDiagnostics;
};
audit=function(){return course.map(t=>{const available=spacesFor(t);return{id:t.id,zh:t.zh,en:t.en,quality:t.quality,spaces:available,geometryStatus:available.length?'source-geometry':'no-independent-geometry',sourceObjects:RAW.filter(r=>available.some(s=>matchesRecord(r,t,s))).map(r=>({id:r.id,name:r.name,side:r.side,space:recordSpace(r),quality:r.quality||t.quality,source:r.source,limits:r.limitations})),relations:t.rel.map(([id,relationship])=>({id,relationship})),position:t.loc,function:t.fn,limitations:t.note};});};
const oldDiagnosticReport=diagnosticReport;
diagnosticReport=function(){
 const r=oldDiagnosticReport(),coverage=audit();r.version='2.0';r.current.space=state.space;r.current.lockView=state.lockView;r.current.pins=state.pins;r.current.fitRelations=state.fitRelations;r.current.cutPosition=state.cut;r.current.context=state.context;r.current.history=state.history.length;r.current.future=state.future.length;
 r.missing=coverage.filter(t=>!t.spaces.length).map(t=>t.id);r.intentionalGeometryGaps=r.missing.slice();r.noLeft=[];r.noRight=[];
 r.crossSpaceVisible=objects.filter(o=>recordSpace(o.r)!==state.space&&o.group.visible&&o.alpha>.01).map(o=>o.r.id);
 r.finitePoses=objects.every(o=>[...o.group.position.toArray(),o.alpha,...o.targetPos.toArray()].every(Number.isFinite));r.poseTransition=poseTween?.serial||null;
 r.spaces=Object.entries(SPACES).map(([id,m])=>({id,title:m.title,objects:sourceObjects.filter(o=>recordSpace(o.r)===id).length,singleHemisphere:Boolean(m.singleHemisphere)}));
 r.generatedMacroAnnotations=objects.filter(o=>o.r.category==='annotations').length;r.quaternionNorm=cameraState.q.length();return r;
};
showDiagnostics=function(){const r=diagnosticReport(),ok=r.ready&&!r.invalidBounds.length&&!r.missingRelations.length&&!r.errors.length&&!r.crossSpaceVisible.length&&r.finiteCamera&&r.finitePoses;modal(`<h2>运行诊断</h2><p>${ok?'✓ 软件状态检查通过。':'有软件状态需要检查。'} 明确记录的几何缺项不被误报为已完成建模；这些检查不构成解剖精度验收。</p><pre id="diagnosticJSON">${esc(JSON.stringify(r,null,2))}</pre><button id="diagnosticDownload" class="download">下载运行报告 JSON</button>`);$('diagnosticDownload').onclick=()=>download('NeuroAtlas-v2-runtime.json',JSON.stringify(r,null,2),'application/json');};
showAudit=function(){const rows=audit();modal(`<h2>逐条建模覆盖清单</h2><p>数据可用、表面提取通过与医学准确是不同检查。每条明确记录来源空间；无独立几何的条目保持缺项。</p><div class="audit-list"><table><tr><th>结构</th><th>来源空间</th><th>几何对象</th></tr>${rows.map(r=>`<tr><td><button class="textbtn" data-audit-select="${r.id}">${esc(r.zh)}</button></td><td>${r.spaces.map(s=>esc(SPACES[s].short)).join(' / ')||'缺项'}</td><td>${r.sourceObjects.length}</td></tr>`).join('')}</table></div>`);$('modalContent').querySelectorAll('[data-audit-select]').forEach(b=>b.onclick=()=>{$('modal').close();select(b.dataset.auditSelect);});};

