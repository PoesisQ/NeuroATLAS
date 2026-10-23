from pathlib import Path
import hashlib,json
HERE=Path(__file__).resolve().parent
uw=json.loads((HERE/'uw-label-statistics.json').read_text(encoding='utf-8'))
ct=json.loads((HERE/'uw-ct-validation.json').read_text(encoding='utf-8'))
bp=json.loads((HERE/'bodyparts3d/bp3d-analysis.json').read_text(encoding='utf-8'))
old=json.loads((HERE/'mesh-analysis.json').read_text(encoding='utf-8'))
report={
 'date':'2026-10-23','purpose':'Source-only additions for educational offline NeuroAtlas; no guessed foraminal rings or fitted anatomy',
 'conclusions':[
  'Original existing skeletal.glb contains whole source bone meshes, no independently labeled bony foramen rim objects.',
  'Existing bone-nerve mesh pairings contain detected surface intersections in several coarse foraminal inspection windows. Do not certify exact nerve passage from those meshes.',
  'UW provides author-segmented bilateral foramen ovale/rotundum/spinosum and vidian canal volume labels with bone from a 6-subject synthetic CT template. These are volume-label boundaries, not separately traced bony rims.',
  'DBCLS official 4.3 download provides source-labeled bilateral entire insula and internal capsule, with same-source basal/deep nuclei and selected cortical neighbors.',
  'The two additions must be independent source coordinate spaces unless an explicit, validated registration is available. No registration/deformation was applied here.',
  'No dataset located in this bounded research establishes a completely error-free, complete skull-base rim and all-nerve/course atlas.'
 ],
 'candidates':[
  {'id':'uw-skullbase','status':'downloaded-and-extracted','title':'Automated atlas-based segmentation for skull base surgical planning',
   'authors':['Neeraja Konuthula','Francisco A. Perez','A. Murat Maga','Waleed M. Abuzeid','Kris Moe','Blake Hannaford','Randall A. Bly'],
   'datasetURL':'https://hdl.handle.net/1773/46259','resolvedURL':'https://digital.lib.washington.edu/researchworks/items/2b0f0e1e-ae81-4bf8-9b79-8dc6872b5ecc',
   'paperURL':'https://pubmed.ncbi.nlm.nih.gov/34009539/','doi':'10.1007/s11548-021-02390-5',
   'license':'CC BY-NC-SA 3.0 United States','licenseURL':'https://creativecommons.org/licenses/by-nc-sa/3.0/us/',
   'licenseEvidenceFile':'uw-item-metadata.json','sourceType':'6-subject synthetic CT template; manual reference segmentation agreed on by otolaryngologist and neuroradiologist per paper',
   'nativeSpace':'Segmentation RAS / CT LPS; convert CT physical coordinates by diag(-1,-1,1) only',
   'segmentationSpacingMm':uw['voxelSpacingMm'],'segmentationIJKToRAS':uw['ijkToRAS'],'ctIJKToRAS':ct['ctIJKToRAS'],
   'geometry':'uw-meshes.json + uw-meshes.bin.gz','geometryMethod':uw['surfaceExtraction'],
   'downloadedOriginals':['uw-segmentation.seg.nrrd','uw-template.nrrd','uw-readme.txt'],
   'validation':['Eight source-CT overlay figures for left and right foramen ovale, spinosum, rotundum and vidian canal. No registration fitted.',
     'Every labeled voxel samples within CT physical extent; finite CT intensity fractions equal 1.0 for all 14 segments.',
     'Foramina ovale, rotundum and spinosum each have two nonempty connected components consistent with left and right; vidian canal has two large components plus a one-voxel island.',
     'All original small islands are retained. No segmentation cleanup or anatomical repair was applied.'],
   'limits':['Small foramina have few source voxels and 1.25 mm through-plane label resolution. Polygon precision does not improve that resolution.',
     'The paper reports less favorable transferred segmentation usability for foramen rotundum/spinosum; this is not an error-free atlas.',
     'No independently labeled true osseous rim, no explicit completeness guarantee for full canal length.',
     'Bone label is cropped anterior skull-base/fossa anatomy, not a whole skull. Marching-cubes closes label regions at array crop boundaries, which are computational cut faces and must not be labeled natural bone surface.',
     'It does not include jugular foramen, hypoglossal canal, internal acoustic meatus, stylomastoid foramen, foramen magnum or superior orbital fissure as separate labels.',
     'No mandibular/maxillary nerves labeled, so this source cannot independently prove V3/V2 passage.'],
   'segments':[{'index':s['index'],'en':s['en'],'zh':s['zh'],'role':s['role'],'components':len(s['components']),'voxels':s['voxelCount']} for s in uw['segments']]},
  {'id':'dbcls-bp3d','status':'downloaded-and-extracted','title':'BodyParts3D / Anatomography 4.3 official source meshes',
   'sourceURL':'https://lifesciencedb.jp/bp3d/','downloadEndpoint':'https://lifesciencedb.jp/bp3d/download.cgi',
   'officialManifestEndpoint':'https://lifesciencedb.jp/bp3d/get-info.cgi?version=4.3&cmd=concept-objfiles-list',
   'license':'Official archive: CC BY 4.0 (updated 2025-02-27); legacy viewer notices: CC BY-SA 2.1 Japan',
   'licenseURL':'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
   'attribution':'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Legacy BodyParts3D notices retained.',
   'space':bp['axes'],'unit':'mm','geometry':'bodyparts3d/bp3d-meshes.json + bodyparts3d/bp3d-meshes.bin.gz',
   'geometryMethod':'Unmodified original OBJ positions and triangles packed as float32/uint32. No smoothing, simplification, mirror or fit.',
   'sourceType':bp['sourceType'],'validation':bp['grossRelationshipChecks'],'limits':bp['limits'],
   'specificCaveat':'Left thalamus reaches X=-0.092 mm, crossing approximate world midline slightly; its centroid and bulk are left. No mirroring correction was applied.',
   'missingOriginalElements':['claustrum','external capsule','extreme capsule','circular sulcus of insula','separately labeled insular long/short gyri','separately labeled internal-capsule limbs'],
   'sourceGeometryCount':len(bp['segments'])},
  {'id':'cahid-cranial','status':'reference-only-already-upstream','title':'Cranial Nerves and Foramina',
   'sourceURL':'https://sketchfab.com/3d-models/cranial-nerves-and-foramina-a9358ee7a6dd4ea18a3622114405a4c7',
   'author':'Sophia Lappe / University of Dundee CAHID','sourceType':'Anatomical model based on BodyParts3D, as stated by author',
   'licenseEvidence':'Existing Z_ANATOMY_LICENSE.txt credits CC BY 4.0; current Sketchfab page displays NoAI tag and no directly accessible original download in research tools.',
   'decision':'No new model bytes downloaded. Existing attribution retained. This is not independent evidence of CT-derived precise rim geometry.'},
  {'id':'cahid-microct','status':'candidate-not-downloaded','title':'Transverse section of calvarium',
   'sourceURL':'https://sketchfab.com/3d-models/transverse-section-of-calvarium-15ae80638f7d4f0d82fff13728ebb6be',
   'author':'University of Dundee CAHID','sourceType':'Author states micro-CT of adult male skull; 605.7k triangles',
   'limits':['Different specimen and coordinate space','No cranial-foramen label set verified','Original download and redistribution license not independently verified'],
   'decision':'Not bundled; potentially useful future evidence if original download/license obtained.'},
  {'id':'stanford-dissection','status':'candidate-reference-only','sourceURL':'https://med.stanford.edu/neurosurgery/research/SNFTVR_Lab/models.html',
   'sourceType':'Official Stanford models based on photogrammetry from dissections',
   'decision':'No original mesh download/redistribution rights confirmed; not bundled, no fabricated registration.'}
 ],
 'perExistingForamen':[{'id':x['id'],'zh':x['zh'],'side':x['side'],'status':x['status'],'collisionLocationCountCappedAt10':len(x['collisionLocations']),'rimStatus':x['rimStatus']} for x in old['items']],
 'followupVerification': {
  'foramenComponentSides':'uw-side-components.json: original mesh connected components; no face or vertex change; septum centroid is a coarse side reference, not a fitted anatomical midsagittal plane.',
  'rightCTEvidence':'uw-right-ct-validation.json: exact source voxel centroids, original CT and label affines, three planes per right structure.',
  'insulaLicense':'bodyparts3d/insula-license-recheck.json: direct official OBJ provenance, SHA256 checks, current archive and legacy viewer notices retained.'
 },
 'files':[]
}
for p in sorted(HERE.rglob('*')):
 if not p.is_file() or p.name=='source-report.json' or p.suffix in ['.pyc']:continue
 report['files'].append({'path':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(HERE/'source-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(HERE/'UW_ATTRIBUTION.txt').write_text('University of Washington ResearchWorks\nKonuthula N, Perez FA, Maga AM, Abuzeid WM, Moe K, Hannaford B, Bly RA. Automated atlas-based segmentation for skull base surgical planning.\nDataset: https://hdl.handle.net/1773/46259\nPaper: https://doi.org/10.1007/s11548-021-02390-5\nLicense: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 United States\nLicense URL: https://creativecommons.org/licenses/by-nc-sa/3.0/us/\nChanges: original binary labelmap surfaces extracted using marching cubes without smoothing or decimation; source CT interpolated for explicitly labeled verification slices. No registration, invented anatomy, cleanup or patient-specific representation.\nUse and redistribute these source-derived components under the stated noncommercial share-alike terms; these components are not relicensed as MIT or CC BY.\n',encoding='utf-8')
print('source-report.json written')
