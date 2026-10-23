const fs=require('fs'),path=require('path'),zlib=require('zlib');
const factory=require('./draco_decoder_nodejs.cjs');
(async()=>{
 const d=await factory({wasmBinary:fs.readFileSync(path.join(__dirname,'draco_decoder_gltf.wasm'))});
 const b=fs.readFileSync(path.join(__dirname,'brain.glb'));
 const jn=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jn).toString());
 const bin=b.subarray(28+jn); const records=[]; const buffers=[];let offset=0;
 for(const n of g.nodes){
  const parts=[];
  for(const p of g.meshes[n.mesh].primitives){
   const ext=p.extensions.KHR_draco_mesh_compression,bv=g.bufferViews[ext.bufferView];
   const bytes=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);
   const db=new d.DecoderBuffer();db.Init(new Int8Array(bytes),bytes.length);
   const decoder=new d.Decoder(),mesh=new d.Mesh();
   const status=decoder.DecodeBufferToMesh(db,mesh); if(!status.ok())throw Error(n.name+': '+status.error_msg());
   const vc=mesh.num_points(),fc=mesh.num_faces();
   const attr=decoder.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),out=new d.DracoFloat32Array();
   decoder.GetAttributeFloatForAllPoints(mesh,attr,out);
   const pos=new Float32Array(vc*3); for(let i=0;i<pos.length;i++)pos[i]=out.GetValue(i);
   // Native glTF world axes: +X left, +Y superior, +Z anterior. Convert meters to mm,
   // keeping the original world frame across every structure; translation is shared.
   for(let i=0;i<pos.length;i+=3){pos[i]*=1000;pos[i+1]=(pos[i+1]-1.63)*1000;pos[i+2]*=1000;}
   const indices=vc<65536?new Uint16Array(fc*3):new Uint32Array(fc*3),face=new d.DracoInt32Array();
   for(let i=0;i<fc;i++){decoder.GetFaceFromMesh(mesh,i,face);for(let k=0;k<3;k++)indices[3*i+k]=face.GetValue(k);}
   while(offset%4){buffers.push(Buffer.from([0]));offset++;}
   const po=offset,pb=Buffer.from(pos.buffer);buffers.push(pb);offset+=pb.length;
   const io=offset,ib=Buffer.from(indices.buffer);buffers.push(ib);offset+=ib.length;
   const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<pos.length;i++) {const k=i%3;mins[k]=Math.min(mins[k],pos[i]);maxs[k]=Math.max(maxs[k],pos[i]);}
   parts.push({po,io,vc,ic:indices.length,it:indices.BYTES_PER_ELEMENT,min:mins,max:maxs});
   [face,out,mesh,decoder,db].forEach(o=>d.destroy(o));
  }
  const e=n.extras;
  records.push({id:e.bx_id,name:e.bx_label,side:e.bx_side,category:e.bx_cat,region:e.bx_region,source:e.bx_source,parts});
 }
 fs.writeFileSync(path.join(__dirname,'meshes.json'),JSON.stringify(records));
 fs.writeFileSync(path.join(__dirname,'meshes.bin'),Buffer.concat(buffers));
 fs.writeFileSync(path.join(__dirname,'meshes.bin.gz'),zlib.gzipSync(Buffer.concat(buffers),{level:9}));
 console.log(JSON.stringify({records:records.length,parts:records.reduce((a,r)=>a+r.parts.length,0),vertices:records.flatMap(x=>x.parts).reduce((a,r)=>a+r.vc,0),bytes:offset,gzip:fs.statSync(path.join(__dirname,'meshes.bin.gz')).size}));
})();
