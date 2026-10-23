from pathlib import Path
import json,base64,hashlib,zipfile
P=Path(__file__).resolve().parent
root=P.parent
template=(P/'template.html').read_text(encoding='utf-8')
meta=json.loads((P/'packed.json').read_text(encoding='utf-8'))
native=json.loads((P/'native-pack.json').read_text(encoding='utf-8')) if (P/'native-pack.json').exists() else {'records':[],'spaces':{}}
meta+=native['records']
stats=json.loads((P/'stats.json').read_text(encoding='utf-8'))
assets=json.loads((P/'downloads.json').read_text(encoding='utf-8'))
content=(P/'content.js').read_text(encoding='utf-8')+'\n'+(P/'translations.js').read_text(encoding='utf-8')
if (P/'native-content.js').exists():content+='\n'+(P/'native-content.js').read_text(encoding='utf-8')
if (P/'context-content.js').exists():content+='\n'+(P/'context-content.js').read_text(encoding='utf-8')
buildmeta={'date':'2026-10-23','stats':stats,'downloads':assets,'brainproject_tree_sha':json.loads((P/'tree.json').read_text())['sha'],'supplement_commit':'8ca3b7421bcfbe88b85859eb1983d5cf79f21749'}
buildmeta['version']='3.2';buildmeta['date']='2026-10-24';buildmeta['native_spaces']=native.get('spaces',{})
buildmeta['total_source_objects']=len(meta)
buildmeta['total_vertices']=sum(p['vc'] for o in meta for p in o['parts'])
buildmeta['total_triangles']=sum(p['ic']//3 for o in meta for p in o['parts'])
buildmeta['native_geometry_validation']=json.loads((root/'native-validation.json').read_text(encoding='utf-8'))
buildmeta['context_geometry_validation']=json.loads((root/'context-validation.json').read_text(encoding='utf-8'))
replacements={
 'STYLE':(P/'style.css').read_text(encoding='utf-8')+'\n'+(P/'spatial.css').read_text(encoding='utf-8'),
 'THREE':(P/'three.min.js').read_text(encoding='utf-8'),
 'FFLATE':(P/'fflate.min.js').read_text(encoding='utf-8'),
 'METADATA':json.dumps(meta,ensure_ascii=False,separators=(',',':')),
 'BINARY':base64.b64encode((P/'packed.bin.gz').read_bytes()).decode(),
 'CONTENT':content,
 'APP':'\n'.join((P/f).read_text(encoding='utf-8') for f in ['diagnostics.js','app.js','upgrades.js','spatial.js','section-kernel.js','sections.js','rendering.js'])+'\nboot();',
}
nativeblock='<script id="nativeMetadata" type="application/json">'+json.dumps(native.get('spaces',{}),ensure_ascii=False).replace('</script','<\\/script')+'</script>\n'
for space in native.get('spaces',{}):
    datafile=P/(space+'-packed.bin.gz')
    if datafile.exists():nativeblock+='<script data-native-binary="'+space+'" type="application/octet-stream">'+base64.b64encode(datafile.read_bytes()).decode()+'</script>\n'
evidence=P/'native-evidence.json'
nativeblock+='<script id="nativeEvidence" type="application/json">'+(evidence.read_text(encoding='utf-8') if evidence.exists() else '{}')+'</script>\n'
template=template.replace('<!--__NATIVE_DATA__-->',nativeblock)
for key,value in replacements.items():
    if key not in ['STYLE','BINARY','METADATA']:value=value.replace('</script','<\\/script')
    template=template.replace('/*__'+key+'__*/',value)
licenses='\n\n'.join(filename+'\n'+(P/filename).read_text(encoding='utf-8') for filename in ['LOCAL_LICENSE.txt','ASSET_LICENSE.txt','Z_ANATOMY_LICENSE.txt','THREE_LICENSE.txt','FFLATE_LICENSE.txt'])
if (P/'NATIVE_LICENSES.txt').exists():licenses+='\n\n'+(P/'NATIVE_LICENSES.txt').read_text(encoding='utf-8')
if (P/'research-foramina/bodyparts3d/context-v3/bp2018-full/ATTRIBUTION.txt').exists():licenses+='\n\nBP2018 SOURCE ATTRIBUTION\n'+(P/'research-foramina/bodyparts3d/context-v3/bp2018-full/ATTRIBUTION.txt').read_text(encoding='utf-8')
licenseblock='<script id="bundledLicenses" type="text/plain">'+licenses.replace('</script','<\\/script')+'</script>\n<script id="buildManifest" type="application/json">'+json.dumps(buildmeta,ensure_ascii=False)+'</script>\n'
template=template.replace('</body>',licenseblock+'</body>')
assert '/*__' not in template
out=root/'NeuroAtlas.html';out.write_text(template,encoding='utf-8')
(root/'build-manifest.json').write_text(json.dumps(buildmeta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'file':str(out),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},ensure_ascii=False))
