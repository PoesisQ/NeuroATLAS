/* v3. Stable anatomy, coherent assemblies, fixed anatomical sections, native-space locator. */
Object.assign(state,{hiddenObjects:new Set(),displacementGuides:false,showFlow:false,plan:'surface',planSide:'left',lockView:true,previousId:null,continuity:'',context:.16});
let sectionRoot=null,sectionKey='',sectionTimer=null,outlineRoot=null,locator=null;
const PLAN_INFO={
 surface:{title:'完整皮层',description:'皮层与脑叶保留原位；点击相邻区域只改变选中标记。',view:'oblique',axis:'x'},
 sylvian:{title:'外侧沟观察窗',description:'额顶皮层组向上移，颞叶外侧组向下移；沟底、颞横回与岛叶保持原位。分组依据源脑回，未冒称独立岛盖分割。',view:'insular',axis:'y'},
 deep:{title:'深部结构观察窗',description:'观察侧的皮层组整组向外移，深部核团和白质保持原位。',view:'deep',axis:'y'},
 medial:{title:'内侧面观察窗',description:'观察侧的皮层组整组向外移，胼胝体、脑室和间脑保持原位。',view:'medial',axis:'x'},
 posterior:{title:'脑干—小脑观察窗',description:'小脑作为一个整体向后移，脑干与神经根保持原位。',view:'stem',axis:'z'},
 skull:{title:'颅底原位关系',description:'骨与孔腔保持同源坐标；用固定剖面观察通道与骨面的关系。',view:'skull',axis:'y'},
 nuclei:{title:'核团原位关系',description:'单标本脑干标签保持原位；可用水平或冠状剖面检查背景组织。',view:'deep',axis:'y'}
};
function recommendedPlan(t,space=state.space){
 if(space==='uw')return'skull';if(space==='p41')return'nuclei';
 if(t.overview&&['bp3d','bp2018'].includes(space))return'surface';
 if(['insula','a1','lateral','wernicke','bp_stg','bp_ifg','bp_smg'].includes(t.id)||t.view==='insular')return'sylvian';
 if(t.group==='surface')return'surface';
 if(t.group==='foramen')return'skull';if(['stem','nerve'].includes(t.group))return'posterior';
 if(t.view==='medial'||t.group==='csf')return'medial';return'deep';
}
function stableColor(r){
 const n=r.name.replace(/^BP3D: /,'').toLowerCase();
 const fine=[[/posterior transverse temporal/,'#a6854e'],[/anterior short insular/,'#cb915c'],[/middle short insular/,'#af776a'],[/posterior short insular/,'#b09b58'],[/anterior long insular/,'#9a76a8'],[/posterior long insular/,'#6b91a9'],[/accessory short/,'#bf8093'],[/central insular sulcus/,'#3e6e68'],[/sublenticular part/,'#bd915e'],[/retrolenticular part/,'#b6ad70'],[/genu of.*internal capsule/,'#dfc47f']];for(const [p,c]of fine)if(p.test(n))return c;
 const named=[[/transverse temporal|heschl/,'#b9573c'],[/insula/,'#aa6b40'],[/internal capsule/,'#d2b35c'],[/caudate/,'#657dba'],[/putamen/,'#ad647d'],[/globus pallid/,'#698e70'],[/thalamus/,'#907ab3'],[/lat fis|lateral sulcus/,'#467a80'],[/central sulcus/,'#597d61'],[/precentral/,'#b5695b'],[/postcentral/,'#7c9253'],[/corpus callosum/,'#c0ab76'],[/hippocampus/,'#a66b91']];
 for(const [pattern,c] of named)if(pattern.test(n))return c;
 if(r.category==='ventricles')return'#478ca6';
 if(r.nativeColor)return r.nativeColor;
 const c=new THREE.Color(baseColor(r));let hash=0;for(const s of n)hash=(hash*31+s.charCodeAt(0))>>>0;
 if(r.category==='cortex')c.offsetHSL(0,0,((hash%9)-4)*.009);
 else if(['deep_grey','diencephalon'].includes(r.category))c.offsetHSL((hash%13)*.027,0,-.02);
 return '#'+c.getHexString();
}
const spatialCapture=captureView;
captureView=function(){const v=spatialCapture(),dest=camTween?.to;if(dest)v.camera={target:dest.target.toArray(),q:dest.q.toArray(),distance:dest.distance};return{...v,hiddenObjects:[...state.hiddenObjects],plan:state.plan,planSide:state.planSide,previousId:state.previousId,showFlow:state.showFlow,displacementGuides:state.displacementGuides};};
const spatialRestore=restoreView;
restoreView=function(v,opts){state.hiddenObjects=new Set(v.hiddenObjects||[]);state.plan=v.plan||'surface';state.planSide=v.planSide||'left';state.previousId=v.previousId||null;state.showFlow=Boolean(v.showFlow);state.displacementGuides=Boolean(v.displacementGuides);state.continuity='恢复先前的位置、颜色、切面和镜头';spatialRestore(v,opts);};
const spatialBounds=boundsOf;
boundsOf=function(set,...args){return spatialBounds([...set].filter(o=>!state.hiddenObjects.has(o.r.id)),...args);};
function nativeSet(t){return objects.filter(o=>matchObject(o,t)&&sideMatches(o,t));}
function sameSide(o){return o.r.side===state.planSide||['median','single','both'].includes(o.r.side);}
function corticalShell(o){return o.r.category==='cortex'&&!/Hippocamp|Parahippocamp|entorhinal|Insula|insula|Circular sulcus|Transverse temporal/i.test(o.r.name);}
function assembly(o){
 if(!sameSide(o))return'';const r=o.r,n=r.name;
 if(state.space==='bp2018'&&state.plan==='sylvian'){
  if(r.nativeGroup==='opercula'||r.category==='cortex'&&['Frontal lobe','Parietal lobe'].includes(r.region))return'额顶皮层组';
  if(/superior temporal gyrus/i.test(n))return'颞上回';
  return'';
 }
 if(state.plan==='sylvian'&&corticalShell(o)){
  if(['Frontal lobe','Parietal lobe'].includes(r.region)&&!n.startsWith('Lat Fis'))return'额顶皮层组';
  if(r.region==='Temporal lobe'&&!/Transverse temporal|planum/i.test(n))return'颞叶外侧组';
 }
 if(['deep','medial'].includes(state.plan)&&corticalShell(o))return'外侧皮层组';
 if(state.plan==='posterior'&&r.category==='cerebellum')return'小脑整体';
 return'';
}
displacement=function(o){const v=new THREE.Vector3();if(state.cutAxis!=='off')return v;const k=state.open,s=state.planSide==='right'?-1:1;
 switch(assembly(o)){case'岛盖组':v.set(s*30,42,0);break;case'颞上回':v.set(s*25,-35,0);break;case'额顶皮层组':v.set(s*14,48,0);break;case'颞叶外侧组':v.set(s*12,-35,0);break;case'外侧皮层组':v.set(s*88,8,0);break;case'小脑整体':v.set(0,-8,-65);break;}return v.multiplyScalar(k);
};
function contextVisible(o){
 const r=o.r;if(recordSpace(r)!==state.space)return false;
 if(state.space==='uw')return true;
 if(state.space==='p41')return r.role==='nucleus'||r.role==='white-context';
 if(r.category==='cortex')return true;
 if(r.category==='cerebellum')return true;
 if(r.category==='brainstem'&&(/^(Pons|Midbrain|Medulla oblongata|White matter of spinal cord)$/.test(r.name)))return true;
 if(state.space==='bp3d'||state.space==='bp2018')return true;
 if(['deep','medial'].includes(state.plan))return ['deep_grey','diencephalon','ventricles','white_matter'].includes(r.category)&&(r.source.startsWith('Z-Anatomy')||['Thalamus'].includes(r.name));
 if(state.plan==='posterior')return r.category==='cranial_nerves';
 if(state.plan==='skull')return['skull','cranial_nerves'].includes(r.category);
 return false;
}
updateAppearance=function({instant=false}={}){
 const t=byId.get(state.id),micro=t.view==='schematic'&&state.showDiagrams;
 setSelectionSets();if(root){root.visible=!micro;microRoot.visible=micro;}for(const [id,g]of Object.entries(microGroups))g.visible=micro&&id===t.synthetic;
 const grooveSelection=state.selected.size>0&&[...state.selected].every(o=>o.r.role==='source-sulcus-model');
 const from=objects.map(o=>({o,pos:o.group.position.clone()}));
 for(const o of objects){
  o.selected=state.selected.has(o);o.relatedIndex=state.related.has(o)?state.related.get(o):-1;
  if(o.selected)state.hiddenObjects.delete(o.r.id);
  const related=o.relatedIndex>=0;let show=contextVisible(o)&&state.layers.has(o.r.category)||o.selected||related||state.layers.has(o.r.category)&&!['cortex','brainstem','cerebellum'].includes(o.r.category)||requiredSectionContext(o);
  if(!o.r.space&&!o.r.source.startsWith('Z-Anatomy')&&!o.selected&&!related&&!state.fine&&!['Thalamus'].includes(o.r.name))show=false;
  if(state.reveal==='isolate')show=o.selected;else if(state.reveal==='related')show=o.selected||related;
  // Authored groove locator sheets are not extra cortical tissue. Show on selection only.
  if(o.r.role==='source-sulcus-model'&&(!o.selected||!grooveSelection))show=false;
  if(recordSpace(o.r)!==state.space||state.hiddenObjects.has(o.r.id)||micro)show=false;
  // Render the same surfaces at the same color. Visibility changes never crossfade.
  o.visualRole=o.selected?'target':related&&!state.broadRelated.has(o)&&o.box.getSize(new THREE.Vector3()).length()<105?'neighbor':'context';
  o.sectionVisible=show;o.targetAlpha=show?1:0;if(show&&state.reveal==='ghost'&&o.visualRole==='context')o.targetAlpha=state.context;
  if(state.space==='p41'&&o.r.role==='white-context'&&!o.selected&&state.cutAxis==='off')o.targetAlpha=0;
  o.alpha=o.targetAlpha;o.group.visible=o.alpha>.006;o.targetPos.copy(displacement(o));
  o.targetColor.set(stableColor(o.r));o.baseColor.copy(o.targetColor);
  for(const m of o.meshes){const mat=m.material,wasTransparent=mat.transparent,wasSide=mat.side;mat.color.copy(o.targetColor);mat.opacity=1;mat.transparent=false;mat.depthTest=true;mat.depthWrite=true;mat.side=THREE.DoubleSide;mat.wireframe=false;mat.polygonOffset=false;m.renderOrder=0;if(wasTransparent!==mat.transparent||wasSide!==mat.side)mat.needsUpdate=true;}
 }
 poseTween={start:performance.now(),duration:instant||state.reduced?0:900,from};
 if(csfGroup)csfGroup.visible=state.space==='legacy'&&state.tour==='csf'&&state.showFlow;
 syncControls();buildLabels();updateNotice();renderOccluders();updateSelectionOutline();scheduleSection();updateLocatorObjects();
};
stepPose=function(now){const p=poseTween?(poseTween.duration?Math.min(1,(now-poseTween.start)/poseTween.duration):1):1,e=p*p*(3-2*p);
 for(let i=0;i<objects.length;i++){const o=objects[i],a=poseTween?.from[i];if(a)o.group.position.lerpVectors(a.pos,o.targetPos,e);else o.group.position.copy(o.targetPos);}
 if(outlineRoot)for(const c of outlineRoot.children){const o=c.userData.owner;c.position.copy(o.group.position);c.visible=o.group.visible;}
 if(p===1)poseTween=null;
};
function updateSelectionOutline(){
 if(!scene)return;if(!outlineRoot){outlineRoot=new THREE.Group();scene.add(outlineRoot);}for(const child of [...outlineRoot.children]){child.geometry.dispose();child.material.dispose();outlineRoot.remove(child);}
 if(byId.get(state.id).overview||state.selected.size>30)return;
 for(const o of state.selected)for(const m of o.meshes){const lines=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry,38),new THREE.LineBasicMaterial({color:'#263f3b',transparent:false,depthTest:true}));lines.userData.owner=o;lines.position.copy(o.group.position);outlineRoot.add(lines);}
}
function areAdjacent(a,b){if(a?.rel?.some(([id])=>id===b.id)||b.rel?.some(([id])=>id===a?.id))return true;const aa=nativeSet(a),bb=nativeSet(b);if(!aa.length||!bb.length)return false;const ab=new THREE.Box3(),bc=new THREE.Box3();for(const o of aa)ab.union(o.box);for(const o of bb)bc.union(o.box);return Math.hypot(...['x','y','z'].map(k=>Math.max(0,ab.min[k]-bc.max[k],bc.min[k]-ab.max[k])))<32;}
// Prefer staying in a source space when the same target exists there.
resolveSpace=function(t,requested){if(requested&&SPACES[requested])return requested;const available=spacesFor(t);if(t.defaultEntrySpace&&available.includes(t.defaultEntrySpace)&&(state.space==='legacy'||byId.get(state.id)?.overview))return t.defaultEntrySpace;if(available.includes(state.space))return state.space;return available.includes(t.preferredSpace)?t.preferredSpace:available[0]||'legacy';};
select=function(id,{push=true,side,space,keepTour=false,animate=true}={}){
 clearTimeout(searchTimer);const t=byId.get(id);if(!t)return;const old=byId.get(state.id),oldSpace=state.space,nextSpace=resolveSpace(t,space),changed=oldSpace!==nextSpace;
 const targetPlan=recommendedPlan(t,nextSpace),keepWindow=state.plan!=='surface'||targetPlan==='surface'||state.cutAxis!=='off',sameWindowSide=!side||side==='auto'||side==='both'||side===state.planSide;
 const adjacent=!changed&&state.ready&&old&&!old.overview&&!t.overview&&keepWindow&&sameWindowSide&&(state.cutAxis!=='off'||areAdjacent(old,t));
 if(push&&(state.id!==id||changed||side&&side!==state.side))pushHistory();
 state.previousId=changed?null:state.id;state.id=id;state.space=nextSpace;if(side&&['left','right','both','auto'].includes(side))state.side=side;
 if(changed){state.side=side||'auto';state.hiddenObjects.clear();state.pins=[];state.cutAxis='off';state.showDiagrams=false;camTween=null;}
 if(!keepTour)state.tour=null;
 if(!adjacent){state.plan=recommendedPlan(t);state.planSide=sideFor(t)==='right'?'right':'left';state.open=['surface','skull','nuclei'].includes(state.plan)?0:1;state.cutAxis='off';state.reveal='smart';state.layers=new Set(DEFAULT_LAYERS);for(const o of objects)if(contextVisible(o))state.layers.add(o.r.category);}
 state.fitRelations=false;state.expanded.add(t.group);
 state.continuity=changed?'已切换来源：各来源独立坐标，不作位置连续动画':adjacent?(state.cutAxis!=='off'?'沿用固定切面 · 颜色与镜头方向保持':'沿用当前观察窗 · 颜色、开合与镜头方向保持'):'固定解剖观察窗 · 拖动可从任意方向查看';
 if(state.ready){updateAppearance({instant:!animate||changed});refreshAll();
  if(adjacent){if(!state.lockView)focus(undefined,animate);else ensureTargetInView(animate);}
  else focus(PLAN_INFO[state.plan].view,animate&&!changed,true);
 }else{setSelectionSets();refreshAll();}
 if(changed&&push)toast('切换到 '+SPACES[nextSpace].title+'。定位小图已同步更换；不同来源不叠合。');
 replaceHash();if(innerWidth<=760)$('sidebar').classList.remove('open');
};
function ensureTargetInView(animate){if(!state.selected.size||!camera)return;syncCamera();const center=boundsOf(state.selected).getCenter(new THREE.Vector3()),p=center.clone().project(camera),a=safeViewport(),x=(p.x+1)*a.w/2,y=(1-p.y)*a.h/2;
 if(x<a.left+40||x>a.w-a.right-40||y<a.top+25||y>a.h-a.bottom-25)tweenCamera({target:center,q:cameraState.q.clone(),distance:cameraState.distance},animate);
}
const spatialFocus=focus;
const v3Direction=desiredDirection;
desiredDirection=function(view,t){return state.space==='bp2018'&&view==='insular'?[state.planSide==='right'?-1:1,.72,.15]:v3Direction(view,t);};
focus=function(view,animate=true,entry=false){
 if(!camera)return;const selected=state.selected,t=byId.get(state.id);if(t.view==='schematic'&&state.showDiagrams)return spatialFocus(view,animate);
 let set=new Set(selected),q=view?viewQuaternion(view,t):cameraState.q.clone();
 if(t.overview||t.id==='brain'||entry&&state.plan==='surface')set=new Set(objects.filter(o=>recordSpace(o.r)===state.space&&contextVisible(o)&&o.targetAlpha===1));
 else if(state.fitRelations||entry){const b=boundsOf(selected);for(const o of objects)if(o.targetAlpha===1&&!assembly(o)&&o.box.getSize(new THREE.Vector3()).length()<85&&b.distanceToPoint(o.center)<24)set.add(o);}
 if(!set.size)set=new Set(state.related.keys());if(!set.size)set=new Set(objects.filter(o=>o.targetAlpha===1));
 let b=boundsOf(set);if(b.isEmpty())return;
 // Even tiny nuclei retain a local frame; an explicit closer inspection can use the wheel.
 const minSpan=state.space==='p41'?20:state.space==='uw'?35:entry?65:45,size=b.getSize(new THREE.Vector3());
 b.expandByVector(new THREE.Vector3(...size.toArray().map(v=>Math.max(3,(minSpan-v)/2))));
 const center=b.getCenter(new THREE.Vector3());
 if(entry&&selected.size&&!t.overview&&state.plan!=='surface')center.lerp(boundsOf(selected).getCenter(new THREE.Vector3()),.35);
 const inv=q.clone().invert();let ex=0,ey=0,ez=0;for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inv);ex=Math.max(ex,Math.abs(p.x));ey=Math.max(ey,Math.abs(p.y));ez=Math.max(ez,Math.abs(p.z));}
 resize();const a=safeViewport(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),ux=Math.max(.28,(a.w-a.left-a.right)/a.h),uy=Math.max(.22,(a.h-a.top-a.bottom)/a.h);
 tweenCamera({target:center,q,distance:Math.min(2400,Math.max(ex/(tan*ux*.86),ey/(tan*uy*.86))+ez)},animate);
};
safeViewport=function(){const w=stage.clientWidth,h=stage.clientHeight;return{w,h,left:18,right:Math.min(100,w*.15),top:Math.min(h*.28,document.querySelector('.scene-top').offsetHeight+26),bottom:Math.min(h*.38,document.querySelector('.scene-bottom').offsetHeight+20)};};
const spatialReset=reset;
reset=function(){state.hiddenObjects.clear();state.showFlow=false;state.plan='surface';state.previousId=null;spatialReset();state.lockView=true;syncControls();};

// Fixed sections in anatomical coordinates. Rotation never updates the plane.
updateClipping=function(){const enabled=state.cutAxis!=='off';clipPlane.normal.set(state.cutAxis==='x'?state.cutSign:0,state.cutAxis==='y'?state.cutSign:0,state.cutAxis==='z'?state.cutSign:0);clipPlane.constant=-state.cut*state.cutSign;
 for(const o of objects)for(const m of o.meshes){const planes=[];if(!o.r.space&&o.r.category==='skull'&&!enabled)planes.push(skullRoof);if(enabled)planes.push(clipPlane);m.material.clippingPlanes=planes.length?planes:null;}
 if(outlineRoot)for(const c of outlineRoot.children)c.material.clippingPlanes=enabled?[clipPlane]:null;
 if(sectionRoot)sectionRoot.visible=enabled;
};
function scheduleSection(){clearTimeout(sectionTimer);if(sectionRoot)sectionRoot.visible=false;sectionTimer=setTimeout(buildSection,90);}
function disposeSection(){if(!sectionRoot)return;const children=new Set(sectionRoot.children);pickMeshes=pickMeshes.filter(m=>!children.has(m));for(const m of sectionRoot.children){m.geometry.dispose();m.material.dispose();}sectionRoot.clear();}
function buildSection(){
 if(!scene)return;const key=[state.space,state.cutAxis,state.cut,state.cutSign,...objects.filter(o=>o.targetAlpha>0).map(o=>o.r.id)].join('|');if(key===sectionKey){if(sectionRoot)sectionRoot.visible=state.cutAxis!=='off';return;}sectionKey=key;
 if(!sectionRoot){sectionRoot=new THREE.Group();scene.add(sectionRoot);}disposeSection();if(state.cutAxis==='off'){sectionRoot.userData.stats=null;return;}
 const ai={x:0,y:1,z:2}[state.cutAxis],uv=[0,1,2].filter(i=>i!==ai),cut=state.cut,stats={closedLoops:0,openChains:0,triangles:0};
 for(const o of objects){if(o.targetAlpha<=0||o.box.min.getComponent(ai)>cut||o.box.max.getComponent(ai)<cut)continue;
  for(const m of o.meshes){const a=m.geometry.attributes.position,idx=m.geometry.index.array,segments=[],nodes=new Map(),edges=[];
   const add=p=>{const key=p.map(x=>Math.round(x*10000)).join(',');if(!nodes.has(key))nodes.set(key,{p,links:[]});return key;};
   for(let j=0;j<idx.length;j+=3){const pts=[0,1,2].map(k=>[a.getX(idx[j+k]),a.getY(idx[j+k]),a.getZ(idx[j+k])]),cross=[];
    for(let k=0;k<3;k++){const p=pts[k],q=pts[(k+1)%3],d=p[ai]-cut,e=q[ai]-cut;if((d<=0&&e>0)||(d>0&&e<=0)){const t=d/(d-e);cross.push(p.map((v,c)=>v+(q[c]-v)*t));}}
    if(cross.length===2){const u=add(cross[0]),v=add(cross[1]);if(u!==v){const n=edges.length;edges.push([u,v]);nodes.get(u).links.push(n);nodes.get(v).links.push(n);segments.push(...cross[0],...cross[1]);}}
   }
   if(!segments.length)continue;
   const line=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(segments,3)),new THREE.LineBasicMaterial({color:'#233f3c',depthTest:true}));line.userData.owner=o;sectionRoot.add(line);
   const used=new Set(),loops=[];
   for(let e=0;e<edges.length;e++){if(used.has(e))continue;let start=edges[e][0],at=start,edge=e,points=[],closed=false;
    for(let k=0;k<=edges.length;k++){if(used.has(edge))break;used.add(edge);points.push(nodes.get(at).p);const pair=edges[edge];at=pair[0]===at?pair[1]:pair[0];if(at===start){closed=true;break;}const next=nodes.get(at).links.filter(x=>!used.has(x));if(next.length!==1)break;edge=next[0];}
    if(closed&&points.length>=3){loops.push(points.map(p=>new THREE.Vector2(p[uv[0]],p[uv[1]])));stats.closedLoops++;}else stats.openChains++;
   }
   // Fill only closed source contours, respecting nested holes. Open parcellation edges remain open.
   const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const u=poly[i],v=poly[j];if((u.y>p.y)!==(v.y>p.y)&&p.x<(v.x-u.x)*(p.y-u.y)/(v.y-u.y)+u.x)c=!c;}return c;};
   const levels=loops.map((l,i)=>loops.reduce((n,k,j)=>n+(i!==j&&inside(l[0],k)?1:0),0));
   const vertices=[];
   for(let i=0;i<loops.length;i++)if(levels[i]%2===0){const contour=loops[i],holes=loops.filter((l,j)=>levels[j]===levels[i]+1&&inside(l[0],contour)),flat=[...contour,...holes.flat()];
    try{for(const tri of THREE.ShapeUtils.triangulateShape(contour,holes))for(const v of tri){const p=[0,0,0];p[ai]=cut+state.cutSign*.018;p[uv[0]]=flat[v].x;p[uv[1]]=flat[v].y;vertices.push(...p);}}catch(err){state.errors.push('section triangulation: '+err.message);}
   }
   if(vertices.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();const cap=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:o.targetColor,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));cap.userData.owner=o;sectionRoot.add(cap);pickMeshes.push(cap);stats.triangles+=vertices.length/9;}
  }
 }
 sectionRoot.userData.stats=stats;sectionRoot.visible=true;
}

function hideObject(id){const o=objects.find(o=>o.r.id===id);if(!o||o.selected)return;pushHistory();state.hiddenObjects.add(id);updateAppearance();}
function renderOccluders(){const list=$('occluderList');if(!list)return;$('hiddenCount').textContent=state.hiddenObjects.size?`已隐藏 ${state.hiddenObjects.size} 项`:'所有结构保持实体深度遮挡';if($('occluderPanel').hidden)return;
 const rows=objects.filter(o=>recordSpace(o.r)===state.space&&(o.targetAlpha>0||state.hiddenObjects.has(o.r.id))).sort((a,b)=>Number(b.selected)-Number(a.selected));
 list.innerHTML=rows.map(o=>`<label class="occluder-row"><input type="checkbox" data-object-visible="${o.r.id}" ${state.hiddenObjects.has(o.r.id)?'':'checked'} ${o.selected?'disabled':''}><i style="background:${stableColor(o.r)}"></i><span>${esc(ZH[o.r.name]||o.r.name)}<small>${esc(o.r.side)}${assembly(o)?' · '+esc(assembly(o)):''}</small></span></label>`).join('');
 list.querySelectorAll('[data-object-visible]').forEach(el=>el.onchange=()=>{pushHistory();const id=Number(el.dataset.objectVisible);el.checked?state.hiddenObjects.delete(id):state.hiddenObjects.add(id);updateAppearance();});
}
function paintForTerm(id){const t=byId.get(id);if(!t)return null;const colors=[...new Set(objects.filter(o=>matchObject(o,t)&&sideMatches(o,t)).map(o=>stableColor(o.r)))];return colors.length>1?`linear-gradient(90deg,${colors.slice(0,6).join(',')})`:colors[0]||null;}
updateNotice=function(){const t=byId.get(state.id),q=qualityOf(t),notes=[];
 if(q==='missing')notes.push('此条缺少独立几何；定位图显示已有邻近结构。');if(q==='functional')notes.push('脑回用于功能定位；不代表个体功能边界。');if(q==='registered')notes.push('跨图谱配准结构，位置仅作参考。');if(q==='cavity')notes.push('此表面为 CT 孔腔标签，不是单独描绘的骨缘。');
 if(state.cutAxis!=='off')notes.push(`${{x:'矢状',y:'水平',z:'冠状'}[state.cutAxis]}实体剖面 · ${state.cut.toFixed(1)} mm · ${state.protectTarget&&!t.overview?'目标完整保留，周围组织切平':'目标与周围一起切开'}。`);
 if(state.cutAxis!=='off'&&['bp3d','bp2018'].includes(state.space))notes.push('未提供的组织留空；空白不表示解剖空腔。');
 else if(state.open>0)notes.push('展示性分离：覆盖组按方案移开，深部结构保留原位；合拢可复核天然位置。');
 if(state.reveal==='ghost')notes.push(state.cutAxis!=='off'?'外表透明辅助，剖面保持实体；目标保留真实深度遮挡。':'透明辅助保留开合与镜头：目标和局部邻近为实体，背景只取最近表面；虚线轮廓表示前方仍有遮挡。');
 if([...state.selected].some(o=>o.r.role==='source-sulcus-model')&&![...state.selected].some(o=>o.r.role!=='source-sulcus-model'))notes.push('当前脑沟是源作者的定位面，不是独立分割的空腔或额外脑组织。');
 if(state.tour==='csf'&&state.showFlow)notes.push('流向示意不表示真实边界或流速。');
 $('sceneNotice').hidden=!notes.length;$('sceneNotice').textContent=notes.join(' ');$('sceneNotice').style.bottom=(document.querySelector('.scene-bottom').offsetHeight+5)+'px';
 const ids=[state.id,...(t.rel||[]).map(([id])=>id)];$('legend').innerHTML=ids.filter((id,i)=>ids.indexOf(id)===i&&paintForTerm(id)).slice(0,6).map(id=>`<button data-legend="${id}" class="${id===state.id?'current':''}"><i style="background:${paintForTerm(id)}"></i>${esc(byId.get(id).zh.split(' · ')[0])}</button>`).join('');$('legend').querySelectorAll('[data-legend]').forEach(b=>b.onclick=()=>select(b.dataset.legend));
 if($('planName')){$('planName').textContent=PLAN_INFO[state.plan].title;$('planDescription').textContent=planDescription();$('continuityNote').textContent=state.continuity;$('sectionMode').value=state.cutAxis;}
};
function planDescription(){return state.space==='bp2018'&&state.plan==='sylvian'?'额顶皮层与额、顶、眶岛盖作为一组向上移，颞上回整体向下外侧移；颞横回、岛叶及其深部邻居保持原位。移开范围大于岛盖，用于同时展示表面入口与沟底。每个脑回保留2018同版本原始边界。':PLAN_INFO[state.plan].description;}
const spatialDetail=renderDetail;
renderDetail=function(){spatialDetail();$('detail').querySelectorAll('.related-link').forEach(b=>{b.querySelector('i').style.background=paintForTerm(b.dataset.select)||'#b5bcb8';const spaces=spacesFor(byId.get(b.dataset.select)),available=spaces.includes(state.space);b.classList.toggle('other-space',!available);if(!available){b.querySelector('b').textContent=spaces.length?'换源':'缺几何';b.title=spaces.length?'此来源没有该结构；点击切换到可用来源':'暂无可核验的独立边界；点击查看邻近结构与说明';}});};
const spatialHeading=renderHeading;
renderHeading=function(){spatialHeading();let b=$('flowToggle');if(!b){b=document.createElement('button');b.id='flowToggle';$('tourBar').append(b);b.onclick=()=>{state.showFlow=!state.showFlow;updateAppearance();renderHeading();};}b.hidden=state.tour!=='csf';b.textContent=state.showFlow?'关闭流向示意':'流向示意';};
buildLabels=function(){const holder=$('worldLabels');holder.innerHTML='<svg class="label-connectors" aria-hidden="true"></svg>';labelNodes=[];if(!state.labels||!state.ready)return;const t=byId.get(state.id);if(t.overview)return;
 const anchors=state.plan==='sylvian'?['a1','insula','heschl_post','operculum_parietal']:state.plan==='deep'?['internal_capsule','caudate','putamen','thalamus']:[];
 const sectionWhite=state.cutAxis!=='off'&&state.space==='legacy'?objects.find(o=>o.r.name==='White matter of telencephalon'&&sameSide(o)):null;
 const ids=[state.id,...anchors,...(t.rel||[]).map(([id])=>id),...(sectionWhite?[ownerTerm(sectionWhite)]:[]),...state.pins].filter((id,i,a)=>a.indexOf(id)===i);
 for(const id of ids){const term=byId.get(id);if(!term)continue;const set=new Set(nativeSet(term).filter(o=>o.targetAlpha>0||state.cutAxis!=='off'&&o.sectionVisible));if(!set.size)continue;
  const el=document.createElement('button');el.className='world-label'+(id===state.id?' selected':'');el.textContent=(id===state.id?'● ':'')+term.zh.split(' · ')[0];el.style.borderLeft='3px solid '+(paintForTerm(id)?.startsWith('#')?paintForTerm(id):'#4d6a60');el.onclick=()=>select(id);holder.append(el);
  const line=document.createElementNS('http://www.w3.org/2000/svg','line'),dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('r','2.5');dot.setAttribute('fill','#2d5843');holder.firstChild.append(line,dot);labelNodes.push({id,set,el,line,dot,selected:id===state.id});if(labelNodes.length>=5)break;
 }
};
updateLabels=function(){if(!state.labels||!camera)return;const a=safeViewport(),placed=[];
 for(const l of labelNodes){const active=[...l.set].filter(o=>(o.group.visible||state.cutAxis!=='off'&&o.sectionVisible)&&!state.hiddenObjects.has(o.r.id)),box=spatialBounds(active,false);let show=!box.isEmpty();if(!show){l.el.hidden=true;l.line.style.display='none';l.dot.style.display='none';continue;}
  const p=box.getCenter(new THREE.Vector3());if(state.cutAxis!=='off'&&!active.some(targetProtected)){const k=state.cutAxis;if(state.cut>=box.min[k]&&state.cut<=box.max[k])p[k]=state.cut;else if((box.max[k]-state.cut)*state.cutSign<0&&(box.min[k]-state.cut)*state.cutSign<0)show=false;} p.project(camera);const px=(p.x+1)*a.w/2,py=(1-p.y)*a.h/2,w=l.el.offsetWidth||110;
  let x=px+18,y=py-10;
  show=show&&p.z<1&&p.z>-1&&px>4&&px<a.w-4&&py>a.top-20&&py<a.h-a.bottom+15;
  if(show){const candidates=[[18,-18],[-w-18,-18],[18,26],[-w-18,26],[12,-53],[-w-12,-53],[12,57],[-w-12,57]];const best=candidates.map(([dx,dy])=>({x:px+dx,y:py+dy,w})).find(r=>r.x>=8&&r.x+w<a.w-a.right&&r.y>a.top+4&&r.y<a.h-a.bottom-12&&!placed.some(k=>r.x<k.x+k.w&&r.x+w>k.x&&Math.abs(r.y-k.y)<30));if(best){x=best.x;y=best.y;placed.push(best);}else if(l.selected){x=Math.max(8,Math.min(px+18,a.w-a.right-w));y=Math.max(a.top+12,Math.min(py-18,a.h-a.bottom-18));placed.push({x,y,w});}else show=false;}
  l.el.hidden=!show;l.line.style.display=show?'':'none';l.dot.style.display=show?'':'none';if(show){l.el.style.left=x+'px';l.el.style.top=y+'px';l.line.setAttribute('x1',px);l.line.setAttribute('y1',py);l.line.setAttribute('x2',Math.max(x,Math.min(px,x+w)));l.line.setAttribute('y2',y);l.dot.setAttribute('cx',px);l.dot.setAttribute('cy',py);}
 }
};

// A separate intact view uses only the same source's original meshes, with no explode or clipping.
function initLocator(){if(locator||!renderer)return;const mini=$('locatorCanvas');if(!mini)return;
 try{const r=new THREE.WebGLRenderer({canvas:mini,alpha:true,antialias:true});r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.setSize(180,132,false);const s=new THREE.Scene();s.add(new THREE.HemisphereLight('#ffffff','#63726f',2.2));const light=new THREE.DirectionalLight('#ffffff',1.8);light.position.set(100,150,180);s.add(light);const cam=new THREE.OrthographicCamera(-110,110,80,-80,.1,2000);locator={renderer:r,scene:s,camera:cam,meshes:[],selected:[],space:null};}catch(err){$('locatorPanel').hidden=true;}
}
function updateLocatorObjects(){if(!state.ready)return;initLocator();if(!locator)return;
 if(locator.space!==state.space){for(const m of [...locator.meshes,...locator.selected]){locator.scene.remove(m);m.material.dispose();}locator.meshes=[];locator.selected=[];locator.space=state.space;
  const list=sourceObjects.filter(o=>recordSpace(o.r)===state.space&&(state.space==='uw'?o.r.category==='skull':state.space==='p41'?o.r.role==='white-context':['cortex','cerebellum'].includes(o.r.category)||['Pons','Medulla oblongata','Midbrain'].includes(o.r.name)));
  for(const o of list)for(const m of o.meshes){const x=new THREE.Mesh(m.geometry,new THREE.MeshLambertMaterial({color:'#a5b4ae',side:THREE.DoubleSide}));locator.scene.add(x);locator.meshes.push(x);}
  locator.box=spatialBounds(list,false); // native positions are used below; exploded positions must not enter locator bounds
  locator.box=new THREE.Box3();for(const o of list)locator.box.union(o.box);if(locator.box.isEmpty())for(const o of sourceObjects.filter(o=>recordSpace(o.r)===state.space))locator.box.union(o.box);
 }
 for(const m of locator.selected){locator.scene.remove(m);m.material.dispose();}locator.selected=[];
 if(!byId.get(state.id).overview)for(const o of state.selected)for(const m of o.meshes){const x=new THREE.Mesh(m.geometry,new THREE.MeshBasicMaterial({color:stableColor(o.r),side:THREE.DoubleSide,depthTest:false,depthWrite:false}));x.renderOrder=5;locator.scene.add(x);locator.selected.push(x);}
 $('locatorCaption').textContent=state.space==='p41'?'单标本脑干 · 目标原位投影':state.space==='uw'?'同源 CT 颅底 · 目标原位投影':'完整皮层参照 · 目标原位投影';
}
function drawLocator(){if(!locator||!locator.box||$('locatorPanel').hidden)return;const b=locator.box,center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3()).length()*.53,c=locator.camera;c.left=-size*180/132;c.right=size*180/132;c.top=size;c.bottom=-size;c.updateProjectionMatrix();c.position.set(0,0,600).applyQuaternion(cameraState.q).add(center);c.quaternion.copy(cameraState.q);locator.renderer.render(locator.scene,c);}
function spatialSnapshot(){let colors=2166136261,poses=2166136261;const hash=(h,s)=>{for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};for(const o of objects)if(recordSpace(o.r)===state.space){colors=hash(colors,o.r.id+':'+o.meshes[0].material.color.getHexString());poses=hash(poses,o.r.id+':'+o.group.position.toArray().map(x=>x.toFixed(3)).join(','));}return{id:state.id,space:state.space,plan:state.plan,open:state.open,side:state.side,cutAxis:state.cutAxis,cut:state.cut,cutSign:state.cutSign,camera:{q:cameraState.q.toArray(),target:cameraState.target.toArray(),distance:cameraState.distance},colors,poses,settled:!poseTween&&!camTween,selected:state.selected.size,opaque:objects.filter(o=>o.group.visible&&o.alpha===1).length,transparent:objects.filter(o=>o.group.visible&&o.alpha<1).length,errors:state.errors.slice(),section:sectionRoot?.userData.stats||null};}
const spatialCompass=drawCompass;drawCompass=function(){spatialCompass();drawLocator();$('renderStatus').dataset.spatialState=JSON.stringify(spatialSnapshot());};
const spatialSync=syncControls;
syncControls=function(){spatialSync();if($('sectionMode'))$('sectionMode').value=state.cutAxis;$('cutPanel').hidden=state.cutAxis==='off';if($('opacityControl'))$('opacityControl').hidden=state.reveal!=='ghost';if($('guideToggle'))$('guideToggle').checked=false;
 $('openSlider').disabled=!state.ready||['surface','skull','nuclei'].includes(state.plan)||state.cutAxis!=='off';$('revealTargetButton').disabled=!state.ready||['skull','nuclei'].includes(state.plan);$('openValue').textContent=Math.round(state.open*100)+'%';
};
function setSection(axis,expose=false){pushHistory();state.cutAxis=axis;state.open=0;state.reveal='smart';if(axis!=='off'){const b=new THREE.Box3();for(const o of state.selected)b.union(o.box);state.cutSign=axis==='x'?(state.planSide==='left'?-1:1):-1;state.cut=b.isEmpty()?0:expose?(state.cutSign<0?b.max[axis]+1:b.min[axis]-1):b.getCenter(new THREE.Vector3())[axis];}
 updateAppearance({instant:true});syncControls();$('cutPanel').hidden=axis==='off';resize();updateNotice();if(axis!=='off')focus({x:state.planSide==='left'?'left':'right',y:'superior',z:'anterior'}[axis]);
}
const spatialBind=bindUI;
bindUI=function(){spatialBind();
 document.querySelector('[data-reveal="smart"]').textContent='解剖观察';document.querySelector('[data-reveal="related"]').textContent='仅看关联';document.querySelector('[data-reveal="ghost"]').textContent='透明辅助';document.querySelector('[data-reveal="isolate"]').textContent='目标单独';
 $('inSituButton').textContent='合拢复核';$('revealTargetButton').textContent='分组移开';$('fitRelationsButton').textContent='目标＋邻近';$('cutButton').textContent='推荐剖面';$('cutButton').onclick=()=>setSection(PLAN_INFO[state.plan].axis,true);$('lockView').parentElement.lastChild.textContent='连续观察';
 $('planInfo').onclick=()=>modal('<h2>'+esc(PLAN_INFO[state.plan].title)+'</h2><p>'+esc(planDescription())+'</p><p>分组移开是展示性分离，源组织之间的天然位置请通过“合拢复核”和右上原位定位图检查。固定剖面按真实三角网格求交，旋转镜头不会改变切面。</p>');
 $('inSituButton').onclick=()=>{pushHistory();state.open=0;state.cutAxis='off';state.reveal='smart';updateAppearance();};
 $('revealTargetButton').onclick=()=>{pushHistory();state.plan=recommendedPlan(byId.get(state.id));if(state.plan==='surface')state.plan='deep';state.open=1;state.cutAxis='off';state.reveal='smart';updateAppearance();};
 $('openSlider').onpointerdown=()=>pushHistory();$('openSlider').oninput=()=>{state.open=Number($('openSlider').value)/100;updateAppearance({instant:true});};$('openSlider').onchange=null;
 $('fitRelationsButton').onclick=()=>{state.fitRelations=true;focus();};$('sectionMode').onchange=()=>setSection($('sectionMode').value);
 $('cutAxis').onchange=()=>setSection($('cutAxis').value);$('cutSlider').onpointerdown=()=>pushHistory();$('cutSlider').oninput=()=>{state.cut=Number($('cutSlider').value);$('cutReadout').textContent=state.cut.toFixed(1)+' mm';scheduleSection();updateNotice();};$('cutFlip').onclick=()=>{if(state.cutAxis==='off')return;pushHistory();state.cutSign*=-1;scheduleSection();focus({x:state.cutSign<0?'left':'right',y:state.cutSign<0?'superior':'inferior',z:state.cutSign<0?'anterior':'posterior'}[state.cutAxis]);};$('cutCenter').onclick=()=>{const b=new THREE.Box3();for(const o of state.selected)b.union(o.box);if(state.cutAxis!=='off'&&!b.isEmpty()){pushHistory();state.cut=b.getCenter(new THREE.Vector3())[state.cutAxis];syncControls();scheduleSection();updateNotice();}};
 document.querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>{pushHistory();state.reveal=b.dataset.reveal;updateAppearance();});
 document.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{pushHistory();state.side=b.dataset.side;state.planSide=sideFor()==='right'?'right':'left';updateAppearance();renderDetail();focus(PLAN_INFO[state.plan].view);});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.query='';$('search').value='';renderList();syncControls();});
 $('occluderButton').onclick=()=>{$('occluderPanel').hidden=!$('occluderPanel').hidden;$('layerPanel').hidden=true;renderOccluders();};$('occluderClose').onclick=()=>$('occluderPanel').hidden=true;$('showHidden').onclick=()=>{pushHistory();state.hiddenObjects.clear();updateAppearance();};
 $('guideToggle').parentElement.hidden=true;$('locatorOverview').onclick=()=>{const selected=state.selected;state.selected=new Set(objects.filter(o=>contextVisible(o)));try{focus(undefined,true,true);}finally{state.selected=selected;}};
 document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='h'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)&&!$('modal').open&&hovered)hideObject(hovered.r.id);});
};
showHelp=function(){modal(`<h2>先定位，再打开，连续看邻接</h2><p>左上选择区域；右上小图始终显示同一来源模型的原位关系。小图中的目标投影可穿过表面，仅用于定位；主视图遵循实体深度遮挡。</p><h3>固定颜色与连续观察</h3><p>同一结构始终使用同一颜色。选中通过深色轮廓和带 ● 的标签表示。“连续观察”默认开启，相邻结构沿用当前观察窗、开合程度和镜头方向；目标离开画面时只平移居中。点“重新居中”或滚轮可放大。</p><h3>两种打开方式</h3><p>“分组移开”让源皮层脑回组成的大组整体平移，深部结构留在原位。它是展示性分离，不表示真实组织间距或手术入路。“合拢复核”把各组放回源坐标。</p><p>“矢状／水平／冠状”是真正固定在模型坐标中的剖面，旋转不会改变切面。切口沿原三角网格求交；仅对闭合交线补同色截面，开放边界不猜补。截面不是组织学纹理。“到目标”、毫米滑块和“翻面”可调节。</p><h3>操作</h3><p>左拖旋转，滚轮缩放，右拖平移；F 居中，R 全脑复位，Ctrl K 搜索，Backspace 返回。返回／前进保存切面、开合、源空间和相机。标签、图例、右侧关系均可点击；“换源”明确表示数据坐标发生变化。隐藏可从遮挡清单操作，或悬停后按 H。</p><p>透明辅助保持开合和镜头，目标及局部邻近保持实体，背景仅取最近表面；虚线选中轮廓表示仍有前景遮挡。Alt + 点击可选透明外层。脑沟定位面仅在直接选择该沟时出现。源模型的面数、标注范围和跨源配准限制仍然存在；显示逻辑不产生新的解剖细节。</p>`);};
const spatialDiagnostic=diagnosticReport;
diagnosticReport=function(){const r=spatialDiagnostic();r.version='3.0';Object.assign(r.current,{plan:state.plan,planSide:state.planSide,hiddenObjects:[...state.hiddenObjects],viewAlignedCutaway:false,fixedSection:state.cutAxis!=='off',continuity:state.continuity});r.fixedColors=objects.filter(o=>o.group.visible).every(o=>o.meshes.every(m=>m.material.color.getHexString()===new THREE.Color(stableColor(o.r)).getHexString()));r.materialDepth={opaque:objects.filter(o=>o.group.visible&&o.alpha===1).length,transparent:objects.filter(o=>o.group.visible&&o.alpha<1).length};r.section=sectionRoot?.userData.stats||null;r.hiddenVisible=objects.filter(o=>state.hiddenObjects.has(o.r.id)&&o.group.visible).map(o=>o.r.id);r.locatorSpace=locator?.space;return r;};
