# -*- coding: utf-8 -*-
"""MRI/label QA in native physical RAS planes; image interpolation is explicit."""
from pathlib import Path
import sys,json,functools
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'builddeps'))
import numpy as np,nibabel as nib
from scipy.ndimage import map_coordinates
from PIL import Image,ImageDraw,ImageFont
OUT=ROOT/'evidence';OUT.mkdir(exist_ok=True)
mesh=json.loads((ROOT/'p41-meshes.json').read_text('utf-8'))
meta=json.loads((ROOT/'p41-label-statistics.json').read_text('utf-8'))
MRI=nib.load(ROOT/'p41-mri.nii.gz');m=np.asanyarray(MRI.dataobj).astype(np.float32)
win=np.percentile(m[m>0],[1,99.7]);invMRI=np.linalg.inv(MRI.affine)
fontpath='C:/Windows/Fonts/msyh.ttc'
font=ImageFont.truetype(fontpath,19);small=ImageFont.truetype(fontpath,14);large=ImageFont.truetype(fontpath,24)
@functools.lru_cache(maxsize=3)
def block(n):
    im=nib.load(ROOT/f'p41-labels/{n}.nii.gz')
    return np.asanyarray(im.dataobj),im.affine,np.linalg.inv(im.affine)
panes=[('axial','轴位 S',0,1,2,'L','R','A','P'),('coronal','冠状位 A',0,2,1,'L','R','S','I'),('sagittal','矢状位 R',1,2,0,'P','A','S','I')]
evidence=[]
for s in mesh['segments']:
    if s['role']=='context':continue
    id=s['labelId'];center=np.array(s['centroidRASmm']);best=(float('inf'),None)
    for p in s['parts']:
        a,aff,inv=block(p['sourceBlock']);lo,hi=np.array(p['sourceVoxelBounds']);crop=a[tuple(slice(int(l),int(h+1)) for l,h in zip(lo,hi))]
        pts=np.array(np.nonzero(crop==id)).T+lo;w=nib.affines.apply_affine(aff,pts);dist=np.sum((w-center)**2,axis=1);i=int(np.argmin(dist))
        if dist[i]<best[0]:best=(dist[i],w[i])
    anchor=best[1];bounds=np.array(s['bboxSurfaceRASmm']);span=max(22,float(np.max(bounds[1]-bounds[0])+12));n=432;scale=span/(n-1)
    horizontal=(np.arange(n)-n//2)*scale;vertical=-(np.arange(n)-n//2)*scale;xx,yy=np.meshgrid(horizontal,vertical)
    imgs=[];pr=[]
    for key,title,u,v,fixed,left,right,top,bottom in panes:
        coords=np.tile(anchor,(n,n,1));coords[:,:,u]+=xx;coords[:,:,v]+=yy
        flat=coords.reshape(-1,3);q=nib.affines.apply_affine(invMRI,flat).T
        gray=map_coordinates(m,q,order=1,mode='constant',cval=0,prefilter=False).reshape(n,n)
        gray=np.clip((gray-win[0])/(win[1]-win[0]),0,1)
        rgb=np.repeat((gray*220).astype(np.float32)[:,:,None],3,axis=2)
        masks=[]
        for p in s['parts']:
            a,aff,inv=block(p['sourceBlock']);c=nib.affines.apply_affine(inv,flat).T
            labels=map_coordinates(a,c,order=0,mode='constant',cval=0,prefilter=False).reshape(n,n)
            masks.append(labels==id)
        target=np.logical_or.reduce(masks);overlap=np.sum(np.stack(masks),axis=0)>1
        rgb[target]=rgb[target]*.35+np.array([255,87,74])*.65
        rgb[overlap]=np.array([255,202,62])
        im=Image.fromarray(np.uint8(np.clip(rgb,0,255)))
        panel=Image.new('RGB',(472,534),(247,248,247));panel.paste(im,(20,52));draw=ImageDraw.Draw(panel)
        draw.text((20,10),f'{title} = {anchor[fixed]:.3f} mm',font=font,fill=(25,45,50))
        draw.text((23,54),left,font=small,fill='white');draw.text((430,54),right,font=small,fill='white')
        draw.text((231,54),top,font=small,fill='white');draw.text((231,460),bottom,font=small,fill='white')
        length=5/scale;draw.line((32,469,32+length,469),fill='white',width=3);draw.text((32,443),'5 mm',font=small,fill='white')
        draw.text((20,494),f'红：源标签  |  黄：跨块重叠  |  像素 {scale:.3f} mm',font=small,fill=(40,60,64))
        file=f'p41_{id}_{key}.png';panel.save(OUT/file);imgs.append(panel)
        pr.append({'plane':key,'fixedRASaxis':fixed,'fixedCoordinateMm':float(anchor[fixed]),'sourceOverlayPixelCount':int(target.sum()),'blockOverlapPixelCount':int(overlap.sum()),'file':file})
        assert target.sum()>0,(id,key,'empty target')
    sheet=Image.new('RGB',(1456,680),(247,248,247));d=ImageDraw.Draw(sheet)
    d.text((20,12),f'P41-16 | {s["zh"]} | ID {id}',font=large,fill=(20,45,50))
    d.text((20,46),s['en'],font=font,fill=(40,65,70))
    for i,im in enumerate(imgs):sheet.paste(im,(10+i*482,82))
    blocks=[p['sourceBlock'] for p in s['parts']]
    d.text((20,618),f'同标本 MRI 约 0.4 mm；标签原生约 0.1 mm 面内，切片间距 0.25 / 0.5 mm（配准后按各块 affine）。块：{blocks}',font=small,fill=(40,65,70))
    d.text((20,641),'MRI 仅作显示线性插值；标签最近邻回投。跨块未补缝；此图验证坐标一致性，不证明核团完整性或零解剖误差。',font=small,fill=(40,65,70))
    if s['smallSourceLabelCaution']:d.text((20,662),'注意：该来源仅提供很小的局部标签，不可作为完整核团体积。',font=small,fill=(180,65,45))
    contact=f'p41_{id}_orthogonal.png';sheet.save(OUT/contact)
    evidence.append({'labelId':id,'zh':s['zh'],'en':s['en'],'contactSheet':contact,'anchorRASmm':anchor.tolist(),'fieldOfViewMm':span,'displayPixelMm':scale,
                     'sourceBlocks':blocks,'sourceBlockSpacingMm':[p['sourceSpacingMm'] for p in s['parts']],
                     'slicePanels':pr,'smallSourceLabelCaution':s['smallSourceLabelCaution'],
                     'method':'World RAS orthogonal planes sampled through an actual label voxel nearest the source-volume centroid. MRI sampled via inverse MRI affine (linear), each source label block via its inverse native NIfTI affine (nearest). No guessed image-index alignment.'})
    print(id,[v['sourceOverlayPixelCount'] for v in pr],flush=True)
(OUT/'p41-evidence-index.json').write_text(json.dumps({'MRI':meta['MRI'],'coordinateConvention':'neurological physical RAS axis labels printed on each panel; L/R and A/P are not inferred from bitmap indices',
    'referenceWindow':win.tolist(),'sourceMRIResolutionMm':[float(x) for x in MRI.header.get_zooms()],'evidence':evidence},ensure_ascii=False,indent=2),encoding='utf-8')
