from pathlib import Path
from array import array
import json,gzip,struct,sys
P=Path(__file__).resolve().parent
records=json.loads((P/'atlas.json').read_text(encoding='utf-8'))
binary=(P/'atlas.bin').read_bytes();chunks=[];offset=0;vertices=0;triangles=0
for r in records:
    for p in r['parts']:
        pos=array('f');pos.frombytes(binary[p['po']:p['po']+p['vc']*12])
        idx=array('H' if p['it']==2 else 'I');idx.frombytes(binary[p['io']:p['io']+p['ic']*p['it']])
        if r['category']=='cranial_nerves':
            used=array(idx.typecode)
            for i in range(0,len(idx),3):
                face=idx[i:i+3]
                if sum(pos[3*v+1] for v in face)/3>=-135:used.extend(face)
            if len(used)<len(idx):r['cropped']=True
            idx=used
        mapping={};newpos=array('f');newidx=array('H' if len(set(idx))<65536 else 'I')
        for v in idx:
            if v not in mapping:
                mapping[v]=len(mapping);newpos.extend(pos[3*v:3*v+3])
            newidx.append(mapping[v])
        lo=[min(newpos[k::3]) for k in range(3)];hi=[max(newpos[k::3]) for k in range(3)]
        sc=[(hi[k]-lo[k])/65535 or 1 for k in range(3)]
        q=array('H',(max(0,min(65535,round((v-lo[i%3])/sc[i%3]))) for i,v in enumerate(newpos)))
        while offset%4:chunks.append(b'\0');offset+=1
        p['po']=offset;chunks.append(q.tobytes());offset+=len(q)*2
        while offset%4:chunks.append(b'\0');offset+=1
        p['io']=offset;chunks.append(newidx.tobytes());offset+=len(newidx)*newidx.itemsize
        p.update(vc=len(newpos)//3,ic=len(newidx),it=newidx.itemsize,min=lo,max=hi,scale=sc)
        vertices+=p['vc'];triangles+=p['ic']//3
(P/'packed.json').write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
packed=b''.join(chunks);(P/'packed.bin.gz').write_bytes(gzip.compress(packed,compresslevel=9,mtime=0))
stats={'structures':len(records),'vertices':vertices,'triangles':triangles,'packed_bytes':len(packed),'gzip_bytes':(P/'packed.bin.gz').stat().st_size,'max_quantization_error_mm':max(max(p['scale'])/2 for r in records for p in r['parts'])}
(P/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8');print(json.dumps(stats))
