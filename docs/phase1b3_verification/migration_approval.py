"""Accept only the original 0002 and the owner's exact one-line 0003 revision."""
import hashlib
import json
import subprocess

OLD='0a1693d44a00f043bc066807056754675700138a71d5ad27a9148b589e7f4c51'
NEW='3b8156d1eee07b1e73affde5898d47888b237e579913c785e99a6652eabe9e2c'


def verify_migrations(root):
    approval=json.loads((root/'docs/phase1b3_verification/corrected-migration-approval.json').read_text())
    if (approval['owner_reply']!='Approve corrected hash and fresh disposable tests'
            or approval['original_sha256_utf8_lf']!=OLD or approval['approved_sha256_utf8_lf']!=NEW
            or approval['production_authorized'] or approval['existing_database_patch_authorized']):
        raise RuntimeError('Exact disposable correction approval missing.')
    items=json.loads((root/'docs/phase1b3_static/evidence/schema-manifest.json').read_text())['migrations']
    result={}
    for item in items:
        original=subprocess.check_output(['git','show','30a9a61:'+item['file']],cwd=root).replace(b'\r\n',b'\n')
        if hashlib.sha256(original).hexdigest()!=item['sha256_utf8_lf']:
            raise RuntimeError('Original migration provenance changed.')
        expected=original
        if item['file']==approval['migration']:
            old=b'for sql in SQLITE_TRIGGERS.values(): schema_editor.execute(sql)'
            if original.count(old)!=1 or hashlib.sha256(original).hexdigest()!=OLD:
                raise RuntimeError('Original correction target mismatch.')
            expected=original.replace(old,old[:-1]+b', params=None)')
            if hashlib.sha256(expected).hexdigest()!=NEW:
                raise RuntimeError('Correction is not the reviewed one-line change.')
        current=(root/item['file']).read_text(encoding='utf-8-sig').encode()
        if current!=expected:
            raise RuntimeError('Unreviewed migration change; abort execution.')
        result[item['file']]=hashlib.sha256(current).hexdigest()
    return result
