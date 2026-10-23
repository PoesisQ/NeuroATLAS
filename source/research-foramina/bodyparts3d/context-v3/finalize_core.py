"""Keep the deliverable bounded: original cortex/local context plus requested putamen.
Thalamic files retrieved with the earlier compound request remain research-only.
"""
from pathlib import Path
import hashlib,json,shutil
HERE=Path(__file__).resolve().parent;OUT=HERE/'bp2018-full'
manifest=json.loads((OUT/'download-manifest.json').read_text(encoding='utf8'))
thal=set()
for fma in ['FMA258716','FMA258714']:thal.update(manifest.get('additionalDeepSourceCompounds',{}).get(fma,[]))
if thal:
    research=OUT/'research-only-thalamus';research.mkdir(exist_ok=True)
    records=[r for r in manifest['files'] if r['id'] in thal]
    for r in records:
        source=(OUT/r['file']).resolve();target=(research/r['file']).resolve()
        assert source.is_relative_to(OUT.resolve()) and target.is_relative_to(research.resolve())
        assert source.is_file() and not target.exists()
        shutil.move(str(source),str(target))
        assert hashlib.sha256(target.read_bytes()).hexdigest()==r['sha256']
    (research/'research-only-manifest.json').write_text(json.dumps({'role':'research-only; excluded from the delivered core geometry',
        'sourceVersion':'20181210i412','files':records,'sourceRows':[r for r in manifest['sourceRows'] if r['id'] in thal],
        'reason':'Core scope is cortical orientation, Heschl-insula continuity and finite capsule/basal context; no expansion into all thalamic subnuclei.'},ensure_ascii=False,indent=2),encoding='utf8')
    manifest['files']=[r for r in manifest['files'] if r['id'] not in thal]
    manifest['sourceRows']=[r for r in manifest['sourceRows'] if r['id'] not in thal]
    manifest['sourceDeepContextIds']=[i for i in manifest['sourceDeepContextIds'] if i not in thal]
    manifest['additionalDeepSourceCompounds']={k:v for k,v in manifest['additionalDeepSourceCompounds'].items() if k not in ['FMA258716','FMA258714']}
    manifest['excludedResearchOnlyIds']=sorted(thal)
    (OUT/'download-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('Core original OBJ count:',len(list(OUT.glob('*.obj'))))
