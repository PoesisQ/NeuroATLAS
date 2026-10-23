'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s).toLowerCase().normalize('NFKC').replace(/[\s\-_'’().·/，、：；（）；]/g,'');
const QLABEL={mesh:'源解剖网格',functional:'功能区定位参考',registered:'图谱配准 · 近似',approx:'范围或位置示意',landmark:'定位标记 · 非孔缘分割',schematic:'独立结构示意',concept:'概念／关系说明',group:'结构组合'};
const CAT={cortex:['皮层表面','surface','#bf8877'],white_matter:['白质与连合','deep','#d1c79e'],deep_grey:['深部灰质','deep','#a18cad'],diencephalon:['间脑','diencephalon','#b39a61'],brainstem:['脑干与上颈髓','stem','#b58e74'],cerebellum:['小脑','stem','#8c9eae'],ventricles:['脑室腔隙','csf','#5b9bad'],meninges_dura:['硬脑膜隔','dura','#9aa980'],veins_sinuses:['静脉窦','dura','#7c8bb1'],cranial_nerves:['脑神经','nerve','#d0ac53'],tracts:['配准纤维通路','deep','#bca973'],arteries:['动脉','foramen','#bf7167'],skull:['颅骨','foramen','#c6bfa6'],annotations:['教学定位标记','foramen','#da9674']};
const RELCOLORS=['#5c9fbc','#8ca66d','#ad83ad','#c1a05d','#668ab3','#b8846b','#6baba0','#a0a75b'];
const RAW=JSON.parse($('atlasMetadata').textContent);
// Missing side suffix of the supplemental right cochlear nerve was corrected during packing.
const course=TERMS.slice(),byId=new Map(TERMS.map(t=>[t.id,t]));
const baseNames=[...new Set(RAW.map(r=>r.name))];
const generalLoc={cortex:'位于大脑皮层表面。源数据分区：',white_matter:'大脑深部白质结构。源数据分区：',deep_grey:'位于深部灰质。源数据分区：',diencephalon:'间脑相关结构。源数据分区：',brainstem:'脑干或上颈髓相关结构。源数据分区：',cerebellum:'小脑的组成部分。源数据分区：',ventricles:'脑室系统及其邻接结构。源数据分区：',meninges_dura:'硬脑膜反折。源数据分区：',veins_sinuses:'颅内静脉窦通道。源数据分区：',cranial_nerves:'脑神经或其组成分支。源数据分区：',tracts:'脑内白质通路的配准参考。源数据分区：',arteries:'脑供血相关动脉分支。源数据分区：',skull:'颅骨组成部分。源数据分区：'};
const atlasTerms=baseNames.map((name,i)=>{
 const rs=RAW.filter(r=>r.name===name),r=rs[0],registered=!r.source.startsWith('Z-Anatomy')&&!r.space;
 const main=course.filter(t=>t.names?.length===1&&t.names[0]===name&&!t.derived&&t.quality==='mesh')[0];
 if(main)return main;
 const t={id:'atlas_'+i,zh:ZH[name]||name,en:name,group:CAT[r.category]?.[1]||'deep',names:[name],loc:(generalLoc[r.category]||'解剖结构。源数据分区：')+(r.region||r.category)+'。',fn:'完整图谱扩展条目：可观察源网格的形态、侧别和相邻结构；本条未编写独立的精细功能讲解。',note:registered?'这是其他图谱配准到参考脑上的结构。位置、尺寸及纤维管径不应作为个体测量依据。':'保留上游的独立结构命名与形态。该参考标本不代表所有人的解剖变异。',quality:registered?'registered':'mesh',refs:[registered?'registration':'atlas'],view:r.category==='skull'?'skull':r.category==='cortex'?'lateral':r.category==='cerebellum'?'posterior':'deep',open:r.category==='cortex'?0:0.65,rel:[],extended:true};
 const relByCat={cortex:['cortex','central'],white_matter:['commissural','association'],deep_grey:['basal','thalamus'],diencephalon:['diencephalon','third'],brainstem:['brainstem','fourth'],cerebellum:['cerebellum','vermis'],ventricles:['ventricles','choroid'],meninges_dura:['dural_septa','sinuses'],veins_sinuses:['sinuses','dural_septa'],cranial_nerves:['brainstem','skullbase'],tracts:['projection','association'],arteries:['skullbase','brain'],skull:['skullbase','cn5']};
 t.rel=(relByCat[r.category]||['brain']).filter(id=>id!==t.id).map(id=>[id,'相关系统']);
 if(name==='Insula (Subcentral gyrus and ant. and post. sulci)'){
  t.quality='approx';t.fn='该源名称混合了岛叶与中央下回分区，不能据此确认完整岛叶的形态。';t.note='FreeSurfer / Destrieux 的 subcentral gyrus（中央下回）与 insular gyri（岛回）是不同分区。结合该网格的表浅范围，怀疑源名称有混合标注；本工具保留原名以便追溯，课程岛叶词条使用 BodyParts3D 的独立岛叶源网格。';t.refs=['destrieux','atlas'];
 }
 if(r.space){t.space=r.space;t.preferredSpace=r.space;t.quality=r.quality||'segmented';t.loc=r.description||t.loc;t.note=r.limitations||t.note;t.refs=[r.space];t.open=0;t.view=r.space==='uw'?'skull':'deep';}
 TERMS.push(t);byId.set(t.id,t);return t;
});
for(const [id,key,url,title] of [
 ['cn2','cn2','https://www.ncbi.nlm.nih.gov/books/NBK507907/','NCBI · Optic Nerve'],['cn3','cn3','https://www.ncbi.nlm.nih.gov/books/NBK537126/','NCBI · Oculomotor Nerve'],['cn6','cn6','https://www.ncbi.nlm.nih.gov/books/NBK430711/','NCBI · Abducens Nerve'],['cn7','cn7','https://www.ncbi.nlm.nih.gov/books/NBK385/','Clinical Methods · Facial Nerve'],['cn9','cn9','https://www.ncbi.nlm.nih.gov/books/NBK386/','Clinical Methods · IX and X'],['cn10','cn10','https://www.ncbi.nlm.nih.gov/books/NBK537171/','NCBI · Vagus Nerve'],['cn12','cn12','https://oac22.hsc.uth.tmc.edu/courses/neuroanatomy/L10P04.html','UTHealth · Hypoglossal Nerve'],['superior_olive','olive','https://www.ncbi.nlm.nih.gov/books/NBK542242/','NCBI · Superior and Inferior Olivary Complex']]){SOURCES[key]=[title,url];byId.get(id).refs=[...new Set([...(byId.get(id).refs||[]),key])];if(id==='superior_olive')byId.get('inferior_olive').refs=[...new Set([...(byId.get('inferior_olive').refs||[]),key])];}

const DEFAULT_LAYERS=['cortex','brainstem','cerebellum'];
const state={id:'brain',tab:'course',query:'',side:'auto',reveal:'smart',open:0,context:.18,history:[],expanded:new Set(['surface']),layers:new Set(DEFAULT_LAYERS),fine:false,labels:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,cutAxis:'off',cut:0,cutSign:1,tour:null,tourIndex:0,selected:new Set(),related:new Map(),broadRelated:new Set(),ready:false,errors:[],fps:0};
let renderer,scene,camera,root,microRoot,canvas=$('brainCanvas'),stage=$('stage');
let objects=[],sourceObjects=[],pickMeshes=[],binary,clockTime=0,camTween=null,hovered=null,lastFrame=performance.now(),frameNo=0,lastMeasure=performance.now(),lastHover=0;
let cameraState={target:new THREE.Vector3(0,-5,0),q:new THREE.Quaternion(),distance:470};
let microGroups={},labelNodes=[],pointerState=new Map(),gesture=null,toastTimer,searchTimer,visibleSearch=[];
const selectionBox=new THREE.Box3(),clipPlane=new THREE.Plane(new THREE.Vector3(1,0,0),0),skullRoof=new THREE.Plane(new THREE.Vector3(0,-1,0),-14);
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),_v=new THREE.Vector3();
let csfRoutes=[],csfDots=[],csfGroup;

function baseColor(r){
 if(r.nativeColor)return r.nativeColor;
 if(r.category==='cortex'){
  if(r.name==='Hippocampus')return '#ac91a1';
  if(r.name.includes('sulcus')||r.name.startsWith('Lat Fis'))return '#9a9b85';
  return {'Frontal lobe':'#bb8976','Parietal lobe':'#9aa98b','Occipital lobe':'#bea668','Temporal lobe':'#8ba2ab','Limbic lobe':'#aa98ac','Insula':'#bba090'}[r.region]||'#b6a595';
 }
 return CAT[r.category]?.[2]||'#a8b39c';
}
function newMaterial(color){return new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.02,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:true});}
function register(r,group,box){
 const o={r,group,box,center:box.getCenter(new THREE.Vector3()),alpha:0,targetAlpha:0,targetPos:new THREE.Vector3(),targetColor:new THREE.Color(baseColor(r)),baseColor:new THREE.Color(baseColor(r)),selected:false,relatedIndex:-1,meshes:[],derived:false};
 group.traverse(c=>{if(c.isMesh){c.userData.owner=o;c.frustumCulled=true;o.meshes.push(c);pickMeshes.push(c);}});
 objects.push(o);root.add(group);return o;
}
function buildRecord(r){
 const group=new THREE.Group(),box=new THREE.Box3();group.name=r.name;
 for(const p of r.parts){
  const q=new Uint16Array(binary,p.po,p.vc*3),positions=new Float32Array(q.length);
  for(let i=0;i<q.length;i++)positions[i]=p.min[i%3]+q[i]*p.scale[i%3];
  const indices=p.it===2?new Uint16Array(binary,p.io,p.ic):new Uint32Array(binary,p.io,p.ic);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setIndex(new THREE.BufferAttribute(indices,1));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  const mat=newMaterial(baseColor(r));if(r.category==='skull')mat.clippingPlanes=[skullRoof];
  const m=new THREE.Mesh(geo,mat);group.add(m);box.union(geo.boundingBox);
 }
 const o=register(r,group,box);sourceObjects.push(o);return o;
}
function derivedCopy(t,filter){
 const src=sourceObjects.filter(o=>t.names.includes(o.r.name));
 for(const o of src){
  const group=new THREE.Group(),box=new THREE.Box3();
  for(const mesh of o.meshes){
   const a=mesh.geometry.attributes.position,old=mesh.geometry.index.array,indices=[];
   for(let i=0;i<old.length;i+=3){const x=(a.getX(old[i])+a.getX(old[i+1])+a.getX(old[i+2]))/3,y=(a.getY(old[i])+a.getY(old[i+1])+a.getY(old[i+2]))/3,z=(a.getZ(old[i])+a.getZ(old[i+1])+a.getZ(old[i+2]))/3;if(filter(x,y,z))indices.push(old[i],old[i+1],old[i+2]);}
   if(!indices.length)continue;
   const geom=mesh.geometry.clone();geom.setIndex(indices);
   // Bounds must reflect only the retained triangles, not the parent attribute array.
   const b=new THREE.Box3();for(const i of new Set(indices))b.expandByPoint(new THREE.Vector3(a.getX(i),a.getY(i),a.getZ(i)));geom.boundingBox=b;geom.boundingSphere=b.getBoundingSphere(new THREE.Sphere());
   group.add(new THREE.Mesh(geom,newMaterial('#dc8c6b')));box.union(b);
  }
  if(!group.children.length)continue;
  const r={...o.r,id:'derived_'+t.id+'_'+o.r.id,name:t.en,source:'教学分区 · 基于源网格',ownerTerm:t.id};const n=register(r,group,box);n.derived=true;
 }
}
function tube(points,radius=.6,color='#dd9474'){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 return new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(10,points.length*8),radius,6,false),newMaterial(color));
}
function annotation(t,points,radius=3.2,style='ring'){
 points.forEach((point,i)=>{
  const group=new THREE.Group();
  if(style==='ring'){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,.35,8,40),newMaterial('#d78d68'));m.rotation.x=Math.PI/2;m.position.set(...point);group.add(m);}
  else if(style==='sphere'){const m=new THREE.Mesh(new THREE.SphereGeometry(radius,16,10),newMaterial('#d78d68'));m.position.set(...point);group.add(m);}
  const box=new THREE.Box3().setFromObject(group);const side=points.length===2?(point[0]>0?'left':'right'):'median';
  register({id:'annotation_'+t.id+'_'+i,name:t.en,side,category:'annotations',region:'教学定位',source:'教学定位标记 · 非扫描分割',ownerTerm:t.id},group,box);
 });
}
function buildTeachingGeometry(){
 const map={interthalamic:[[0,-6,-10]],interpeduncular:[[0,-26,1]],superior_olive:[[6,-47,-12],[-6,-47,-12]],monro:[[3,1,12],[-3,1,12]],luschka:[[13,-50,-26],[-13,-50,-26]],magendie:[[0,-65,-34]],csf_exit:[[0,-75,-44]],olfactory_epithelium:[[5,-35,53],[-5,-35,53]],cribriform:[[6,-29,53],[-6,-29,53]],optic_canal:[[15,-27,39],[-15,-27,39]],sof:[[26,-32,38],[-26,-32,38]],rotundum:[[23,-40,31],[-23,-40,31]],ovale:[[28,-45,19],[-28,-45,19]],iam:[[24,-50,-8],[-24,-50,-8]],stylomastoid:[[43,-75,-11],[-43,-75,-11]],jugular:[[25,-68,-22],[-25,-68,-22]],foramen_magnum:[[0,-77,-32]],hypoglossal_canal:[[14,-73,-19],[-14,-73,-19]]};
 for(const t of course){
  if(t.derived){const filters={wernicke:(x,y,z)=>z<-22,internal_capsule:(x,y,z)=>y>-18&&y<16&&Math.abs(x)>12&&Math.abs(x)<35,anterior_horn:(x,y,z)=>z>9&&y>-3,posterior_horn:(x,y,z)=>z<-43&&y>-18,inferior_horn:(x,y,z)=>y<-8&&z>-44};derivedCopy(t,filters[t.derived]);}
  if(map[t.synthetic])annotation(t,map[t.synthetic],t.id==='foramen_magnum'?15:t.id==='superior_olive'?1.5:2.7,t.id==='superior_olive'||t.id==='interthalamic'?'sphere':'ring');
  if(t.synthetic==='longitudinal'||t.synthetic==='transverse'){
   const points=t.synthetic==='longitudinal'?[[0,42,60],[0,64,10],[0,60,-45],[0,26,-88]]:[[-57,-29,-49],[-28,-27,-75],[0,-29,-85],[28,-27,-75],[57,-29,-49]];
   const group=new THREE.Group();group.add(tube(points,.6));register({id:'annotation_'+t.id,name:t.en,side:'median',category:'annotations',ownerTerm:t.id,source:'间隙定位线 · 非组织'},group,new THREE.Box3().setFromObject(group));
  }
  if(t.synthetic==='falx_cerebelli'){
   const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute([0,-40,-79,0,-84,-70,0,-77,-87,0,-40,-79,0,-77,-87,0,-38,-86],3));geom.computeVertexNormals();const group=new THREE.Group();group.add(new THREE.Mesh(geom,newMaterial('#a8b18c')));register({id:'annotation_'+t.id,name:t.en,side:'median',category:'annotations',ownerTerm:t.id,source:'膜片示意 · 非扫描分割'},group,new THREE.Box3().setFromObject(group));
  }
 }
 buildMicro();buildCSF();
}
function buildMicro(){
 const cell=new THREE.Group(),arbor=new THREE.Group();microRoot.add(cell,arbor);microGroups={purkinje:cell,arbor};
 let seed=481;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 const mat=c=>{const m=newMaterial(c);m.opacity=1;m.transparent=false;return m;};
 const soma=new THREE.Mesh(new THREE.SphereGeometry(7,24,16),mat('#b57c64'));soma.scale.set(.7,1,.6);soma.position.set(0,-28,0);cell.add(soma);
 function branch(group,start,angle,length,width,depth,color){
  const end=[start[0]+Math.sin(angle)*length,start[1]+Math.cos(angle)*length,start[2]+(rand()-.5)*3];
  const mid=start.map((x,i)=>(x+end[i])/2+(i===2?(rand()-.5)*2:0));const m=tube([start,mid,end],width,color);m.material=mat(color);group.add(m);
  if(depth>0){branch(group,end,angle-.27-rand()*.2,length*.71,width*.69,depth-1,color);branch(group,end,angle+.27+rand()*.2,length*.71,width*.69,depth-1,color);}
 }
 branch(cell,[0,-23,0],-.32,24,1.7,6,'#b18266');branch(cell,[0,-23,0],.32,24,1.7,6,'#b18266');
 const axon=tube([[0,-34,0],[1,-51,0],[-3,-76,0],[1,-95,0]],.65,'#759588');axon.material=mat('#759588');cell.add(axon);
 // Histological layers are context panels; there are no numerical scale claims.
 for(const [y,c,opacity] of [[10,'#dae2bd',.13],[-28,'#d4b39a',.18],[-64,'#b7cac0',.13]]){const panel=new THREE.Mesh(new THREE.BoxGeometry(155,y===-28?9:62,8),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity,depthWrite:false}));panel.position.set(0,y,-6);cell.add(panel);}
 for(let i=0;i<75;i++){const granule=new THREE.Mesh(new THREE.SphereGeometry(1.2,6,4),mat('#a0b1a3'));granule.position.set((rand()-.5)*140,-40-rand()*52,(rand()-.5)*4);cell.add(granule);}
 branch(arbor,[0,-70,0],0,37,4,5,'#bbb798');branch(arbor,[0,-70,0],-.65,34,3,4,'#bbb798');branch(arbor,[0,-70,0],.65,34,3,4,'#bbb798');
 cell.visible=false;arbor.visible=false;
}
function buildCSF(){
 csfGroup=new THREE.Group();scene.add(csfGroup);
 const paths=[[[21,12,18],[10,8,15],[3,1,12],[0,-8,5],[0,-13,-17],[0,-22,-23],[0,-42,-24],[0,-62,-32],[0,-75,-47]], [[-21,12,18],[-10,8,15],[-3,1,12],[0,-8,5],[0,-13,-17],[0,-22,-23],[0,-42,-24],[-13,-50,-26],[-26,-53,-32]], [[0,-42,-24],[13,-50,-26],[26,-53,-32]]];
 for(const points of paths){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));csfRoutes.push(c);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(100)),new THREE.LineDashedMaterial({color:'#4e9fa9',dashSize:2,gapSize:2,transparent:true,opacity:.6,depthTest:false}));line.computeLineDistances();line.renderOrder=30;csfGroup.add(line);
  for(let i=0;i<5;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.8,10,6),new THREE.MeshBasicMaterial({color:'#4ba7b1',depthTest:false}));dot.renderOrder=31;csfGroup.add(dot);csfDots.push({dot,c,offset:i/5});}}
 csfGroup.visible=false;
}

function matchObject(o,t){
 if(o.r.ownerTerm)return o.r.ownerTerm===t.id;
 if(t.synthetic||t.derived)return false;
 return t.names?.includes(o.r.name)||t.includeNames?.includes(o.r.name)||t.category?.includes(o.r.category)||(t.region&&o.r.category==='cortex'&&o.r.region===t.region);
}
function sideFor(t=byId.get(state.id)){
 if(state.side!=='auto')return state.side;
 if(t.defaultSide)return t.defaultSide;
 if(['surface','nerve','foramen'].includes(t.group)&&!t.overview&&!['longitudinal','transverse','skullbase','sphenoid'].includes(t.id))return'left';
 return'both';
}
function sideMatches(o,t){const s=sideFor(t);return s==='both'||o.r.side==='median'||o.r.side===s;}
function setSelectionSets(){
 const t=byId.get(state.id);state.selected=new Set(objects.filter(o=>matchObject(o,t)&&sideMatches(o,t)));state.related=new Map();state.broadRelated=new Set();
 (t.rel||[]).forEach(([id],i)=>{const rt=byId.get(id);if(!rt)return;for(const o of objects)if(!state.selected.has(o)&&matchObject(o,rt)&&sideMatches(o,t)&&!state.related.has(o)){state.related.set(o,i%4);if(rt.category||rt.region||rt.names?.length>10)state.broadRelated.add(o);}});
}
function isOuter(o){return o.r.category==='cortex'&&o.r.name!=='Hippocampus';}
function displacement(o,t){
 const v=new THREE.Vector3(),k=state.open,s=o.r.side==='left'?1:o.r.side==='right'?-1:0;
 if(!k||o.r.ownerTerm)return v;
 if(isOuter(o)||o.r.category==='white_matter'){
  if(t.view==='insular'){
   if(o.selected||o.r.name==='Circular sulcus of insula'||o.r.name==='Transverse temporal gyri')return v;
   v.set(s*k*35,(o.r.region==='Temporal lobe'?-15:18)*k,0);
  }else v.set(s*k*46,k*8,0);
 }
 if(o.r.category==='cerebellum'&&t.id!=='cerebellum'&&!['folia','vermis'].includes(t.id))v.set(s*k*4,-k*8,-k*40);
 if(o.r.category==='meninges_dura'&&!state.selected.has(o))v.set(s*k*12,k*17,-k*8);
 return v;
}
function updateAppearance(){
 const t=byId.get(state.id),micro=t.view==='schematic';if(root){root.visible=!micro;microRoot.visible=micro;for(const [id,g] of Object.entries(microGroups))g.visible=micro&&id===t.synthetic;}
 setSelectionSets();
 const overview=t.overview||t.id==='brain',surface=t.group==='surface'&&!['insula','a1','v1','parieto_occipital','calcarine'].includes(t.id),s=sideFor(t);
 for(const o of objects){
  const r=o.r;let alpha=0,color=o.baseColor;
  o.selected=state.selected.has(o);o.relatedIndex=state.related.has(o)?state.related.get(o):-1;
  if(!r.ownerTerm&&!o.derived&&state.layers.has(r.category)){
   const reg=!r.source.startsWith('Z-Anatomy')&&!r.space;
   if(reg&&!state.fine&&r.category!=='tracts')alpha=0;
   else if(overview)alpha=(isOuter(o)||r.category==='cerebellum'||r.name==='Pons'||r.name==='Medulla oblongata'||r.name==='Midbrain')?.98:.0;
   else if(isOuter(o))alpha=state.context*.16;
   else if(r.category==='cerebellum')alpha=state.context*.25;
   else if(r.category==='brainstem')alpha=['Pons','Midbrain','Medulla oblongata','White matter of spinal cord'].includes(r.name)?state.context*.65:0;
   else alpha=state.context*.6;
   if(r.category==='white_matter')alpha=Math.min(alpha,.035);
   if(r.category==='tracts')alpha=Math.min(alpha,.09);
   if(r.category==='skull')alpha=Math.min(alpha,.18);
   if(r.category==='veins_sinuses'||r.category==='arteries')alpha=Math.min(alpha,.25);
   if(s!=='both'&&r.side!=='median'&&r.side!==s)alpha*=.18;
  }
  if(!overview&&!o.selected&&o.relatedIndex<0)color=new THREE.Color('#bcc3b1');
  if(overview&&o.selected)color=o.baseColor;
  if(o.relatedIndex>=0){alpha=.88;color=new THREE.Color(RELCOLORS[o.relatedIndex]);}
  if(state.broadRelated.has(o))alpha=.045;
  if(o.selected){alpha=1;color=overview?o.baseColor:new THREE.Color('#e1825e');}
  if(state.reveal==='related'&&!o.selected&&o.relatedIndex<0)alpha=0;
  if(state.reveal==='isolate'&&!o.selected)alpha=0;
  if(state.reveal==='ghost'&&!o.selected&&o.relatedIndex<0)alpha=Math.min(alpha,.075);
  // Large surface lobes in relationship sets stay translucent so they cannot cover an embedded target.
  if(!surface&&!overview&&o.relatedIndex>=0&&isOuter(o)&&t.id!=='cerebellum'&&t.id!=='vermis')alpha=Math.min(alpha,.07);
  if(t.view==='insular'&&o.relatedIndex>=0&&isOuter(o)&&!o.selected)alpha=Math.min(alpha,.07);
  if(!overview&&o.relatedIndex>=0&&['cortex','white_matter','diencephalon','brainstem','cerebellum','skull'].includes(r.category)){
   const volume=b=>{const s=b.getSize(new THREE.Vector3());return s.x*s.y*s.z;};
   if([...state.selected].some(s=>o.box.containsPoint(s.center)&&volume(o.box)>volume(s.box)*4))alpha=Math.min(alpha,.065);
  }
  if(r.name==='Interpeduncular fossa'&&!o.selected)alpha=0;
  if(o.derived&&!o.selected&&o.relatedIndex<0)alpha=0;
  o.targetAlpha=micro?0:alpha;o.targetColor.copy(color);o.targetPos.copy(displacement(o,t));
  for(const m of o.meshes){m.renderOrder=o.selected?4:o.relatedIndex>=0?2:0;m.material.polygonOffset=o.derived;m.material.polygonOffsetFactor=o.derived?-2:0;m.material.polygonOffsetUnits=o.derived?-2:0;}
 }
 if(csfGroup)csfGroup.visible=!micro&&state.tour==='csf';
 syncControls();buildLabels();updateNotice();
}
function desiredDirection(view,t){
 const left=sideFor(t)!=='right';
 return {oblique:[1,.45,.7],lateral:[left?1:-1,.12,.08],right:[-1,.12,.08],anterior:[0,.05,1],posterior:[0,.12,-1],superior:[0,1,.05],inferior:[.06,-1,.18],medial:[left?-1:1,.08,.05],deep:[left?1:-1,.55,.75],stem:[.12,-.06,1],ventricles:[left?1:-1,.38,.68],insular:[left?1:-1,.35,.3],skull:[.15,1,.4],schematic:[0,.07,1]}[view]||[1,.3,.65];
}
function viewQuaternion(view,t){
 const dir=new THREE.Vector3(...desiredDirection(view,t)).normalize(),up=['inferior','superior'].includes(view)?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(dir,new THREE.Vector3(),up));
}
function boundsOf(set,predicted=true){const b=new THREE.Box3();for(const o of set){const p=predicted?o.targetPos:o.group.position;b.union(o.box.clone().translate(p));}return b;}
function focus(view,animate=true){
 if(!camera)return;const t=byId.get(state.id),q=view?viewQuaternion(view,t):cameraState.q.clone();
 let box=t.view==='schematic'?new THREE.Box3().setFromObject(microGroups[t.synthetic]):boundsOf(state.selected);
 if(box.isEmpty())box=boundsOf(sourceObjects.filter(o=>isOuter(o)||o.r.category==='cerebellum'));
 box=box.clone().expandByScalar(t.view==='schematic'?10:t.overview?0:3);
 const center=box.getCenter(new THREE.Vector3()),inv=q.clone().invert();
 let ex=0,ey=0,ez=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new THREE.Vector3(x,y,z).sub(center).applyQuaternion(inv);ex=Math.max(ex,Math.abs(v.x));ey=Math.max(ey,Math.abs(v.y));ez=Math.max(ez,Math.abs(v.z));}
 const w=stage.clientWidth,h=stage.clientHeight,aspect=w/h,usableY=Math.max(.28,(h-295)/h),half=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const distance=Math.max(25,Math.max(Math.max(ex,8)/(half*aspect*.77),Math.max(ey,8)/(half*usableY))+ez*.65);
 const dest={target:center,q,distance:Math.min(1800,distance)};
 if(!animate||state.reduced){cameraState.target.copy(dest.target);cameraState.q.copy(dest.q);cameraState.distance=dest.distance;camTween=null;}
 else camTween={start:performance.now(),duration:780,from:{target:cameraState.target.clone(),q:cameraState.q.clone(),distance:cameraState.distance},to:dest};
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.setViewOffset(w,h,w*.035,-h*.005,w,h);camera.updateProjectionMatrix();}
function syncCamera(){camera.position.set(0,0,cameraState.distance).applyQuaternion(cameraState.q).add(cameraState.target);camera.quaternion.copy(cameraState.q);camera.updateMatrixWorld();}
function renderAtlas(){renderer.render(scene,camera);}
function animate(now){
 requestAnimationFrame(animate);if(!renderer||!state.ready)return;
 const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;clockTime+=dt;const k=state.reduced?1:1-Math.exp(-dt*7.5);
 if(camTween){const p=Math.min(1,(now-camTween.start)/camTween.duration),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;cameraState.target.lerpVectors(camTween.from.target,camTween.to.target,e);cameraState.q.slerpQuaternions(camTween.from.q,camTween.to.q,e);cameraState.distance=THREE.MathUtils.lerp(camTween.from.distance,camTween.to.distance,e);if(p===1)camTween=null;}
 stepPose(now,dt,k);
 syncCamera();updateClipping();if(csfGroup?.visible&&!state.reduced)for(const d of csfDots)d.dot.position.copy(d.c.getPointAt((clockTime*.10+d.offset)%1));
 renderAtlas();if(frameNo%2===0)updateLabels();if(frameNo%4===0)drawCompass();frameNo++;
 if(now-lastMeasure>2000){state.fps=Math.round(frameNo*1000/(now-lastMeasure));frameNo=0;lastMeasure=now;$('renderStatus').textContent=byId.get(state.id).view==='schematic'?'独立尺度 · 形态示意':`定位 ${state.selected.size} · 可见 ${objects.filter(o=>o.group.visible).length}`;}
}
function updateClipping(){
 const enabled=state.cutAxis!=='off',normal=new THREE.Vector3(state.cutAxis==='x'?state.cutSign:0,state.cutAxis==='y'?state.cutSign:0,state.cutAxis==='z'?state.cutSign:0);clipPlane.normal.copy(normal);clipPlane.constant=-state.cut*state.cutSign;
 for(const o of objects)for(const m of o.meshes){const planes=[];if(o.r.category==='skull')planes.push(skullRoof);if(enabled)planes.push(clipPlane);m.material.clippingPlanes=planes.length?planes:null;}
}

function qualityOf(t){
 if(t.quality!=='mesh'&&t.quality!=='group')return t.quality;
 const parts=[...state.selected].filter(o=>!o.r.ownerTerm);if(parts.length&&parts.some(o=>!o.r.source.startsWith('Z-Anatomy')))return'registered';
 return t.quality;
}
function select(id,{push=true,side,keepTour=false,animate=true}={}){
 clearTimeout(searchTimer);
 const t=byId.get(id);if(!t)return;
 if(push&&state.id!==id){state.history.push({id:state.id,side:state.side,reveal:state.reveal,open:state.open});if(state.history.length>80)state.history.shift();}
 if(side)state.side=side;if(!keepTour)state.tour=null;
 state.id=id;state.open=state.cutAxis==='off'?(t.open||0):0;state.expanded.add(t.group);
 if(state.ready){updateAppearance();focus(t.view,animate);}else setSelectionSets();
 renderList();renderDetail();renderHeading();syncControls();
 try{history.replaceState(null,'','#'+encodeURIComponent(id));}catch(_){}
 if(innerWidth<=760)$('sidebar').classList.remove('open');
}
function goBack(){const prev=state.history.pop();if(!prev)return;state.side=prev.side;state.reveal=prev.reveal;select(prev.id,{push:false});state.open=prev.open;updateAppearance();focus(byId.get(state.id).view);}
function reset(){state.side='auto';state.reveal='smart';state.context=.18;state.cutAxis='off';state.cut=0;state.cutSign=1;state.layers=new Set(DEFAULT_LAYERS);state.fine=false;state.labels=true;state.query='';$('search').value='';state.tab='course';state.tour=null;select('brain');$('cutPanel').hidden=true;}
function syncControls(){
 const micro=byId.get(state.id).view==='schematic';
 $('openSlider').value=Math.round(state.open*100);$('openValue').textContent=Math.round(state.open*100)+'%';$('opacitySlider').value=Math.round(state.context*100);$('opacityValue').textContent=Math.round(state.context*100)+'%';
 document.querySelectorAll('[data-reveal]').forEach(b=>{b.disabled=micro||!state.ready;b.classList.toggle('active',b.dataset.reveal===state.reveal);b.setAttribute('aria-pressed',b.dataset.reveal===state.reveal);});
 document.querySelectorAll('[data-side]').forEach(b=>{b.disabled=micro||!state.ready;b.classList.toggle('active',b.dataset.side===state.side);b.setAttribute('aria-pressed',b.dataset.side===state.side);});
 $('openSlider').disabled=micro||!state.ready;$('opacitySlider').disabled=micro||!state.ready;$('cutButton').disabled=micro||!state.ready;
 for(const id of ['focusButton','snapshotButton','layerButton'])$(id).disabled=!state.ready;
 document.querySelectorAll('[data-view]').forEach(b=>b.disabled=!state.ready);
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.setAttribute('aria-selected',b.dataset.tab===state.tab);});
 $('backButton').disabled=state.history.length===0;$('cutAxis').value=state.cutAxis;$('cutSlider').value=state.cut;$('labelToggle').checked=state.labels;$('motionToggle').checked=state.reduced;$('atlasFine').checked=state.fine;
 document.querySelectorAll('[data-layer]').forEach(el=>el.checked=state.layers.has(el.dataset.layer));
}
function renderHeading(){
 const t=byId.get(state.id),gi=GROUPS.findIndex(g=>g.id===t.group),g=GROUPS[gi];
 $('sceneEyebrow').textContent=(g?.en||'ANATOMY').toUpperCase()+' / '+String(gi+1).padStart(2,'0');
 $('sceneTitle').textContent=t.id==='brain'?'建立大脑的空间地图':t.zh.replace(/ · .*/, '');
 $('sceneSubtitle').textContent=t.id==='brain'?'从完整外形开始，逐层探索。':t.view==='schematic'?'独立尺度示意 · 可自由旋转':t.en;
 const pkeys={brain:['surface'],callosum:[],basal:['deep','diencephalon'],ventricles:['csf'],brainstem:['stem'],cn5:['nerve'],skullbase:['foramen']};
 document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.id||pkeys[b.dataset.preset]?.includes(t.group)));
 if(t.view==='medial')document.querySelector('[data-preset="callosum"]').classList.add('active');
 const tour=TOURS.find(x=>x.id===state.tour);$('tourBar').hidden=!tour;
 if(tour){$('tourName').textContent=tour.zh;$('tourStep').textContent=`${state.tourIndex+1} / ${tour.steps.length}`;$('tourPrev').disabled=state.tourIndex===0;$('tourNext').disabled=state.tourIndex===tour.steps.length-1;}
}
function renderDetail(){
 const t=byId.get(state.id),g=GROUPS.find(x=>x.id===t.group),q=qualityOf(t),num=course.findIndex(x=>x.id===t.id),side=sideFor(t),parts=[...state.selected];
 const related=(t.rel||[]).map(([id,relation],i)=>{const rt=byId.get(id);if(!rt)return'';return`<button class="related-link" data-select="${esc(id)}"><i style="background:${RELCOLORS[i%4]}"></i><div>${esc(rt.zh.replace(/ · .*/,''))}<small>${esc(relation)}</small></div><b>↗</b></button>`;}).join('');
 const paths=t.path?`<section><h3>走行 · 按顺序联系</h3><div class="path">${t.path.map(([name,id],i)=>`<div class="path-step"><i>${i+1}</i>${id?`<button data-select="${esc(id)}">${esc(name)} ↗</button>`:`<span>${esc(name)}</span>`}</div>`).join('')}</div></section>`:'';
 const sources=[...new Set([...(t.refs||[]),'atlas',...(parts.some(o=>o.r.id>=1000)?['za']:[]),...(q==='registered'?['registration']:[])])];
 const sourceNames=[...new Set(parts.map(o=>o.r.source))];
 $('detail').innerHTML=`<div class="detail-breadcrumb"><span>${esc(g?.zh||'解剖图谱')}</span><span class="entry-index">${num>=0?String(num+1).padStart(3,'0'):'ATLAS'}</span></div><h2>${esc(t.zh)}</h2><p class="entry-en">${esc(t.en)}</p><div class="entry-meta"><span class="quality-badge" data-quality="${esc(q)}">${q==='mesh'?'●':'◇'} ${esc(QLABEL[q]||q)}</span><span class="entry-side">${side==='both'?'双侧／中线':side==='left'?'左侧优先':'右侧优先'}</span></div><section><h3>在哪里</h3><p>${esc(t.loc)}</p></section><section><h3>基本功能</h3><p>${esc(t.fn)}</p></section><section><h3>辨认与记忆</h3><p class="note">${esc(t.note)}</p></section>${paths}<section><h3>联系着看 · 颜色对应场景</h3><div class="related-list">${related}</div></section><div class="detail-buttons"><button data-action="focus">◎ 居中观察</button><button data-action="relations">只看关联结构</button></div>${t.group==='csf'?'<div class="detail-buttons"><button data-action="csfTour">→ 跟随脑脊液路线</button></div>':''}<details class="detail-sources"><summary>网格来源与参考资料</summary>${sources.map(key=>SOURCES[key]?`<a href="${esc(SOURCES[key][1])}" target="_blank" rel="noopener noreferrer">${esc(SOURCES[key][0])} ↗</a>`:'').join('')}<div class="source-note">${esc(sourceNames.join('；')||'无独立源网格，以相关对象或示意说明。')}${parts.some(o=>o.r.cropped)?'<br>神经网格已在颈部裁切，末端不是自然终点。':''}<br>颜色用于学习；人体存在左右差异和个体变异。</div></details>`;
 $('detail').querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>select(b.dataset.select));
 $('detail').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(b.dataset.action==='focus')focus();if(b.dataset.action==='relations'){state.reveal='related';updateAppearance();}if(b.dataset.action==='csfTour')startTour('csf');});
 if(t.view==='schematic')$('detail').querySelector('.entry-side').textContent='独立尺度';
 $('detail').scrollTop=0;
}
function score(t,q){
 const n=norm(q),fields=[t.zh,t.en,t.zh.split(' · ')[0],t.en.split(' · ')[0],...(t.aliases||[])].map(norm);if(fields.some(x=>x===n))return 100;
 if(fields.some(x=>x.startsWith(n)))return 70;if(fields.some(x=>x.includes(n)))return 50;
 if(norm(t.zh+t.en+(t.aliases||[]).join('')).includes(n))return 30;
 return 0;
}
function row(t,search=false){const q=t.quality;return`<button class="term-row${t.id===state.id?' selected':''}" data-term="${esc(t.id)}" title="${esc(t.en)}"><span>${esc(t.zh)}${search||state.tab==='atlas'?`<small>${esc(t.en)}</small>`:''}</span>${['mesh','group'].includes(q)?'':'<i class="quality-dot" title="定位参考、配准或示意"></i>'}<span class="term-arrow">›</span></button>`;}
function renderList(){
 const list=$('structureList');$('clearSearch').hidden=!state.query;
 if(state.tab==='tours'&&!state.query){list.innerHTML=TOURS.map((t,i)=>`<button class="tour-card" data-tour="${t.id}"><span class="eyebrow">ROUTE ${String(i+1).padStart(2,'0')}</span><b>${esc(t.zh)}</b><p>${esc(t.desc)}</p><small>${t.steps.length} 站 · 开始探索 →</small></button>`).join('');$('listCount').textContent=`${TOURS.length} 条引导路线`;list.querySelectorAll('[data-tour]').forEach(b=>b.onclick=()=>startTour(b.dataset.tour));return;}
 const pool=state.query?TERMS:state.tab==='atlas'?atlasTerms:course;
 let found=pool;
 if(state.query){const seen=new Set();found=pool.map(t=>({t,s:score(t,state.query)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||Number(a.t.extended)-Number(b.t.extended)).map(x=>x.t).filter(t=>{const k=t.id;if(seen.has(k))return false;seen.add(k);return true;});}
 visibleSearch=found;$('listCount').textContent=state.query?`${found.length} 个匹配 · 停顿后自动定位`:`${pool.length} 个${state.tab==='atlas'?'独立结构名称':'课程词条'} · 点击展开分类`;
 if(!found.length)list.innerHTML='<p class="empty-list">没有找到匹配。可以试试中文名、英文名或常用缩写，如“中央沟”“thalamus”“CN IV”。</p>';
 else if(state.query)list.innerHTML=found.map(t=>row(t,true)).join('');
 else list.innerHTML=GROUPS.map(g=>{const ts=found.filter(t=>t.group===g.id);if(!ts.length)return'';const expanded=state.expanded.has(g.id);return`<button class="group-head" data-group="${g.id}" aria-expanded="${expanded}"><i class="group-dot" style="background:${g.color}"></i>${g.zh}<small>${ts.length}</small><span class="chevron">${expanded?'−':'＋'}</span></button>${expanded?ts.map(t=>row(t)).join(''):''}`;}).join('');
 list.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{const id=b.dataset.group;state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);renderList();});
 list.querySelectorAll('[data-term]').forEach(b=>b.onclick=()=>select(b.dataset.term));
 syncControls();
}
function querySide(q){if(/右|\bright\b/i.test(q))return'right';if(/左|\bleft\b/i.test(q))return'left';return undefined;}
function searchInput(){
 state.query=$('search').value.trim();renderList();clearTimeout(searchTimer);
 const raw=state.query;if(!raw)return;
 searchTimer=setTimeout(()=>{if(state.query!==raw||!visibleSearch.length)return;const match=visibleSearch[0],s=score(match,raw);if(s>=50&&(norm(raw).length>=2||visibleSearch.length===1))select(match.id,{side:querySide(raw)});},500);
}
function startTour(id){const t=TOURS.find(x=>x.id===id);if(!t)return;state.tour=id;state.tourIndex=0;state.reveal='smart';state.side='auto';select(t.steps[0],{keepTour:true});}
function tourMove(delta){const tour=TOURS.find(x=>x.id===state.tour);if(!tour)return;state.tourIndex=THREE.MathUtils.clamp(state.tourIndex+delta,0,tour.steps.length-1);select(tour.steps[state.tourIndex],{keepTour:true});}
function updateNotice(){
 const t=byId.get(state.id),q=qualityOf(t),notes=[];
 if(t.view==='schematic')notes.push('独立尺度的结构示意；不与宏观脑模型作比例比较。');
 else if(['landmark','approx'].includes(q))notes.push('◇ 当前高亮含教学定位或范围示意，请结合右侧精度说明。');
 else if(q==='registered')notes.push('◇ 当前包含跨图谱配准结构，空间位置仅供学习参考。');
 else if(q==='functional')notes.push('◇ 按脑回／脑沟定位功能区，未分割组织学边界。');
 if(state.open>.01&&t.view!=='schematic')notes.push(`展开 ${Math.round(state.open*100)}% · 移动用于显露；合拢后查看原始空间关系。`);
 if(t.group==='foramen')notes.push('颅顶已隐藏；孔道定位环为注释，骨网格保留原坐标。');
 if(state.tour==='csf')notes.push('粒子与连线仅示意连通方向，不表示真实流速或管径。');
 $('sceneNotice').hidden=!notes.length;$('sceneNotice').textContent=notes.join(' ');
 const overview=t.overview||t.id==='brain';
 $('legend').innerHTML=overview?`<span><i style="background:#bb8976"></i>额叶</span><span><i style="background:#9aa98b"></i>顶叶</span><span><i style="background:#8ba2ab"></i>颞叶</span><span><i style="background:#bea668"></i>枕叶</span><span><i style="background:#8c9eae"></i>小脑</span>`:`<span><i style="background:#e1825e"></i>所选</span>${(t.rel||[]).slice(0,4).map(([id],i)=>`<span><i style="background:${RELCOLORS[i]}"></i>${esc(byId.get(id)?.zh.replace(/ · .*/,''))}</span>`).join('')}`;
 if(t.view==='schematic')$('legend').textContent='独立尺度示意 · 宏观关联请点击右侧词条切换';
}
function buildLabels(){
 const holder=$('worldLabels');holder.innerHTML='';labelNodes=[];if(!state.labels)return;const t=byId.get(state.id);if(t.overview)return;
 const groups=[{name:t.zh.replace(/ · .*/,''),set:state.selected,selected:true},...(t.rel||[]).slice(0,4).map(([id],i)=>({name:byId.get(id)?.zh.replace(/ · .*/,''),set:new Set([...state.related].filter(([o,j])=>j===i).map(([o])=>o)),selected:false}))];
 if(t.view==='schematic'){const box=new THREE.Box3().setFromObject(microGroups[t.synthetic]);groups.length=0;groups.push({name:t.id==='purkinje'?'浦肯野细胞 · 示意':'髓树分支 · 示意',point:box.getCenter(new THREE.Vector3()),selected:true});}
 for(const g of groups){if(!g.name||(!g.point&&!g.set.size))continue;const el=document.createElement('span');el.className='world-label'+(g.selected?' selected':'');el.textContent=g.name;holder.append(el);labelNodes.push({...g,el});}
}
function updateLabels(){
 if(!state.labels||!camera)return;const w=stage.clientWidth,h=stage.clientHeight,placed=[];
 for(const l of labelNodes){const p=l.point?.clone()||boundsOf(l.set,false).getCenter(new THREE.Vector3());p.project(camera);let x=(p.x+1)/2*w,y=(1-p.y)/2*h;const width=l.el.offsetWidth||110,height=24;
  let visible=p.z<1&&p.z>-1&&x>0&&x<w-20&&y>135&&y<h-215;
  if(visible){x=Math.min(x,w-width-14);for(let i=0;i<6;i++){if(!placed.some(r=>x<r.x+r.w&&x+width>r.x&&Math.abs(y-r.y)<27))break;y+=29;}if(y>h-215)visible=false;else placed.push({x,y,w:width});}
  l.el.hidden=!visible;if(visible){l.el.style.left=x+'px';l.el.style.top=y+'px';}
 }
}
function drawCompass(){
 const c=$('compass'),ctx=c.getContext('2d'),inv=cameraState.q.clone().invert();ctx.clearRect(0,0,156,156);ctx.save();ctx.translate(78,78);ctx.scale(2,2);ctx.lineWidth=.7;
 const axes=[['左 L',1,0,0,'#b78374'],['右 R',-1,0,0,'#b78374'],['上 S',0,1,0,'#8ea17b'],['下 I',0,-1,0,'#8ea17b'],['前 A',0,0,1,'#7b9da1'],['后 P',0,0,-1,'#7b9da1']].map(([name,x,y,z,color])=>({name,color,v:new THREE.Vector3(x,y,z).applyQuaternion(inv)})).sort((a,b)=>a.v.z-b.v.z);
 for(const a of axes){ctx.globalAlpha=a.v.z<0?.4:.9;ctx.strokeStyle=a.color;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(a.v.x*20,-a.v.y*20);ctx.stroke();ctx.fillStyle=a.color;ctx.font='7px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(a.name,a.v.x*29,-a.v.y*29);}
 ctx.globalAlpha=1;ctx.fillStyle='#a3b08f';ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();ctx.restore();
}

const ownerTerm=o=>o.r.ownerTerm||course.find(t=>t.names?.length===1&&t.names[0]===o.r.name&&!t.derived&&!t.synthetic)?.id||o.r.termIds?.find(id=>byId.has(id)&&!byId.get(id).overview&&!byId.get(id).region&&!byId.get(id).category)||atlasTerms.find(t=>t.names?.includes(o.r.name))?.id||o.r.termIds?.find(id=>byId.has(id)&&!byId.get(id).overview)||'brain';
function pick(x,y,alt=false){
 if(!state.ready||byId.get(state.id).view==='schematic')return null;
 const rect=canvas.getBoundingClientRect();mouse.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);
 const meshes=pickMeshes.filter(m=>{const o=m.userData.owner;return m.parent?.visible!==false&&(o.group.visible||m.userData.solidSection&&o.sectionVisible)&&(m.userData.solidSection||alt||state.reveal!=='ghost'||o.visualRole!=='context')&&(m.userData.solidSection||o.alpha>(alt?.04:.42));});
 const hits=raycaster.intersectObjects(meshes,false).filter(h=>(h.object.material.clippingPlanes||[]).every(p=>p.distanceToPoint(h.point)>=0));
 // Coplanar section labels use the same stable priority for picking and painting.
 hits.sort((a,b)=>a.object.userData.solidSection&&b.object.userData.solidSection&&Math.abs(a.distance-b.distance)<.0001?b.object.renderOrder-a.object.renderOrder:a.distance-b.distance);
 const unique=[];for(const hit of hits){const o=hit.object.userData.owner;if(!unique.includes(o))unique.push(o);}if(!unique.length)return null;
 if(alt){const current=unique.findIndex(o=>ownerTerm(o)===state.id);return unique[(current+1)%unique.length];}return unique[0];
}
function arcball(x,y){const r=canvas.getBoundingClientRect(),scale=Math.min(r.width,r.height)*.5,v=new THREE.Vector3((x-r.left-r.width*.5)/scale,(r.height*.5-y+r.top)/scale,0),length=v.x*v.x+v.y*v.y;v.z=length<.5?Math.sqrt(1-length):.5/Math.sqrt(length);return v.normalize();}
function pan(dx,dy){const k=2*cameraState.distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/stage.clientHeight;cameraState.target.add(new THREE.Vector3(-dx*k,dy*k,0).applyQuaternion(cameraState.q));}
function bindPointer(){
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{if(!state.ready)return;camTween=null;$('hoverTip').hidden=true;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointerState.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,button:e.button});gesture=null;if(pointerState.size===2){const ps=[...pointerState.values()];gesture={d:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2,pinch:true};}});
 canvas.addEventListener('pointermove',e=>{
  const p=pointerState.get(e.pointerId);
  if(p){const old={...p};p.x=e.clientX;p.y=e.clientY;
   if(pointerState.size===2){const ps=[...pointerState.values()],d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),x=(ps[0].x+ps[1].x)/2,y=(ps[0].y+ps[1].y)/2;if(gesture){cameraState.distance=THREE.MathUtils.clamp(cameraState.distance*gesture.d/Math.max(1,d),3,2400);pan(x-gesture.x,y-gesture.y);}gesture={d,x,y,pinch:true};}
   else if(p.button===2||e.ctrlKey||e.metaKey||e.shiftKey)pan(p.x-old.x,p.y-old.y);
   else{const previous=arcball(old.x,old.y),current=arcball(p.x,p.y),delta=new THREE.Quaternion().setFromUnitVectors(current,previous);cameraState.q.multiply(delta).normalize();}
   return;
  }
  if(performance.now()-lastHover<120||camTween)return;lastHover=performance.now();const o=pick(e.clientX,e.clientY,e.altKey);hovered=o;canvas.style.cursor=o?'pointer':'grab';
  if(o){const tip=$('hoverTip'),r=stage.getBoundingClientRect();tip.innerHTML=esc(ZH[o.r.name]||byId.get(ownerTerm(o))?.zh||o.r.name)+`<small>${esc(o.r.name)} · ${{left:'左',right:'右',single:'单半球源标本',both:'源标签含双侧',median:'中线'}[o.r.side]||'侧别未标注'}</small>`;tip.style.left=Math.min(e.clientX-r.left+14,r.width-235)+'px';tip.style.top=Math.min(e.clientY-r.top+14,r.height-70)+'px';tip.hidden=false;}else $('hoverTip').hidden=true;
 });
 const up=e=>{const p=pointerState.get(e.pointerId);if(!p)return;const click=pointerState.size===1&&!gesture?.pinch&&Math.hypot(e.clientX-p.sx,e.clientY-p.sy)<5&&p.button===0;pointerState.delete(e.pointerId);if(!pointerState.size)gesture=null;
  if(click){const o=pick(e.clientX,e.clientY,e.altKey);if(o)select(ownerTerm(o),{side:o.r.side==='median'?undefined:o.r.side});}
 };
 canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',e=>{pointerState.delete(e.pointerId);gesture={pinch:true};});canvas.addEventListener('pointerleave',()=>{$('hoverTip').hidden=true;});
 canvas.addEventListener('wheel',e=>{if(!state.ready)return;e.preventDefault();camTween=null;const delta=e.deltaY*(e.deltaMode===1?16:1);cameraState.distance=THREE.MathUtils.clamp(cameraState.distance*Math.exp(delta*.0012),3,2400);},{passive:false});
}

function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function download(name,data,type){const b=new Blob([data],{type}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function snapshot(){if(!renderer)return;renderAtlas();const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`脑图谱-${byId.get(state.id).zh.replace(/[\\/:*?"<>|]/g,'')}.png`;a.click();toast('已导出当前三维视图 PNG（不含讲解面板）。');}
function modal(html){$('modalContent').innerHTML=html;if(typeof $('modal').showModal==='function')$('modal').showModal();else $('modal').setAttribute('open','');}
function showHelp(){modal(`<h2>把模型当作可以打开的地图</h2><p>选择结构后，镜头会居中并高亮。相关结构用不同颜色显示；右侧关系按钮、走行节点和左侧搜索都可以继续选择。</p><table><tr><th>操作</th><th>方式</th></tr><tr><td>任意方向旋转</td><td>鼠标左键拖动；可翻转到任何面，没有极角锁定</td></tr><tr><td>缩放／平移</td><td>滚轮缩放；右键拖动，或 Ctrl／Shift 加拖动平移</td></tr><tr><td>触屏</td><td>单指旋转；双指捏合缩放、双指移动平移</td></tr><tr><td>点击／穿透点击</td><td>点击可见对象；按住 Alt 点击，可在射线击中的多层对象间切换</td></tr><tr><td>搜索</td><td>Ctrl K 聚焦搜索；输入中英文或常用缩写，停顿后自动定位；Enter 选第一项</td></tr><tr><td>接管镜头</td><td>动画中开始拖动即可接管；F 重新居中，R 全脑复位</td></tr><tr><td>返回／路线</td><td>Backspace 返回上一次选择；路线中左右方向键上一站／下一站</td></tr></table><h3>打开遮挡</h3><p>“展开结构”可移开大脑半球、岛盖或小脑；“背景透明度”可淡化遮挡；“仅看关联”保留当前对象与关联对象。“合拢到 0%”用于重新检查天然位置。展开距离不能作为真实间距。</p><h3>资料和尺度</h3><p>源解剖网格、图谱配准、功能定位和独立示意分别标识。缺少可核验边界的孔道保留缺项；CT 孔腔边界与真实骨缘分割明确区分。浦肯野细胞、髓树仅在单独开启时作为独立尺度教学示意。点击“资料与精度”查看全部限制。</p><p>转发只需要最终的 HTML；不需要本机源代码、服务器、账号或网络。参考文献外链需要联网。现代浏览器和可用的 WebGL 是三维显示的条件。</p>`);}
function showSources(){
 modal(`<h2>资料、尺度与模型精度</h2><p><span class="badge-count">466 个源对象</span><span class="badge-count">约 149 万三角形</span><span class="badge-count">${course.length} 个课程词条</span></p><p>本工具把可追溯的参考解剖网格、跨图谱配准结果和明确标识的教学示意组合在一起。它没有经过独立解剖专家逐结构验收，不能称为“全部细节准确无误”的标准标本。</p><table><tr><th>标识</th><th>如何理解</th></tr><tr><td>源解剖网格</td><td>Z-Anatomy／BodyParts3D 的代表性模型。保持共同坐标与相对尺寸；不是所有人的平均脑，也不覆盖所有显微结构。</td></tr><tr><td>图谱配准</td><td>HCP1065 通路，以及 CIT168、Najdenovska、Neudorfer 等核团配准到该脑。上游报告约 7 mm 的注册量级，不能据此精确测量小核团。</td></tr><tr><td>功能定位</td><td>用相关脑回／脑沟帮助定位 M1、S1、V1、A1、Broca、Wernicke；没有用组织学或功能扫描划定个体边界。</td></tr><tr><td>定位／范围示意</td><td>脑裂、脑室开口和颅底孔环，内囊参考段及侧脑室角的教学分区。没有独立真实边界的结构，不补画成精确分割。</td></tr><tr><td>独立示意</td><td>浦肯野细胞、髓树和小脑镰等形态示意；不用于判断真实比例、分支数或微结构。</td></tr></table><h3>本次明确保留的限制</h3><ul><li>没有完整重建所有脑神经核、全部外周分支和末梢。神经网格在头颈部裁切；长程终点由走行说明给出。</li><li>颅底骨网格有源形态，但孔缘未逐孔分割；定位环位置尚未经过颅底专家配准验收，不应据此背诵毫米级定位。</li><li>上游脚间窝网格的标注范围存疑，课程词条改用明显标识的定位点；完整图谱仍保留原始条目并标注待核对。</li><li>没有真实分割的上橄榄核、下橄榄核折叠板、完整内囊包络、全部脉络丛、完整脑膜／脑池或小脑髓树。</li><li>表面裁切不补绘组织学截面。展开是可逆的观察位移，不保留天然间距；合拢到 0% 后才能看原始相对位置。</li></ul><h3>建模处理</h3><p>统一保留源 glTF 坐标，只对全体做相同平移、米到毫米的单位转换。原始 +X＝左、+Y＝上、+Z＝前。解码后对每个网格进行 16 位坐标量化，最大量化误差约 0.0014 mm；这个数只描述文件压缩误差，完全不代表解剖准确度。</p><h3>来源与许可证</h3><p>几何及其改编按 CC BY-SA 4.0 共享。BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan；Z-Anatomy contributors；Brain Project / Itay Inbarr；Cranial Nerves and Foramina — University of Dundee, CAHID, CC BY 4.0。补充数据固定在 nqwrc/3d-anatomy 的 8ca3b742 提交。剔除了特殊 NC 许可的内耳和肾模型。</p><p>另含 CIT168（Pauli 2018）、CIT168 amygdala（Tyszka 2016）、Najdenovska 2018、Neudorfer 2020、HCP1065（Yeh 2022）的上游配准派生数据；具体归属与许可证随模型保留。界面原创代码采用 MIT；Three.js 和 fflate 采用 MIT。完整版权文本已内嵌于文件源码与交付目录。</p><div class="detail-sources">${Object.entries(SOURCES).map(([k,[title,url]])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`).join('')}</div><h3>转发与核对</h3><p>整个页面、网格、解压库和讲解都在同一个 HTML 里。没有远程字体、脚本、遥测或模型请求；只有主动点开的参考链接需要网络。</p><button class="download" id="openAudit">查看逐条覆盖清单</button><button class="download" id="downloadAudit">下载覆盖清单 JSON</button>`);
 $('openAudit').onclick=showAudit;$('downloadAudit').onclick=()=>download('NeuroAtlas-coverage.json',JSON.stringify(audit(),null,2),'application/json');
 const diagnosticButton=document.createElement('button');diagnosticButton.className='download';diagnosticButton.id='diagnosticButton';diagnosticButton.textContent='运行诊断';diagnosticButton.onclick=showDiagnostics;$('modalContent').append(diagnosticButton);
 $('modalContent').querySelector('.badge-count').textContent=RAW.length+' 个源对象';
}
function audit(){
 return course.map(t=>{const rs=objects.filter(o=>matchObject(o,t));return{id:t.id,zh:t.zh,en:t.en,quality:t.quality,sourceObjects:rs.map(o=>({id:o.r.id,name:o.r.name,side:o.r.side,source:o.r.source})),relations:t.rel.map(([id,relationship])=>({id,relationship})),position:t.loc,function:t.fn,limitations:t.note};});
}
function showAudit(){const rows=audit();modal(`<h2>逐条建模覆盖清单</h2><p>“有可选对象”只表示交互可定位，不表示其边界已由专家核对；请同时读取精度类型和词条限制。</p><p><span class="badge-count">${rows.length} 个课程词条</span><span class="badge-count">${rows.filter(r=>r.sourceObjects.length).length} 条有可选对象</span><span class="badge-count">2 个独立尺度场景</span></p><div class="audit-list"><table><tr><th>结构</th><th>精度类型</th><th>对象</th></tr>${rows.map(t=>`<tr><td><button class="textbtn" data-audit-select="${t.id}">${esc(t.zh)}</button></td><td>${esc(QLABEL[t.quality])}</td><td>${t.sourceObjects.length||'独立场景'}</td></tr>`).join('')}</table></div><p>完整覆盖说明、测试记录及源文件见交付目录 README。</p>`);$('modalContent').querySelectorAll('[data-audit-select]').forEach(b=>b.onclick=()=>{$('modal').close();select(b.dataset.auditSelect);});}

function bindUI(){
 $('search').oninput=searchInput;$('search').onkeydown=e=>{if(e.key==='Enter'&&visibleSearch.length){e.preventDefault();clearTimeout(searchTimer);select(visibleSearch[0].id,{side:querySide(state.query)});}if(e.key==='Escape'){e.stopPropagation();state.query='';$('search').value='';renderList();}};
 $('clearSearch').onclick=()=>{clearTimeout(searchTimer);state.query='';$('search').value='';renderList();$('search').focus();};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderList();});
 document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{state.side='auto';state.reveal='smart';select(b.dataset.preset);});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>focus(b.dataset.view));
 document.querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>{state.reveal=b.dataset.reveal;updateAppearance();});
 document.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{state.side=b.dataset.side;updateAppearance();renderDetail();focus(byId.get(state.id).view);});
 $('openSlider').oninput=()=>{if(state.cutAxis!=='off'){state.cutAxis='off';toast('已关闭表面裁切，以展开原始结构。');}state.open=Number($('openSlider').value)/100;updateAppearance();};$('openSlider').onchange=()=>focus();
 $('opacitySlider').oninput=()=>{state.context=Number($('opacitySlider').value)/100;updateAppearance();};
 $('resetButton').onclick=reset;$('focusButton').onclick=()=>focus();$('backButton').onclick=goBack;$('snapshotButton').onclick=snapshot;
 $('layerButton').onclick=()=>{$('layerPanel').hidden=!$('layerPanel').hidden;};$('layerClose').onclick=()=>$('layerPanel').hidden=true;
 $('layerList').innerHTML=Object.entries(CAT).filter(([id])=>id!=='annotations').map(([id,[name,,color]])=>`<label class="check-row"><input type="checkbox" data-layer="${id}" ${state.layers.has(id)?'checked':''}><i class="group-dot" style="background:${color}"></i>${name}</label>`).join('');
 $('layerList').querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>{el.checked?state.layers.add(el.dataset.layer):state.layers.delete(el.dataset.layer);updateAppearance();});
 $('atlasFine').onchange=()=>{state.fine=$('atlasFine').checked;if(state.fine){state.layers.add('deep_grey');state.layers.add('diencephalon');}updateAppearance();};$('labelToggle').onchange=()=>{state.labels=$('labelToggle').checked;buildLabels();};$('motionToggle').checked=state.reduced;$('motionToggle').onchange=()=>{state.reduced=$('motionToggle').checked;if(state.reduced){camTween=null;focus(undefined,false);}updateAppearance();};
 $('cutButton').onclick=()=>{$('cutPanel').hidden=!$('cutPanel').hidden;};$('cutAxis').onchange=()=>{state.cutAxis=$('cutAxis').value;if(state.cutAxis!=='off'){state.open=0;state.cut=0;const ranges={x:[-80,80],y:[-135,80],z:[-110,100]};[$('cutSlider').min,$('cutSlider').max]=ranges[state.cutAxis];}updateAppearance();};$('cutSlider').oninput=()=>state.cut=Number($('cutSlider').value);$('cutFlip').onclick=()=>state.cutSign*=-1;
 $('sourceButton').onclick=showSources;$('helpButton').onclick=showHelp;$('auditButton').onclick=showAudit;$('modalClose').onclick=()=>$('modal').close();$('modal').onclick=e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}};
 $('tourPrev').onclick=()=>tourMove(-1);$('tourNext').onclick=()=>tourMove(1);$('tourClose').onclick=()=>{state.tour=null;renderHeading();updateAppearance();};
 $('menuButton').onclick=()=>$('sidebar').classList.toggle('open');$('focusModeButton').onclick=()=>{const active=document.body.classList.toggle('focus-mode');$('focusModeButton').textContent=active?'返回图谱':'专注 3D';};
 document.addEventListener('keydown',e=>{const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('sidebar').classList.add('open');$('search').focus();$('search').select();return;}if(typing||$('modal').open)return;
  if(e.key==='?')showHelp();if(e.key.toLowerCase()==='f')focus();if(e.key.toLowerCase()==='r')reset();if(e.key==='Backspace'){e.preventDefault();goBack();}if(state.tour&&e.key==='ArrowRight')tourMove(1);if(state.tour&&e.key==='ArrowLeft')tourMove(-1);
 });
}
async function init(){
 bindUI();renderList();renderDetail();renderHeading();
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;renderer.localClippingEnabled=true;
 }catch(err){state.errors.push(String(err));$('loading').hidden=true;$('fallback').hidden=false;$('renderStatus').textContent='三维不可用 · 词条可用';return;}
 scene=new THREE.Scene();root=new THREE.Group();microRoot=new THREE.Group();scene.add(root,microRoot);camera=new THREE.PerspectiveCamera(39,1,.1,8000);
 scene.add(new THREE.HemisphereLight('#fff9e9','#818c83',1.35));const key=new THREE.DirectionalLight('#fff3df',1.75);key.position.set(180,260,220);scene.add(key);const fill=new THREE.DirectionalLight('#d9eff4',.85);fill.position.set(-200,40,-130);scene.add(fill);const rim=new THREE.DirectionalLight('#eff3d1',.65);rim.position.set(0,-100,-180);scene.add(rim);
 $('loadProgress').style.width='24%';
 await new Promise(requestAnimationFrame);
 const base64=$('atlasBinary').textContent.trim(),str=atob(base64),compressed=new Uint8Array(str.length);for(let i=0;i<str.length;i++)compressed[i]=str.charCodeAt(i);
 const unpacked=fflate.gunzipSync(compressed);binary=unpacked.buffer.slice(unpacked.byteOffset,unpacked.byteOffset+unpacked.byteLength);$('atlasBinary').remove();$('loadingStatus').textContent='建立独立结构与可点击表面…';
 const buffers={legacy:binary};
 for(const el of document.querySelectorAll('[data-native-binary]')){const raw=atob(el.textContent.trim()),bytes=new Uint8Array(raw.length);for(let j=0;j<raw.length;j++)bytes[j]=raw.charCodeAt(j);const data=fflate.gunzipSync(bytes);buffers[el.dataset.nativeBinary]=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);el.remove();}
 for(let i=0;i<RAW.length;i++){binary=buffers[RAW[i].space||'legacy'];buildRecord(RAW[i]);if(i%24===0){$('loadProgress').style.width=(30+i/RAW.length*55)+'%';await new Promise(requestAnimationFrame);}}
 binary=null;
 buildTeachingGeometry();$('loadingStatus').textContent='核对结构索引与观察关系…';$('loadProgress').style.width='96%';
 state.ready=true;resize();bindPointer();new ResizeObserver(()=>resize()).observe(stage);
 let initial='brain';try{const hash=decodeURIComponent(location.hash.slice(1));if(byId.has(hash))initial=hash;}catch(_){}
 select(initial,{push:false,animate:false});
 for(const o of objects){o.alpha=o.targetAlpha;o.group.position.copy(o.targetPos);for(const m of o.meshes){m.material.opacity=o.alpha;m.material.color.copy(o.targetColor);}}
 $('loadProgress').style.width='100%';$('loading').hidden=true;requestAnimationFrame(animate);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('三维图形上下文暂时丢失，正在等待浏览器恢复。');});canvas.addEventListener('webglcontextrestored',()=>{resize();updateAppearance();toast('三维显示已恢复。');});
 window.NeuroAtlas={getState:()=>({id:state.id,side:state.side,selected:state.selected.size,related:state.related.size,open:state.open,reveal:state.reveal,camera:{target:cameraState.target.toArray(),q:cameraState.q.toArray(),distance:cameraState.distance},fps:state.fps,errors:state.errors.slice()}),audit,inspect:()=>({ready:state.ready,course:course.length,sourceObjects:sourceObjects.length,sceneObjects:objects.length,missing:course.filter(t=>!objects.some(o=>matchObject(o,t))&&t.view!=='schematic').map(t=>t.id),missingRelations:course.flatMap(t=>t.rel.filter(([id])=>!byId.has(id)).map(([id])=>[t.id,id])),untranslated:baseNames.filter(n=>!ZH[n]),invalidGeometry:objects.filter(o=>o.box.isEmpty()||!Number.isFinite(o.box.min.x)).map(o=>o.r.id)})};
}
window.addEventListener('error',e=>state.errors.push(e.message));window.addEventListener('unhandledrejection',e=>state.errors.push(String(e.reason)));
function boot(){init().catch(err=>{state.errors.push(String(err));console.error(err);$('loadingStatus').textContent='加载失败：'+err.message;$('loadProgress').style.width='0%';$('loading').style.pointerEvents='none';toast('模型加载遇到问题。可从左侧阅读词条；请尝试在新版浏览器中重新打开。');});}
