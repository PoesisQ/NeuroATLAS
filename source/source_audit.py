from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parent
paths={
 'nativePacking':'../native-validation.json',
 'sourceSelection':'research-atlas/source-report.json',
 'foraminaAndInsulaResearch':'research-foramina/source-report.json',
 'bodypartsGeometry':'research-foramina/bodyparts3d/bp3d-analysis.json',
 'bodypartsSections':'research-foramina/bodyparts3d/bp3d-section-validation.json',
 'bodypartsLicense':'research-foramina/bodyparts3d/insula-license-recheck.json',
 'existingNerveBoneIntersections':'research-foramina/mesh-analysis.json',
 'uwCTCoordinatesLeft':'research-foramina/uw-ct-validation.json',
 'uwCTCoordinatesRight':'research-foramina/uw-right-ct-validation.json',
 'p41Coordinates':'research-atlas/p41-coordinate-validation.json',
 'v3ContextPacking':'../context-validation.json',
 'v3OfficialContextSources':'research-foramina/bodyparts3d/context-v3/bp2018-full/source-report.json',
 'v3ContextGeometry':'research-foramina/bodyparts3d/context-v3/bp2018-full/geometry-analysis.json',
 'v3BP43ContextGeometry':'research-foramina/bodyparts3d/context-v3/bp43-context/geometry-analysis.json',
}
report={'version':'3.0','date':'2026-10-23','scope':'Provenance, source-space coordinate consistency, original mesh topology, hemisphere labels and limited nerve/bone collision sampling. NativePacking covers the v2 base; v3ContextPacking records additions. Not independent expert anatomical validation.','reports':{},'reportSHA256':{}}
for key,name in paths.items():
 f=P/name;b=f.read_bytes();report['reports'][key]=json.loads(b.decode('utf-8-sig'));report['reportSHA256'][key]=hashlib.sha256(b).hexdigest()
(P.parent/'anatomy-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Saved anatomy-validation.json with '+str(len(paths))+' source reports.')
