from pathlib import Path
from urllib.request import urlopen,Request
from concurrent.futures import ThreadPoolExecutor
import json,hashlib
ROOT=Path(__file__).resolve().parent
tree=json.loads((ROOT/'nextbrain-p41-tree.json').read_text())
commit=tree['sha']
files=[v for v in tree['tree'] if v['type']=='blob' and ('/labels_blocks/' in v['path'] or v['path'].endswith('/mri_rotated/indices.nii.gz') or '/mri_rotated/matrices/' in v['path'])]
def get(v):
    url='https://raw.githubusercontent.com/UCL/BrainAtlas-P41-16/'+commit+'/'+v['path']
    parts=v['path'].split('/')
    if 'labels_blocks' in parts: rel='p41-labels/'+parts[2]+'.nii.gz'
    elif 'matrices' in parts: rel='p41-matrices/'+parts[-1]
    else: rel='p41-indices.nii.gz'
    path=ROOT/rel;path.parent.mkdir(exist_ok=True)
    data=path.read_bytes() if path.exists() else urlopen(Request(url,headers={'User-Agent':'NeuroAtlas research'}),timeout=60).read()
    blob=hashlib.sha1(('blob '+str(len(data))+'\0').encode()+data).hexdigest()
    assert blob==v['sha'],(rel,blob,v['sha'])
    path.write_bytes(data)
    rec={'file':rel,'url':url,'size':len(data),'sha256':hashlib.sha256(data).hexdigest(),'gitBlobSHA1':blob}
    print(rel,len(data),flush=True)
    return rec
with ThreadPoolExecutor(max_workers=6) as pool: records=list(pool.map(get,files))
(ROOT/'p41-downloads.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
