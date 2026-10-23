"""Preserve original DBCLS vertices/triangles and inspect gross relationships.
No anatomical generation, smoothing, mirroring, registration or inferred labels.
"""
from pathlib import Path
import gzip,hashlib,json,re
import numpy as np
from scipy.spatial import cKDTree
HERE=Path(__file__).resolve().parent
ROOT=HERE/'bodyparts3d'
ZH={'insula':'岛叶','internal capsule':'内囊','caudate nucleus':'尾状核','globus pallidus':'苍白球',
    'putamen':'壳核','thalamus':'丘脑','precentral gyrus':'中央前回','postcentral gyrus':'中央后回',
    'superior temporal gyrus':'颞上回','middle frontal gyrus':'额中回','inferior frontal gyrus':'额下回',
    'superior parietal lobule':'顶上小叶','supramarginal gyrus':'缘上回'}

def parse_obj(path):
    vv=[];ff=[];polygonCounts={}
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.startswith('v '): vv.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('f '):
            face=[int(x.split('/')[0])-1 for x in line.split()[1:]]
            polygonCounts[str(len(face))]=polygonCounts.get(str(len(face)),0)+1
            if len(face)!=3: raise ValueError('Nontriangular original polygon: '+path.name)
            ff.append(face)
    v=np.array(vv,dtype='<f4');f=np.array(ff,dtype='<u4')
    assert np.all(np.isfinite(v)) and f.min()>=0 and f.max()<len(v)
    return v,f,polygonCounts

def topology(v,f):
    # Coordinate duplicates in OBJ can mark seams. No welding is applied to output.
    keys,inv=np.unique(v,axis=0,return_inverse=True)
    wf=inv[f]; edges=np.concatenate([wf[:,[0,1]],wf[:,[1,2]],wf[:,[2,0]]]); edges.sort(axis=1)
    ue,counts=np.unique(edges,axis=0,return_counts=True)
    return {'sourceVertices':len(v),'exactUniquePositions':len(keys),'triangles':len(f),
            'boundaryEdgesAfterExactPositionMerge':int(np.sum(counts==1)),
            'nonmanifoldEdgesAfterExactPositionMerge':int(np.sum(counts>2)),
            'eulerCharacteristicAfterExactPositionMerge':int(len(keys)-len(ue)+len(f))}

def main():
    metadata=[];binary=[];offset=0;objects={};stats=[]
    for path in sorted(ROOT.glob('*.obj')):
        # The 4.3 manifest contains two overlapping historical representations
        # per superior parietal lobule. Neither is needed for the local insula
        # window; retain originals for research but do not render both together.
        if 'superior parietal lobule' in path.name: continue
        m=re.match(r'(FJ\d+M?)_(BP\d+)_(FMA\d+)_(.*)\.obj$',path.name)
        assert m,path.name
        fj,bp,fma,en=m.groups();v,f,pc=parse_obj(path);objects[en]=v
        side='left' if en.startswith('Left ') else 'right' if en.startswith('Right ') else 'median'
        base=en.removeprefix('Left ').removeprefix('Right ')
        role='white-matter-atlas' if base=='internal capsule' else 'cortical-context' if 'gyrus' in base or 'lobule' in base else 'cortex-atlas' if base=='insula' else 'deep-grey-atlas'
        zh=('左侧' if side=='left' else '右侧' if side=='right' else '')+ZH.get(base,base)
        po=offset;pb=v.tobytes();binary.append(pb);offset+=len(pb)
        io=offset;ib=f.tobytes();binary.append(ib);offset+=len(ib)
        rec={'index':len(metadata),'id':fj,'sourceFile':path.name,'en':en,'zh':zh,'side':side,'role':role,
             'fma':fma,'bp':bp,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
             'vertexCount':len(v),'triangleCount':len(f),'bboxNativeMm':[v.min(0).tolist(),v.max(0).tolist()],
             'centroidNativeMm':v.mean(0).tolist(),'po':po,'io':io}
        metadata.append(rec)
        stats.append({**rec,'bboxDimensionsMm':(v.max(0)-v.min(0)).tolist(),'originalPolygonSizes':pc,
                      'topology':topology(v,f),'leftRightCoordinateCheck':bool(np.all(v[:,0]>0)) if side=='left' else bool(np.all(v[:,0]<0)) if side=='right' else None})
    # Same-source gross medial/lateral ordering of vertex centroids. This check
    # must not be mistaken for a full surface intersection or regional limb audit.
    relationships=[]
    for side in ['Left','Right']:
        c={key:objects[side+' '+key].mean(0) for key in ['insula','internal capsule','caudate nucleus','putamen','globus pallidus','thalamus']}
        lat={key:abs(float(v[0])) for key,v in c.items()}
        checks=[('thalamus medial to capsule',lat['thalamus']<lat['internal capsule']),
                ('capsule medial to globus pallidus',lat['internal capsule']<lat['globus pallidus']),
                ('globus pallidus medial to putamen',lat['globus pallidus']<lat['putamen']),
                ('putamen medial to insula',lat['putamen']<lat['insula']),
                ('caudate centroid medial to capsule',lat['caudate nucleus']<lat['internal capsule'])]
        relationships.append({'side':side.lower(),'absoluteCentroidXmm':lat,'checks':[{'claim':n,'pass':bool(v)} for n,v in checks]})
    allv=np.concatenate(list(objects.values()))
    raw=b''.join(binary);(ROOT/'bp3d-meshes.bin').write_bytes(raw);(ROOT/'bp3d-meshes.bin.gz').write_bytes(gzip.compress(raw,9))
    (ROOT/'bp3d-meshes.json').write_text(json.dumps({'space':'BodyParts3D: +X left,+Y posterior,+Z superior','unit':'mm',
        'registrationToExistingAtlas':None,'recommendedDisplayAxisTransform':[[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],
        'nativeCommonBoundingBoxCenterMm':((allv.min(0)+allv.max(0))/2).tolist(),'segments':metadata},ensure_ascii=False),encoding='utf-8')
    report={'source':'DBCLS BodyParts3D/Anatomography, official download.cgi originals',
            'unit':'mm','axes':'+X patient left,+Y posterior,+Z superior',
            'sourceCoordinatesPreserved':True,'surfacesSmoothed':False,'surfacesMirrored':False,
            'sourceType':'Anatomical atlas incorporating MRI and anatomical art; per-structure image resolution/validation is not supplied.',
            'limits':['No claustrum, external capsule, extreme capsule or circular insular sulcus element found in inspected 4.3 discovery manifest.',
                      'Downloaded superior parietal lobule has overlapping old/new element variants; excluded from packed scene rather than superimposed.',
                      'Internal capsule is a whole labeled atlas structure; anterior limb, genu, posterior/retrolenticular/sublenticular subdivisions are not independently labeled.',
                      'Insula is source-labeled whole structure, not separately labeled short/long gyri, limen or central insular sulcus.',
                      'Cortical context is a selection of same-source gyri, not a closed complete hemisphere shell.',
                      'Centroid ordering is only a gross consistency check, not a full anatomy or surface-contact validation.',
                      'Data not co-registered to existing Z-Anatomy scene; do not paste into it based on matching names.'],
            'segments':stats,'grossRelationshipChecks':relationships}
    (ROOT/'bp3d-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'segments':len(metadata),'vertices':sum(r['vertexCount'] for r in metadata),'triangles':sum(r['triangleCount'] for r in metadata),'compressedBytes':(ROOT/'bp3d-meshes.bin.gz').stat().st_size,'relationships':relationships}))
if __name__=='__main__':main()
