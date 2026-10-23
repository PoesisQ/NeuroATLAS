from pathlib import Path
import sys,json,gzip,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'builddeps'))
import nibabel as nib
from scipy.ndimage import find_objects

src=ROOT/'3dAtlas/atlas.labels.argmax.nii.gz'
out=ROOT/'atlas-labels.uint16.bin'
im=nib.load(src)
assert im.get_data_dtype()==np.dtype('float32')
assert float(im.dataobj.slope)==1 and float(im.dataobj.inter)==0
assert im.shape[-1]==1
counts=np.zeros(65536,np.int64)
with gzip.open(src,'rb') as fi,out.open('wb') as fo:
    fi.read(int(im.dataobj.offset))
    while True:
        b=fi.read(16*1024*1024)
        if not b:break
        a=np.frombuffer(b,dtype='<f4')
        assert np.isfinite(a).all() and np.equal(a,np.floor(a)).all()
        assert a.min()>=0 and a.max()<=65535
        a=a.astype('<u2')
        counts+=np.bincount(a,minlength=65536)
        fo.write(a.tobytes())
print('Converted',out.stat().st_size,flush=True)
shape=tuple(im.shape[:3])
a=np.memmap(out,mode='r',dtype='<u2',shape=shape,order='F')
boxes=find_objects(a,max_label=int(np.nonzero(counts)[0].max()))
lut={}
for line in (ROOT/'3dAtlas/lut.freeview.txt').read_text().splitlines():
    vals=line.split()
    if vals and vals[0].isdigit():
        lut[int(vals[0])]={'name':vals[1],'rgb':[int(v) for v in vals[2:5]]}
det=float(abs(np.linalg.det(im.affine[:3,:3])))
labels=[]
for idx in np.nonzero(counts)[0]:
    if idx==0:continue
    box=boxes[idx-1]
    lo=[s.start for s in box];hi=[s.stop-1 for s in box]
    labels.append({'id':int(idx),**lut.get(int(idx),{}),'voxelCount':int(counts[idx]),'volumeMm3':float(counts[idx]*det),
                   'voxelBounds':[lo,hi], 'nativeRASBoundsMm':[nib.affines.apply_affine(im.affine,lo).tolist(),nib.affines.apply_affine(im.affine,hi).tolist()]})
report={'source':'NextBrain 3dAtlas probability argmax', 'license':'CC0-1.0',
        'doi':'10.5522/04/24243835.v1','sourceFile':str(src),'rawFile':str(out),
        'dtype':'uint16','byteOrder':'little','memoryOrder':'F','shape':shape,'niftiShape':im.shape,
        'affine':im.affine.tolist(),'axisCodes':list(nib.aff2axcodes(im.affine)),'units':im.header.get_xyzt_units(),
        'voxelVolumeMm3':det,'countIncludingBackground':int(np.count_nonzero(counts)),
        'hemisphere':'Single left-oriented pooled hemisphere: authors flipped 3 right donor hemispheres and combined with 2 left donor hemispheres; cortical label names retain ctx-rh. Do not duplicate or mirror as real bilateral anatomy.',
        'argmaxMeaning':'Each voxel assigned its greatest-probability label. Not a single subject and not a complete set of masks for every LUT item.',
        'samplingGridMm':[float(x) for x in im.header.get_zooms()[:3]],
        'samplingNotAccuracy':'0.2 mm grid spacing is not measured anatomical accuracy; histology/MRI alignment and population aggregation add uncertainty.',
        'labels':labels,
        'missingInternalCapsuleLabelIDs':{str(i):lut[i]['name'] for i in [73,115,204,258]},
        'sourceSHA256':hashlib.sha256(src.read_bytes()).hexdigest()}
(ROOT/'nextbrain-label-statistics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Saved label statistics',len(labels),flush=True)
