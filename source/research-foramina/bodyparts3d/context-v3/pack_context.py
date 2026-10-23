"""Pack original triangular source meshes. No anatomy synthesis or fitted transform."""
from pathlib import Path
import gzip,hashlib,json,re,sys
import numpy as np
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]))
from analyze_bp3d import parse_obj,topology

ZH={'angular gyrus':'角回','middle temporal gyrus':'颞中回','inferior temporal gyrus':'颞下回',
    'superior frontal gyrus':'额上回','superior parietal lobule':'顶上小叶','precuneus':'楔前叶',
    'anterior orbital gyrus':'眶前回','lateral orbital gyrus':'眶外侧回','medial orbital gyrus':'眶内侧回',
    'posterior orbital gyrus':'眶后回','straight gyrus':'直回','cingulate gyrus':'扣带回','cuneus':'楔叶',
    'fusiform gyrus':'梭状回','lateral occipital gyrus':'枕外侧回','lingual gyrus':'舌回',
    'parahippocampal gyrus':'海马旁回','superior occipital gyrus':'枕上回',
    'superior temporal gyrus':'颞上回','anterior transverse temporal gyrus':'前颞横回（Heschl 回）',
    'posterior transverse temporal gyrus':'后颞横回','frontal operculum':'额岛盖',
    'parietal operculum':'顶岛盖','orbital operculum':'眶岛盖','lateral sulcus':'外侧沟',
    'central insular sulcus':'岛叶中央沟','accessory short gyrus':'岛叶副短回',
    'posterior short insular gyrus':'岛叶后短回','middle short insular gyrus':'岛叶中短回',
    'anterior short insular gyrus':'岛叶前短回','anterior long insular gyrus':'岛叶前长回',
    'posterior long insular gyrus':'岛叶后长回','planum temporale (pt)':'颞平面','planum polare (pp)':'颞极平面'}
IDZH={'MM3398':'岛叶环状沟','MM3811':'岛叶极','MM3287':'岛叶尖'}
ZH.update({'paraterminal gyrus':'旁终回','presubiculum':'前下托','subiculum':'下托',
    'fasciolar gyrus':'束状回','fasciola cinerea':'灰束','paracentral lobule':'中央旁小叶',
    'supramarginal gyrus':'缘上回','precentral gyrus':'中央前回','postcentral gyrus':'中央后回',
    'middle frontal gyrus':'额中回','inferior frontal gyrus':'额下回','anterior cingulate gyrus':'前扣带回',
    'posterior cingulate gyrus':'后扣带回','anterior middle cingulate gyrus':'前中扣带回',
    'posterior middle cingulate gyrus':'后中扣带回','inferior occipital gyrus':'枕下回',
    'medial frontal gyrus':'额内侧回','frontomarginal gyrus':'额缘回',
    'superior transverse frontopolar gyrus':'额极上横回','middle transverse frontopolar gyrus':'额极中横回',
    'inferior transverse frontopolar gyrus':'额极下横回','gyrus descendens of ecker':'Ecker 降回',
    'gyrus uncinatus':'钩回','band of giacomini':'Giacomini 带','anterior accessory gyrus':'岛叶前副回',
    'first posterior central gyrus':'第一后中央回（源名称）','second posterior central gyrus':'第二后中央回（源名称）',
    'first short gyrus of insula':'岛叶第一短回（旧表示）','second short gyrus of insula':'岛叶第二短回（旧表示）',
    'intermediate short gyrus of insula':'岛叶中间短回（旧表示）','ca1 field':'CA1 区','ca2 field':'CA2 区',
    'ca3 field':'CA3 区','ca4 field':'CA4 区','dentate gyrus of hippocampus':'海马齿状回',
    'body of caudate nucleus':'尾状核体','tail of caudate nucleus':'尾状核尾',
    'lateral globus pallidus':'苍白球外侧部','medial globus pallidus':'苍白球内侧部',
    'medial medullary lamina of globus pallidus':'苍白球内髓板','lateral medullary lamina of globus pallidus':'苍白球外髓板',
    'sublenticular part of internal capsule':'内囊豆状核下部','retrolenticular part of internal capsule':'内囊豆状核后部',
    'genu of internal capsule':'内囊膝','anterior limb of internal capsule':'内囊前肢',
    'external capsule':'外囊','extreme capsule':'最外囊','claustrum':'屏状核','auditory radiation':'听辐射','putamen':'壳核',
    'proper part of putamen':'壳核主体（源标注 proper part）',
    'apex of uncus':'钩尖','anterior segment of uncus':'钩前段','isthmus of cingulate gyrus':'扣带回峡部'})
OLD_OVERLAPS={'CX229','FJ1837','FJ1838','FJ1839','FJ1840','MM232','MM232M','MM233','MM233M','MM235','MM235M','MM236','MM236M','MM237','MM237M'}
def translate(en,objid):
    base=re.sub(r'\b(left|right)\b\s*','',en,flags=re.I).strip().lower()
    if objid.removesuffix('M') in IDZH:return IDZH[objid.removesuffix('M')]
    if base in ZH:return ZH[base]
    for kind,zhkind in [('part','部'),('segment','段')]:
        m=re.match(r'(anterior|posterior|middle|dorsal|ventral|temporal|occipital|opercular|orbital|triangular|inferior|superior) '+kind+r' of (.*)',base)
        if m:
            descriptor={'anterior':'前','posterior':'后','middle':'中','dorsal':'背侧','ventral':'腹侧','temporal':'颞','occipital':'枕','opercular':'盖','orbital':'眶','triangular':'三角','inferior':'下','superior':'上'}[m[1]]
            return ZH.get(m[2],m[2])+descriptor+zhkind
    return base
existing=json.loads((HERE.parent/'bp3d-meshes.json').read_text(encoding='utf8'))
axes=[[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]]
bundles=[]
for name in (sys.argv[1:] or ['bp43-context','bp2018-perisylvian']):
    out=HERE/name
    manifest=json.loads((out/'download-manifest.json').read_text(encoding='utf8'))
    sources={r['id']:r for r in manifest['sourceRows']}
    binary=[];offset=0;segments=[];stats=[];allv=[]
    for path in sorted(out.glob('*.obj')):
        objid,bpid,fmaid,en=path.stem.split('_',3)
        v,f,pc=parse_obj(path);allv.append(v)
        source=sources[objid]
        # Publisher's actual returned OBJ names/IDs are authoritative for this file.
        side='left' if re.search(r'\bleft\b',en,re.I) else 'right' if re.search(r'\bright\b',en,re.I) else 'unknown'
        zh=translate(en,objid)
        zh=('左侧' if side=='left' else '右侧' if side=='right' else '')+zh
        n=en.lower()
        role='source-sulcus-model' if 'sulcus' in n else 'white-matter-atlas' if any(x in n for x in ['capsule','radiation','medullary lamina']) else 'deep-grey-atlas' if any(x in n for x in ['caudate','globus pallidus','putamen','claustrum']) else 'cortical-context'
        medial=any(x in n for x in ['hippocamp','subiculum','ca1 field','ca2 field','ca3 field','ca4 field','uncus','uncinatus','fasciola','fasciolar','giacomini'])
        sceneGroup='sulci' if role=='source-sulcus-model' else 'white-matter' if role=='white-matter-atlas' else 'deep-nuclei' if role=='deep-grey-atlas' else 'insula' if ('insula' in n or objid.removesuffix('M')=='MM3814') else 'opercula' if 'operculum' in n else 'hippocampal-cortex' if medial else 'cortex'
        defaultVisible=role=='cortical-context' and not medial and objid not in OLD_OVERLAPS and objid.removesuffix('M') not in ['MM3287','MM3811']
        sourceSideConflict=(side=='left' and float(v[:,0].mean())<0) or (side=='right' and float(v[:,0].mean())>0)
        po=offset;data=v.tobytes();binary.append(data);offset+=len(data)
        io=offset;data=f.tobytes();binary.append(data);offset+=len(data)
        meta={'index':len(segments),'id':objid,'sourceFile':path.name,'en':en,'zh':zh,'side':side,'role':role,
              'bp':bpid,'fma':fmaid,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
              'sourceVersion':manifest['version'],'originalName':source['originalName'],'originalGroup':source['originalGroup'],
              'sceneGroup':sceneGroup,'defaultContextVisible':defaultVisible,'overlappingHistoricalRepresentation':objid in OLD_OVERLAPS,
              'sourceSideConflict':sourceSideConflict,'recommendedSelectable':not sourceSideConflict and objid not in OLD_OVERLAPS,
              'coverageNote':('Anatomical transverse temporal gyrus, not an independently mapped A1 functional/cytoarchitectonic boundary.' if 'transverse temporal gyrus' in n else
                              'Source-labeled sulcus geometry; no independently measured sulcal wall/boundary accuracy is supplied.' if role=='source-sulcus-model' else
                              'One named internal-capsule subdivision. The core collection does not contain a complete posterior limb; do not label the union as the complete internal capsule.' if 'internal capsule' in n else
                              'One named caudate subdivision. The core collection lacks the caudate head; do not label the body/tail union as the complete caudate.' if 'caudate' in n else
                              'Source explicitly names this PROPER PART OF putamen; retain the limited source label rather than claiming an independently complete boundary.' if 'proper part of' in n else ''),
              'vertexCount':len(v),'triangleCount':len(f),'bboxNativeMm':[v.min(0).tolist(),v.max(0).tolist()],
              'centroidNativeMm':v.mean(0).tolist(),'po':po,'io':io}
        segments.append(meta)
        stats.append({**meta,'dimensionsMm':(v.max(0)-v.min(0)).tolist(),'sourcePolygonSizes':pc,'topology':topology(v,f),
                      'vertexMeanSideConsistent':bool(v[:,0].mean()>0) if side=='left' else bool(v[:,0].mean()<0) if side=='right' else None,
                      'signedSurfaceVolumeMm3':float(np.einsum('ij,ij->i',v[f[:,0]],np.cross(v[f[:,1]],v[f[:,2]])).sum()/6)})
    allv=np.concatenate(allv);raw=b''.join(binary)
    (out/'meshes.bin').write_bytes(raw);(out/'meshes.bin.gz').write_bytes(gzip.compress(raw,9,mtime=0))
    for s in segments:
        v,f,_=parse_obj(out/s['sourceFile'])
        assert np.array_equal(v,np.frombuffer(raw,dtype='<f4',count=s['vertexCount']*3,offset=s['po']).reshape(-1,3))
        assert np.array_equal(f,np.frombuffer(raw,dtype='<u4',count=s['triangleCount']*3,offset=s['io']).reshape(-1,3))
    meta={'space':'BodyParts3D '+manifest['version']+': +X left,+Y posterior,+Z superior','unit':'mm',
          'sourceVersion':manifest['version'],'recommendedDisplayAxisTransform':axes,
          'registrationToExistingAtlas':None,
          'sharesNativeSourceCoordinatesWithExistingBP43':name=='bp43-context',
          'displayCenterInstruction':'Use one common display basis and translation for every object in each version. Do not independently recenter parts. The 2018 source space has no validated registration to 4.3.',
          'existingBP43CommonBoundingBoxCenterMm':existing['nativeCommonBoundingBoxCenterMm'],
          'bundleBoundingBoxNativeMm':[allv.min(0).tolist(),allv.max(0).tolist()],
          'nativeCommonBoundingBoxCenterMm':((allv.min(0)+allv.max(0))/2).tolist(),
          'defaultContextTriangleCount':sum(s['triangleCount'] for s in segments if s['defaultContextVisible']),
          'recommendedDefaultContextIds':[s['id'] for s in segments if s['defaultContextVisible']],
          'availableObjectIds':[s['id'] for s in segments],
          'recommendedSelectableIds':[s['id'] for s in segments if s['recommendedSelectable']],
          'missingMajorStructures':['Complete internal-capsule posterior limb','Caudate head','Thalamus excluded from this bounded core package'] if name=='bp2018-full' else [],
          'segments':segments}
    (out/'meshes.json').write_text(json.dumps(meta,ensure_ascii=False),encoding='utf8')
    report={'bundle':name,'sourceVersion':manifest['version'],'sourceCoordinatesPreserved':True,
            'meshMutation':'None except numeric storage as float32/uint32; no welding, decimation, smoothing, deformation, cuts, mirroring or registration.',
            'validation':'Source index range/finiteness, triangle-only input, exact packed data round-trip and per-object topology/side statistics.',
            'sourceType':'Publisher anatomical atlas models; not a newly verified patient MRI segmentation or a functional-area measurement.',
            'objects':len(segments),'vertices':sum(s['vertexCount'] for s in segments),
            'triangles':sum(s['triangleCount'] for s in segments),'compressedBytes':(out/'meshes.bin.gz').stat().st_size,
            'binarySha256':hashlib.sha256(raw).hexdigest(),'segments':stats}
    (out/'geometry-analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    bundles.append({k:report[k] for k in ['bundle','sourceVersion','objects','vertices','triangles','compressedBytes','binarySha256']})
    print(json.dumps(bundles[-1]),flush=True)
(HERE/'bundle-summary.json').write_text(json.dumps(bundles,indent=2),encoding='utf8')
