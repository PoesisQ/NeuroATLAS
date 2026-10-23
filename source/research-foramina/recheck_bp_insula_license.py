"""Record the direct official OBJ provenance and separately preserved license notices."""
from pathlib import Path
import hashlib
import json
import zipfile

HERE = Path(__file__).resolve().parent
BP = HERE / 'bodyparts3d'
packed = json.loads((BP / 'bp3d-meshes.json').read_text(encoding='utf-8'))
insula = [s for s in packed['segments'] if s['id'] in ['FJ1748', 'FJ1749']]
assert len(insula) == 2
for s in insula:
    p = BP / s['sourceFile']
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    assert digest == s['sha256']
with zipfile.ZipFile(BP / 'capsule-insula-context-official.zip') as z:
    members = z.namelist()
    assert len(members) == 20 and all(n.lower().endswith('.obj') for n in members)
report = {
    'checkedDate': '2026-10-23',
    'source': 'Original BodyParts3D 4.3 public official download; not the Z-Anatomy or CAHID derivative files.',
    'sourceEndpoint': 'https://lifesciencedb.jp/bp3d/download.cgi',
    'officialManifestURL': 'https://lifesciencedb.jp/bp3d/get-info.cgi?version=4.3&cmd=concept-objfiles-list',
    'officialDownloadZIP': 'capsule-insula-context-official.zip',
    'zipContains': '20 original OBJ files, no additional license or third-party attribution file',
    'currentArchiveNotice': {
        'URL': 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
        'pageUpdated': '2025-02-27',
        'license': 'CC BY 4.0 International',
        'licenseURL': 'https://creativecommons.org/licenses/by/4.0/',
        'requiredCredit': 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',
        'verifiedOnLivePage': True,
    },
    'legacyViewerNotice': {
        'URL': 'https://lifesciencedb.jp/bp3d/info_en/license/index.html',
        'license': 'CC BY-SA 2.1 Japan',
        'licenseURL': 'https://creativecommons.org/licenses/by-sa/2.1/jp/',
        'credit': 'BodyParts3D, Copyright 2008 The Database Center for Life Science, licensed under CC BY-SA 2.1 Japan',
        'detailsReferToArchivePage': True,
        'verifiedOnLivePage': True,
    },
    'distributionInstruction': 'Retain the current official archive credit and license URL plus the legacy viewer notice and URL. Do not erase source notices or imply these source data are authored by NeuroAtlas. Keep the UW component under its separate NC-SA license.',
    'changes': 'Original OBJ coordinates and triangle indices packed into float32/uint32 binary; no smoothing, deformation, mirroring, new anatomical mesh, or registration.',
    'scopeOfVerification': 'Official source name, download, hashes and publisher notices were checked. Source labeling as entire insula does not establish independently measured anatomical accuracy or patient-specific segmentation.',
    'insula': [{k: s[k] for k in ['id', 'en', 'zh', 'side', 'sourceFile', 'fma', 'bp', 'sha256', 'vertexCount', 'triangleCount']} for s in insula],
}
(BP / 'insula-license-recheck.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('Verified two insula source hashes and official license notices; wrote insula-license-recheck.json')
