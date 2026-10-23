"""Bounded public metadata fetch for the same-source cortical context task."""
from pathlib import Path
import http.cookiejar, json, re, urllib.parse, urllib.request, zipfile
HERE=Path(__file__).resolve().parent
BASE='https://lifesciencedb.jp/bp3d'
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders=[('User-Agent','Mozilla/5.0'),('Referer',BASE+'/?lng=en')]
def fetch(url,data=None):
    return opener.open(url,urllib.parse.urlencode(data).encode() if data else None,timeout=120).read()
def save(name,url,data=None):
    p=HERE/name
    if not p.exists():p.write_bytes(fetch(url,data))
    return p

page=save('official-viewer.html',BASE+'/?lng=en')
save('official-4.3-obj2FMA.html',BASE+'/get-info.cgi',{'cmd':'upload-all-list','load':'1','md_abbr':'bp3d','title':'obj2FMA','tree':'isa','version':'4.3'})
save('official-20181210i412-obj2FMA.html',BASE+'/get-info.cgi',{'cmd':'upload-all-list','load':'1','md_abbr':'bp3d','title':'obj2FMA','tree':'isa','version':'20181210i412'})
new=save('official-20181210i412-manifest.zip',BASE+'/get-info.cgi?version=20181210i412&cmd=concept-objfiles-list')
try:
    with zipfile.ZipFile(new) as z:
        t=next(n for n in z.namelist() if n.endswith('.txt'))
        data=z.read(t);(HERE/'official-20181210i412-FMA2Obj.txt').write_bytes(data)
    print(data.decode('utf-8').splitlines()[:4])
except zipfile.BadZipFile:
    print('Newer manifest request did not return ZIP; kept raw evidence.')
print('Saved viewer HTML and official 4.3 object-name metadata')
