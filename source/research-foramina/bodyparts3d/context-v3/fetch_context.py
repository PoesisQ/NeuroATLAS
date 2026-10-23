"""Download only two bounded cortical-context subsets from official DBCLS."""
from pathlib import Path
import hashlib, html, http.cookiejar, json, re, urllib.parse, urllib.request, zipfile
HERE=Path(__file__).resolve().parent
BP=HERE.parent
BASE='https://lifesciencedb.jp/bp3d'
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders=[('User-Agent','Mozilla/5.0'),('Referer',BASE+'/?lng=en')]
def fetch(url,data=None):
    return opener.open(url,urllib.parse.urlencode(data).encode() if data else None,timeout=180).read()
def table(path):
    out={}
    for row in re.findall(r'<tr>\s*(.*?)\s*</tr>',path.read_text(encoding='utf8'),re.S):
        c=[html.unescape(x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)]
        if len(c)>=8 and c[1] and c[2]:out[c[1]]={'id':c[1],'bp':c[2],'fma':c[3],'en':c[4],'synonyms':c[5],'originalName':c[6],'originalGroup':c[7]}
    return out
def member_set(path):return set(re.findall(r'\b(?:FJ|MM|CX)\d+M?\b',path.read_text(encoding='utf8')))
def compound(path,fma,relation='is_a'):
    line=next(l for l in path.read_text(encoding='utf8').splitlines() if l.startswith(fma+'\t'+relation+'\t'))
    return line.split('\t')[2].split('+')

existing={s['id'] for s in json.loads((BP/'bp3d-meshes.json').read_text(encoding='utf8'))['segments']}
allcortex=compound(BP/'FMA2Obj.txt','FMA61820')
# Explicitly select one whole named representation where official mapping lists
# overlapping historical components. Keep the selected source faces unchanged.
excluded={'FJ1746','FJ1747','FJ1835','FJ1836','FJ1837','FJ1838','FJ1839','FJ1840','FJ7500','FJ7500M'}
oldids=[i for i in allcortex if i not in existing and i not in excluded]
newbases=['MM3299','MM3300','MM3292','MM3301','MM3143','MM3771','MM3398','MM3291',
          'MM3814','MM3815','MM3819','MM3820','MM3821','MM3822','MM3811','MM3287',
          'MM3295','MM3298','MM3317','MM3303','MM3313']
newids=[i for base in newbases for i in [base,base+'M']]
jobs=[('bp43-context','4.3',oldids,BP/'FMA2Obj.txt'),
      ('bp2018-perisylvian','20181210i412',newids,HERE/'official-20181210i412-FMA2Obj.txt')]
opener.open(BASE+'/?lng=en',timeout=30).read()
for name,version,ids,mf in jobs:
    out=HERE/name;out.mkdir(exist_ok=True)
    lookup=table(HERE/('official-'+version+'-obj2FMA.html'))
    active=member_set(mf)
    assert len(ids)==len(set(ids)) and set(ids)<=active and set(ids)<=set(lookup)
    rows=[lookup[i] for i in ids]
    archive=out/(name+'-official.zip')
    if not archive.exists():archive.write_bytes(fetch(BASE+'/download.cgi',{'ids':json.dumps(ids),'rep_id':json.dumps([r['bp'] for r in rows]),'filename':name,'type':'art_file','all_downloads':'1'}))
    files=[]
    with zipfile.ZipFile(archive) as z:
        for member in z.namelist():
            base=Path(member).name
            if not base.endswith('.obj'):continue
            objid=base.split('_')[0]
            assert objid in ids
            data=z.read(member);(out/base).write_bytes(data)
            files.append({'id':objid,'file':base,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    assert len(files)==len(ids), (name,len(files),len(ids))
    report={'source':'DBCLS official public download.cgi','version':version,'downloadEndpoint':BASE+'/download.cgi',
        'officialObjectMapSHA256':hashlib.sha256(mf.read_bytes()).hexdigest(),'sourceRows':rows,'files':files,
        'geometryChanged':False,'registrationApplied':False,
        'licenseURL':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
        'legacyNoticeURL':'https://lifesciencedb.jp/bp3d/info_en/license/index.html',
        'licenseNote':'Current archive CC BY 4.0; legacy viewer CC BY-SA 2.1 Japan. Preserve both source notices.',
        'excludedExistingIds':sorted(existing) if version=='4.3' else [],
        'excludedOverlappingHistoricalIds':sorted(excluded) if version=='4.3' else [],
        'interpretation':'4.3 context may share native coordinates with existing 4.3 FJ atlas. The 2018 subset is a separately versioned candidate and MUST NOT be overlaid onto the 4.3 anatomy without independent validation.'}
    (out/'download-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'bundle':name,'objects':len(files),'zipBytes':archive.stat().st_size}),flush=True)
