"""Partition existing mesh face indices by connectivity without editing geometry.
This writes side assignment metadata only. It never rewrites mesh binaries.
"""
import hashlib,json
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
HERE=Path(__file__).resolve().parent
meta=json.loads((HERE/'uw-meshes.json').read_text(encoding='utf-8'))
stats=json.loads((HERE/'uw-label-statistics.json').read_text(encoding='utf-8'))
raw=(HERE/'uw-meshes.bin').read_bytes()
mid=stats['referenceMidlineXmmFromSeptumCentroid']
report={'meshBinarySha256':hashlib.sha256(raw).hexdigest(),'sourceSpace':'RAS mm',
 'referencePlaneXmm':mid,'assignmentBandHalfWidthMm':2.0,
 'method':'Connected components of original triangle-index graph; each component assigned only if its complete vertex bounding box is outside the septum reference plane +/-2 mm band.',
 'sideMeaning':'Positive R relative to reference plane is patient right; negative R is patient left.',
 'anatomicalRegistrationPerformed':False,'verticesModified':False,'facesModified':False,'meshFilesRewritten':False,
 'interpretation':'Reliable coarse side assignment for these spatially separated components. It does not identify a precise midsagittal plane, establish anatomical boundaries, or improve source segmentation accuracy.',
 'items':[]}
for idx in [5,6,7,8]:
 s=meta['segments'][idx]
 v=np.frombuffer(raw,dtype='<f4',count=s['vertexCount']*3,offset=s['po']).reshape(-1,3)
 f=np.frombuffer(raw,dtype='<u4',count=s['triangleCount']*3,offset=s['io']).reshape(-1,3)
 edges=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]])
 adj=coo_matrix((np.ones(len(edges)),(edges[:,0],edges[:,1])),shape=(len(v),len(v))).tocsr()
 count,labels=connected_components(adj,directed=False)
 components=[];assigned=[]
 for cid in range(count):
  vi=np.flatnonzero(labels==cid);fi=np.flatnonzero(labels[f[:,0]]==cid)
  if not len(fi):continue
  assert np.all(labels[f[fi]]==cid)
  p=v[vi].astype(np.float64);lo=p.min(0);hi=p.max(0);c=p.mean(0)
  side='right' if lo[0]>mid+2 else 'left' if hi[0]<mid-2 else 'unresolved'
  components.append({'component':cid,'side':side,'vertexCount':len(vi),'triangleCount':len(fi),
    'centroidVertexMeanRASmm':c.tolist(),'bboxRASmm':[lo.tolist(),hi.tolist()],
    'minimumDistanceToReferencePlaneMm':float(lo[0]-mid if side=='right' else mid-hi[0] if side=='left' else 0),
    'faceIndices':fi.tolist()})
  assigned.extend(fi.tolist())
 assert sorted(assigned)==list(range(len(f)))
 report['items'].append({'index':idx,'en':s['en'],'originalTriangleCount':len(f),'components':components,
     'allFacesAssignedExactlyOnce':True,'allComponentsSideResolved':all(c['side']!='unresolved' for c in components),
     'sideTriangleCounts':{side:sum(c['triangleCount'] for c in components if c['side']==side) for side in ['left','right','unresolved']}})
(HERE/'uw-side-components.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{k:s[k] for k in ['index','en','sideTriangleCounts','allComponentsSideResolved']} for s in report['items']]))
