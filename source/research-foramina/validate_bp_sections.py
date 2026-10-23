"""Sections are exact triangle/plane intersections, not invented anatomy."""
from pathlib import Path
import json
import numpy as np
from analyze_bp3d import ROOT,parse_obj
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D

palette={'insula':'#e06b53','internal capsule':'#c4a232','caudate nucleus':'#348da7','thalamus':'#8b6fb4','globus pallidus':'#b4699c','putamen':'#60935c'}
meshes={}
for p in ROOT.glob('*.obj'):
    en=p.stem.split('_',3)[3]
    if en.removeprefix('Left ').removeprefix('Right ') not in palette:continue
    v,f,_=parse_obj(p);meshes[en]=(v,f)

def section(v,f,axis,value):
    tri=v[f].astype(float); d=tri[:,:,axis]-value
    use=(d.min(1)<=0)&(d.max(1)>=0);tri=tri[use];d=d[use]
    lines=[]
    for t,dd in zip(tri,d):
        pts=[t[i] for i in range(3) if abs(dd[i])<1e-9]
        for a,b in [(0,1),(1,2),(2,0)]:
            if dd[a]*dd[b]<0:pts.append(t[a]+(-dd[a]/(dd[b]-dd[a]))*(t[b]-t[a]))
        unique=[]
        for pt in pts:
            if not any(np.linalg.norm(pt-q)<1e-7 for q in unique):unique.append(pt)
        if len(unique)==2:lines.append(unique)
    return np.array(lines)

def rayx(v,f,y,z):
    t=v[f].astype(float); a=t[:,0];b=t[:,1];c=t[:,2]
    e=b-a;g=c-a;q=np.array([y,z])-a[:,1:]
    den=e[:,1]*g[:,2]-e[:,2]*g[:,1]
    valid=np.abs(den)>1e-9
    u=np.zeros(len(t));w=u.copy();u[valid]=(q[valid,0]*g[valid,2]-q[valid,1]*g[valid,1])/den[valid]
    w[valid]=(e[valid,1]*q[valid,1]-e[valid,2]*q[valid,0])/den[valid]
    valid &= (u>=0)&(w>=0)&(u+w<=1)
    xs=np.sort((a[:,0]+u*e[:,0]+w*g[:,0])[valid]);clean=[]
    for x in xs:
        if not clean or abs(x-clean[-1])>.0001:clean.append(float(x))
    return clean

fig,axs=plt.subplots(1,2,figsize=(12,6),dpi=150)
for ax,axis,value,project,desc in [(axs[0],2,1558.0,[0,1],'Axial: native Z = 1558.0 mm'),(axs[1],1,-92.0,[0,2],'Coronal: native Y = -92.0 mm')]:
    for en,(v,f) in meshes.items():
        lines=section(v,f,axis,value)
        if len(lines): ax.add_collection(LineCollection(lines[:,:,project],colors=[palette[en.removeprefix('Left ').removeprefix('Right ')]],linewidths=1.0))
    ax.autoscale();ax.set_aspect('equal');ax.set_title(desc,fontsize=11);ax.grid(alpha=.15);ax.set_xlabel('Native X: + left (mm)')
    if axis==2:ax.invert_yaxis();ax.set_ylabel('Native Y: - anterior (mm)')
    else:ax.set_ylabel('Native Z: + superior (mm)')
fig.legend(handles=[Line2D([0],[0],color=c,label=n) for n,c in palette.items()],loc='lower center',ncol=3,bbox_to_anchor=(.5,.05),frameon=False)
fig.suptitle('DBCLS source meshes | exact triangle-plane sections, common native coordinates',fontsize=12)
fig.text(.5,.015,'These are atlas mesh sections, not MRI slices. No per-structure repositioning or reconstructed missing tissues.',ha='center',fontsize=8)
fig.tight_layout(rect=[0,.16,1,.93]);fig.savefig(ROOT/'bp3d-context-sections.png');plt.close(fig)
report={'method':'Exact ray/triangle intersections along source X axis at fixed source Y,Z; no geometry deformation',
        'note':'Intervals and centroids are useful geometric consistency checks, not a complete anatomical validation.',
        'sections':[]}
for y,z in [(-110,1558),(-90,1558),(-75,1558)]:
    report['sections'].append({'nativeYmm':y,'nativeZmm':z,'crossings':{en:rayx(v,f,y,z) for en,(v,f) in meshes.items()}})
(ROOT/'bp3d-section-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report))
