"""Create the asset manifest, checksums and delivery ZIP. Standard library only."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parent.parent
entries=[]
for file in sorted(ROOT.rglob('*')):
    if file.is_file() and file.name not in ('MANIFEST.json','CHECKSUMS.sha256'):
        data=file.read_bytes()
        entries.append({'file':str(file.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
identity=json.loads((ROOT/'source/identity.json').read_text())
manifest={'brand':'Pibbl','identity':'Original Tangram','version':identity['version'],'date':identity['date'],
          'fileCountExcludingManifestAndChecksums':len(entries),
          'formats':dict(Counter(Path(e['file']).suffix for e in entries)),'files':entries}
(ROOT/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'CHECKSUMS.sha256').write_text(''.join(f"{e['sha256']}  {e['file']}\n" for e in entries))
archive=ROOT.parent/'pibbl-tangram-logo-kit.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for file in sorted(ROOT.rglob('*')):
        if file.is_file():z.write(file,str(Path(ROOT.name)/file.relative_to(ROOT)))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(entries)+2
    for e in entries:assert hashlib.sha256(z.read(ROOT.name+'/'+e['file'])).hexdigest()==e['sha256']
print(json.dumps({'archive':str(archive),'files':len(entries)+2,'bytes':archive.stat().st_size,'integrity':'passed'},indent=2))
