"""Finalize audited metadata without changing source or packed geometry."""
from pathlib import Path
import hashlib,json
HERE=Path(__file__).resolve().parent;OUT=HERE/'bp2018-full'
meta=json.loads((OUT/'meshes.json').read_text(encoding='utf8'))
analysis=json.loads((OUT/'geometry-analysis.json').read_text(encoding='utf8'))
validation=json.loads((OUT/'core-validation.json').read_text(encoding='utf8'))
for rows in [meta['segments'],analysis['segments']]:
    for s in rows:
        mean=s['centroidNativeMm'][0]
        s['sourceSideConflict']=(s['side']=='left' and mean<0) or (s['side']=='right' and mean>0)
        s['recommendedSelectable']=not s['sourceSideConflict'] and not s['overlappingHistoricalRepresentation']
meta['recommendedSelectableIds']=[s['id'] for s in meta['segments'] if s['recommendedSelectable']]
meta['sourceSideConflictIds']=[s['id'] for s in meta['segments'] if s['sourceSideConflict']]
assert meta['sourceSideConflictIds']==['MM3641','MM3641M']
assert not set(meta['sourceSideConflictIds'])&set(meta['recommendedDefaultContextIds'])
validation['sourceSideConflictIds']=meta['sourceSideConflictIds']
validation['allOther203SideMeansMatchSourceSide']=all(s['vertexMeanSideConsistent'] for s in analysis['segments'] if not s['sourceSideConflict'])
validation['sourceSideConflictHandling']='Original source names and vertices retained. Both contradictory Giacomini-band entries are excluded from recommended selection and the default context; no corrective mirror or guessed rename.'
validation['visualInspection']='Three orthographic views inspected after original-face rendering; one continuous source coordinate space and gross bilateral cortical orientation confirmed. This does not certify source anatomical accuracy or absence of inter-surface intersections.'
(OUT/'meshes.json').write_text(json.dumps(meta,ensure_ascii=False),encoding='utf8')
(OUT/'geometry-analysis.json').write_text(json.dumps(analysis,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'core-validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf8')
report={
 'status':'READY','date':'2026-10-23','bundle':'bp2018-full',
 'source':'DBCLS BodyParts3D / Anatomography official version 20181210i412, objects set 20181210, tree FMA4.12.0-inference',
 'officialSource':'https://lifesciencedb.jp/bp3d/',
 'officialObjectMapURL':'https://lifesciencedb.jp/bp3d/get-info.cgi?version=20181210i412&cmd=concept-objfiles-list',
 'sourceObjectCompound':'FMA61820 is_a: all 161 listed cortical objects retained as source inventory; default visibility excludes older overlapping alternatives and internal hippocampal pieces.',
 'coreFiles':['meshes.json','meshes.bin.gz'],
 'objectCount':len(meta['segments']),'vertices':analysis['vertices'],'triangles':analysis['triangles'],'compressedBytes':analysis['compressedBytes'],
 'defaultContextObjectCount':validation['defaultContextObjects'],'defaultContextTriangles':meta['defaultContextTriangleCount'],
 'schema':{'positions':'little-endian float32 xyz, byte offset segment.po, vertexCount vertices','indices':'little-endian uint32 triangle indices, byte offset segment.io, triangleCount triangles',
           'metadata':'segments include id,en,zh,side,role,sceneGroup,sourceFile,sourceVersion,fma,bp,sha256,po,io,vertexCount,triangleCount,bboxNativeMm,centroidNativeMm,coverageNote,defaultContextVisible,recommendedSelectable,sourceSideConflict'},
 'coordinateSystem':{'units':'mm','axes':'+X patient left, +Y posterior, +Z superior','commonNativeCenterMm':meta['nativeCommonBoundingBoxCenterMm'],
                     'displayBasis':meta['recommendedDisplayAxisTransform'],'registrationTo43':None,'rule':'All objects share this native space. Apply only one global display-basis/translation. Preserve this frame during selection and layer opening; never independently recenter anatomical parts.'},
 'keyObjects':{'anteriorTransverseTemporalGyri':['MM3299','MM3299M'],'posteriorTransverseTemporalGyri':['MM3300','MM3300M'],
    'frontalOpercula':['MM3292','MM3292M'],'parietalOpercula':['MM3301','MM3301M'],'orbitalOpercula':['MM3143','MM3143M'],
    'insulaSourceCompoundLeft':['MM3814','MM3815','MM3819','MM3820','MM3821','MM3822'],
    'insulaSourceCompoundRight':['MM3814M','MM3815M','MM3819M','MM3820M','MM3821M','MM3822M'],
    'lateralSulci':['MM3771','MM3771M'],'circularInsularSulci':['MM3398','MM3398M'],
    'extremeCapsules':['MM3351','MM3351M'],'claustra':['MM3360','MM3360M'],'externalCapsules':['MM3355','MM3355M'],
    'putamenProperParts':['MM3271','MM3271M'],'auditoryRadiations':['MM3323','MM3323M']},
 'coverage':[
  {'structure':'Cerebral cortical orientation background','status':'available','note':'124 recommended default objects, 875398 original triangles; composite source gyri, not a newly closed/manifold hemisphere shell.'},
  {'structure':'Heschl-insula-opercula continuity','status':'available-in-one-version','note':'Direct original 2018 atlas coordinates. No 4.3/UW/other-source registration or overlay was performed.'},
  {'structure':'A1 functional/cytoarchitectonic boundary','status':'not-provided','note':'The anatomical transverse temporal gyri are available. Do not paint an arbitrary fraction as exact A1.',
   'primaryReference':'https://pubmed.ncbi.nlm.nih.gov/11305897/','additionalPrimaryReference':'https://pmc.ncbi.nlm.nih.gov/articles/PMC6623669/'},
  {'structure':'Internal capsule','status':'partial','available':['anterior limb','genu','retrolenticular part','sublenticular part'],'missing':['complete posterior limb'],
   'note':'Official FMA72907/FMA72906 compounds contain these four parts. MM3353 posterior thalamolenticular file names exist in global metadata but are unmapped/inactive for this version; MM3358 is labeled a corticospinal tract segment, not a complete posterior limb. Do not infer the missing whole.'},
  {'structure':'Caudate nucleus','status':'partial','available':['body','tail'],'missing':['head'],'note':'Official active compounds FMA72827/FMA72826 map only body and tail. Global unassigned head file names are not active verified 2018 labeled parts.'},
  {'structure':'Putamen','status':'source-proper-part-available','note':'MM3271/M names explicitly say PROPER PART OF putamen. Preserve this source qualifier.'},
  {'structure':'Globus pallidus','status':'named-subparts-available','available':['medial part','lateral part','medial medullary lamina','lateral medullary lamina']},
  {'structure':'Thalamus','status':'excluded-from-core','note':'Official 32 components per side were resolved; original files are quarantined in research-only-thalamus and are absent from meshes.json/bin. No broad deep-nucleus expansion in this delivery.'}
 ],
 'validation':{'all205SourceHashesAndPackedFacesMatch':True,'gzipRoundTrip':True,'allOther203SideMeansMatch':True,
    'sourceSideConflictsExcludedFromRecommendedSelection':['MM3641','MM3641M'],
    'sourceTopologyDefects':validation['sourceMeshTopologyIssuesPreserved'],
    'figure':'../bp2018-whole-cortex-context.png','report':'core-validation.json'},
 'limitations':['Publisher anatomical atlas incorporating anatomical modeling; per-structure acquisition precision or measured segmentation confidence is not supplied.',
               'Default visibility is a documented source-object selection, not certification that every pair of surfaces has zero overlap.',
               'Existing source boundary/nonmanifold edges are retained; no fabricated closing faces or geometric repairs.',
               'Native geometric compatibility is limited to this source version. 2018 and 4.3 insula models differ substantially; no mixed-version fusion.'],
 'license':{'currentOfficialArchive':'CC BY 4.0 International','currentURL':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
            'requiredCredit':'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',
            'legacyViewerNotice':'CC BY-SA 2.1 Japan','legacyURL':'https://lifesciencedb.jp/bp3d/info_en/license/index.html',
            'instruction':'Preserve both publisher notices and links. These are original DBCLS assets, not Z-Anatomy or CAHID derivative downloads.'},
 'files':[{ 'path':name,'bytes':(OUT/name).stat().st_size,'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest()} for name in ['meshes.json','meshes.bin','meshes.bin.gz','geometry-analysis.json','core-validation.json','download-manifest.json']]
}
(OUT/'source-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'ATTRIBUTION.txt').write_text('BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International\nOfficial license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\nLegacy viewer notice retained: BodyParts3D / Database Center for Life Science, CC BY-SA 2.1 Japan\nLegacy notice: https://lifesciencedb.jp/bp3d/info_en/license/index.html\nLegacy license: https://creativecommons.org/licenses/by-sa/2.1/jp/\nSource: official BodyParts3D version 20181210i412 / object set 20181210 / FMA4.12.0-inference\nChanges: original OBJ vertices and faces packed as float32/uint32; named source objects grouped for selection/visibility, bilingual metadata and diagnostics added. No mesh simplification, anatomical reconstruction, fitted registration, or altered source geometry.\n',encoding='utf8')
print(json.dumps({'status':'READY','objects':report['objectCount'],'triangles':report['triangles'],'defaultContextTriangles':report['defaultContextTriangles'],'sourceSideConflictIds':meta['sourceSideConflictIds'],'recommendedSelectableObjects':len(meta['recommendedSelectableIds'])}),flush=True)
