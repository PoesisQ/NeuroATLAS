"""Offline orthographic QA and native-coordinate version differences, no fitting."""
from pathlib import Path
import json,sys
import numpy as np
from scipy.spatial import cKDTree
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from matplotlib.colors import to_rgb
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]))
from analyze_bp3d import parse_obj

def load(folder,meta):
    result={}
    for s in json.loads((folder/meta).read_text(encoding='utf8'))['segments']:
        v,f,_=parse_obj(folder/s['sourceFile']);result[s['id']]={**s,'v':v,'f':f}
    return result
old=load(HERE.parent,'bp3d-meshes.json')
context=load(HERE/'bp43-context','meshes.json')
new=load(HERE/'bp2018-perisylvian','meshes.json')
for s in old.values():
    if 'gyrus' in s['en'] or 'insula' in s['en']:context[s['id']]=s
assert len(context)==50

def color(s):
    n=s['en'].lower()
    if 'sulcus' in n:return '#9a7adc'
    if 'transverse temporal gyrus' in n:return '#e78e32'
    if 'insula' in n or s['id'].startswith(('MM3814','MM3815','MM3819','MM3820','MM3821','MM3822')):return '#db6174'
    if 'frontal' in n or 'orbital' in n or 'straight' in n or 'precentral' in n:return '#7cafd4'
    if 'temporal' in n or 'fusiform' in n or 'parahippocamp' in n:return '#7cbdac'
    if 'occipital' in n or n.endswith('cuneus') or 'lingual' in n:return '#ac9cc6'
    if 'cingulate' in n:return '#b7a88e'
    return '#d4b774'

def panel(ax,objects,view,title):
    # Rows are plot horizontal, plot vertical and observer-depth directions.
    R={'left':np.array([[0,-1,0],[0,0,1],[1,0,0]]),
       'front':np.array([[1,0,0],[0,0,1],[0,-1,0]]),
       'top':np.array([[1,0,0],[0,-1,0],[0,0,1]])}[view]
    faces=[];depth=[];colors=[]
    for s in objects:
        tv=s['v'][s['f']]
        norm=np.cross(tv[:,1]-tv[:,0],tv[:,2]-tv[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-9)
        light=.56+.44*np.maximum(0,norm@np.array([.45,-.45,.77]))
        colors.append(np.clip(np.array(to_rgb(color(s)))[None,:]*light[:,None],0,1))
        transformed=tv@R.T;faces.append(transformed[:,:,:2]);depth.append(transformed[:,:,2].mean(1))
    polys=np.concatenate(faces);colors=np.concatenate(colors);order=np.argsort(np.concatenate(depth))
    ax.add_collection(PolyCollection(polys[order],facecolors=colors[order],linewidth=0,antialiased=False,rasterized=True))
    lo=polys.reshape(-1,2).min(0);hi=polys.reshape(-1,2).max(0)
    pad=(hi-lo)*.05;ax.set_xlim(lo[0]-pad[0],hi[0]+pad[0]);ax.set_ylim(lo[1]-pad[1],hi[1]+pad[1]);ax.set_aspect('equal');ax.axis('off');ax.set_title(title,fontsize=11)

fig,axs=plt.subplots(1,3,figsize=(16,6.5),facecolor='#f5f3ed')
for ax,view,title in zip(axs,['left','front','top'],['Left lateral view','Anterior view','Superior view']):panel(ax,list(context.values()),view,title)
fig.suptitle('BodyParts3D 4.3 | 50 original cortical objects in unchanged source coordinates',fontsize=16)
fig.text(.5,.06,'14 existing cortex objects + 36 new context objects; selected same-source gyri, not a reconstructed hemisphere shell.',ha='center',fontsize=10)
fig.text(.5,.025,'BodyParts3D © The Database Center for Life Science. Source: official 4.3 object map and OBJ download.',ha='center',fontsize=9)
fig.subplots_adjust(top=.88,bottom=.12,wspace=.02)
fig.savefig(HERE/'bp43-whole-cortex-context.png',dpi=130);plt.close(fig)

left=[s for s in new.values() if s['side']=='left']
uncovered=[s for s in left if 'operculum' not in s['en'].lower() and 'sulcus' not in s['en'].lower() and s['id'] not in ['MM3287','MM3811']]
fig,axs=plt.subplots(1,3,figsize=(16,6.5),facecolor='#f5f3ed')
panel(axs[0],left,'left','Original left-side context')
panel(axs[1],uncovered,'top','Superior view; whole opercular objects hidden')
panel(axs[2],[s for s in uncovered if s['id'] not in ['MM3303','MM3313','MM3317']],'left','Source insular gyri + transverse temporal gyri')
fig.suptitle('BodyParts3D 20181210i412 | separate version candidate; no fit to 4.3',fontsize=16)
fig.text(.5,.06,'Orange: anterior/posterior transverse temporal gyri. Rose: source insular gyri. Sulcus objects are publisher atlas models.',ha='center',fontsize=10)
fig.text(.5,.025,'Anatomical Heschl gyrus is not a measured A1 functional-area boundary. All source vertices and faces are unchanged.',ha='center',fontsize=9)
fig.subplots_adjust(top=.88,bottom=.12,wspace=.02)
fig.savefig(HERE/'bp2018-perisylvian-context.png',dpi=130);plt.close(fig)

differences=[]
for side,oldid,suffix in [('left','FJ1748',''),('right','FJ1749','M')]:
    ov=old[oldid]['v'];parts=[new[i+suffix]['v'] for i in ['MM3814','MM3815','MM3819','MM3820','MM3821','MM3822']]
    nv=np.concatenate(parts)
    a=cKDTree(nv).query(ov)[0];b=cKDTree(ov).query(nv)[0]
    differences.append({'side':side,'oldID':oldid,'newCompoundSourceFMA':'FMA72978' if side=='left' else 'FMA72977',
        'newIDs':[i+suffix for i in ['MM3814','MM3815','MM3819','MM3820','MM3821','MM3822']],
        'oldToNewVertexDistancesMm':{'median':float(np.median(a)),'p95':float(np.percentile(a,95)),'max':float(a.max())},
        'newToOldVertexDistancesMm':{'median':float(np.median(b)),'p95':float(np.percentile(b,95)),'max':float(b.max())}})
allv=np.concatenate([s['v'] for s in context.values()])
report={'method':'Direct native-coordinate nearest-original-vertex distances. No fit, surface Hausdorff calculation or proof of biological correspondence.',
        'versionComparison':differences,
        'decision':'Do not substitute 2018 local parts into the old 4.3 atlas as if they were registered. The differences include anatomical remodeling and mesh sampling, which this check does not separate.',
        'bp43CombinedCorticalObjectCount':len(context),'bp43CombinedBoundsMm':[allv.min(0).tolist(),allv.max(0).tolist()],
        'bp43CombinedDimensionsMm':(allv.max(0)-allv.min(0)).tolist(),
        'renderMethod':'Original triangle faces projected orthographically and painter-sorted for QA. Rendered objects are explicitly listed in this script. No surfaces synthesized.',
        'figures':['bp43-whole-cortex-context.png','bp2018-perisylvian-context.png']}
(HERE/'context-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
