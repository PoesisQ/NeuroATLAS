from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'builddeps'))
import numpy as np,nibabel as nib
stats=json.loads((ROOT/'p41-label-statistics.json').read_text())
m=nib.load(ROOT/'p41-mri.nii.gz');ind=nib.load(ROOT/'p41-indices.nii.gz')
lut={v['name']:v['id'] for v in stats['labels']}
raw=json.loads((ROOT/'p41-ontology.json').read_text())
checks=[];matrixchecks=[]
for b in stats['blocks']:
    bid=b['block'];aff=np.array(b['affine']);t=np.loadtxt(ROOT/f'p41-matrices/block_{bid:02d}.txt')
    rel=np.linalg.inv(aff)@m.affine@np.linalg.inv(t)
    expected=np.array([0,0,1,0]) if rel[2,2]>0 else np.array([0,0,-1,b['shape'][2]-1])
    matrixchecks.append({'block':bid,'nativeToDisplaySliceReversed':bool(rel[2,2]<0),'nativeZFromDisplayZ':rel[2].tolist(),'maxZCoordinateTransformError':float(np.max(np.abs(rel[2]-expected))),'inPlaneMatrixDeterminant':float(np.linalg.det(rel[:2,:2]))})
    nodes=[c for group in raw for c in [group,*group.get('children',[])] if int(c['data'].get('blockNumber',-1))==bid and (c.get('label') or '').strip() in lut and not (c['data']['xh']==0 and c['data']['yh']==0)]
    if not nodes:continue
    vol=np.asanyarray(nib.load(ROOT/f'p41-labels/{bid}.nii.gz').dataobj)
    for node in nodes:
        q=node['data'];id=lut[node['label'].strip()]
        expectedMRI=np.array([q['xm'],q['ym'],q['zm']]);pos=nib.affines.apply_affine(np.linalg.inv(aff)@m.affine,expectedMRI)
        ijk=np.round(pos).astype(int)
        inside=np.all(ijk>=0) and np.all(ijk<np.array(vol.shape))
        actual=int(vol[tuple(ijk)]) if inside else None
        points=np.array(np.nonzero(vol==id)).T
        if not len(points):continue
        world=nib.affines.apply_affine(aff,points)
        target=nib.affines.apply_affine(m.affine,expectedMRI)
        dist=float(np.sqrt(np.min(np.sum((world-target)**2,axis=1))))
        checks.append({'block':bid,'id':int(id),'name':node['label'].strip(),'nearestVoxelLabel':actual,'distanceToSameLabelMm':dist,'pointInLabel':actual==id})
res={'method':'Transform author ontology MRI voxel locations into each native label block using only NIfTI headers. Compare nearest present same-label voxel. Display matrices are independently checked for the same slice coordinate.',
     'coordinateProof':'Native block and MRI NIfTI affines are consistent with the author-supplied MRI-to-display matrices up to expected in-plane display rotations and optional reversal of section order. Blocks 9 and 15 reverse z; no arbitrary registration was fitted.',
     'notAnatomicalValidation':'This tests coordinate/data consistency, not the accuracy or completeness of anatomical boundaries. Author ontology points need not fall within nonconvex masks.',
     'MRIandOwnershipAffineMaxDifference':float(np.max(np.abs(m.affine-ind.affine))),
     'matrixChecks':matrixchecks,'ontologyChecks':checks,
     'summary':{'points':len(checks),'exactMatches':sum(v['pointInLabel'] for v in checks),'within1mm':sum(v['distanceToSameLabelMm']<=1 for v in checks),'within2mm':sum(v['distanceToSameLabelMm']<=2 for v in checks),
                'maxDisplayZError':max(x['maxZCoordinateTransformError'] for x in matrixchecks)}}
(ROOT/'p41-coordinate-validation.json').write_text(json.dumps(res,indent=2),encoding='utf-8')
print(json.dumps(res['summary']))
