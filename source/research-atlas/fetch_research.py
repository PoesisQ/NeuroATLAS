"""Download explicitly named public reference data; never executes downloaded code."""
from pathlib import Path
from urllib.request import urlopen, Request
import sys, json, hashlib

ROOT=Path(__file__).resolve().parent
filename,url=sys.argv[1:3]
path=(ROOT/filename).resolve()
if ROOT not in path.parents: raise ValueError('outside research folder')
path.parent.mkdir(parents=True,exist_ok=True)
with urlopen(Request(url, headers={'User-Agent':'NeuroAtlas educational research'}), timeout=90) as r:
    data=r.read()
path.write_bytes(data)
rec={'file':filename,'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
ledger=ROOT/'downloads.json'
rows=json.loads(ledger.read_text('utf-8')) if ledger.exists() else []
rows=[x for x in rows if x['file']!=filename]+[rec]
ledger.write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(rec))
