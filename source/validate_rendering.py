"""Verify a display-only release did not change any embedded source geometry."""
from pathlib import Path
from html.parser import HTMLParser
import zipfile,hashlib,json
P=Path(__file__).resolve().parent.parent
class DataBlocks(HTMLParser):
    def __init__(self):super().__init__();self.key=None;self.blocks={}
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='script':
            ident=a.get('id')
            self.key=ident if ident in ['atlasMetadata','atlasBinary','nativeMetadata'] else 'binary:'+a['data-native-binary'] if 'data-native-binary' in a else None
            if self.key:self.blocks[self.key]=''
    def handle_data(self,data):
        if self.key:self.blocks[self.key]+=data
    def handle_endtag(self,tag):
        if tag=='script':self.key=None
with zipfile.ZipFile(P/'releases/NeuroAtlas-v3.1-backup.zip') as z:old=z.read('NeuroAtlas.html').decode('utf8')
current=(P/'NeuroAtlas.html').read_text(encoding='utf8')
a=DataBlocks();a.feed(old);b=DataBlocks();b.feed(current)
assert set(a.blocks)==set(b.blocks)
assert len(a.blocks)==7,(len(a.blocks),list(a.blocks))
checks=[]
for key,value in a.blocks.items():
    assert value==b.blocks[key],key
    checks.append({'block':key,'identicalToV31':True,'sha256':hashlib.sha256(value.encode('utf8')).hexdigest()})
report={'version':'3.2','sourceGeometryChanged':False,'comparedAgainst':'releases/NeuroAtlas-v3.1-backup.zip','checks':checks,'scope':'Exact comparison of all embedded mesh metadata, all five binary blocks, and native source-space definitions. Rendering changes do not constitute new anatomical validation.','rendererReferences':['https://threejs.org/manual/pages/how-to-update-things.html','https://threejs.org/manual/pages/transparency.html']}
(P/'rendering-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
