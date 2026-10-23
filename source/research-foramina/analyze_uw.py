"""Reproducible, non-generative inspection of the UW skull-base labelmap.

Only research outputs are written. Geometry is marching-cubes at 0.5 of original
binary masks, with no smoothing, deformation, registration or hand-drawn parts.
"""
from pathlib import Path
import gzip, hashlib, json, re, sys
import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'builddeps'))
from skimage.measure import marching_cubes

NAMES = [
    ('eyes', '眼球', 'tissue'),
    ('septum', '鼻中隔', 'tissue'),
    ('optic nerves', '视神经', 'tissue'),
    ('internal carotid artery', '颈内动脉', 'tissue'),
    ('nasolacrimal duct', '鼻泪管', 'lumen-or-duct-label'),
    ('foramen ovale', '卵圆孔', 'foramen-volume-label'),
    ('foramen spinosum', '棘孔', 'foramen-volume-label'),
    ('foramen rotundum', '圆孔', 'foramen-volume-label'),
    ('vidian canal', '翼管', 'canal-volume-label'),
    ('pterygopalatine fossa', '翼腭窝', 'space-volume-label'),
    ('pituitary', '垂体', 'tissue'),
    ('cavernous sinus', '海绵窦', 'sinus-volume-label'),
    ('extraocular muscles', '眼外肌', 'tissue'),
    ('bone of anterior cranial fossa', '前颅窝骨性结构（源分割范围）', 'bone-segmentation'),
]

def read_nrrd(path):
    raw = Path(path).read_bytes()
    sep = b'\n\n' if b'\n\n' in raw else b'\r\n\r\n'
    hb, data = raw.split(sep, 1)
    head = {}
    for line in hb.decode('utf-8').splitlines():
        if not line or line.startswith('#') or line.startswith('NRRD'): continue
        if ':=' in line: k, v = line.split(':=', 1)
        else: k, v = line.split(':', 1)
        head[k.strip()] = v.strip()
    types = {'unsigned char':'u1','uchar':'u1','short':'i2','short int':'i2','unsigned short':'u2','float':'f4','double':'f8'}
    dtype = np.dtype(types[head['type']]).newbyteorder('>' if head.get('endian') == 'big' else '<')
    if head['encoding'] == 'gzip': data = gzip.decompress(data)
    elif head['encoding'] != 'raw': raise ValueError(head['encoding'])
    sizes = tuple(map(int, head['sizes'].split()))
    a = np.frombuffer(data, dtype=dtype).reshape(sizes, order='F')
    origin = np.array([float(x) for x in head['space origin'].strip('()').split(',')])
    directions = []
    for s in re.findall(r'none|\([^)]*\)', head['space directions']):
        if s != 'none': directions.append([float(x) for x in s.strip('()').split(',')])
    affine = np.eye(4); affine[:3, :3] = np.array(directions).T; affine[:3, 3] = origin
    return a, head, affine

def bounds(x): return [x.min(0).tolist(), x.max(0).tolist()]

def main():
    arr, head, affine = read_nrrd(HERE/'uw-segmentation.seg.nrrd')
    spacing = np.linalg.norm(affine[:3,:3], axis=0)
    raw = (HERE/'uw-segmentation.seg.nrrd').read_bytes()
    septum_vox = np.argwhere(arr[1] != 0)
    midline_reference = float((septum_vox @ affine[:3,:3].T + affine[:3,3])[:,0].mean())
    report = {
        'source':'University of Washington ResearchWorks / Konuthula et al.',
        'url':'https://hdl.handle.net/1773/46259',
        'sha256':hashlib.sha256(raw).hexdigest(),
        'license':'CC BY-NC-SA 3.0 United States',
        'coordinateSystem':head['space'], 'arrayShape':list(arr.shape),
        'voxelSpacingMm':spacing.tolist(), 'ijkToRAS':affine.tolist(),
        'referenceMidlineXmmFromSeptumCentroid':midline_reference,
        'sourceType':'Synthetic template from 6 CT subjects; manual reference segmentation',
        'notRegisteredToExistingAtlas':True,
        'surfaceExtraction':{'method':'Lewiner marching cubes, level 0.5', 'input':'original binary mask',
                             'faceWinding':'gradient_direction=ascent; positive signed volume / outward winding',
                             'smoothing':False,'decimation':False,'padding':'one zero voxel to close outer array boundary',
                             'coordinates':'Original source RAS mm; no deformation or registration'},
        'segments':[]
    }
    metadata=[]; binary=[]; offset=0
    for index,(en,zh,role) in enumerate(NAMES):
        assert head[f'Segment{index}_Name'] == en
        mask = np.asarray(arr[index] != 0)
        vox = np.argwhere(mask)
        ras = vox @ affine[:3,:3].T + affine[:3,3]
        cc, n = ndimage.label(mask)
        counts = np.bincount(cc.ravel()); counts[0]=0
        components=[]
        for cid in np.argsort(counts)[::-1]:
            if counts[cid] == 0: break
            v = np.argwhere(cc == cid); rr = v @ affine[:3,:3].T + affine[:3,3]
            c=rr.mean(0)
            components.append({'label':int(cid),'voxelCount':int(counts[cid]),'volumeMm3':float(counts[cid]*np.prod(spacing)),
                'centroidRASmm':c.tolist(),'bboxRASmm':bounds(rr),
                'approxSideRelativeToSeptum':'right' if c[0]>midline_reference+2 else 'left' if c[0]<midline_reference-2 else 'median',
                'touchesArrayBoundary':bool(np.any((v==0)|(v==np.array(mask.shape)-1)))})
        verts,faces,normals,vals = marching_cubes(np.pad(mask.astype(np.uint8),1),level=.5,allow_degenerate=False,gradient_direction='ascent')
        verts = (verts-1) @ affine[:3,:3].T + affine[:3,3]
        verts=verts.astype('<f4'); faces=faces.astype('<u4')
        po=offset; pb=verts.tobytes(); binary.append(pb); offset+=len(pb)
        io=offset; ib=faces.tobytes(); binary.append(ib); offset+=len(ib)
        st={'index':index,'id':head[f'Segment{index}_ID'],'en':en,'zh':zh,'role':role,
            'voxelCount':int(mask.sum()),'volumeMm3':float(mask.sum()*np.prod(spacing)),
            'centroidRASmm':ras.mean(0).tolist(),'bboxVoxelCentersRASmm':bounds(ras),
            'bboxSurfaceRASmm':bounds(verts),'vertexCount':len(verts),'triangleCount':len(faces),
            'components':components,
            'quality':'source CT template segmentation, finite voxel resolution; not independent histological ground truth'}
        t=verts[faces].astype(np.float64)
        st['signedMeshVolumeMm3']=float(np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2])).sum()/6)
        assert st['signedMeshVolumeMm3']>0
        if 'foramen' in role or 'canal' in role:
            st['interpretation']='Boundary of author-labeled foramen/canal volume. Not a separately segmented osseous rim. Full canal completeness is not documented.'
        if role=='bone-segmentation':
            st['interpretation']='Authors anterior cranial fossa bone label only; not a complete skull and not the posterior fossa.'
        report['segments'].append(st)
        metadata.append({k:st[k] for k in ['index','en','zh','role','vertexCount','triangleCount','bboxSurfaceRASmm','centroidRASmm']})
        metadata[-1].update({'po':po,'io':io,'color':[float(c) for c in head[f'Segment{index}_Color'].split()]})
    (HERE/'uw-label-statistics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (HERE/'uw-meshes.json').write_text(json.dumps({'space':'RAS','unit':'mm','segments':metadata},ensure_ascii=False),encoding='utf-8')
    (HERE/'uw-meshes.bin').write_bytes(b''.join(binary))
    (HERE/'uw-meshes.bin.gz').write_bytes(gzip.compress(b''.join(binary),compresslevel=9))
    print(json.dumps({'segments':len(metadata),'triangles':sum(r['triangleCount'] for r in metadata),'geometryBytes':offset,
                     'gzipBytes':(HERE/'uw-meshes.bin.gz').stat().st_size,'midline':midline_reference}))

if __name__=='__main__': main()
