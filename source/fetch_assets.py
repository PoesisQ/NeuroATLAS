from pathlib import Path
from urllib.request import urlopen, Request
import json, hashlib

ROOT=Path(__file__).resolve().parent
URLS={
 'manifest.json':'https://raw.githubusercontent.com/itayinbarr/brainproject/main/brain-atlas/models/manifest.json',
 'brain.glb':'https://raw.githubusercontent.com/itayinbarr/brainproject/main/brain-atlas/models/brain.glb',
 'ASSET_LICENSE.txt':'https://raw.githubusercontent.com/itayinbarr/brainproject/main/LICENSE',
 'UPSTREAM_README.md':'https://raw.githubusercontent.com/itayinbarr/brainproject/main/README.md',
 'export_brain.py.txt':'https://raw.githubusercontent.com/itayinbarr/brainproject/main/scripts/export_brain.py',
 'three.min.js':'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js',
 'draco_decoder_nodejs.cjs':'https://cdn.jsdelivr.net/npm/draco3dgltf@1.5.7/draco_decoder_gltf_nodejs.js',
 'draco_decoder_gltf.wasm':'https://cdn.jsdelivr.net/npm/draco3dgltf@1.5.7/draco_decoder_gltf.wasm',
 'body_fetch.mjs.txt':'https://raw.githubusercontent.com/CognitionLabSNUC/open-anatomy-atlas/main/src/data/zanatomy.js',
 'nervous.glb':'https://raw.githubusercontent.com/nqwrc/3d-anatomy/8ca3b7421bcfbe88b85859eb1983d5cf79f21749/public/models/nervous.glb',
 'skeletal.glb':'https://raw.githubusercontent.com/nqwrc/3d-anatomy/8ca3b7421bcfbe88b85859eb1983d5cf79f21749/public/models/skeletal.glb',
 'Z_ANATOMY_LICENSE.txt':'https://raw.githubusercontent.com/nqwrc/3d-anatomy/8ca3b7421bcfbe88b85859eb1983d5cf79f21749/public/models/License.txt',
 'fflate.min.js':'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js',
 'THREE_LICENSE.txt':'https://cdn.jsdelivr.net/npm/three@0.160.1/LICENSE',
 'FFLATE_LICENSE.txt':'https://cdn.jsdelivr.net/npm/fflate@0.8.2/LICENSE',
 'registration.md':'https://raw.githubusercontent.com/itayinbarr/brainproject/main/docs/registration.md',
}
records=[]
for filename,url in URLS.items():
    path=ROOT/filename
    if not path.exists():
        with urlopen(Request(url,headers={'User-Agent':'NeuroAtlas-educational-build/1.0'}),timeout=90) as r:
            data=r.read()
        path.write_bytes(data)
    data=path.read_bytes()
    records.append({'file':filename,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
    print(filename,len(data),flush=True)
(ROOT/'downloads.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
