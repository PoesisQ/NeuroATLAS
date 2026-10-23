"""Add official same-version cortical context, never register versions to each other.
Run after prepare_native.py. Idempotent: base binaries/evidence remain in a build cache.
"""
from pathlib import Path
import json,gzip,hashlib,re
import numpy as np
P=Path(__file__).resolve().parent
D=P/'research-foramina/bodyparts3d/context-v3'
def read(p):return json.loads(p.read_text(encoding='utf8'))
def write(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf8')
base=P/'v3-base';base.mkdir(exist_ok=True)
for f in ['native-pack.json','native-evidence.json','bp3d-packed.bin.gz']:
    if not (base/f).exists():(base/f).write_bytes((P/f).read_bytes())
native=read(base/'native-pack.json');evidence=read(base/'native-evidence.json')
translations={};terms=[];updates={};reports={}
def term(tid,zh,en,names,loc,fn,note,rel,group='surface',**kw):
    terms.append(dict(id=tid,zh=zh,en=en,names=names,loc=loc,fn=fn,note=note,rel=rel,group=group,quality='mesh',space='bp2018',preferredSpace='bp2018',view='insular' if group=='surface' else 'deep',refs=['bp2018'],**kw))
def canonical(s):return re.sub(r'\s+',' ',re.sub(r'\b(left|right)\b','',s,flags=re.I)).strip()
def region(s):
    n=s['en'].lower()
    if s.get('sceneGroup')=='insula':return'Insula'
    if any(x in n for x in ['precentral','frontal','frontopolar','orbital','straight gyrus','frontomarginal']):return'Frontal lobe'
    if any(x in n for x in ['postcentral','parietal','angular','supramarginal','precuneus']):return'Parietal lobe'
    if any(x in n for x in ['occipital','lingual','cuneus']):return'Occipital lobe'
    if any(x in n for x in ['temporal','planum','fusiform']):return'Temporal lobe'
    return'Limbic lobe'
def append_mesh(s,raw,space,buf,center,tid,ids,cat,reg,extra):
    pos=np.frombuffer(raw,dtype='<f4',count=s['vertexCount']*3,offset=s['po']).reshape(-1,3)
    ix=np.frombuffer(raw,dtype='<u4',count=s['triangleCount']*3,offset=s['io'])
    assert np.isfinite(pos).all() and ix.max()<len(pos)
    p=(pos-center)@np.array([[1,0,0],[0,0,1],[0,-1,0]],float).T
    lo=p.min(0);hi=p.max(0);scale=(hi-lo)/65535;scale[scale==0]=1e-9
    q=np.rint((p-lo)/scale).clip(0,65535).astype('<u2');error=float(np.max(np.abs(q*scale+lo-p)))
    while len(buf)%4:buf.extend(b'\0')
    po=len(buf);buf.extend(q.tobytes())
    while len(buf)%4:buf.extend(b'\0')
    it=2 if len(pos)<65536 else 4;io=len(buf);buf.extend(ix.astype('<u2' if it==2 else '<u4').tobytes())
    name=('BP2018: ' if space=='bp2018' else 'BP3D: ')+canonical(s['en'])
    zh=re.sub(r'^(左侧|右侧)','',s['zh']);translations[name]=zh
    ek=space+'-v3-'+s['id'];limit='官方解剖建模网格；保留源拓扑、比例与同源坐标。无逐结构准确度保证；两侧可含作者对称建模，不能代表个体左右变异。'
    if space=='bp2018':limit+=' 2018 版本独立显示，不与 4.3 网格拼接。'
    if s.get('role')=='source-sulcus-model':limit+=' 沟对象为作者命名的沟面模型，不是独立分割的空腔体积。'
    if s.get('coverageNote'):limit+=' '+s['coverageNote']
    rec=dict(id=tid,name=name,space=space,side=s['side'],category=cat,region=reg,termIds=ids,source='DBCLS BodyParts3D official '+s.get('sourceVersion','4.3')+' · '+s['id']+' · '+s['fma'],quality='mesh',role=s.get('role','cortical-context'),sourceFile=s['sourceFile'],sourceSHA256=s['sha256'],evidenceKey=ek,limitations=limit,contextV3=True,**extra)
    rec['parts']=[dict(po=po,io=io,vc=len(pos),ic=len(ix),it=it,min=lo.tolist(),max=hi.tolist(),scale=scale.tolist())]
    native['records'].append(rec)
    evidence[ek]=dict(title=zh+' · 官方原始网格',description=limit,metrics={'模型版本':s.get('sourceVersion','4.3'),'源对象':s['id'],'FMA':s['fma'],'SHA-256':s['sha256'],'顶点 / 三角面':str(len(pos))+' / '+str(len(ix)//3),'坐标量化最大分量误差 mm（不是解剖误差）':error,'原生坐标包围盒 mm':s['bboxNativeMm']},limits=limit,images=[])
    return name,error

# Existing 4.3 cortex: shared transform with all existing 4.3 structures.
b=read(D/'bp43-context/meshes.json');raw=gzip.decompress((D/'bp43-context/meshes.bin.gz').read_bytes())
buf=bytearray(gzip.decompress((base/'bp3d-packed.bin.gz').read_bytes()))
center=np.array(native['spaces']['bp3d']['displayTransform']['subtractNativeCenterMM']);errors=[]
for i,s in enumerate(b['segments']):
    reg=region(s);ids=['bp3d_overview','cortex','cerebrum','telencephalon']
    ids+= {'Frontal lobe':['frontal'],'Parietal lobe':['parietal'],'Temporal lobe':['temporal'],'Occipital lobe':['occipital']}.get(reg,[])
    _,e=append_mesh(s,raw,'bp3d',buf,center,30000+i,ids,'cortex',reg,{});errors.append(e)
(P/'bp3d-packed.bin.gz').write_bytes(gzip.compress(bytes(buf),9,mtime=0))
native['spaces']['bp3d']['title']='BodyParts3D 4.3 · 岛叶与内囊'
native['spaces']['bp3d']['limits']='同版本脑回集合提供皮层定位背景。整体内囊、岛叶网格没有独立细分；MRI 与解剖建模结合，未提供逐结构准确度。'
reports['bp3d_context']={'addedObjects':len(errors),'maxQuantizationErrorMM':max(errors),'transformIdenticalToExistingBP43':True}

# 2018 source parts: omit explicitly identified overlapping historical cortex versions.
b=read(D/'bp2018-full/meshes.json');raw=gzip.decompress((D/'bp2018-full/meshes.bin.gz').read_bytes())
center=np.array(b['nativeCommonBoundingBoxCenterMm']);buf=bytearray();errors=[];names={};included=[];excluded=[]
parts={
 'MM3299':('heschl_ant','前颞横回','Anterior transverse temporal gyrus',['a1']),
 'MM3300':('heschl_post','后颞横回','Posterior transverse temporal gyrus',[]),
 'MM3292':('operculum_frontal','额岛盖','Frontal operculum',[]),
 'MM3301':('operculum_parietal','顶岛盖','Parietal operculum',[]),
 'MM3143':('operculum_orbital','眶岛盖','Orbital operculum',[]),
 'MM3295':('planum_temporale','颞平面','Planum temporale',[]),
 'MM3298':('planum_polare','颞极平面','Planum polare',[]),
 'MM3398':('insular_circular','岛叶环状沟','Circular sulcus of insula',[]),
 'MM3291':('insular_central','岛叶中央沟','Central insular sulcus',[]),
 'MM3771':('lateral','外侧沟','Lateral sulcus',[]),
 'MM3814':('insular_accessory','岛叶副短回','Accessory short insular gyrus',['insula']),
 'MM3815':('insular_short_post','岛叶后短回','Posterior short insular gyrus',['insula']),
 'MM3819':('insular_short_mid','岛叶中短回','Middle short insular gyrus',['insula']),
 'MM3820':('insular_short_ant','岛叶前短回','Anterior short insular gyrus',['insula']),
 'MM3821':('insular_long_ant','岛叶前长回','Anterior long insular gyrus',['insula']),
 'MM3822':('insular_long_post','岛叶后长回','Posterior long insular gyrus',['insula']),
 'MM3345':('capsule_anterior','内囊前肢','Anterior limb of internal capsule',[]),
 'MM3343':('capsule_genu','内囊膝','Genu of internal capsule',[]),
 'MM3333':('capsule_retrolenticular','内囊豆状核后部','Retrolenticular part of internal capsule',[]),
 'MM3326':('capsule_sublenticular','内囊豆状核下部','Sublenticular part of internal capsule',[]),
 'MM3355':('external_capsule','外囊','External capsule',[]),
 'MM3351':('extreme_capsule','最外囊','Extreme capsule',[]),
 'MM3360':('claustrum','屏状核','Claustrum',[]),
 'MM3271':('putamen_proper','壳核主体 · 2018源部分','Proper part of putamen',[]),
}
for i,s in enumerate(b['segments']):
    if s.get('overlappingHistoricalRepresentation') or s.get('sourceSideConflict') or s['id'] in ['MM3641','MM3641M']:excluded.append(s['id']);continue
    baseid=s['id'].removesuffix('M');part=parts.get(baseid);grp=s.get('sceneGroup');reg=region(s)
    cat='white_matter' if grp=='white-matter' else 'deep_grey' if grp=='deep-nuclei' else 'cortex'
    ids=['bp2018_overview'];extra={'nativeGroup':grp,'defaultContextVisible':s.get('defaultContextVisible',True)}
    if cat=='cortex':ids+=['cortex','cerebrum','telencephalon'];ids+= {'Frontal lobe':['frontal'],'Parietal lobe':['parietal'],'Temporal lobe':['temporal'],'Occipital lobe':['occipital']}.get(reg,[])
    if part:ids+=[part[0],*part[3]]
    if 'precentral' in s['en'].lower():ids+=['precentral']
    if 'postcentral' in s['en'].lower():ids+=['postcentral']
    if baseid in ['MM2879','MM2915']:ids+=['pallidum','basal','lentiform']
    name,e=append_mesh(s,raw,'bp2018',buf,center,31000+i,ids,cat,reg,extra);errors.append(e);included.append(s['id'])
    if part:names.setdefault(part[0],[]).append(name)
(P/'bp2018-packed.bin.gz').write_bytes(gzip.compress(bytes(buf),9,mtime=0))
sp={'title':'BodyParts3D 2018 · 精细皮层与岛叶','short':'BP2018 同源皮层','overview':'bp2018_overview','type':'官方分部解剖模型','description':'20181210i412 官方同版本皮层、岛盖、颞横回、岛叶脑回与有限白质分部。保留所有源三角面，仅统一刚性变换及16位坐标量化；定位背景与局部结构来自相同版本。','limits':'这是解剖建模图谱，不能称为每个部位经扫描精确分割。只接入可追溯的源对象，排除旧版重叠皮层。A1 用前颞横回作定位参考；内囊后肢与尾状核头在当前2018数据包中缺失，不以其余分部冒充整体。','license':native['spaces']['bp3d']['license'],'url':'https://lifesciencedb.jp/bp3d/?lng=en','unit':'mm','sides':['left','right','both'],'displayTransform':{'linear':[[1,0,0],[0,0,1],[0,-1,0]],'subtractNativeCenterMM':center.tolist(),'scaleFactor':1,'registrationToOtherSpaces':None}}
native['spaces']['bp2018']=sp
for bid,(tid,zh,en,aliases) in parts.items():
    if tid=='lateral' or tid not in names:continue
    group='deep' if tid.startswith('capsule_') or tid in ['external_capsule','extreme_capsule','claustrum','putamen_proper'] else 'surface'
    rel=[['insula','外侧沟深部'],['a1','颞上面的听觉定位'],['lateral','表面入口']]
    loc='位于外侧沟周围；与本源颞横回、岛盖和岛叶保持原生坐标。'
    fn='用于辨认宏观形态及其相邻结构。'
    if tid.startswith('insular_short'):loc='位于岛叶中央沟前方的短回区。';fn='岛叶参与内感受、感觉和情感等网络；不能把单一功能严格划给一个脑回。'
    elif tid.startswith('insular_long'):loc='位于岛叶中央沟后方的长回区。';fn='岛叶后部参与躯体感觉与内感受等整合；本模型提供形态定位。'
    elif tid=='insular_central':loc='斜行于岛叶表面，前方为短回区，后方为长回区。'
    elif tid.startswith('operculum_'):loc='覆盖岛叶的外侧；按官方独立岛盖对象移开可显露沟底。'
    elif tid=='heschl_ant':loc='在颞叶上面、外侧沟内，是初级听觉皮层的常用宏观定位标志。';fn='初级听觉皮层常位于前颞横回；脑回边界不等同于细胞构筑学 A1 边界。'
    elif tid=='heschl_post':loc='在前颞横回后方的颞叶上面。';fn='听觉相关皮层的宏观定位参照；不能将整个后颞横回统称初级听觉皮层。'
    elif tid=='capsule_anterior':loc='位于尾状核头与豆状核之间；本来源没有完整尾状核头。';fn='含额桥及丘脑皮层相关纤维；图中为源白质分部模型。'
    elif tid=='capsule_genu':loc='内囊前、后肢之间的弯折区域；本来源缺少独立后肢。';fn='皮质核束常以此区定位；网格不显示单条轴突。'
    elif tid=='capsule_retrolenticular':loc='在豆状核后方。';fn='包括视觉辐射等投射纤维的通路区域。'
    elif tid=='capsule_sublenticular':loc='在豆状核下方。';fn='包括听觉辐射等投射纤维的通路区域。'
    elif tid=='external_capsule':loc='位于壳核与屏状核之间。';fn='大脑半球的白质层，含皮层间联络纤维。'
    elif tid=='extreme_capsule':loc='位于屏状核与岛叶皮层之间。';fn='岛叶深面的白质层。'
    elif tid=='claustrum':loc='在外囊与最外囊之间的薄灰质板，位于岛叶深面。';fn='与广泛皮层区域相连；具体功能仍在研究。'
    elif tid=='putamen_proper':loc='位于外囊内侧、苍白球外侧。源对象只标注壳核主体部分。';fn='壳核参与皮层—基底核环路；当前对象不能冒称完整壳核边界。'
    if group=='deep':rel=[['external_capsule','外侧白质层'],['claustrum','薄灰质板'],['insula','更外侧的皮层'],['internal_capsule','查看4.3整体内囊']]
    term(tid,zh,en,sorted(set(names[tid])),loc,fn,'仅依据官方命名与原始形态。该分部不是个体功能边界，未虚构未提供的区域。',[r for r in rel if r[0]!=tid],group)
term('bp2018_overview','精细皮层—岛叶原位关系','BodyParts3D 2018 cortex and perisylvian anatomy',[],sp['description'],'观察同版本外侧沟周围的原位与展开关系。',sp['limits'],[['a1','颞横回'],['insula','岛叶'],['operculum_frontal','额岛盖'],['lateral','外侧沟']],overview=True)
updates['a1']={'preferredSpace':'bp2018','defaultEntrySpace':'bp2018','note':'2018 同源场景以前颞横回定位 A1，另列后颞横回和颞平面。功能边界仍需细胞构筑学或功能测量，不能从脑回网格断言。','rel':[['heschl_post','后方相邻脑回'],['planum_temporale','更后方颞上面'],['operculum_parietal','上方覆盖'],['insula','内侧沟底'],['lateral','外侧入口']]}
updates['insula']={'preferredSpace':'bp2018','defaultEntrySpace':'bp2018','note':'2018 独立来源显示官方岛短回、岛长回及岛叶中央沟；4.3 来源仍保留整体岛叶。各版本不拼接、不冒称个体精确解剖。','rel':[['insular_short_ant','前部短回'],['insular_long_ant','后部长回'],['insular_central','短回与长回间'],['operculum_frontal','上前方覆盖'],['a1','外侧沟内邻近'],['internal_capsule','另一来源的整体内囊']]}
updates['lateral']={'defaultEntrySpace':'bp2018','preferredSpace':'bp2018','rel':[['operculum_frontal','上前方覆盖'],['operculum_parietal','上后方覆盖'],['temporal','下方'],['insula','沟底'],['a1','颞上面']]}
updates['internal_capsule']={'preferredSpace':'bp3d','defaultEntrySpace':'bp3d'}
for space in ['bp3d','bp2018']:
    rs=[r for r in native['records'] if r['space']==space];native['spaces'][space]['stats']={'objects':len(rs),'vertices':sum(r['parts'][0]['vc'] for r in rs),'triangles':sum(r['parts'][0]['ic']//3 for r in rs),'gzipBytes':(P/(space+'-packed.bin.gz')).stat().st_size}
reports['bp2018']={'objects':len(included),'includedSourceIds':included,'excludedOverlappingSourceIds':excluded,'sourceVersion':'20181210i412','maxQuantizationErrorMM':max(errors),'scaleFactor':1,'rigidTransformDeterminant':1,'interVersionRegistration':None,'meshSmoothing':False,'sameVersionContext':True,'a1SourceFacesPerSide':6118}
write(P/'native-pack.json',native);write(P/'native-evidence.json',evidence)
js='/* Generated by prepare_context_v3.py. */\nObject.assign(ZH,'+json.dumps(translations,ensure_ascii=False)+');\n'
js+='SOURCES.bp2018=["DBCLS BodyParts3D · 20181210i412 官方模型","https://lifesciencedb.jp/bp3d/?lng=en"];\n'
js+='SOURCES.insula_primary=["Türe et al. · Topographic anatomy of the insular region","https://pubmed.ncbi.nlm.nih.gov/10193618/"];\n'
js+='SOURCES.heschl_primary=["Human Primary Auditory Cortex Follows the Shape of Heschl’s Gyrus","https://pmc.ncbi.nlm.nih.gov/articles/PMC6623669/"];\n'
js+='SOURCES.central_core=["Microsurgical anatomy of the central core of the brain","https://pubmed.ncbi.nlm.nih.gov/29271710/"];\n'
js+='for(const t of '+json.dumps(terms,ensure_ascii=False)+'){TERMS.push(t);}\n'
js+='for(const [id,v] of Object.entries('+json.dumps(updates,ensure_ascii=False)+'))Object.assign(TERMS.find(t=>t.id===id),v);\n'
js+='for(const t of TERMS){if(t.id==="insula"||t.id.startsWith("insular_")||t.id.startsWith("operculum_"))t.refs=[...new Set([...(t.refs||[]),"bp2018","insula_primary"])];if(t.id==="a1"||t.id.startsWith("heschl_"))t.refs=[...new Set([...(t.refs||[]),"bp2018","heschl_primary"])];if(["external_capsule","extreme_capsule","claustrum"].includes(t.id))t.refs.push("central_core");}\n'
js+='TOURS.push({id:"sylvian3",zh:"外侧沟：由表及里",en:"Perisylvian anatomy",desc:"同一源模型，保持颜色和观察窗，依次认识覆盖与邻接。",steps:["lateral","operculum_frontal","operculum_parietal","a1","heschl_post","planum_temporale","insula","insular_central","insular_short_ant","insular_long_ant"]});\n'
(P/'context-content.js').write_text(js,encoding='utf8');write(P.parent/'context-validation.json',reports)
print(json.dumps({'bp3d':native['spaces']['bp3d']['stats'],'bp2018':native['spaces']['bp2018']['stats'],'newTerms':len(terms)},ensure_ascii=False))
