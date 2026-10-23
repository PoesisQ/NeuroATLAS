/* v3.2: retained target, solid source cross-sections, and explicit tissue context. */
state.protectTarget=true;
function targetProtected(o){return state.cutAxis!=='off'&&state.protectTarget&&!byId.get(state.id)?.overview&&state.selected.has(o);}
function requiredSectionContext(o){return state.cutAxis!=='off'&&recordSpace(o.r)===state.space&&state.space==='legacy'&&state.layers.has(o.r.category)&&['white_matter','deep_grey','diencephalon','ventricles'].includes(o.r.category)&&(o.r.source.startsWith('Z-Anatomy')||o.r.name==='Thalamus');}
const sectionCapture=captureView;
captureView=function(){return{...sectionCapture(),protectTarget:state.protectTarget};};
const sectionRestore=restoreView;
restoreView=function(v,opts){state.protectTarget=v.protectTarget!==false;sectionRestore(v,opts);};
updateClipping=function(){const enabled=state.cutAxis!=='off',built=sectionRoot?.userData.renderState,cut=built?.axis===state.cutAxis&&built.space===state.space?built.cut:state.cut;clipPlane.normal.set(state.cutAxis==='x'?state.cutSign:0,state.cutAxis==='y'?state.cutSign:0,state.cutAxis==='z'?state.cutSign:0);clipPlane.constant=-cut*state.cutSign;
 for(const o of objects)for(const m of o.meshes){const planes=[];if(!o.r.space&&o.r.category==='skull'&&!enabled)planes.push(skullRoof);if(enabled&&!targetProtected(o))planes.push(clipPlane);m.material.clippingPlanes=planes.length?planes:null;}
 if(sectionRoot)sectionRoot.visible=enabled&&built?.axis===state.cutAxis&&built.space===state.space;
};
function sectionPriority(o){return o.r.category==='ventricles'?5:['deep_grey','diencephalon'].includes(o.r.category)?4:o.r.category==='cortex'?3:o.r.category==='white_matter'?1:2;}
function sectionTolerance(o){return Math.max(.00001,...o.r.parts.map(p=>Math.hypot(...p.scale)*1.05));}
function sectionPolicyKey(){return[state.space,state.cutAxis,state.protectTarget,...[...state.selected].map(o=>o.r.id)].join('|');}
scheduleSection=function(){
 // Keep the last COMPLETE section while dragging. Commit plane and cap together;
 // never expose a hollow clipped surface while waiting for a debounce to finish.
 if(state.cutAxis==='off'||sectionRoot?.userData.policy!==sectionPolicyKey()){clearTimeout(sectionTimer);sectionTimer=null;buildSection();return;}
 if(sectionTimer!==null)return;sectionTimer=setTimeout(()=>{sectionTimer=null;buildSection();},32);
};
buildSection=function(){
 if(!scene)return;const visible=objects.filter(o=>o.targetAlpha>0||state.cutAxis!=='off'&&o.sectionVisible),key=[state.space,state.cutAxis,state.cut,state.cutSign,state.protectTarget,...state.selected].map(x=>x?.r?.id??x).concat(visible.map(o=>o.r.id)).join('|');
 if(key===sectionKey){if(sectionRoot)sectionRoot.visible=state.cutAxis!=='off';return;}sectionKey=key;
 if(!sectionRoot){sectionRoot=new THREE.Group();scene.add(sectionRoot);}disposeSection();sectionRoot.userData.policy=sectionPolicyKey();sectionRoot.userData.renderState={space:state.space,axis:state.cutAxis,cut:state.cut};
 if(state.cutAxis==='off'){sectionRoot.userData.stats=null;sectionRoot.visible=false;return;}
 const ai={x:0,y:1,z:2}[state.cutAxis],stats={closedLoops:0,openChains:0,triangles:0,holes:0,rejected:0,areaMM2:0,objects:[],protectedIds:[],solidCaps:true};
 for(const o of visible){
  if(targetProtected(o)){stats.protectedIds.push(o.r.id);continue;}
  if(o.box.min.getComponent(ai)>state.cut||o.box.max.getComponent(ai)<state.cut||o.r.role==='source-sulcus-model')continue;
  const parts=o.meshes.map(m=>({positions:m.geometry.attributes.position.array,indices:m.geometry.index.array}));
  // One source object can span multiple materials. Close its shared contours together.
  const result=SectionGeometry.slice(parts,ai,state.cut,sectionTolerance(o));
  for(const k of['closedLoops','openChains','triangles','holes','rejected','areaMM2'])stats[k]+=result.stats[k];
  stats.objects.push({id:o.r.id,name:o.r.name,...result.stats});
  if(!result.positions.length)continue;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(result.positions,3));
  // All caps lie on EXACTLY the requested plane. Paint them in a stable label order
  // against the 3D depth buffer, WITHOUT competing with other coplanar cap depths.
  // Then write the union's depth in a colorless pass for contour/ghost compositing.
  const priority=sectionPriority(o),cap=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:o.targetColor,side:THREE.DoubleSide,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-2}));
  cap.renderOrder=20+priority+objects.indexOf(o)/(objects.length+1);cap.userData.owner=o;cap.userData.solidSection=true;sectionRoot.add(cap);pickMeshes.push(cap);
  const depth=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide,colorWrite:false,depthWrite:true,depthTest:true,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-2}));depth.renderOrder=10000;depth.userData={owner:o,solidSection:true,capDepth:true};sectionRoot.add(depth);
 }
 sectionRoot.userData.stats=stats;sectionRoot.visible=true;if($('sectionStatus'))$('sectionStatus').textContent=sectionSummary(stats);
};
function sectionSummary(stats){const wm=stats?.objects.filter(o=>o.triangles>0&&/White matter of telencephalon/.test(o.name)).length||0;
 return(wm?'同源端脑白质已形成实体截面':'按原始组织边界形成截面')+' · '+(state.protectTarget&&!byId.get(state.id)?.overview?'完整目标凸出':'目标参与剖切');
}
function positionSectionAtTarget(){const b=new THREE.Box3();for(const o of state.selected)b.union(o.box);if(b.isEmpty())return 0;const axis=state.cutAxis;
 return state.protectTarget&&!byId.get(state.id)?.overview?(state.cutSign<0?b.min[axis]-1.2:b.max[axis]+1.2):b.getCenter(new THREE.Vector3())[axis];
}
function sectionView(){return{x:state.cutSign<0?'left':'right',y:state.cutSign<0?'superior':'inferior',z:state.cutSign<0?'anterior':'posterior'}[state.cutAxis];}
function focusSection(view){
 const box=new THREE.Box3(),axis=state.cutAxis;for(const o of objects){if(o.targetAlpha<=0)continue;const b=o.box.clone();if(!targetProtected(o)){if(state.cutSign<0)b.max[axis]=Math.min(b.max[axis],state.cut);else b.min[axis]=Math.max(b.min[axis],state.cut);}if(!b.isEmpty())box.union(b);}
 if(box.isEmpty())return focus(view);box.expandByScalar(4);const center=box.getCenter(new THREE.Vector3()),q=viewQuaternion(view,byId.get(state.id)),inv=q.clone().invert();let ex=0,ey=0,ez=0;
 for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inv);ex=Math.max(ex,Math.abs(p.x));ey=Math.max(ey,Math.abs(p.y));ez=Math.max(ez,Math.abs(p.z));}
 resize();const a=safeViewport(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),ux=Math.max(.2,(a.w-a.left-a.right)/a.h),uy=Math.max(.2,(a.h-a.top-a.bottom)/a.h);
 tweenCamera({target:center,q,distance:Math.max(ex/(tan*ux*.92),ey/(tan*uy*.92))+ez},true);
}
setSection=function(axis){pushHistory();state.cutAxis=axis;state.open=0;state.reveal='smart';if(axis!=='off'){
  if(state.space==='legacy')for(const layer of['white_matter','deep_grey','diencephalon','ventricles'])state.layers.add(layer);
  // Medial sulci are seen from the interhemispheric side, not through the lateral cortex.
  const medial=axis==='x'&&(byId.get(state.id)?.view==='medial'||['parieto_occipital','calcarine','v1'].includes(state.id));
  state.cutSign=axis==='x'?(state.planSide==='left'?-1:1)*(medial?-1:1):-1;state.cut=positionSectionAtTarget();
 }
 updateAppearance({instant:true});syncControls();resize();updateNotice();if(axis!=='off')focusSection(sectionView());
};
const sectionSync=syncControls;
syncControls=function(){sectionSync();stage.classList.toggle('section-active',state.cutAxis!=='off');if($('protectTarget')){$('protectTarget').checked=state.protectTarget;$('protectTarget').disabled=Boolean(byId.get(state.id)?.overview);$('cutCenter').textContent=state.protectTarget?'露出整个目标':'到目标中心';$('sectionStatus').textContent=sectionSummary(sectionRoot?.userData.stats);}};
const sectionBind=bindUI;
bindUI=function(){sectionBind();
 for(const button of document.querySelectorAll('[data-side]')){const original=button.onclick;button.onclick=()=>{if(state.cutAxis==='off')return original();pushHistory();const oldSide=state.planSide;state.side=button.dataset.side;state.planSide=sideFor()==='right'?'right':'left';setSelectionSets();if(state.cutAxis==='x'&&oldSide!==state.planSide)state.cutSign*=-1;state.cut=positionSectionAtTarget();updateAppearance({instant:true});renderDetail();focusSection(sectionView());};}
 $('protectTarget').onchange=()=>{pushHistory();state.protectTarget=$('protectTarget').checked;updateAppearance({instant:true});};
 $('cutCenter').onclick=()=>{if(state.cutAxis==='off')return;pushHistory();state.cut=positionSectionAtTarget();syncControls();scheduleSection();updateNotice();};
 $('cutFlip').onclick=()=>{if(state.cutAxis==='off')return;pushHistory();state.cutSign*=-1;scheduleSection();syncControls();updateNotice();focusSection(sectionView());};
 $('sectionHelp').onclick=()=>modal('<h2>实体剖面 · 目标完整保留</h2><p>默认只剖开周围组织，所选目标保持完整、位置不变。选择切面后，“露出整个目标”把切面放到目标背后；旋转时切面固定在脑内。</p><p>取消“完整保留目标”后，目标也会参与剖切，可用“到目标中心”查看其内部。相邻区域沿用现有切面；需要进一步显露时再点击“露出整个目标”。</p><p>截面按源网格与平面的闭合交线生成，孔洞保留。参考脑中的端脑白质、核团、脑室随剖面显示。透明辅助只淡化外表，剖面继续保持实体。</p><p>分区模型存在开放或不一致边界，不能从这些边界推断组织；没有闭合交线的局部不补造。截面是解剖模型截面，不是 MRI 或组织学切片。完整白质目前仅来自参考脑；其他来源只显示各自已提供的组织。</p>');
 syncControls();
};
const sectionViewport=safeViewport;
safeViewport=function(){const a=sectionViewport();if(state.cutAxis!=='off'){a.top=Math.min(a.h*.26,document.querySelector('.scene-top').offsetHeight+20);a.bottom=Math.min(a.h*.48,document.querySelector('.scene-bottom').offsetHeight+24);}return a;};
const sectionSnapshot=spatialSnapshot;
spatialSnapshot=function(){return{...sectionSnapshot(),protectTarget:state.protectTarget,displayedCut:sectionRoot?.userData.renderState?.cut,protectedObjects:[...state.selected].filter(targetProtected).map(o=>o.r.id),targetClippedMeshes:[...state.selected].flatMap(o=>o.meshes).filter(m=>m.material.clippingPlanes?.includes(clipPlane)).length,internalContext:objects.filter(o=>o.group.visible&&requiredSectionContext(o)).map(o=>o.r.id)};};
