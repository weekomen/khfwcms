"""Run on the reviewed host with the private deployment backup directory as argv[1]."""
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

backup = Path(sys.argv[1]).resolve()
site = Path('/etc/nginx/sites-available/edu-feiyue')
candidate = backup / 'rendered/edu-feiyue'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(site) == (backup / 'rendered/baseline.sha256').read_text().strip(), 'Live configuration changed; review again'
assert not (backup / 'apex-before-cutover').exists(), 'Cutover already attempted; inspect before retrying'
subprocess.run(['nginx', '-t'], check=True)
shutil.copy2(site, backup / 'apex-before-cutover')
try:
    shutil.copy2(candidate, site)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    for attempt in range(10):
        response = subprocess.run(['curl', '-fsS', '--max-time', '8', '--resolve',
            'kehoubang.cn:443:127.0.0.1', 'https://kehoubang.cn/api/content'], capture_output=True)
        try:
            content = json.loads(response.stdout)
            assert len(content['news']) == 2 and len(content['courses']) == 55
            break
        except (ValueError, KeyError, AssertionError):
            if attempt == 9:
                raise RuntimeError('Website content probe failed')
            time.sleep(1)
    (backup / 'apex-after.sha256').write_text(sha(site) + '\n')
    print('CUTOVER_OK: published content has 2 news and 55 courses')
except Exception:
    shutil.copy2(backup / 'apex-before-cutover', site)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    print('ROLLED_BACK: original apex configuration restored')
    raise
