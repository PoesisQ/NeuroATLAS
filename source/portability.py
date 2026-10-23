from html.parser import HTMLParser
from pathlib import Path
import re,json,hashlib
P=Path(__file__).resolve().parent
data=(P.parent/'NeuroAtlas.html').read_bytes()
html=data.decode('utf-8')
class Scan(HTMLParser):
    def __init__(self):super().__init__();self.resources=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','img','iframe','video','audio','source') and a.get('src'):self.resources.append((tag,a['src']))
        if tag=='link' and any(x in a.get('rel','') for x in ('stylesheet','preload','prefetch','icon')) and a.get('href'):self.resources.append((tag,a['href']))
s=Scan();s.feed(html)
css='\n'.join((P/name).read_text(encoding='utf-8') for name in ['style.css','spatial.css'])
app='\n'.join((P/name).read_text(encoding='utf-8') for name in ['app.js','diagnostics.js','upgrades.js','spatial.js','section-kernel.js','sections.js','rendering.js'])
assert not s.resources,s.resources
assert not re.search(r'@import|url\s*\(',css,re.I)
assert not re.search(r'\b(fetch\s*\(|XMLHttpRequest|import\s*\()',app)
assert '/*__' not in html
assert 'id="atlasBinary"' in html and 'id="bundledLicenses"' in html
assert all(('data-native-binary="'+s+'"') in html for s in ['bp3d','bp2018','uw','p41'])
assert 'id="nativeEvidence"' in html and 'CC BY-NC-SA' in html
report={'html_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'external_asset_attributes':s.resources,'remote_css_resources':False,'application_network_calls':False,'classic_inline_scripts':True,'binary_data_inlined':True,'license_inlined':True,'file_protocol_browser_test':'Not performed: built-in browser URL security policy allows HTTP/HTTPS only. No bypass attempted.','scope':'Static dependency audit plus HTTP browser run; not a test of every browser or GPU.'}
(P.parent/'portability-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
