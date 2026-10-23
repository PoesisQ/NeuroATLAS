"""Inspect published UW segmentation against published CT in world coordinates.
No fitting is performed. Both affine matrices are read from source headers.
"""
from pathlib import Path
import hashlib,json
import numpy as np
from scipy.ndimage import map_coordinates, binary_dilation
from analyze_uw import read_nrrd,HERE
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

seg,sh,sa = read_nrrd(HERE/'uw-segmentation.seg.nrrd')
ct,ch,ca = read_nrrd(HERE/'uw-template.nrrd')
# Convert physical LPS -> RAS, not an anatomical registration.
if ch['space']=='left-posterior-superior': ca = np.diag([-1,-1,1,1])@ca
assert sh['space']=='right-anterior-superior'
invct=np.linalg.inv(ca); invseg=np.linalg.inv(sa)
stats=json.loads((HERE/'uw-label-statistics.json').read_text(encoding='utf-8'))

def sample_ct_ras(ras):
    ijk=ras@invct[:3,:3].T+invct[:3,3]
    return map_coordinates(ct,ijk.T,order=1,mode='constant',cval=np.nan,prefilter=False)

def ct_values(index):
    vox=np.argwhere(seg[index] != 0)
    ras=vox@sa[:3,:3].T+sa[:3,3]
    v=sample_ct_ras(ras)
    return {'finiteFraction':float(np.isfinite(v).mean()),'min':float(np.nanmin(v)),'q10':float(np.nanpercentile(v,10)),
            'median':float(np.nanmedian(v)),'q90':float(np.nanpercentile(v,90)),'max':float(np.nanmax(v))}

report={'ctSha256':hashlib.sha256((HERE/'uw-template.nrrd').read_bytes()).hexdigest(),
        'ctOriginalSpace':ch['space'],'ctShape':list(ct.shape),'ctIJKToRAS':ca.tolist(),
        'segIJKToRAS':sa.tolist(),'registrationPerformed':False,
        'sampling':'linear interpolation at world RAS voxel centres; outside CT counted as nonfinite',
        'interpretation':'Image overlay supports a visual alignment check only. It is not clinical proof of segmentation accuracy. CT is a synthetic average of 6 subjects.',
        'segments':[]}
for s in stats['segments']:
    report['segments'].append({'index':s['index'],'en':s['en'],'ctSampleStats':ct_values(s['index'])})

# Native world-coordinate views through each named foramen/canal's left label centroid.
for index in [5,6,7,8]:
    s=stats['segments'][index]
    c=next(v['centroidRASmm'] for v in s['components'] if v['approxSideRelativeToSeptum']=='left')
    views=[('Axial',0,1,2),('Coronal',0,2,1),('Sagittal',1,2,0)]
    fig,axs=plt.subplots(1,3,figsize=(12,4.8),dpi=150)
    for ax,(name,h,v,fixed) in zip(axs,views):
        span=24 if index!=6 else 16
        xx=np.linspace(c[h]-span,c[h]+span,400); yy=np.linspace(c[v]-span,c[v]+span,400)
        gx,gy=np.meshgrid(xx,yy); ras=np.tile(c,(gx.size,1)); ras[:,h]=gx.ravel();ras[:,v]=gy.ravel()
        image=sample_ct_ras(ras).reshape(gx.shape)
        ijk=ras@invseg[:3,:3].T+invseg[:3,3]
        label=map_coordinates(np.asarray(seg[index]),ijk.T,order=0,mode='constant',cval=0,prefilter=False).reshape(gx.shape)
        bone=map_coordinates(np.asarray(seg[13]),ijk.T,order=0,mode='constant',cval=0,prefilter=False).reshape(gx.shape)
        ext=[xx[0],xx[-1],yy[0],yy[-1]]
        ax.imshow(image,cmap='gray',vmin=-300,vmax=1500,origin='lower',extent=ext)
        if np.any(label): ax.contour(xx,yy,label,levels=[.5],colors=['#ff3b6c'],linewidths=1.0)
        if np.any(bone): ax.contour(xx,yy,bone,levels=[.5],colors=['#4dceff'],linewidths=.4,alpha=.55)
        ax.set_title(f'{name} | RAS {"RAS"[fixed]}={c[fixed]:.2f} mm',fontsize=9)
        ax.set_xlabel(f'{"RAS"[h]} (mm)'); ax.set_ylabel(f'{"RAS"[v]} (mm)'); ax.tick_params(labelsize=7)
    fig.suptitle(s['en']+' | source CT + segmentation, original world coordinates',fontsize=11)
    fig.text(.5,.025,'Pink: source foramen/canal label. Cyan: source bone label. No fitted registration or edited anatomy.',ha='center',fontsize=8)
    fig.tight_layout(rect=[0,.09,1,.92]); fn='uw-'+s['en'].replace(' ','-')+'-ct.png';fig.savefig(HERE/fn);plt.close(fig)
    report.setdefault('slices',[]).append({'index':index,'file':fn,'targetRASmm':c})
(HERE/'uw-ct-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'ctShape':list(ct.shape),'segments':report['segments'],'slices':report['slices']}))
