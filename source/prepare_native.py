"""Pack independently sourced anatomy without inter-atlas registration.

Positions undergo one shared rigid axis transform and translation per source,
then 16-bit coordinate quantization with measured error.
No scaling, smoothing, invented boundaries or mirror copies are introduced.
"""
from pathlib import Path
import json,gzip,hashlib,base64,sys,re
import numpy as np
P=Path(__file__).resolve().parent
F=P/'research-foramina';A=P/'research-atlas'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
def image_data(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
spaces={
 'bp3d':{'title':'BodyParts3D · 岛叶与内囊','short':'BP3D 原模型','overview':'bp3d_overview','type':'官方解剖网格','description':'官方双侧岛叶与内囊整体源网格，以及同源邻近核团和脑回。保留源拓扑与比例；统一刚性坐标转换并作 16 位坐标量化，量化误差见记录，非解剖误差。','limits':'MRI 与解剖建模结合的参考图谱，未提供逐结构精度；未标注岛叶短／长回、内囊各肢、膝及豆状核后／下部的独立边界。邻近皮层是源脑回集合，不是完整半球外壳。','license':'BodyParts3D © DBCLS；官方下载归档页面自 2025-02-27 起标注 CC BY 4.0；旧查看器同时保留 CC BY-SA 2.1 Japan 历史声明。','url':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html','unit':'mm','sides':['left','right','both']},
 'uw':{'title':'UW CT · 颅底孔腔','short':'UW 颅底 CT','overview':'uw_overview','type':'CT 模板手工分割','description':'6 人 CT 合成模板上的作者手工标签，含圆孔、卵圆孔、棘孔、翼管与同源骨面。这里显示标签的等值面，未移动到原有参考脑。','limits':'孔腔体积边界不等于独立追踪的骨性孔缘。源标签分辨率 0.46875 × 0.46875 × 1.25 mm；存在部分容积效应，完整管道范围未单独验证。骨面保留源扫描裁切开口。','license':'Konuthula et al., University of Washington；CC BY-NC-SA 3.0 United States。此来源及派生组件须保留署名、非商业与相同方式共享。','url':'https://hdl.handle.net/1773/46259','unit':'mm','fixed':True,'sides':['left','right','both']},
 'p41':{'title':'NextBrain P41 · 源核团标签','short':'P41 组织学标签','overview':'p41_overview','type':'单标本组织学标签','description':'P41-16 的人工描绘、AI 插值并按需人工校正的组织学标签，经作者配准至本标本 MRI；逐块保留原生物理坐标。可检查核团标签及原始 MRI 切片。','limits':'仅源单半球，不镜像补全。块间边界未焊接、补洞或平滑；源标签不保证覆盖完整核团。尤其动眼、EW、滑车核标签很小。背景白质按源标签降采样供定位，目标核团保持原标签采样。论文整体配准误差不能忽略。','license':'NextBrain / UCL / MGH，原始数据 CC0-1.0；Adrià Casamitjana et al., Nature 2025。','url':'https://github-pages.ucl.ac.uk/NextBrain/','unit':'mm','singleHemisphere':True,'sides':['single']}
}
records=[];evidence={};translations={};pack_reports={};additions=[];updates={};native_counter=20000
def add_term(id,zh,en,group,names,loc,fn,note,rel,**extra):
    additions.append([id,zh,en,group,names,loc,fn,note,rel,extra])
def record(name,zh,space,side,category,region,termids,positions,faces,src,quality,**extra):
    global native_counter
    r={'id':native_counter,'name':name,'space':space,'side':side,'category':category,'region':region,'termIds':termids,'source':src,'quality':quality,**extra}
    native_counter+=1;translations[name]=zh
    r['_positions']=positions;r['_faces']=faces;records.append(r);return r
def parse_segment(raw,s):
    pos=np.frombuffer(raw,dtype='<f4',count=s['vertexCount']*3,offset=s['po']).reshape(-1,3).copy()
    faces=np.frombuffer(raw,dtype='<u4',count=s['triangleCount']*3,offset=s['io']).reshape(-1,3).copy()
    return pos,faces
def pack_space(space,transform,center):
    chunks=[];offset=0;vertices=triangles=0;maxerror=0;rawbounds=[]
    for r in [r for r in records if r['space']==space]:
        pos=r.pop('_positions');idx=r.pop('_faces');rawbounds.append([pos.min(0).tolist(),pos.max(0).tolist()])
        pos=(pos-center)@transform.T
        assert np.isfinite(pos).all() and idx.max()<len(pos)
        lo=pos.min(0);hi=pos.max(0);scale=(hi-lo)/65535;scale[scale==0]=1e-9
        q=np.rint((pos-lo)/scale).clip(0,65535).astype('<u2')
        actual=np.max(np.abs(q*scale+lo-pos));maxerror=max(maxerror,float(actual))
        indices=idx.astype('<u2' if len(pos)<65536 else '<u4')
        while offset%4:chunks.append(b'\0');offset+=1
        po=offset;block=q.tobytes();chunks.append(block);offset+=len(block)
        while offset%4:chunks.append(b'\0');offset+=1
        io=offset;block=indices.tobytes();chunks.append(block);offset+=len(block)
        r['parts']=[{'po':po,'io':io,'vc':len(pos),'ic':idx.size,'it':indices.dtype.itemsize,'min':lo.tolist(),'max':hi.tolist(),'scale':scale.tolist()}]
        vertices+=len(pos);triangles+=len(idx)
    binary=b''.join(chunks);target=P/(space+'-packed.bin.gz');target.write_bytes(gzip.compress(binary,compresslevel=9,mtime=0))
    spaces[space]['displayTransform']={'linear':transform.tolist(),'subtractNativeCenterMM':center.tolist(),'scaleFactor':1,'registrationToOtherSpaces':None}
    spaces[space]['stats']={'objects':sum(r['space']==space for r in records),'vertices':vertices,'triangles':triangles,'gzipBytes':target.stat().st_size,'quantizationMaxAbsErrorMM':maxerror}
    pack_reports[space]={**spaces[space]['stats'],'bufferBytes':len(binary),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'rigidTransformDeterminant':float(np.linalg.det(transform)),'smoothingApplied':False,'mirroredCopies':False}

# Official BodyParts3D source meshes.
bp=read(F/'bodyparts3d/bp3d-meshes.json');bpraw=gzip.decompress((F/'bodyparts3d/bp3d-meshes.bin.gz').read_bytes())
bpdetails=read(F/'bodyparts3d/bp3d-analysis.json')
bpmap={
 'insula':('insula','岛叶','cortex','Insula',['insula']),
 'internal capsule':('internal_capsule','内囊','white_matter','',['internal_capsule']),
 'caudate nucleus':('caudate','尾状核','deep_grey','',['caudate','basal','nucleus']),
 'putamen':('putamen','壳核','deep_grey','',['putamen','basal','lentiform','nucleus']),
 'globus pallidus':('pallidum','苍白球','deep_grey','',['pallidum','basal','lentiform','nucleus']),
 'thalamus':('thalamus','丘脑','diencephalon','',['thalamus','diencephalon','nucleus']),
 'inferior frontal gyrus':('bp_ifg','额下回','cortex','Frontal lobe',['frontal']),
 'middle frontal gyrus':('bp_mfg','额中回','cortex','Frontal lobe',['frontal']),
 'precentral gyrus':('precentral','中央前回','cortex','Frontal lobe',['precentral','frontal']),
 'postcentral gyrus':('postcentral','中央后回','cortex','Parietal lobe',['postcentral','parietal']),
 'supramarginal gyrus':('bp_smg','缘上回','cortex','Parietal lobe',['parietal']),
 'superior temporal gyrus':('bp_stg','颞上回','cortex','Temporal lobe',['temporal'])}
bpnames={}
for s in bp['segments']:
    key=re.sub(r'^(Left|Right) ','',s['en']).lower();tid,zh,cat,reg,tids=bpmap[key]
    name='BP3D: '+key[0].upper()+key[1:];bpnames[tid]=name
    pos,faces=parse_segment(bpraw,s)
    limits='保留官方原始网格；未新增组织边界或镜像。此模型的表面精度未由作者逐结构量化。'
    if key=='insula':limits+='完整源岛叶对象，未独立标注岛短回、岛长回、岛阈及岛中央沟。'
    elif key=='internal capsule':limits+='完整源内囊对象，未单独标注前肢、膝、后肢、豆状核后部及下部。'
    elif cat=='cortex':limits+='该脑回仅为同源邻近皮层参照，不能当作整个脑叶。'
    ek='bp3d-'+s['id']
    record(name,zh,'bp3d',s['side'],cat,reg,tids+['bp3d_overview'],pos,faces,'DBCLS BodyParts3D official 4.3 · '+s['id']+' · '+s['fma'],'mesh',role=s['role'],evidenceKey=ek,sourceFile=s['sourceFile'],sourceSHA256=s['sha256'],limitations=limits)
    evidence[ek]={'title':s['zh']+' · 原始网格','description':'保留官方 OBJ 的顶点连接与三角面。界面做共同刚性坐标转换及 16 位坐标量化；误差见核验报告，非解剖精度。未把其他标本变形到这里。','metrics':{'原文件':s['sourceFile'],'FMA':s['fma'],'SHA-256':s['sha256'],'源坐标包围盒 mm':s['bboxNativeMm'],'顶点 / 三角面':str(s['vertexCount'])+' / '+str(s['triangleCount']),'左右侧':s['side']},'limits':limits,'images':[]}
    if key in ['insula','internal capsule'] and (F/'bodyparts3d/bp3d-context-sections.png').exists():
        evidence[ek]['images']=[{'data':image_data(F/'bodyparts3d/bp3d-context-sections.png'),'caption':'同一官方网格的几何剖面核对：不是 MRI 或组织学原始切片。曲线保留源网格关系。'}]
updates['insula']={'names':[bpnames['insula']],'quality':'mesh','preferredSpace':'bp3d','note':'完整源岛叶网格已经补入。它位于外侧沟深部、壳核的外侧；移开的邻近脑回均来自同一个 BodyParts3D 模型。源网格没有独立标注各岛短回、岛长回和岛阈，不能据此声称这些细分已逐一核实。','refs':['bp3d','surface','destrieux'],'rel':[['frontal','上前方邻近脑回'],['temporal','下方颞上回'],['putamen','内侧深部'],['internal_capsule','更内侧']]}
updates['internal_capsule']={'names':[bpnames['internal_capsule']],'quality':'mesh','preferredSpace':'bp3d','note':'已补入官方内囊整体源网格，不再截取投射束替代。用同源尾状核、丘脑和豆状核核对其前后关系；源数据未独立划分前肢、膝、后肢与豆状核后／下部，因此不额外画分界。','refs':['bp3d','capsule']}
for tid in ['bp_ifg','bp_mfg','bp_smg','bp_stg']:
    name=bpnames[tid];zh=translations[name]
    add_term(tid,zh+' · BP3D',name[6:],'surface',[name],'BodyParts3D 同源皮层脑回，作为岛叶和深部结构的外侧参照。','按该脑回的宏观形态观察其与岛叶、基底核的空间关系。','没有把该脑回扩大为整个脑叶，也没有据此分割个体功能区。',[['insula','深部'],['internal_capsule','更深部']],space='bp3d',preferredSpace='bp3d',quality='mesh',view='lateral',refs=['bp3d'])
add_term('bp3d_overview','岛叶—内囊原生关系','BodyParts3D insula and internal capsule','deep',[],spaces['bp3d']['description'],'在一个源模型内观察由外至内的关系，并用左右两侧互相对照。',spaces['bp3d']['limits'],[['insula','外侧'],['internal_capsule','深部白质'],['putamen','内囊外侧'],['thalamus','内囊后肢内侧']],space='bp3d',preferredSpace='bp3d',quality='mesh',view='oblique',overview=True,refs=['bp3d'])
pack_space('bp3d',np.array([[1,0,0],[0,0,1],[0,-1,0]],float),np.array(bp['nativeCommonBoundingBoxCenterMm']))

# UW author-delineated CT labels. Remove only algorithm caps on source array crop planes.
uw=read(F/'uw-meshes.json');uwstats=read(F/'uw-label-statistics.json');uwraw=gzip.decompress((F/'uw-meshes.bin.gz').read_bytes())
uwids={'eyes':['uw_eyes'],'septum':['uw_septum'],'optic nerves':['cn2'],'internal carotid artery':['uw_carotid'],'nasolacrimal duct':['uw_nasolacrimal'],'foramen ovale':['ovale'],'foramen spinosum':['spinosum'],'foramen rotundum':['rotundum'],'vidian canal':['vidian'],'pterygopalatine fossa':['pterygopalatine'],'pituitary':['pituitary'],'cavernous sinus':['cavernous'],'extraocular muscles':['uw_eye_muscles'],'bone of anterior cranial fossa':['uw_bone','skullbase']}
uw_names={};capsremoved={};side_report=read(F/'uw-side-components.json')
assert side_report['meshBinarySha256']==hashlib.sha256(uwraw).hexdigest()
for s in uw['segments']:
    pos,faces=parse_segment(uwraw,s);original_faces=len(faces)
    if s['role']=='bone-segmentation':
        a=np.array(uwstats['ijkToRAS']);spacing=np.diag(a)[:3];origin=a[:3,3];sizes=np.array(uwstats['arrayShape'][1:]);keep=np.ones(len(faces),bool)
        for axis in range(3):
            for edge in [origin[axis]-.5*spacing[axis],origin[axis]+(sizes[axis]-.5)*spacing[axis]]:
                keep&=~np.all(np.abs(pos[faces,axis]-edge)<.0002,axis=1)
        faces=faces[keep]
    capsremoved[s['en']]=original_faces-len(faces)
    name='UW CT: '+s['en'];uw_names[s['en']]=name
    ids=uwids[s['en']];hole='foramen' in s['role'] or s['role']=='canal-volume-label'
    cat='skull' if s['role']=='bone-segmentation' else 'cranial_nerves' if s['en']=='optic nerves' else 'diencephalon' if s['en']=='pituitary' else 'veins_sinuses' if s['en']=='cavernous sinus' else 'arteries' if s['en']=='internal carotid artery' else 'native_tissue'
    quality='cavity' if hole else 'segmented';ek='uw-'+str(s['index'])
    limits=spaces['uw']['limits'] if hole else '同源 CT 模板手工标签。骨与组织保留源范围；CT 与分割的层厚不同，显示不能消除部分容积效应。'
    color='#'+''.join(f'{int(c*255):02x}' for c in s['color'])
    components=next((item['components'] for item in side_report['items'] if item['index']==s['index']),None) if hole else None
    pieces=[]
    if components:
        covered=[]
        for side in ['left','right']:
            subset=np.concatenate([np.array(c['faceIndices'],dtype=np.int64) for c in components if c['side']==side])
            source_faces=faces[subset];vertices,inverse=np.unique(source_faces,return_inverse=True)
            pieces.append((side,pos[vertices],inverse.reshape(-1,3),ek+'-'+side))
            covered.extend(subset.tolist())
        assert sorted(covered)==list(range(len(faces))) and len(covered)==len(set(covered))
    else:pieces=[('both',pos,faces,ek)]
    for side,pp,ff,key in pieces:
        record(name,s['zh'],'uw',side,cat,'',ids+['uw_overview'],pp,ff,'Konuthula et al. / University of Washington · CT manual label','cavity' if hole else 'segmented',role=s['role'],nativeColor=color,evidenceKey=key,labelIndex=s['index'],limitations=limits,removedArrayCaps=original_faces-len(faces),sourceSHA256=uwstats['sha256'])
    metrics={'源标签':s['en'],'体素尺寸 mm':uwstats['voxelSpacingMm'],'标签体积 mm³':uwstats['segments'][s['index']]['volumeMm3'],'源网格顶点 / 三角面':str(s['vertexCount'])+' / '+str(len(faces)),'剔除源裁切面封口三角形':original_faces-len(faces)}
    evidence[ek]={'title':s['zh']+' · CT 原始分割','description':'同一模板 CT 与分割分别按各自 header affine 转换到同一物理坐标。没有配准至其他参考脑。粉色为孔腔标签边界，青色为骨标签边界。','metrics':metrics,'limits':limits,'images':[]}
    img=F/('uw-'+s['en'].replace(' ','-')+'-ct.png')
    if img.exists():evidence[ek]['images']=[{'data':image_data(img),'caption':'轴状／冠状／矢状源 CT 核对，刻度为原生 RAS 毫米坐标；源标签层厚 1.25 mm。'}]
    if components:
        original=evidence.pop(ek)
        for side,pp,ff,key in pieces:
            label='左侧' if side=='left' else '右侧'
            e={**original,'title':label+' '+original['title'],'metrics':{**metrics,'显示侧别':label,'本侧网格顶点 / 面':str(len(pp))+' / '+str(len(ff))},'images':[]}
            e['description']+=' 左右侧按原网格不相连组件分组，不切开或修改原表面；鼻中隔质心只作粗侧别参考，不代表精确中矢状面。'
            candidate=F/('uw-'+s['en'].replace(' ','-')+('-right-ct.png' if side=='right' else '-ct.png'))
            assert candidate.exists(),candidate
            e['images']=[{'data':image_data(candidate),'caption':label+'源 CT 与本侧孔腔标签：轴状／冠状／矢状切片。原生 RAS 毫米坐标；标签层厚 1.25 mm。'}]
            evidence[key]=e
for tid,en in [('ovale','foramen ovale'),('rotundum','foramen rotundum')]:
    updates[tid]={'names':[uw_names[en]],'quality':'cavity','preferredSpace':'uw','open':0,'note':'显示论文作者在 CT 模板上手工分割的孔腔体积边界；旁边为同一 CT 的骨分割。它不等于独立描出的骨性孔缘，也不是无限精度的通道。通过的三叉神经分支未在这个模板中分割，点击神经词条会切换来源，不将旧神经贴入此孔腔。','refs':['uw','foramina'],'rel':[['uw_bone','同源骨面'],['rotundum' if tid=='ovale' else 'ovale','同源邻孔'],['v3nerve' if tid=='ovale' else 'v2nerve','经过的神经 · 另一参考空间']]}
uwnew=[('spinosum','棘孔','foramen spinosum','位于蝶骨大翼，通常在卵圆孔后外侧。','主要为脑膜中动脉等通过的孔。',[['ovale','前内侧邻孔'],['uw_bone','同源骨面']]),('vidian','翼管','vidian canal','在蝶骨翼突根部，由破裂孔邻近区域通向翼腭窝。','翼管神经与伴行血管的通道。',[['pterygopalatine','前方终端空间'],['rotundum','邻近孔道'],['uw_bone','骨性参照']]),('pterygopalatine','翼腭窝','pterygopalatine fossa','上颌骨后方、翼突前方的深部间隙。','容纳翼腭神经节、上颌神经分支和血管；经多个通道与邻区相通。',[['rotundum','上颌神经进入'],['vidian','后方通道']]),('uw_bone','前颅窝及邻近骨面 · CT','bone of anterior cranial fossa','UW 源分割的骨性区域；名称与范围保持原作者标签。','作为孔腔和邻近软组织的同源骨性参照。',[['ovale','孔腔'],['rotundum','孔腔'],['spinosum','孔腔'],['vidian','通道']])]
for tid,zh,en,loc,fn,rel in uwnew:
    add_term(tid,zh,en.title(),'foramen',[uw_names[en]],loc,fn,spaces['uw']['limits'],rel,space='uw',preferredSpace='uw',view='skull',quality='cavity' if tid in ['spinosum','vidian'] else 'segmented',open=0,refs=['uw','foramina'])
for en,ids in uwids.items():
    if not ids[0].startswith('uw_') or ids[0]=='uw_bone':continue
    s=next(s for s in uw['segments'] if s['en']==en)
    add_term(ids[0],s['zh']+' · CT',en.title(),'foramen',[uw_names[en]],'当前 CT 模板中的同源手工分割对象。','用于检查颅底孔道的邻近关系；具体分割范围按作者源标签。',spaces['uw']['limits'],[['uw_bone','骨性参照']],space='uw',preferredSpace='uw',view='skull',quality='segmented',refs=['uw'])
add_term('uw_overview','颅底孔腔与骨面 · CT','UW skull-base segmentation','foramen',[],spaces['uw']['description'],'在同一模板中查看孔腔、骨面与已分割的邻近软组织。',spaces['uw']['limits'],[['ovale','孔腔'],['rotundum','孔腔'],['spinosum','孔腔'],['vidian','通道']],space='uw',preferredSpace='uw',quality='segmented',view='skull',overview=True,open=0,refs=['uw'])
center=np.array([uwstats['referenceMidlineXmmFromSeptumCentroid'],40,105]);pack_space('uw',np.array([[-1,0,0],[0,0,1],[0,1,0]],float),center)
pack_reports['uw']['removedArrayCaps']=capsremoved
pack_reports['uw']['sideAssignment']={k:v for k,v in side_report.items() if k!='items'}

# Single donor nuclei: labels stay in their MRI-defined physical coordinates.
p41=read(A/'p41-meshes.json');praw=gzip.decompress((A/'p41-meshes.bin.gz').read_bytes())
info={
649:('上橄榄内侧核','位于脑桥尾侧的上橄榄复合体内侧部分。','参与双耳声源定位，尤其双耳时间差处理。','cn8'),
660:('上橄榄外侧核','位于脑桥尾侧的上橄榄复合体外侧部分。','参与双耳声级差等听觉空间信息处理。','cn8'),
654:('下橄榄主核','延髓腹外侧、橄榄隆起深部的折叠灰质。','发出攀缘纤维参与小脑运动学习和时序处理。','olive'),
671:('下橄榄内侧副核','下橄榄复合体的内侧分部。','与小脑相关的运动调节和学习环路。','inferior_olive'),
685:('下橄榄背侧副核','下橄榄复合体背侧分部。','与小脑相关的运动调节和学习环路。','inferior_olive'),
682:('展神经核','脑桥尾侧背部，邻第四脑室底。','运动神经元支配同侧外直肌；核内还含参与水平共同凝视的中间神经元。','cn6'),
666:('面神经核','脑桥尾侧被盖腹外侧。','鳃弓运动核，支配同侧面部表情肌等；不是全部面神经副交感或味觉成分的来源。','cn7'),
724:('舌下神经核','延髓背内侧，近舌下神经三角。','舌肌躯体运动控制；腭舌肌通常由迷走神经相关通路支配。','cn12'),
725:('迷走神经背侧运动核','延髓背部，近第四脑室底与孤束核。','提供迷走神经的部分副交感节前输出；不能概括所有迷走运动成分。','cn10'),
693:('疑核','延髓网状结构深部。','与 IX、X 相关的咽喉鳃弓运动及部分心脏副交感控制有关。','cn10'),
717:('孤束核','延髓背部围绕孤束的灰质。','处理 VII、IX、X 相关的味觉及内脏感觉输入。','cn9'),
630:('三叉神经运动核','脑桥被盖，主感觉核内侧邻近。','经 V3 控制咀嚼肌等第一鳃弓来源肌肉。','v3nerve'),
659:('三叉神经主感觉核','脑桥外侧被盖。','参与面部精细触觉等躯体感觉的中继。','cn5'),
669:('三叉神经脊束核','自脑桥尾侧延至延髓和上颈髓的感觉核柱。','参与面部痛、温等感觉；当前只显示源标本已标注段。','cn5'),
645:('三叉神经中脑核','中脑导水管周围灰质的外侧等区域。','参与咀嚼系统本体感觉与反射，含特殊的中枢内初级感觉神经元胞体。','cn5'),
689:('腹侧耳蜗核','脑桥延髓交界外侧、耳蜗神经进入附近。','听觉信号的早期脑干中继与特征处理。','cn8'),
731:('背侧耳蜗核','位于下小脑脚附近的背外侧。','听觉信息处理的脑干中继。','cn8'),
683:('前庭上核','前庭核群上部，近第四脑室外侧。','参与前庭眼反射和眼位控制。','cn8'),
690:('前庭外侧核','前庭核群外侧部分。','参与前庭脊髓输出和姿势、平衡调节。','cn8'),
694:('前庭内侧核','第四脑室底外侧附近的前庭核群内侧。','参与前庭眼反射及头颈姿势调节。','cn8'),
703:('前庭下核','前庭核群尾侧。','整合前庭、小脑等信息，参与平衡与姿势调节。','cn8'),
715:('顶核','小脑深部靠近中线。','参与轴性姿势、平衡和眼动相关环路。','cerebellum'),
721:('齿状核','小脑半球白质深部的折叠核。','参与运动规划、协调及部分认知相关小脑输出环路。','cerebellum'),
751:('球状核','小脑中间核群的内侧部分。','与栓状核一起参与肢体动作调节。','cerebellum'),
752:('栓状核','小脑中间核群的外侧部分。','与球状核一起参与肢体动作调节。','cerebellum'),
589:('蓝斑','脑桥背侧、第四脑室底外侧附近。','重要去甲肾上腺素能核群，参与觉醒与注意等调节。','pons'),
447:('动眼神经副核 · EW','动眼神经核复合体邻近区域。','EW 命名涉及节前副交感群（EWpg）与中枢投射群（EWcp）；前者经 III—睫状神经节参与缩瞳和调节。当前源标签不能区分两群，不能直接视为完整副交感核。','cn3'),
464:('动眼神经核 · 源局部标签','中脑上丘水平，导水管周围灰质附近。','经 III 支配多条眼外肌；源小标签不能代表全部动眼亚核。','cn3'),
520:('滑车神经核 · 源局部标签','中脑下丘水平附近。','轴突交叉并自中脑背侧发出，经对侧 IV 控制上斜肌。','cn4'),
431:('中脑白质 · 源背景','本标本已标注的中脑白质。','作为邻近核团的位置参照。','midbrain'),
611:('后脑白质 · 源背景','本标本已标注的后脑白质集合。','作为脑干与小脑核团的位置参照。','brainstem'),
580:('脑桥 · 源标签范围','本标本作者标为 pons 的区域。','用于核团相对于脑桥的定位，不能把本标签视为完整脑桥外壳。','pons'),
662:('延髓 · 源标签范围','本标本作者标为 medulla 的区域。','用于核团相对于延髓的定位，不能把本标签视为完整延髓外壳。','medulla')}
pnames={}
for s in p41['segments']:
    lid=s['labelId'];zh,loc,fn,relation=info[lid];tid='p41_'+str(lid);name='P41: '+s['en'].replace('_',' ');pnames[lid]=name
    pos,faces=parse_segment(praw,s);context=s['role']!='nucleus-source-label';cat='brainstem' if lid not in [715,721,751,752] else 'cerebellum'
    terms=[tid,'p41_overview']
    if lid in [649,660]:terms+=['superior_olive']
    if lid in [654,671,685]:terms+=['inferior_olive']
    if context:terms+=[relation]
    note='源标本标签按原块独立提取；跨块接缝保留，不补洞、不平滑、不镜像，不能宣称覆盖完整核团。'
    if s['smallSourceLabelCaution']:note+='该标签体积很小，只显示源中实际存在的局部。'
    if context:note+='背景以原标签每轴步长 4 提取；具体体素间距见证据。'
    ek='p41-'+str(lid)
    palette=['#a97966','#4b93a3','#749b68','#a67a9f','#b3a15b','#6a86b0']
    record(name,zh,'p41','single',cat,'',terms,pos,faces,'NextBrain P41-16 · histology label '+str(lid),'segmented',role='white-context' if context else 'nucleus',nativeColor='#9caeaa' if context else palette[lid%len(palette)],evidenceKey=ek,sourceLabel=lid,limitations=note,sourceParts=s['parts'],completeNucleusClaim=False)
    add_term(tid,zh,name[5:],'nuclei',[name],loc,fn,note,[[relation,'相关结构／神经'],['p41_overview','同源核团与背景']],space='p41',preferredSpace='p41',quality='segmented',view='stem',open=0,refs=['p41','nuclei']+(['ew'] if lid==447 else []),aliases={649:['内侧上橄榄核','MSO'],660:['外侧上橄榄核','LSO'],671:['内侧副橄榄核'],685:['背侧副橄榄核']}.get(lid,[]))
    evidence[ek]={'title':zh+' · P41 原标签','description':'作者把组织学标签配准到同标本 MRI；三维表面直接使用每块 NIfTI 的物理坐标，没有配准到其他脑模型。','metrics':{'原始 label ID':lid,'原始标签名':s['en'],'源块体积合计 mm³（未消除块间重叠）':s['sourceBlockVolumeMm3'],'三角面':s['triangleCount'],'源块编号':[p['sourceBlock'] for p in s['parts']],'源采样间距 mm':[p['sourceSpacingMm'] for p in s['parts']],'显示采样间距 mm':[p['displaySpacingMm'] for p in s['parts']],'块边界开放边数量':[p['meshOpenEdges'] for p in s['parts']],'完整核团声明':False},'limits':note,'images':[]}
    ev=A/'evidence'/('p41_'+str(lid)+'_orthogonal.png')
    if ev.exists():evidence[ek]['images']=[{'data':image_data(ev),'caption':'同标本 MRI 与源标签的物理坐标切片核对；彩色覆盖为对应标注。不是组织学精度的 MRI 影像。'}]
updates['superior_olive']={'names':[pnames[649],pnames[660]],'quality':'segmented','preferredSpace':'p41','view':'stem','open':0,'note':'已补入 P41 标本上橄榄内侧、外侧核的源标签表面，不再用球形标记替代。块边界保留开放接缝；不宣称完整重建整个上橄榄复合体。','refs':['p41','nuclei'],'rel':[['p41_649','内侧分部'],['p41_660','外侧分部'],['p41_689','同源耳蜗核'],['p41_611','同源后脑白质背景']]}
updates['inferior_olive']={'names':[pnames[654],pnames[671],pnames[685]],'quality':'segmented','preferredSpace':'p41','view':'stem','open':0,'note':'已补入 P41 下橄榄主核及内侧、背侧副核的源分割表面，不再仅以外部橄榄隆起代替。跨块未补缝，不能保证完整灰质折叠板。','refs':['p41','nuclei'],'rel':[['p41_654','主核'],['p41_671','内侧副核'],['p41_685','背侧副核'],['p41_662','同源延髓标签']]}
add_term('p41_overview','脑干与小脑核团 · P41','P41 donor nuclei','nuclei',[],spaces['p41']['description'],'在同一标本中对照源核团标签和同源白质背景；可逐一查看证据切片。',spaces['p41']['limits'],[['superior_olive','上橄榄分部'],['inferior_olive','下橄榄分部'],['p41_724','舌下神经核'],['p41_721','齿状核']],space='p41',preferredSpace='p41',quality='segmented',view='stem',overview=True,open=0,refs=['p41','nuclei'])
allpos=np.concatenate([r['_positions'] for r in records if r['space']=='p41']);center=(allpos.min(0)+allpos.max(0))/2
pack_space('p41',np.array([[-1,0,0],[0,0,1],[0,1,0]],float),center)

write(P/'native-pack.json',{'spaces':spaces,'records':records})
write(P/'native-evidence.json',evidence)
write(P.parent/'native-validation.json',{'spaces':pack_reports,'noInterAtlasRegistration':True,'sourceVertexAndTriangleChecks':True,'note':'Geometry checks are not expert anatomical validation.'})
js='/* Generated by prepare_native.py: real source meshes, no fabricated replacements. */\n'
js+='Object.assign(ZH,'+json.dumps(translations,ensure_ascii=False)+');\n'
js+="Object.assign(SOURCES,{ew:['Horn et al. · 人类 EW 核群与副交感分区','https://pubmed.ncbi.nlm.nih.gov/18186030/'],bp3d:['DBCLS · BodyParts3D 原始数据与许可','https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html'],uw:['University of Washington · 颅底 CT 分割数据','https://hdl.handle.net/1773/46259'],p41:['UCL NextBrain · 原始组织学与 MRI 数据','https://github-pages.ucl.ac.uk/NextBrain/'],nuclei:['UTHealth · 脑神经核与脑干切面','https://nba.uth.tmc.edu/neuroanatomy/L9/Lab09p01_index.html']});\n"
js+="GROUPS.splice(4,0,{id:'nuclei',zh:'源核团与切片核对',en:'Nuclei in source space',color:'#9c85a7'});\n"
for tid,update in updates.items():
    js+='Object.assign(TERMS.find(t=>t.id==='+json.dumps(tid)+'),'+json.dumps(update,ensure_ascii=False)+');\n'
    js+='delete TERMS.find(t=>t.id==='+json.dumps(tid)+').synthetic; delete TERMS.find(t=>t.id==='+json.dumps(tid)+').derived;\n'
for row in additions:js+='add('+','.join(json.dumps(x,ensure_ascii=False) for x in row)+');\n'
js+="delete TERMS.find(t=>t.id==='wernicke').derived; TERMS.find(t=>t.id==='wernicke').note+=' 当前只用完整颞上回与颞平面作定位参照，不再用坐标截取模拟功能边界。';\n"
js+="for(const t of TERMS){if(t.synthetic&&t.view!=='schematic'){t.quality='missing';t.note=t.note.replace(/定位环[^。]*。?/g,'').replace(/定位线[^。]*。?/g,'')+' 本版本没有可核验的独立源边界，因此仅展示已有邻近结构，不再绘制替代形状。';}if(['internal_capsule','anterior_horn','posterior_horn','inferior_horn'].includes(t.derived)){t.quality='missing';t.note+=' 不再使用简单坐标截取模拟独立解剖分割。';}}\n"
js+="for(const t of TERMS.filter(t=>t.group==='nerve'))t.note+=' 几何核查在部分旧骨—神经组合中检出表面相交，不能用该参考模型证明精确穿孔；走行解释与几何精度分别标识。';\n"
js+="TOURS.push({id:'native_deep',zh:'用原始网格核对岛叶与内囊',desc:'同一来源中比较外侧皮层、深部核与内囊',steps:['bp3d_overview','insula','putamen','pallidum','internal_capsule','caudate','thalamus']},{id:'native_nuclei',zh:'逐个核对脑干核团源标签',desc:'同标本核团、白质背景与原始 MRI 切片',steps:['p41_overview','superior_olive','inferior_olive','p41_682','p41_666','p41_724','p41_725','p41_717','p41_721']},{id:'ct_foramina',zh:'检查 CT 孔腔与同源骨面',desc:'骨面 → 圆孔 → 卵圆孔 → 棘孔 → 翼管',steps:['uw_overview','uw_bone','rotundum','ovale','spinosum','vidian']});\n"
(P/'native-content.js').write_text(js,encoding='utf-8')
licenses='NextBrain / UCL / MGH. Data DOI https://doi.org/10.5522/04/24243835.v1, CC0-1.0. P41-16 original source registration retained. Changes: source-label isosurfaces; no smoothing, seam closure, mirroring or inter-atlas registration.\n\n'
licenses+='BodyParts3D, © The Database Center for Life Science (DBCLS). Official archive license https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html is CC BY 4.0 from 2025-02-27. Legacy viewer retains CC BY-SA 2.1 Japan attribution, preserved here as historical source notice. Original OBJ geometry retained; common rigid axis conversion/translation and coordinate quantization only.\n\n'
licenses+=(F/'UW_ATTRIBUTION.txt').read_text(encoding='utf-8')+'\nAdditional change: removed marching-cubes artificial caps at source array crop planes; no change to natural source-label surface vertices. All source-derived components retain their respective licenses; aggregation does not relicense them.\n'
(P/'NATIVE_LICENSES.txt').write_text(licenses,encoding='utf-8')
print(json.dumps({'objects':len(records),'newCourseEntries':len(additions),'evidenceEntries':len(evidence),'spaces':pack_reports},ensure_ascii=True))

