"""Resolve the two source putamen objects only, from official part-of data."""
from pathlib import Path
import hashlib,html,http.cookiejar,json,re,urllib.parse,urllib.request,zipfile
HERE=Path(__file__).resolve().parent;OUT=HERE/'bp2018-full'
BASE='https://lifesciencedb.jp/bp3d'
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders=[('User-Agent','Mozilla/5.0'),('Referer',BASE+'/?lng=en')]
def fetch(url,data=None):return opener.open(url,urllib.parse.urlencode(data).encode() if data else None,timeout=180).read()
opener.open(BASE+'/?lng=en',timeout=30).read()
p=HERE/'official-20181210i412-obj2FMA-partof.html'
if not p.exists():p.write_bytes(fetch(BASE+'/get-info.cgi',{'cmd':'upload-all-list','load':'1','md_abbr':'bp3d','title':'obj2FMA','tree':'partof','version':'20181210i412'}))
lookup={}
for row in re.findall(r'<tr>\s*(.*?)\s*</tr>',p.read_text(encoding='utf8'),re.S):
    c=[html.unescape(x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)]
    if len(c)>7 and c[1]:lookup[c[1]]={'id':c[1],'bp':c[2],'fma':c[3],'en':c[4],'synonyms':c[5],'originalName':c[6],'originalGroup':c[7]}
lines=(HERE/'official-20181210i412-FMA2Obj.txt').read_text(encoding='utf8').splitlines()
def comp(fma):return next(l for l in lines if l.startswith(fma+'\tpart_of\t')).split('\t')[2].split('+')
ids=sorted(set(comp('FMA72829')+comp('FMA72828')))
rows=[lookup[i] for i in ids]
assert all(r['bp'] for r in rows),[(r['id'],r['en']) for r in rows if not r['bp']]
archive=OUT/'official-2018-putamen-thalamus.zip'
if not archive.exists():archive=OUT/'official-2018-putamen.zip'
if not archive.exists():archive.write_bytes(fetch(BASE+'/download.cgi',{'ids':json.dumps(ids),'rep_id':json.dumps([r['bp'] for r in rows]),'filename':archive.stem,'type':'art_file','all_downloads':'1'}))
files=[]
with zipfile.ZipFile(archive) as z:
    for n in z.namelist():
        if not n.endswith('.obj'):continue
        base=Path(n).name;objid=base.split('_')[0]
        if objid not in ids:continue
        data=z.read(n);(OUT/base).write_bytes(data)
        files.append({'id':objid,'file':base,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
assert len(files)==len(ids),(len(files),len(ids))
mf=OUT/'download-manifest.json';r=json.loads(mf.read_text(encoding='utf8'))
got={x['id'] for x in files};r['files']=[x for x in r['files'] if x['id'] not in got]+files
r['sourceRows']=[x for x in r['sourceRows'] if x['id'] not in got]+rows
r['missingRequestedIds']=[i for i in r['missingRequestedIds'] if i not in got]
r['sourceDeepContextIds']=sorted(set(r['sourceDeepContextIds']+ids))
r['additionalDeepSourceCompounds']={fma:comp(fma) for fma in ['FMA72829','FMA72828']}
if archive.name not in r['archives']:r['archives'].append(archive.name)
mf.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'fetched':len(files),'zipBytes':archive.stat().st_size,'totalObjects':len(r['files'])}),flush=True)
