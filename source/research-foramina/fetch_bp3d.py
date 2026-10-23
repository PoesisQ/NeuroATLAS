"""Download a small named subset from public DBCLS Anatomography endpoints.

The third-party CSV is used only as a discovery index. Authoritative 4.3 object
membership is checked against the downloaded official FMA2Obj table. Original
server-returned OBJ bytes are retained, not transformed.
"""
from pathlib import Path
import csv, hashlib, http.cookiejar, io, json, re, sys, urllib.parse, urllib.request, zipfile
HERE=Path(__file__).resolve().parent
BASE='https://lifesciencedb.jp/bp3d'
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders=[('User-Agent','Mozilla/5.0'),('Referer',BASE+'/?lng=en')]
out=HERE/'bodyparts3d';out.mkdir(exist_ok=True)

def fetch(url,data=None):
    return opener.open(url,urllib.parse.urlencode(data).encode() if data else None,timeout=120).read()

opener.open(BASE+'/?lng=en',timeout=30).read()
mf=out/'official-4.3-manifest.zip'
if not mf.exists(): mf.write_bytes(fetch(BASE+'/get-info.cgi?version=4.3&cmd=concept-objfiles-list'))
z=zipfile.ZipFile(mf)
name=next(n for n in z.namelist() if n.endswith('.txt'))
text=z.read(name).decode('utf-8'); (out/'FMA2Obj.txt').write_text(text,encoding='utf-8')
fjset=set(re.findall(r'FJ\d+M?',text))
rows=list(csv.DictReader((HERE/'bp-MANIFEST.csv').open(encoding='utf-8')))
pattern=re.compile(r'^(Left|Right) (internal capsule|insula|caudate nucleus|globus pallidus|putamen|thalamus|precentral gyrus|postcentral gyrus|superior temporal gyrus|middle frontal gyrus|hippocampus)$',re.I)
extra='--opercula' in sys.argv
if extra: pattern=re.compile(r'^(Left|Right) (inferior frontal gyrus|superior parietal lobule|supramarginal gyrus)$',re.I)
selected=[r for r in rows if pattern.match(r['name']) and r['fj_id'] in fjset]
assert len(selected)>0
basename='opercular-context-official' if extra else 'capsule-insula-context-official'
archive=out/(basename+'.zip')
if not archive.exists():
    blob=fetch(BASE+'/download.cgi',{'ids':json.dumps([r['fj_id'] for r in selected]),'rep_id':json.dumps([r['bp_id'] for r in selected]),
        'filename':basename,'type':'art_file','all_downloads':'1'})
    archive.write_bytes(blob)
selectedIds={r['fj_id'] for r in selected}; files=[]
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        base=Path(name).name
        if not base.endswith('.obj') or base.split('_')[0] not in selectedIds: continue
        data=z.read(name); (out/base).write_bytes(data)
        row=next(r for r in selected if r['fj_id']==base.split('_')[0])
        files.append({**row,'file':base,'sha256':hashlib.sha256(data).hexdigest(),'actualBytes':len(data)})
(out/('opercula-download-manifest.json' if extra else 'download-manifest.json')).write_text(json.dumps({'source':BASE,'requested':selected,'files':files,
    'officialManifestSha256':hashlib.sha256(mf.read_bytes()).hexdigest(),
    'downloadMethod':'Public viewer download.cgi with listed object IDs; originals retained unchanged',
    'sourceLicensePage':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
    'licenseNote':'Official archive license changed 2025-02-27 to CC BY 4.0; legacy viewer/docs carry CC BY-SA 2.1 Japan. Preserve both source notices.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'requested':len(selected),'downloaded':len(files),'zipBytes':archive.stat().st_size,'files':[x['name'] for x in files]}))
