const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const r=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const {terms,zh,sources,tours}=vm.runInNewContext(r('content.js')+'\n'+r('translations.js')+'\n'+r('native-content.js')+'\n'+r('context-content.js')+'\n;({terms:TERMS,zh:ZH,sources:SOURCES,tours:TOURS})');
const native=JSON.parse(r('native-pack.json')),evidence=JSON.parse(r('native-evidence.json'));
const raw=[...JSON.parse(r('packed.json')),...native.records],ids=new Set(terms.map(t=>t.id)),names=new Set(raw.map(o=>o.name));
assert.equal(ids.size,terms.length,'duplicate course id');
const missingNames=terms.flatMap(t=>t.names.filter(n=>!names.has(n)).map(n=>[t.id,n]));
const missingRelations=terms.flatMap(t=>t.rel.filter(([id])=>!ids.has(id)).map(([id])=>[t.id,id]));
assert.equal(missingNames.length,0,JSON.stringify(missingNames));assert.equal(missingRelations.length,0,JSON.stringify(missingRelations));
assert.equal([...names].filter(n=>!zh[n]).length,0,'all source names need Chinese translation');
const stats=JSON.parse(r('stats.json')),zlib=require('zlib');
const binaries={};for(const space of ['legacy',...Object.keys(native.spaces)])binaries[space]=zlib.gunzipSync(fs.readFileSync(path.join(__dirname,space==='legacy'?'packed.bin.gz':space+'-packed.bin.gz')));
let maxError=0,vertices=0,triangles=0;for(const o of raw)for(const p of o.parts){const bin=binaries[o.space||'legacy'];assert.equal(p.po%2,0);assert.equal(p.io%p.it,0);assert(p.po+p.vc*6<=bin.length);assert(p.io+p.ic*p.it<=bin.length);assert(p.ic%3===0);vertices+=p.vc;triangles+=p.ic/3;for(let i=0;i<p.ic;i++){const idx=p.it===2?bin.readUInt16LE(p.io+i*2):bin.readUInt32LE(p.io+i*4);assert(idx<p.vc,'index exceeds vertex count');}for(let k=0;k<3;k++){assert(Number.isFinite(p.min[k]));assert(p.max[k]>=p.min[k]);maxError=Math.max(maxError,p.scale[k]/2);}}
assert.equal(new Set(raw.map(r=>r.id)).size,raw.length,'unique geometry ids');
for(const t of tours)for(const id of t.steps)assert(ids.has(id),id);
for(const o of native.records){assert(evidence[o.evidenceKey]);assert(!o.termIds.some(id=>!ids.has(id)));assert(o.space!=='p41'||o.side==='single');}
const ownerLine=r('app.js').split('\n').find(l=>l.startsWith('const ownerTerm='));
const pickTerm=vm.runInNewContext(ownerLine+'\n;ownerTerm',{course:terms,byId:new Map(terms.map(t=>[t.id,t])),atlasTerms:[...names].map((name,i)=>({id:'source_'+i,names:[name]}))});
for(const id of ['precentral','postcentral'])for(const o of native.records.filter(o=>o.space==='bp2018'&&o.termIds.includes(id)))assert.equal(pickTerm({r:o}),id,'surface picking must prefer the gyrus over its parent lobe');
const summary={version:'3.2',course:terms.length,tours:tours.length,tourSteps:tours.reduce((n,t)=>n+t.steps.length,0),distinctNames:names.size,sourceObjects:raw.length,nativeObjects:native.records.length,vertices,triangles,missingNames,missingRelations,untranslated:[],maxQuantizationErrorMM:maxError,bufferBytes:Object.fromEntries(Object.entries(binaries).map(([k,v])=>[k,v.length])),tests:['unique term and mesh ids','source name references','relationship and tour references','Chinese coverage','buffer alignment and bounds','all triangle indices','finite mesh bounds','native evidence for every object','single hemisphere P41 preserved']};
summary.tests.push('native precentral/postcentral picking prefers the specific gyrus');
fs.writeFileSync(path.join(__dirname,'..','static-validation.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
const browserPath=path.join(__dirname,'..','browser-validation.json');
const browser=fs.existsSync(browserPath)?JSON.parse(fs.readFileSync(browserPath,'utf8')):null;
const coverage=terms.map(t=>({id:t.id,zh:t.zh,en:t.en,group:t.group,quality:t.quality,preferredSpace:t.preferredSpace||null,defaultEntrySpace:t.defaultEntrySpace||null,position:t.loc,function:t.fn,limitations:t.note,sourceNames:t.names,categorySelector:t.category||null,regionSelector:t.region||null,derivedPartition:t.derived||null,teachingGeometry:t.synthetic?'disabled-in-macro-view':null,renderedObjectCount:browser?.version==='3.2'?browser?.coverageRows?.find(r=>r.id===t.id)?.objects??null:null,relations:t.rel.map(([id,relationship])=>({id,relationship})),references:(t.refs||[]).map(key=>sources[key]).filter(Boolean)}));
fs.writeFileSync(path.join(__dirname,'..','coverage-audit.json'),JSON.stringify(coverage,null,2));
