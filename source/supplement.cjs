const fs=require('fs'),path=require('path'),zlib=require('zlib');
const THREE=require('./three.min.js');
const factory=require('./draco_decoder_nodejs.cjs');
(async()=>{
const d=await factory({wasmBinary:fs.readFileSync(path.join(__dirname,'draco_decoder_gltf.wasm'))});
const rec=JSON.parse(fs.readFileSync(path.join(__dirname,'meshes.json'))),bufs=[fs.readFileSync(path.join(__dirname,'meshes.bin'))];let offset=bufs[0].length,id=1000;
const neededNerve=/^(Glossopharyngeal nerve \(IX\)|Vestibulocochlear nerve \(VIII\)|Cochlear nerve|Medulla oblongata|Thalamus|Hypothalamus|Amygdala|Globus pallidus|Central canal|White matter of spinal cord|Anterior horn of spinal cord|Posterior horn of spinal cord|Anterior cochlear nucleus|Posterior cochlear nucleus)(\.[lr])?$/;
const neededBone=/^(Sphenoid bone|Ethmoid bone|Occipital bone|Temporal bone|Frontal bone|Parietal bone|Maxilla)(\.[lr])?$/;
for(const file of ['nervous','skeletal']){
 const b=fs.readFileSync(path.join(__dirname,file+'.glb')),len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len).toString()),bin=b.subarray(28+len);
 const parents=new Map();g.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));
 const mats=new Map();function world(i){if(mats.has(i))return mats.get(i);const n=g.nodes[i],m=new THREE.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(world(parents.get(i)));mats.set(i,m);return m;}
 for(let ni=0;ni<g.nodes.length;ni++){
  const n=g.nodes[ni],name=n.extras?.za_name||n.name;if(n.mesh===undefined||!(file==='nervous'?neededNerve:neededBone).test(name))continue;
  const candidateBase=name.replace(/\.[lr]$/,''),candidateSide=name.endsWith('.l')?'left':name.endsWith('.r')?'right':'median';
  if(rec.some(r=>r.name===candidateBase&&r.side===candidateSide))continue;
  const parts=[];
  for(const p of g.meshes[n.mesh].primitives){
   const ext=p.extensions.KHR_draco_mesh_compression,bv=g.bufferViews[ext.bufferView],bytes=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
   const db=new d.DecoderBuffer();db.Init(new Int8Array(bytes),bytes.length);const dec=new d.Decoder(),mesh=new d.Mesh(),st=dec.DecodeBufferToMesh(db,mesh);if(!st.ok())throw Error(name);
   const vc=mesh.num_points(),fc=mesh.num_faces(),attr=dec.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),a=new d.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,attr,a);
   const pos=new Float32Array(vc*3),v=new THREE.Vector3(),m=world(ni);
   for(let i=0;i<vc;i++){v.set(a.GetValue(3*i),a.GetValue(3*i+1),a.GetValue(3*i+2)).applyMatrix4(m);pos[3*i]=v.x*1000;pos[3*i+1]=(v.y-1.63)*1000;pos[3*i+2]=v.z*1000;}
   const fa=new d.DracoInt32Array(),idx=[];for(let i=0;i<fc;i++){dec.GetFaceFromMesh(mesh,i,fa);const x=fa.GetValue(0),y=fa.GetValue(1),z=fa.GetValue(2);if((pos[3*x+1]+pos[3*y+1]+pos[3*z+1])/3 < -135)continue;idx.push(x,y,z);}
   if(m.determinant()<0)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
   // Retain only referenced vertices after clipping a short cervical segment.
   const map=new Map(),pp=[],ii=[];for(const v of idx){if(!map.has(v)){map.set(v,map.size);pp.push(pos[3*v],pos[3*v+1],pos[3*v+2]);}ii.push(map.get(v));}
   const pos2=Float32Array.from(pp),indices=map.size<65536?Uint16Array.from(ii):Uint32Array.from(ii);
   while(offset%4){bufs.push(Buffer.from([0]));offset++;}const po=offset,pb=Buffer.from(pos2.buffer);bufs.push(pb);offset+=pb.length;const io=offset,ib=Buffer.from(indices.buffer);bufs.push(ib);offset+=ib.length;
   const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];for(let i=0;i<pos2.length;i++){const k=i%3;mins[k]=Math.min(mins[k],pos2[i]);maxs[k]=Math.max(maxs[k],pos2[i]);}
   if(ii.length)parts.push({po,io,vc:pp.length/3,ic:ii.length,it:indices.BYTES_PER_ELEMENT,min:mins,max:maxs});
   [fa,a,mesh,dec,db].forEach(o=>d.destroy(o));
  }
  if(!parts.length)continue;
  const base=name.replace(/\.[lr]$/,'');let category=file==='skeletal'?'skull': /nerve/.test(base)?'cranial_nerves':/Thalamus|Hypothalamus/.test(base)?'diencephalon':/Amygdala|pallidus/.test(base)?'deep_grey':/canal/.test(base)?'ventricles':'brainstem';
  let side=candidateSide;if(base==='Cochlear nerve'&&side==='median'&&parts.every(p=>p.max[0]<0))side='right';
  rec.push({id:id++,name:base,side,category,region:category,source:'Z-Anatomy / BodyParts3D · nqwrc 8ca3b742',parts});
 }
}
// Correct source grouping: crus/base of cerebral peduncle is midbrain, not cerebellum.
for(const r of rec)if(r.name==='Base of peduncle'){r.category='brainstem';r.region='Brainstem';}
fs.writeFileSync(path.join(__dirname,'atlas.json'),JSON.stringify(rec));
const binary=Buffer.concat(bufs);fs.writeFileSync(path.join(__dirname,'atlas.bin'),binary);fs.writeFileSync(path.join(__dirname,'atlas.bin.gz'),zlib.gzipSync(binary,{level:9}));
console.log(JSON.stringify({structures:rec.length,added:rec.filter(x=>x.id>=1000).map(x=>({id:x.id,name:x.name,side:x.side})),bytes:binary.length,gzip:fs.statSync(path.join(__dirname,'atlas.bin.gz')).size}));
})();
