from pathlib import Path
import zipfile,json,hashlib
P=Path(__file__).resolve().parent.parent
files=['NeuroAtlas.html','README.md','LICENSE.md','coverage-audit.json','browser-validation.json','static-validation.json','native-validation.json','context-validation.json','anatomy-validation.json','portability-validation.json','build-manifest.json','preview.jpg','preview-focus.jpg','preview-section.jpg','preview-evidence.jpg','preview-transparent.jpg','rendering-validation.json','section-validation.json']
missing=[name for name in files if not (P/name).is_file()]
assert not missing,missing
out=P/'NeuroAtlas-offline.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for name in files:z.write(P/name,name)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert z.read('NeuroAtlas.html')==(P/'NeuroAtlas.html').read_bytes()
report={'zip':out.name,'bytes':out.stat().st_size,'html_sha256':hashlib.sha256((P/'NeuroAtlas.html').read_bytes()).hexdigest(),'zip_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'members':files}
(P/'delivery-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
