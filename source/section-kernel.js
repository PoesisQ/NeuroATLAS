/* Plane/mesh intersection. Input surfaces are never modified. No hull, voxel fill,
   hole repair, or extrapolation: only closed source intersection contours are filled. */
const SectionGeometry=(()=>{
 function area(poly){let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=poly[j][0]*poly[i][1]-poly[i][0]*poly[j][1];return a*.5;}
 function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
 function slice(parts,axis,cut,tolerance=1e-5){
  const uv=[0,1,2].filter(i=>i!==axis),nodes=[],buckets=new Map(),edges=[],seen=new Set(),numeric=1e-7;let welded=0,maxWeld=0;
  const add=p=>{const x=Math.floor(p[0]/numeric),y=Math.floor(p[1]/numeric);let found=-1,best=numeric*numeric;
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const id of buckets.get((x+dx)+','+(y+dy))||[]){const q=nodes[id].p,d=(q[0]-p[0])**2+(q[1]-p[1])**2;if(d<=best){best=d;found=id;}}
   if(found>=0)return found;
   const id=nodes.length,key=x+','+y;nodes.push({p,links:[]});if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);return id;
  };
  for(const part of parts){const a=part.positions,idx=part.indices;
   for(let j=0;j<idx.length;j+=3){const i0=idx[j]*3,i1=idx[j+1]*3,i2=idx[j+2]*3,d0=a[i0+axis]-cut,d1=a[i1+axis]-cut,d2=a[i2+axis]-cut;if(d0>0&&d1>0&&d2>0||d0<=0&&d1<=0&&d2<=0)continue;const ids=[i0,i1,i2],d=[d0,d1,d2],cross=[];
    for(let k=0;k<3;k++){const l=(k+1)%3;if((d[k]<=0&&d[l]>0)||(d[k]>0&&d[l]<=0)){const t=d[k]/(d[k]-d[l]),p=ids[k],q=ids[l];cross.push(uv.map(c=>a[p+c]+(a[q+c]-a[p+c])*t));}}
    if(cross.length!==2)continue;const u=add(cross[0]),v=add(cross[1]);if(u===v)continue;const key=Math.min(u,v)+','+Math.max(u,v);if(seen.has(key))continue;seen.add(key);const e=edges.length;edges.push([u,v]);nodes[u].links.push(e);nodes[v].links.push(e);
   }
  }
  // A large global weld can collapse two close but distinct sulcal walls and destroy
  // an otherwise closed white-matter contour. Only pair unmatched endpoints, and
  // only when each endpoint has exactly one candidate within quantization error.
  if(parts.length>1){const ends=nodes.map((n,i)=>n.links.length===1?i:-1).filter(i=>i>=0),candidates=new Map(),remap=nodes.map((_,i)=>i);
   for(const i of ends)candidates.set(i,ends.filter(j=>j!==i&&Math.hypot(nodes[i].p[0]-nodes[j].p[0],nodes[i].p[1]-nodes[j].p[1])<=tolerance));
   for(const i of ends){const c=candidates.get(i);if(c.length===1&&i<c[0]&&candidates.get(c[0]).length===1){const j=c[0];remap[j]=i;welded++;maxWeld=Math.max(maxWeld,Math.hypot(nodes[i].p[0]-nodes[j].p[0],nodes[i].p[1]-nodes[j].p[1]));}}
   for(const n of nodes)n.links=[];seen.clear();const old=edges.splice(0);
   for(const [a,b]of old){const u=remap[a],v=remap[b];if(u===v)continue;const key=Math.min(u,v)+','+Math.max(u,v);if(seen.has(key))continue;seen.add(key);const e=edges.length;edges.push([u,v]);nodes[u].links.push(e);nodes[v].links.push(e);}
  }
  const used=new Set(),loops=[];let openChains=0,ambiguous=0;
  for(let e=0;e<edges.length;e++){if(used.has(e))continue;const stack=[e],component=[],vertices=new Set();used.add(e);
   while(stack.length){const n=stack.pop();component.push(n);for(const v of edges[n]){vertices.add(v);for(const next of nodes[v].links)if(!used.has(next)){used.add(next);stack.push(next);}}}
   // Branching or open components are evidence of an incomplete source surface.
   if([...vertices].some(v=>nodes[v].links.length!==2)){openChains++;if([...vertices].some(v=>nodes[v].links.length>2))ambiguous++;continue;}
   let at=edges[e][0],edge=e,start=at,poly=[];
   for(let k=0;k<component.length;k++){poly.push(nodes[at].p);at=edges[edge][0]===at?edges[edge][1]:edges[edge][0];if(at===start)break;edge=nodes[at].links.find(n=>n!==edge);}
   if(poly.length>=3&&Math.abs(area(poly))>1e-8)loops.push(poly);
  }
  const levels=loops.map((p,i)=>loops.reduce((n,q,j)=>n+(i!==j&&inside(p[0],q)?1:0),0)),triangles=[];let totalArea=0,rejected=0,holesCount=0;
  for(let i=0;i<loops.length;i++){if(levels[i]%2)continue;const contour=loops[i],holes=loops.filter((p,j)=>levels[j]===levels[i]+1&&inside(p[0],contour)),vertices=[...contour,...holes.flat()];
   const cv=contour.map(p=>new THREE.Vector2(...p)),hv=holes.map(h=>h.map(p=>new THREE.Vector2(...p))),faces=THREE.ShapeUtils.triangulateShape(cv,hv);
   const expected=Math.abs(area(contour))-holes.reduce((n,h)=>n+Math.abs(area(h)),0),actual=faces.reduce((n,t)=>n+Math.abs(area(t.map(v=>vertices[v]))),0);
   if(expected<=0||Math.abs(expected-actual)>Math.max(.00001,expected*.0001)){rejected++;continue;}
   totalArea+=actual;holesCount+=holes.length;
   for(const tri of faces)for(const v of tri){const p=[0,0,0];p[axis]=cut;p[uv[0]]=vertices[v][0];p[uv[1]]=vertices[v][1];triangles.push(...p);}
  }
  return{positions:triangles,stats:{closedLoops:loops.length,openChains,ambiguous,rejected,holes:holesCount,triangles:triangles.length/9,areaMM2:totalArea,welded,maxWeldMM:maxWeld,toleranceMM:tolerance}};
 }
 return{slice,area};
})();
