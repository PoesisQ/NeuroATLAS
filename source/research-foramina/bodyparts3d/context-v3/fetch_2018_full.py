"""Official 2018 cortical compound plus finite same-version local/deep context."""
from pathlib import Path
import hashlib,html,http.cookiejar,json,re,shutil,urllib.parse,urllib.request,zipfile
HERE=Path(__file__).resolve().parent
OUT=HERE/'bp2018-full';OUT.mkdir(exist_ok=True)
BASE='https://lifesciencedb.jp/bp3d'
mf=HERE/'official-20181210i412-FMA2Obj.txt'
lines=mf.read_text(encoding='utf8').splitlines()
def comp(fma,rel='part_of'):
    return next(l for l in lines if l.startswith(fma+'\t'+rel+'\t')).split('\t')[2].split('+')
cortex=comp('FMA61820','is_a')
local=json.loads((HERE/'bp2018-perisylvian/download-manifest.json').read_text(encoding='utf8'))
localids=[x['id'] for x in local['files']]
deepbases=['MM2850','MM2870','MM2879','MM2915','MM2918','MM3272','MM3271',
           'MM3326','MM3333','MM3343','MM3345','MM3351','MM3355','MM3360','MM3323']
deep=[i for base in deepbases for i in [base,base+'M']]
ids=sorted(set(cortex+localids+deep))
active=set(re.findall(r'\b(?:FJ|MM|CX)\d+M?\b',mf.read_text(encoding='utf8')))
lookup={}
for row in re.findall(r'<tr>\s*(.*?)\s*</tr>',(HERE/'official-20181210i412-obj2FMA.html').read_text(encoding='utf8'),re.S):
    c=[html.unescape(x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)]
    if len(c)>7 and c[1]:lookup[c[1]]={'id':c[1],'bp':c[2],'fma':c[3],'en':c[4],'synonyms':c[5],'originalName':c[6],'originalGroup':c[7]}
assert set(ids)<=active and set(ids)<=set(lookup),(set(ids)-active,set(ids)-set(lookup))
for f in local['files']:
    shutil.copyfile(HERE/'bp2018-perisylvian'/f['file'],OUT/f['file'])
remaining=[i for i in ids if i not in localids]
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders=[('User-Agent','Mozilla/5.0'),('Referer',BASE+'/?lng=en')]
opener.open(BASE+'/?lng=en',timeout=30).read()
archives=[];missing=[]
for offset in range(0,len(remaining),60):
    batch=remaining[offset:offset+60];archive=OUT/('official-2018-context-'+str(offset//60+1)+'.zip')
    if not archive.exists():
        fields={'ids':json.dumps(batch),'rep_id':json.dumps([lookup[i]['bp'] for i in batch]),
                'filename':archive.stem,'type':'art_file','all_downloads':'1'}
        archive.write_bytes(opener.open(BASE+'/download.cgi',urllib.parse.urlencode(fields).encode(),timeout=180).read())
    with zipfile.ZipFile(archive) as z:
        members=[n for n in z.namelist() if n.endswith('.obj')]
        got={Path(n).name.split('_')[0] for n in members}
        assert got<=set(batch)
        missing.extend(sorted(set(batch)-got))
        for member in members:
            base=Path(member).name;assert base.split('_')[0] in batch
            (OUT/base).write_bytes(z.read(member))
    archives.append(archive.name)
    print(json.dumps({'batch':offset//60+1,'objects':len(batch),'zipBytes':archive.stat().st_size}),flush=True)
files=[]
for p in sorted(OUT.glob('*.obj')):
    objid=p.name.split('_')[0];assert objid in ids
    files.append({'id':objid,'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
assert len(files)==len(ids)-len(missing)
report={'source':'DBCLS official public download.cgi','version':'20181210i412','downloadEndpoint':BASE+'/download.cgi',
        'officialObjectMapSHA256':hashlib.sha256(mf.read_bytes()).hexdigest(),'sourceRows':[lookup[i] for i in ids],
        'files':files,'missingRequestedIds':missing,'sourceCorticalCompound':{'fma':'FMA61820','relation':'is_a','ids':cortex},
        'sourceLocalIds':localids,'sourceDeepContextIds':deep,'archives':archives,
        'geometryChanged':False,'registrationApplied':False,
        'licenseURL':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
        'legacyNoticeURL':'https://lifesciencedb.jp/bp3d/info_en/license/index.html',
        'note':'Official compound includes historical or nested anatomical representations. Inclusion in this inventory does not mean every object should be displayed simultaneously. No 4.3 geometry was copied into this dataset.'}
(OUT/'download-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'total':len(files),'cortexCompound':len(cortex),'additionalDeep':len(deep)}),flush=True)
