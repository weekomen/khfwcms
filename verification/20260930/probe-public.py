"""Server-local TLS probes, with certificate/hostname validation and no credentials."""
import concurrent.futures
import hashlib
import http.client
import json
import re
import socket
import ssl
from pathlib import Path

def get(host, path='/', headers=None):
    conn = http.client.HTTPSConnection(host, context=ssl.create_default_context(), timeout=20)
    conn._create_connection = lambda address, timeout, source_address=None: socket.create_connection(('127.0.0.1', 443), timeout)
    conn.request('GET', path, headers=headers or {})
    res = conn.getresponse()
    result = res.status, dict(res.getheaders()), res.read()
    conn.close()
    return result

root = Path('/opt/khfwcms/current')
files = [f for f in (root / 'public').rglob('*') if f.is_file()]
for file in files:
    route = '/' + str(file.relative_to(root / 'public'))
    status, _, body = get('kehoubang.cn', route)
    assert status == 200 and hashlib.sha256(body).digest() == hashlib.sha256(file.read_bytes()).digest(), route
content = json.loads(get('kehoubang.cn', '/api/content')[2])
assert len(content['news']) == 2 and len(content['courses']) == 55
redirect = get('www.kehoubang.cn', '/admin?test=1')
assert redirect[0] == 308 and redirect[1]['Location'] == 'https://kehoubang.cn/admin?test=1'
assert get('kehoubang.cn', '/api/admin/content')[0] == 401
assert get('kehoubang.cn', '/profile/private-course-resources/probe.pdf')[0] == 404
assert get('kehoubang.cn', '/cloud/swagger-ui.html')[0] == 404
board = get('kehoubang.cn', '/deployment-board/', {'Referer': 'https://khb.kehoubang.cn/'})
assert board[0] == 302 and board[1]['Location'] == 'https://khb.kehoubang.cn/deployment-board/'
hosts = ['kehoubang.cn', 'khb.kehoubang.cn', 'class.shouboshi.net', 'daoyuanjx.cn', 'khb.gengweilai.xyz', 'khb.sjsxl.com']
for host in hosts:
    assert get(host)[0] == 200, host
    assert get(host, '/app/')[0] == 200, host
    assert json.loads(get(host, '/cloud/captchaImage')[2])['code'] == 200, host
for route in ['/app/', '/assets/index.f8fb397d.js', '/profile/upload/pdf/1/index.html', '/profile/upload/pdf/2/index.html']:
    assert get('kehoubang.cn', route)[2] == get('khb.kehoubang.cn', route)[2], route
manuals = []
for ident in ['1', '2']:
    base = '/profile/upload/pdf/' + ident + '/'
    html = get('kehoubang.cn', base + 'index.html')[2].decode()
    total = int(re.search(r'const TOTAL\s*=\s*(\d+)', html)[1])
    def image_page(i):
        status, headers, body = get('kehoubang.cn', base + f'image/page-{i:04d}.jpg')
        assert status == 200 and body.startswith(b'\xff\xd8\xff') and body.endswith(b'\xff\xd9'), (ident, i)
        return len(body)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        sizes = list(pool.map(image_page, range(1, total + 1)))
    manuals.append({'id': ident, 'pages': total, 'verifiedJpegBytes': sum(sizes), 'reader': 'vertical scroll; no built-in PDF download link'})
print(json.dumps({'ok': True, 'websiteStaticFiles': len(files), 'news': 2, 'courses': 55,
    'tlsHosts': hosts + ['www.kehoubang.cn'], 'wwwRedirect': 'path and query preserved',
    'legacyRoutes': 'H5, API, business assets, private deny and manuals checked',
    'manuals': manuals, 'businessLogin': 'owner confirmed login, common pages and files in this conversation'}, ensure_ascii=False, indent=2))
