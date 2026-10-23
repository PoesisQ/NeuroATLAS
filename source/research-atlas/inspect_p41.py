from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'builddeps'))
import nibabel as nib,numpy as np
from scipy.ndimage import find_objects
lut={}
for line in (ROOT/'3dAtlas/lut.freeview.txt').read_text().splitlines():
    v=line.split()
    if v and v[0].isdigit():lut[int(v[0])]={'name':v[1],'rgb':[int(x) for x in v[2:5]]}
blocks=[];alllabels={}
for path in sorted((ROOT/'p41-labels').glob('*.nii.gz'),key=lambda p:int(p.stem.split('.')[0])):
    im=nib.load(path);a=np.asanyarray(im.dataobj);ids,counts=np.unique(a,return_counts=True);vol=abs(np.linalg.det(im.affine[:3,:3]))
    boxes=find_objects(a,max_label=int(ids.max()))
    labels=[]
    for id,n in zip(ids,counts):
        if id==0:continue
        box=boxes[int(id)-1];lo=[s.start for s in box];hi=[s.stop-1 for s in box]
        corners=np.array([[x,y,z] for x in [lo[0],hi[0]] for y in [lo[1],hi[1]] for z in [lo[2],hi[2]]])
        pts=nib.affines.apply_affine(im.affine,corners)
        row={'id':int(id),**lut.get(int(id),{}),'voxels':int(n),'volumeMm3':float(n*vol),'voxelBounds':[lo,hi],
             'nativeRASBoundsMm':[pts.min(axis=0).tolist(),pts.max(axis=0).tolist()]}
        labels.append(row)
        total=alllabels.setdefault(int(id),{'id':int(id),**lut.get(int(id),{}),'blocks':[],'sumBlockVolumeMm3':0,'totalBlockVoxels':0})
        total['blocks'].append(int(path.name.split('.')[0]));total['sumBlockVolumeMm3']+=float(n*vol);total['totalBlockVoxels']+=int(n)
    blocks.append({'file':str(path),'block':int(path.name.split('.')[0]),'shape':im.shape,'affine':im.affine.tolist(),
                   'spacing':[float(x) for x in im.header.get_zooms()],'voxelVolumeMm3':float(vol),'units':im.header.get_xyzt_units(),'labels':labels})
    print(path.name, len(labels),flush=True)
ref=nib.load(ROOT/'p41-mri.nii.gz');ind=nib.load(ROOT/'p41-indices.nii.gz')
report={'dataset':'NextBrain donor P41-16 / case 2','source':'https://github.com/UCL/BrainAtlas-P41-16',
        'commit':json.loads((ROOT/'nextbrain-p41-tree.json').read_text())['sha'],'license':'CC0-1.0; official Figshare record links this registered-data repository',
        'MRI':{'file':str(ROOT/'p41-mri.nii.gz'),'shape':ref.shape,'affine':ref.affine.tolist(),'units':ref.header.get_xyzt_units()},
        'blockOwnership':{'file':str(ROOT/'p41-indices.nii.gz'),'shape':ind.shape,'affine':ind.affine.tolist(),'labels':[int(x) for x in np.unique(np.asanyarray(ind.dataobj))]},
        'notes':['Use each NIfTI block affine to place the already nonlinearly aligned labels in donor MRI physical coordinates. Do not use the display-pixel matrices without accounting for display rotations.',
                 'Original blocks have histology in-plane spacing approximately 0.1 mm and section spacing 0.25 or 0.5 mm before affine scaling. Header spacings vary with the authors registration.',
                 'Blocks can overlap or leave gaps at seams. Summed block volumes may double-count overlaps and are not a validated total structure volume.',
                 'No independent anatomical expert review performed. Source gives MRI/histology registration method, not zero-error guarantee.',
                 'Do not infer a second hemisphere by mirroring. This is a single donor hemisphere.'],
        'blocks':blocks,'labels':sorted(alllabels.values(),key=lambda x:x['id'])}
(ROOT/'p41-label-statistics.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('Summary',len(blocks),len(alllabels),flush=True)
