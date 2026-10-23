"""Validate complete core packing and render its fixed native-coordinate context."""
from pathlib import Path
import gzip,hashlib,json,sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
HERE=Path(__file__).resolve().parent;OUT=HERE/'bp2018-full'
sys.path.insert(0,str(HERE.parents[1]))
from analyze_bp3d import parse_obj
from render_helpers import panel
meta=json.loads((OUT/'meshes.json').read_text(encoding='utf8'))
raw=(OUT/'meshes.bin').read_bytes()
assert gzip.decompress((OUT/'meshes.bin.gz').read_bytes())==raw
source=json.loads((OUT/'download-manifest.json').read_text(encoding='utf8'))
assert set(meta['availableObjectIds'])=={r['id'] for r in source['files']}
objects=[];verified=[]
for s in meta['segments']:
    v,f,_=parse_obj(OUT/s['sourceFile'])
    assert hashlib.sha256((OUT/s['sourceFile']).read_bytes()).hexdigest()==s['sha256']
    assert np.array_equal(v,np.frombuffer(raw,dtype='<f4',count=s['vertexCount']*3,offset=s['po']).reshape(-1,3))
    assert np.array_equal(f,np.frombuffer(raw,dtype='<u4',count=s['triangleCount']*3,offset=s['io']).reshape(-1,3))
    verified.append(s['id'])
    if s['defaultContextVisible']:objects.append({**s,'v':v,'f':f})
assert sum(s['triangleCount'] for s in objects)==meta['defaultContextTriangleCount']
fig,axs=plt.subplots(1,3,figsize=(16,6.5),facecolor='#f5f3ed')
for ax,view,title in zip(axs,['left','front','top'],['Left lateral view','Anterior view','Superior view']):panel(ax,objects,view,title)
fig.suptitle('BodyParts3D 20181210i412 | fixed native-coordinate cortical context',fontsize=16)
fig.text(.5,.06,str(len(objects))+' displayed source objects; '+format(meta['defaultContextTriangleCount'],',')+' unchanged triangles. Historical overlapping alternatives and deep/hippocampal objects hidden.',ha='center',fontsize=10)
fig.text(.5,.025,'One common coordinate system. No 4.3 mesh added; no fitted registration, shape replacement or invented hemisphere surface.',ha='center',fontsize=9)
fig.subplots_adjust(top=.88,bottom=.12,wspace=.02)
fig.savefig(HERE/'bp2018-whole-cortex-context.png',dpi=130);plt.close(fig)
analysis=json.loads((OUT/'geometry-analysis.json').read_text(encoding='utf8'))
issues=[{'id':s['id'],'boundaryEdges':s['topology']['boundaryEdgesAfterExactPositionMerge'],'nonManifoldEdges':s['topology']['nonmanifoldEdgesAfterExactPositionMerge'],'defaultContextVisible':s['defaultContextVisible']} for s in analysis['segments'] if s['topology']['boundaryEdgesAfterExactPositionMerge'] or s['topology']['nonmanifoldEdgesAfterExactPositionMerge']]
report={'verifiedObjects':len(verified),'allSourceHashesMatch':True,'gzipMatchesBinary':True,'originalVerticesAndFacesMatchPacked':True,
        'defaultContextObjects':len(objects),'defaultContextTriangleCount':meta['defaultContextTriangleCount'],
        'defaultContextIds':[s['id'] for s in objects],
        'allSideMeansMatchSourceSide':all(s['vertexMeanSideConsistent'] for s in analysis['segments']),
        'sourceMeshTopologyIssuesPreserved':issues,
        'topologyInterpretation':'These defects are present in the original source meshes. No repair or closing cap was created. Topology is not an anatomical validation.',
        'nativeCommonBoundingBoxCenterMm':meta['nativeCommonBoundingBoxCenterMm'],
        'wholeCortexFigure':'bp2018-whole-cortex-context.png','figureObjects':'Exactly defaultContextIds; original faces projected with depth sorting for QA.'}
(OUT/'core-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
