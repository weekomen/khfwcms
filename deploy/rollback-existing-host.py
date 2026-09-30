"""Restore only the apex routing, preserving CMS data and the new business domain."""
import hashlib
import shutil
import subprocess
import sys
from pathlib import Path

backup = Path(sys.argv[1]).resolve()
site = Path('/etc/nginx/sites-available/edu-feiyue')
assert hashlib.sha256(site.read_bytes()).hexdigest() == (backup / 'apex-after.sha256').read_text().strip(), 'Configuration changed since cutover; review before restoring'
shutil.copy2(site, backup / 'apex-before-rollback')
shutil.copy2(backup / 'apex-before-cutover', site)
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    shutil.copy2(backup / 'apex-before-rollback', site)
    raise
print('Original business homepage restored; CMS data and khb domain retained.')
