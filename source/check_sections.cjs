const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib'),assert=require('assert');
const P=__dirname,THREE=require('./three.min.js'),kernel=vm.runInNewContext(fs.readFileSync(path.join(P,'section-kernel.js'),'utf8')+';SectionGeometry',{THREE}),tests=[];
function test(name,fn){fn();tests.push({name,passed:true});}
function part(g){return{positions:g.attributes.position.array,indices:g.index.array};}
function close(a,b,tol=.0001){assert(Math.abs(a-b)<=tol,`${a} != ${b}`);}
const box=part(new THREE.BoxGeometry(4,4,4));
test('solid cube gives a planar square of area 16',()=>{for(let axis=0;axis<3;axis++){const s=kernel.slice([box],axis,.37);close(s.stats.areaMM2,16);assert.equal(s.stats.openChains,0);for(let i=axis;i<s.positions.length;i+=3)close(s.positions[i],.37);}});
test('material partitions are joined before closing contours',()=>{const parts=[{positions:box.positions,indices:box.indices.slice(0,18)},{positions:box.positions,indices:box.indices.slice(18)}];close(kernel.slice(parts,2,0).stats.areaMM2,16);});
test('open sheet is not falsely filled',()=>{const g=new THREE.PlaneGeometry(4,4);const s=kernel.slice([part(g)],0,0);assert.equal(s.positions.length,0);assert(s.stats.openChains>0);});
test('nested contour keeps a real central hole',()=>{const s=kernel.slice([part(new THREE.TorusGeometry(3,1,12,48))],2,.000001);const expected=48/2*Math.sin(2*Math.PI/48)*(16-4);close(s.stats.areaMM2,expected,.0001);assert.equal(s.stats.holes,1);});
test('tangent and outside cuts add no fabricated area',()=>{close(kernel.slice([box],0,2.01).stats.areaMM2,0);close(kernel.slice([box],0,2).stats.areaMM2,0);});
const meta=JSON.parse(fs.readFileSync(path.join(P,'packed.json'),'utf8')),bin=zlib.gunzipSync(fs.readFileSync(path.join(P,'packed.bin.gz')));
function decode(r){return r.parts.map(p=>{const v=new Float32Array(p.vc*3),idx=p.it===2?new Uint16Array(p.ic):new Uint32Array(p.ic);for(let i=0;i<v.length;i++)v[i]=bin.readUInt16LE(p.po+i*2)*p.scale[i%3]+p.min[i%3];for(let i=0;i<idx.length;i++)idx[i]=p.it===2?bin.readUInt16LE(p.io+i*2):bin.readUInt32LE(p.io+i*4);return{positions:v,indices:idx};});}
const cuts=[];
for(const id of[433,434]){const r=meta.find(o=>o.id===id),parts=decode(r),tol=Math.max(.00001,...r.parts.map(p=>Math.hypot(...p.scale)*1.05));
 test(`source white matter ${id}: closed source edges`,()=>{const p=parts[0],edges=new Map(),coords=new Map(),remap=[];for(let i=0;i<p.positions.length;i+=3){const key=Array.from(p.positions.slice(i,i+3)).join(',');if(!coords.has(key))coords.set(key,coords.size);remap.push(coords.get(key));}for(let i=0;i<p.indices.length;i+=3)for(let k=0;k<3;k++){const a=remap[p.indices[i+k]],b=remap[p.indices[i+(k+1)%3]],key=Math.min(a,b)+','+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}assert([...edges.values()].every(n=>n===2));});
 test(`source white matter ${id}: 13 cuts across all three axes`,()=>{for(const [axis,values]of[[0,[5,15,25,45].map(n=>id===433?n:-n)],[1,[-30,0,30,55]],[2,[-80,-40,0,50,70]]])for(const cut of values){const s=kernel.slice(parts,axis,cut,tol);cuts.push({id,axis,cut,...s.stats});assert(s.stats.areaMM2>5);assert.equal(s.stats.rejected,0);assert.equal(s.stats.openChains,0,`${id} axis ${axis} cut ${cut}`);for(let i=axis;i<s.positions.length;i+=3)close(s.positions[i],cut);assert(s.stats.maxWeldMM<=tol);}});
}
// A real two-material cortical object that the former per-material algorithm left open.
test('source precentral gyrus closes across its original material boundary',()=>{const r=meta.find(o=>o.id===284),parts=decode(r),tol=Math.max(...r.parts.map(p=>Math.hypot(...p.scale)*1.05));const combined=kernel.slice(parts,1,35,tol),separate=parts.map(p=>kernel.slice([p],1,35,tol));assert(combined.stats.areaMM2>20);assert(combined.stats.areaMM2>separate.reduce((a,s)=>a+s.stats.areaMM2,0));});
const report={version:'3.2',tests,cuts,sourceWhiteMatterIds:[433,434],sourceCoordinatesModified:false,scope:'Geometry and cap-generation tests; not independent anatomical validation. Open source boundaries remain unfilled.'};
fs.writeFileSync(path.join(P,'..','section-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:tests.length,sourceCuts:cuts.length,openSourceWhiteCuts:cuts.filter(c=>c.openChains).length}));
