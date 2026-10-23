# -*- coding: utf-8 -*-
"""Source-label isosurfaces; no model fitting, gap filling, smoothing or mirroring."""
from pathlib import Path
import sys,json,gzip,hashlib
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'builddeps'))
import numpy as np,nibabel as nib
from skimage.measure import marching_cubes
from scipy.ndimage import label as connected_components

names={649:'上橄榄内侧部',660:'上橄榄外侧核',654:'下橄榄主核',671:'下橄榄内侧副核',685:'下橄榄背侧副核',682:'外展神经核',666:'面神经核',724:'舌下神经核',725:'迷走神经背侧运动核',693:'疑核',717:'孤束核',630:'三叉神经运动核',659:'三叉神经脑桥感觉核',669:'三叉神经脊束核',645:'三叉神经中脑核',689:'耳蜗腹侧核',731:'耳蜗背侧核',683:'前庭上核',690:'前庭外侧核',694:'前庭内侧核',703:'前庭下核',715:'小脑顶核',721:'小脑齿状核',751:'小脑球状核',752:'小脑栓状核',589:'蓝斑核',447:'动眼神经副核（局部标签）',464:'动眼神经核（局部标签）',520:'滑车神经核（局部标签）',431:'中脑白质（源分区）',611:'后脑白质（源分区）',580:'脑桥其余组织（源分区）',662:'延髓其余组织（源分区）'}
context={431,611,580,662};tiny={447,464,520}
stats=json.loads((ROOT/'p41-label-statistics.json').read_text())
lookup={x['id']:x for x in stats['labels']}
vols={};partsByLabel={x:[] for x in names};centroids={x:[] for x in names}
for block in stats['blocks']:
    bid=block['block'];wanted=[x for x in block['labels'] if x['id'] in names]
    if not wanted:continue
    im=nib.load(ROOT/f'p41-labels/{bid}.nii.gz');a=np.asanyarray(im.dataobj);aff=im.affine
    for src in wanted:
        id=src['id'];lo=np.maximum(np.array(src['voxelBounds'][0])-1,0);hi=np.minimum(np.array(src['voxelBounds'][1])+2,a.shape)
        mask=(a[tuple(slice(int(l),int(h)) for l,h in zip(lo,hi))]==id)
        sourceTouches=[ax for ax in range(3) if src['voxelBounds'][0][ax]==0 or src['voxelBounds'][1][ax]==a.shape[ax]-1]
        # Coarse context only; target nuclear masks are sampled at every source voxel.
        step=4 if id in context else 1
        crop=mask[::step,::step,::step].astype(np.float32)
        if crop.max()!=1 or crop.min()!=0 or any(s<2 for s in crop.shape):
            raise ValueError(('unsupported crop',id,bid,crop.shape))
        verts,faces,_,_=marching_cubes(crop,level=.5,allow_degenerate=False,gradient_direction='ascent')
        native=(verts*step+lo)@aff[:3,:3].T+aff[:3,3]
        if np.linalg.det(aff[:3,:3])<0:faces=faces[:,[0,2,1]]
        native=native.astype('<f4');faces=faces.astype('<u4')
        assert np.isfinite(native).all() and faces.max()<len(native)
        edges=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]);edges.sort(axis=1)
        _,ec=np.unique(edges,axis=0,return_counts=True)
        _,cc=connected_components(mask)
        sourcePoints=np.array(np.nonzero(mask)).T+lo
        sourceMean=np.mean(sourcePoints,axis=0)@aff[:3,:3].T+aff[:3,3]
        centroids[id].append((sourceMean,src['volumeMm3']))
        centered=native.astype('float64')-native.mean(axis=0,dtype='float64')
        signedVolume=float(np.sum(np.einsum('ij,ij->i',centered[faces[:,0]],np.cross(centered[faces[:,1]],centered[faces[:,2]])))/6)
        if np.sum(ec==1)==0: assert signedVolume>0,(id,bid,'inward winding')
        meta={'sourceBlock':bid,'sourceFile':f'p41-labels/{bid}.nii.gz','sourceVoxels':src['voxels'],'sourceVolumeMm3':src['volumeMm3'],
              'sourceSpacingMm':block['spacing'],'sourceAffine':aff.tolist(),'sourceVoxelBounds':src['voxelBounds'],
              'displayStride':step,'displaySpacingMm':[float(v)*step for v in block['spacing']],
              'sourceBoundaryTouchAxes':sourceTouches,'labelComponents6Connected':int(cc),'meshOpenEdges':int(np.sum(ec==1)),
              'nonManifoldEdges':int(np.sum(ec>2)),'signedSurfaceVolumeMm3':signedVolume,'outwardWinding':'gradient ascent plus affine-determinant correction; positive volume asserted for closed parts','interpolation':'Binary mask 0.5 marching-cubes isosurface',
              'blockSeamHandling':'No artificial padding beyond source block, no union remeshing, no seam closure, no smoothing.'}
        partsByLabel[id].append((native,faces,meta))
        print(id,bid,len(native),len(faces),flush=True)
payload=bytearray();segments=[]
for id in names:
    parts=partsByLabel[id]
    if not parts:continue
    vs=[];fs=[];pm=[];nv=0;nf=0
    for v,f,m in parts:
        vs.append(v);fs.append(f+nv);pm.append({**m,'vertexStart':nv,'triangleStart':nf,'vertexCount':len(v),'triangleCount':len(f)})
        nv+=len(v);nf+=len(f)
    v=np.concatenate(vs).astype('<f4');f=np.concatenate(fs).astype('<u4')
    po=len(payload);payload.extend(v.tobytes());io=len(payload);payload.extend(f.tobytes())
    weights=np.array([x[1] for x in centroids[id]]);center=np.average(np.array([x[0] for x in centroids[id]]),axis=0,weights=weights)
    src=lookup[id]
    segments.append({'index':len(segments),'labelId':id,'en':src['name'],'zh':names[id],'role':'context' if id in context else 'nucleus-source-label',
                     'po':po,'io':io,'vertexCount':nv,'triangleCount':nf,'bboxSurfaceRASmm':[v.min(axis=0).tolist(),v.max(axis=0).tolist()],
                     'centroidRASmm':center.tolist(),'color':[x/255 for x in src['rgb']],'parts':pm,'sourceBlockVolumeMm3':float(weights.sum()),
                     'smallSourceLabelCaution':id in tiny,'completeNucleusClaim':False,
                     'quality':'Donor histology-derived source label; completeness and anatomical boundaries not independently validated.',
                     'warning':'Source local label is very small; it must not be presented as the complete nucleus.' if id in tiny else 'Across-block boundaries remain separate; no complete-boundary guarantee.'})
out=ROOT/'p41-meshes.bin';out.write_bytes(payload)
packed=gzip.compress(payload,compresslevel=9,mtime=0);(ROOT/'p41-meshes.bin.gz').write_bytes(packed)
report={'schema':'positions float32 little-endian, indices uint32 little-endian; byte offsets po/io; one segment per source label; parts are not seam-welded',
        'space':'P41-16 native RAS','unit':'mm','coordinateMeaning':'Each registered block NIfTI affine is applied directly; same specimen MRI. No registration to Z-Anatomy or any other atlas.',
        'source':'https://github.com/UCL/BrainAtlas-P41-16','commit':stats['commit'],'license':'CC0-1.0','datasetDOI':'10.5522/04/24243835.v1',
        'hemisphere':'Single source donor hemisphere; no mirrored copy. Preserve original native RAS and label identities.',
        'segments':segments,'binaryBytes':len(payload),'gzipBytes':len(packed),'sha256':hashlib.sha256(payload).hexdigest(),
        'sourceSpacingNotAccuracy':'0.1 mm in-plane and 0.25/0.5 mm section acquisition are sampling resolutions. Registration and delineation error remain; study reports ~0.99 mm mean landmark error overall.',
        'contextWarning':'Context white matter and pons/medulla labels are source residual labels, not complete anatomical envelopes. Display context uses stride4 in all 3 block axes; nuclear targets use stride1.',
        'meshPolicy':'No smoothing, hole filling, disconnected-component deletion, fitting, manual geometry or mirroring. No padding beyond raw block edge. A .5 surface interpolates binary boundary within the sampled voxel grid.'}
(ROOT/'p41-meshes.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print('OUTPUT',len(segments),len(payload),len(packed),flush=True)
