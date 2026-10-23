/* v3.1: depth-correct nearest-surface assistance and visible selection contours.
   Source geometry, hue, anatomical coordinates, and assembly transforms are unchanged.
   All anatomical passes are opaque; transparency is composed once, per pixel.
   This avoids sorted-triangle alpha accumulation and transparent shader state changes. */
let atlasRender=null;
const renderingAppearance=updateAppearance;
updateAppearance=function(opts){renderingAppearance(opts);configureAnatomyMaterials();};
function configureAnatomyMaterials(){
 for(const o of objects)for(const m of o.meshes){const mat=m.material;
  if(mat.transparent||mat.side!==THREE.DoubleSide){mat.transparent=false;mat.side=THREE.DoubleSide;mat.needsUpdate=true;}
  mat.opacity=1;mat.depthWrite=true;mat.depthTest=true;mat.roughness=.88;mat.metalness=0;
 }
 if(atlasRender)updateRenderMask();
}
// The old EdgesGeometry outlined individual source triangulation, not the visible perimeter.
updateSelectionOutline=function(){if(outlineRoot){for(const c of outlineRoot.children){c.geometry.dispose();c.material.dispose();}scene.remove(outlineRoot);outlineRoot=null;}if(atlasRender)updateRenderMask();};
const renderingCamera=syncCamera;
syncCamera=function(){renderingCamera();if(!state.ready)return;
 // A 0.1–8000 mm range wasted almost all depth precision at the brain surface.
 // Fit the depth interval to visible source bounds (including moved assemblies).
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(cameraState.q);let near=Infinity,far=0;
 for(const o of objects)if(o.group.visible||state.cutAxis!=='off'&&o.sectionVisible){const b=o.box,p=o.group.position;
  for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const d=new THREE.Vector3(x,y,z).add(p).sub(camera.position).dot(forward);near=Math.min(near,d);far=Math.max(far,d);}
 }
 if(Number.isFinite(near)){const n=Math.max(.05,near*.65),f=Math.max(n+30,far+40);if(Math.abs(camera.near-n)>.01||Math.abs(camera.far-f)>.01){camera.near=n;camera.far=f;camera.updateProjectionMatrix();}}
};
function initAtlasRender(){
 if(atlasRender||!renderer)return;
 const gl=renderer.getContext(),depthSupported=renderer.capabilities.isWebGL2||renderer.extensions.has('WEBGL_depth_texture');
 if(!depthSupported){atlasRender={fallback:true};const b=document.querySelector('[data-reveal="ghost"]');b.disabled=true;b.title='此设备不支持深度纹理，请使用分组移开或固定剖面';return;}
 const hdr=renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
 function target(mask=false){const rt=new THREE.WebGLRenderTarget(1,1,{type:!mask&&hdr?THREE.HalfFloatType:THREE.UnsignedByteType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true,stencilBuffer:false});rt.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);rt.texture.generateMipmaps=false;rt.samples=renderer.capabilities.isWebGL2?Math.min(2,renderer.capabilities.maxSamples):0;return rt;}
 const solid=target(),context=target(),mask=target(true),maskScene=new THREE.Scene(),quadScene=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const uniforms={tSolid:{value:solid.texture},dSolid:{value:solid.depthTexture},tContext:{value:context.texture},dContext:{value:context.depthTexture},tMask:{value:mask.texture},dMask:{value:mask.depthTexture},pixel:{value:new THREE.Vector2()},nearClip:{value:1},farClip:{value:1000},ghost:{value:0},strength:{value:state.context},hasMask:{value:0}};
 const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:true,
 vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
 fragmentShader:`
 varying vec2 vUv;
 uniform sampler2D tSolid,dSolid,tContext,dContext,tMask,dMask;
 uniform vec2 pixel;
 uniform float nearClip,farClip,ghost,strength,hasMask;
 float linearDepth(float d){return nearClip*farClip/(farClip-d*(farClip-nearClip));}
 float visibleTarget(vec2 uv){float a=texture2D(tMask,uv).a;if(a<0.5)return 0.0;
  float m=linearDepth(texture2D(dMask,uv).r),s=linearDepth(texture2D(dSolid,uv).r);
  return step(m,s+0.12);
 }
 float contactShade(sampler2D depths,vec2 uv,float d){
  if(d>0.999999)return 1.0;float z=linearDepth(d),occ=0.0;
  for(int i=0;i<8;i++){float a=float(i)*0.78539816;vec2 v=vec2(cos(a),sin(a));
   for(int j=1;j<=2;j++){float sd=texture2D(depths,uv+v*pixel*(float(j)*3.0)).r;
    float delta=z-linearDepth(sd);occ+=step(sd,0.999999)*smoothstep(0.25,1.3,delta)*(1.0-smoothstep(3.5,9.0,delta));
   }
  }
  return 1.0-occ*(0.24/16.0);
 }
 void main(){
  vec4 s=texture2D(tSolid,vUv);float ds=texture2D(dSolid,vUv).r;
  vec3 color=s.rgb*contactShade(dSolid,vUv,ds);float alpha=s.a;
  float dc=1.0;
  if(ghost>0.5){vec4 c=texture2D(tContext,vUv);dc=texture2D(dContext,vUv).r;
   if(c.a>0.5){c.rgb*=contactShade(dContext,vUv,dc);
    if(s.a>0.5){if(dc<ds)color=mix(color,c.rgb,strength);}
    else{color=c.rgb;alpha=min(1.0,strength*1.65);}
   }
  }
  if(hasMask>0.5){float center=visibleTarget(vUv),outside=0.0,inside=1.0,minMask=1.0;
   for(int i=0;i<8;i++){float a=float(i)*0.78539816;vec2 dir=vec2(cos(a),sin(a));
    vec2 uv=vUv+dir*pixel*1.7;float v=visibleTarget(uv);outside=max(outside,v);inside=min(inside,visibleTarget(vUv+dir*pixel));
    if(v>0.5)minMask=min(minMask,texture2D(dMask,uv).r);
   }
   float rim=max(0.0,outside-center),inner=center*(1.0-inside);
   // Never draw a solid selection outline through another solid structure.
   if(s.a>0.5&&linearDepth(ds)+0.4<linearDepth(minMask))rim=0.0;
   bool hidden=ghost>0.5&&dc<min(texture2D(dMask,vUv).r,minMask)-0.00001;
   float dash=hidden?step(0.35,fract((gl_FragCoord.x+gl_FragCoord.y)/9.0)):1.0;
   float edge=max(rim,inner)*dash;
   if(edge>0.01){color=mix(color,inner>0.5?vec3(0.82,0.90,0.75):vec3(0.025,0.11,0.075),edge*0.9);alpha=max(alpha,edge);}
  }
  if(alpha<0.003)discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Canvas uses premultiplied alpha; the full-screen pass does not use alpha blending.
  gl_FragColor.rgb*=gl_FragColor.a;
 }
`});
 quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
 atlasRender={solid,context,mask,maskScene,quadScene,quadCamera,material,uniforms,maskMeshes:[],width:0,height:0,hdr,depthBits:gl.getParameter(gl.DEPTH_BITS),fallback:false};
 updateRenderMask();
}
function updateRenderMask(){const p=atlasRender;if(!p||p.fallback)return;
 p.epoch=(p.epoch||0)+1;
 for(const m of p.maskMeshes){p.maskScene.remove(m);m.material.dispose();}p.maskMeshes=[];
 const t=byId.get(state.id);if(t.overview||state.selected.size>40)return;
 const selectedMeshes=[...state.selected].flatMap(o=>o.meshes).concat((sectionRoot?.children||[]).filter(m=>m.isMesh&&!m.userData.capDepth&&state.selected.has(m.userData.owner)));
 for(const src of selectedMeshes){const m=new THREE.Mesh(src.geometry,new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false}));m.userData.owner=src.userData.owner;m.userData.source=src;m.userData.section=src.parent===sectionRoot;p.maskScene.add(m);p.maskMeshes.push(m);}
}
const renderingSection=buildSection;
buildSection=function(){renderingSection();updateRenderMask();};
renderAtlas=function(){
 initAtlasRender();const p=atlasRender;
 if(!p||p.fallback||microRoot.visible){
  for(const o of objects)for(const m of o.meshes){const mat=m.material,t=o.alpha<1;if(mat.transparent!==t){mat.transparent=t;mat.needsUpdate=true;}mat.opacity=o.alpha;mat.depthWrite=!t;}
  renderer.render(scene,camera);return;
 }
 const fullSize=renderer.getDrawingBufferSize(new THREE.Vector2()),ratio=Math.min(1,Math.sqrt(1500000/(fullSize.x*fullSize.y))),size=fullSize.clone().multiplyScalar(ratio).floor();
 const key=[fullSize.x,fullSize.y,p.epoch,state.cutAxis,state.cut,state.cutSign,state.reveal,state.context,...cameraState.q.toArray(),...cameraState.target.toArray(),cameraState.distance].join('|');
 const moving=Boolean(poseTween||camTween||csfGroup?.visible);
 if(!moving&&!p.wasAnimating&&key===p.lastFrame)return;
 p.lastFrame=key;p.wasAnimating=moving;
 if(size.x!==p.width||size.y!==p.height){p.width=size.x;p.height=size.y;for(const t of[p.solid,p.context,p.mask])t.setSize(size.x,size.y);p.uniforms.pixel.value.set(1/size.x,1/size.y);}
 p.uniforms.nearClip.value=camera.near;p.uniforms.farClip.value=camera.far;p.uniforms.ghost.value=state.reveal==='ghost'?1:0;p.uniforms.strength.value=state.context;
 const visible=objects.filter(o=>o.group.visible),ghosts=state.reveal==='ghost'?visible.filter(o=>o.visualRole==='context'):[];
 const auxiliaries=[csfGroup].filter(Boolean).map(o=>[o,o.visible]);
 const sectionParts=(sectionRoot?.children||[]).map(m=>[m,m.visible]);
 const oldTarget=renderer.getRenderTarget(),clear=new THREE.Color();renderer.getClearColor(clear);const clearAlpha=renderer.getClearAlpha();
 try{
  renderer.setClearColor(0,0);
  for(const o of ghosts)o.group.visible=false;
  for(const [m]of sectionParts)m.visible=m.userData.solidSection?Boolean(m.userData.owner?.sectionVisible):Boolean(m.userData.owner?.group.visible);
  renderer.setRenderTarget(p.solid);renderer.render(scene,camera);
  if(ghosts.length){for(const o of visible)o.group.visible=false;for(const o of ghosts)o.group.visible=true;for(const [o]of auxiliaries)o.visible=false;
   for(const [m]of sectionParts)m.visible=!m.userData.solidSection&&Boolean(m.userData.owner?.group.visible);
   renderer.setRenderTarget(p.context);renderer.render(scene,camera);
  }else{renderer.setRenderTarget(p.context);renderer.clear();}
  for(const o of visible)o.group.visible=true;
  for(const [o,v]of auxiliaries)o.visible=v;
  for(const [m,v]of sectionParts)m.visible=v;
  for(const m of p.maskMeshes){m.visible=m.userData.owner.group.visible&&(!m.userData.section||sectionRoot?.visible);m.position.copy(m.userData.owner.group.position);m.material.clippingPlanes=m.userData.source.material.clippingPlanes;}
  renderer.setRenderTarget(p.mask);renderer.render(p.maskScene,camera);p.uniforms.hasMask.value=p.maskMeshes.length?1:0;
  renderer.setRenderTarget(oldTarget);renderer.render(p.quadScene,p.quadCamera);
 }finally{for(const o of visible)o.group.visible=true;for(const [o,v]of auxiliaries)o.visible=v;for(const [m,v]of sectionParts)m.visible=v;renderer.setRenderTarget(oldTarget);renderer.setClearColor(clear,clearAlpha);}
};
const renderingSnapshot=spatialSnapshot;
spatialSnapshot=function(){return{...renderingSnapshot(),reveal:state.reveal,rendering:{pipeline:atlasRender?.fallback?'compatibility':'nearest-surface',hdr:atlasRender?.hdr||false,depthBits:atlasRender?.depthBits,near:camera?.near,far:camera?.far,fps:state.fps,ghostContext:objects.filter(o=>o.group.visible&&state.reveal==='ghost'&&o.visualRole==='context').length,solidNeighbors:objects.filter(o=>o.group.visible&&o.visualRole==='neighbor').length,sourceGrooveSheets:objects.filter(o=>o.group.visible&&o.r.role==='source-sulcus-model').length,selectedContour:'visible-perimeter',sourceGeometryModified:false}};};
const renderingBind=bindUI;
bindUI=function(){renderingBind();
 const key=document.createElement('div');key.id='visualHierarchy';key.className='visual-hierarchy';key.innerHTML='<span><i class="target-key"></i>选中：轮廓</span><span><i class="neighbor-key"></i>邻近：原色实体</span><span class="ghost-key-note">透视遮挡：虚线轮廓</span>';$('legend').after(key);
 key.title='实体轮廓仅显示可见边界；透明辅助中虚线表示隔着前景观察。点击实体目标；Alt + 点击可选透明外层。';
 const label=$('opacityControl').querySelector('span');label.firstChild.textContent='遮挡层强度 ';$('opacitySlider').setAttribute('aria-label','遮挡层强度');
 const sync=syncControls;syncControls=function(){sync();key.classList.toggle('ghost',state.reveal==='ghost');const ghostButton=document.querySelector('[data-reveal="ghost"]'),overview=Boolean(byId.get(state.id)?.overview);ghostButton.disabled=!state.ready||overview||Boolean(atlasRender?.fallback);ghostButton.title=atlasRender?.fallback?'此设备不支持深度纹理，请使用分组移开或固定剖面':overview?'先选一个具体结构，再观察它与透明背景的关系':'';if(atlasRender?.fallback)key.firstElementChild.innerHTML='<i class="target-key"></i>选中：● 标签';};syncControls();
 const inSitu=$('inSituButton').onclick;$('inSituButton').onclick=()=>{const mode=state.reveal;inSitu();if(mode==='ghost'){state.reveal=mode;updateAppearance();}};
 const open=$('revealTargetButton').onclick;$('revealTargetButton').onclick=()=>{const mode=state.reveal;open();if(mode==='ghost'){state.reveal=mode;updateAppearance();}};
};
const renderingDiagnostic=diagnosticReport;
diagnosticReport=function(){const r=renderingDiagnostic();r.version='3.2';r.rendering=spatialSnapshot().rendering;r.protectTarget=state.protectTarget;return r;};
