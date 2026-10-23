"""Source-only bone / nerve triangle intersection audit in coarse inspection ROIs.
The ROIs are inherited teaching focus locations, NOT anatomical hole boundaries.
No mesh is generated or altered, and a no-collision result cannot prove a canal.
"""
from pathlib import Path
import json
import numpy as np
HERE=Path(__file__).resolve().parent
records=json.loads((HERE.parent/'atlas.json').read_text(encoding='utf-8'))
raw=(HERE.parent/'atlas.bin').read_bytes()

def triangles(names,side):
    alltri=[];descs=[]
    for r in records:
        if r['name'] not in names or r['side'] not in [side,'median']: continue
        for p in r['parts']:
            v=np.frombuffer(raw,dtype='<f4',count=p['vc']*3,offset=p['po']).reshape(-1,3)
            f=np.frombuffer(raw,dtype='<u2' if p['it']==2 else '<u4',count=p['ic'],offset=p['io']).reshape(-1,3)
            alltri.append(v[f]);descs.append({'id':r['id'],'name':r['name'],'side':r['side'],'triangleCount':len(f)})
    return np.concatenate(alltri) if alltri else np.empty((0,3,3)),descs

def edge_hits_triangles(p,q,tri):
    # Moller-Trumbore intersection with finite segment; coplanar cases skipped.
    direction=q-p;e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0]
    h=np.cross(direction,e2);det=np.einsum('ij,ij->i',e1,h);good=np.abs(det)>1e-9
    inv=np.zeros_like(det);inv[good]=1/det[good]
    s=p-tri[:,0];u=inv*np.einsum('ij,ij->i',s,h)
    qq=np.cross(s,e1);v=inv*np.einsum('j,ij->i',direction,qq);t=inv*np.einsum('ij,ij->i',e2,qq)
    good &= (u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)&(t>=-1e-7)&(t<=1+1e-7)
    return p+t[good,None]*direction

def collision_sample(a,b,limit=10):
    out=[]
    if len(a)==0 or len(b)==0:return out
    bmin=b.min(1);bmax=b.max(1)
    for tri in a:
        candidates=b[np.all(bmin<=tri.max(0)+1e-6,axis=1)&np.all(bmax>=tri.min(0)-1e-6,axis=1)]
        if not len(candidates):continue
        for i in range(3):
            for p in edge_hits_triangles(tri[i],tri[(i+1)%3],candidates):
                if not any(np.linalg.norm(p-np.array(q))<1e-3 for q in out):out.append(p.tolist())
                if len(out)>=limit:return out
        for bt in candidates:
            for i in range(3):
                for p in edge_hits_triangles(bt[i],bt[(i+1)%3],tri[None]):
                    if not any(np.linalg.norm(p-np.array(q))<1e-3 for q in out):out.append(p.tolist())
                    if len(out)>=limit:return out
    return out

specs=[
 ('cribriform','筛孔',[6,-29,53],['Ethmoid bone'],['Olfactory nerve (I)']),
 ('optic_canal','视神经管',[15,-27,39],['Sphenoid bone'],['Optic nerve (II)']),
 ('sof','眶上裂',[26,-32,38],['Sphenoid bone','Frontal bone'],['Oculomotor nerve (III)','Trochlear nerve (IV)','Abducens nerve (VI)','Ophthalmic nerve']),
 ('rotundum','圆孔',[23,-40,31],['Sphenoid bone'],['Maxillary nerve']),
 ('ovale','卵圆孔',[28,-45,19],['Sphenoid bone'],['Trigeminal nerve (V)','Anterior division of mandibular nerve','Posterior division of mandibular nerve']),
 ('iam','内耳道',[24,-50,-8],['Temporal bone'],['Facial nerve (VII)','Vestibulocochlear nerve (VIII)','Cochlear nerve','Vestibular nerve']),
 ('stylomastoid','茎乳孔',[43,-75,-11],['Temporal bone'],['Facial nerve (VII)']),
 ('jugular','颈静脉孔',[25,-68,-22],['Temporal bone','Occipital bone'],['Glossopharyngeal nerve (IX)','Vagus nerve (X)','Accessory nerve (XI)']),
 ('foramen_magnum','枕骨大孔',[0,-77,-32],['Occipital bone'],['Medulla oblongata','White matter of spinal cord','Accessory nerve (XI)']),
 ('hypoglossal_canal','舌下神经管',[14,-73,-19],['Occipital bone'],['Hypoglossal nerve (XII)']),
]
report={'source':'Existing decoded Z-Anatomy / BodyParts3D atlas.bin',
 'sourceCoordinateSpace':'+X left,+Y superior,+Z anterior; mm',
 'method':'Exact segment/triangle non-coplanar collision sampling; coarse box includes triangles whose bounding boxes intersect inspection window; max 10 distinct collision locations per item',
 'roiWarning':'Inspection boxes are inherited hand-placed teaching focus coordinates. They are not precise foraminal labels and are not emitted as geometry.',
 'zeroCollisionMeaning':'No sampled collision does NOT certify an open bony canal or correct anatomical registration. Missing target geometry and coplanar cases limit this test.',
 'boneMeshClassification':'Whole bone surfaces; no named cranial foramen/canal meshes or independently segmented rims exist in current skeletal.glb.',
 'items':[]}
for id,zh,center,bnames,nnames in specs:
    for side in (['median'] if id=='foramen_magnum' else ['left','right']):
        c=np.array(center,dtype=float); c[0]*=(-1 if side=='right' else 1); radius=16 if id!='foramen_magnum' else 24
        bt,bd=triangles(bnames,side);nt,nd=triangles(nnames,side)
        def crop(t):return t[np.all(t.max(1)>=c-radius,axis=1)&np.all(t.min(1)<=c+radius,axis=1)]
        bt=crop(bt);nt=crop(nt);hits=collision_sample(nt,bt)
        report['items'].append({'id':id,'zh':zh,'side':side,'boneSources':bd,'nerveSources':nd,
           'inspectionBox':{'centerMm':c.tolist(),'halfWidthMm':radius},'boneTrianglesInBox':len(bt),'nerveTrianglesInBox':len(nt),
           'collisionLocations':hits,
           'status':'source-surface-intersection-detected-not-validated' if hits else 'no-collision-found-in-coarse-window-still-unverified' if len(bt) and len(nt) else 'insufficient-geometry-in-window',
           'rimStatus':'No independently labeled true rim. Display parent bone surface as context; do not fabricate or label an ROI as precise rim.'})
(HERE/'mesh-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'id':x['id'],'side':x['side'],'boneT':x['boneTrianglesInBox'],'nerveT':x['nerveTrianglesInBox'],'hits':len(x['collisionLocations'])} for x in report['items']]))
