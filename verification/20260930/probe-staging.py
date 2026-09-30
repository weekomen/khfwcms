"""Run on the server; report assertions only, never cookies or initial passwords."""
import hashlib
import http.client
import json
import socket
import ssl
from pathlib import Path

def request(path, port=13443, method='GET', payload=None, headers=None):
    conn = http.client.HTTPSConnection('kehoubang.cn', port, context=ssl.create_default_context(), timeout=15)
    conn._create_connection = lambda address, timeout, source_address=None: socket.create_connection(('127.0.0.1', port), timeout)
    conn.request(method, path, body=payload, headers=headers or {})
    res = conn.getresponse()
    result = (res.status, dict(res.getheaders()), res.read())
    conn.close()
    return result

root = Path('/opt/khfwcms/current')
checks = []
for file in (root / 'public').rglob('*'):
    if not file.is_file():
        continue
    route = '/' + str(file.relative_to(root / 'public'))
    status, _, body = request(route)
    assert status == 200, (route, status)
    assert hashlib.sha256(body).digest() == hashlib.sha256(file.read_bytes()).digest(), route
    checks.append(route)
assert '素质教育'.encode() in request('/')[2]
content = json.loads(request('/api/content')[2])
assert len(content['news']) == 2 and len(content['courses']) == 55
for route in ['/app/', '/assets/index.f8fb397d.js', '/profile/upload/pdf/1/index.html', '/profile/upload/pdf/2/index.html']:
    expected = request(route, port=443)
    actual = request(route)
    assert expected[0] == actual[0] == 200, route
    assert hashlib.sha256(expected[2]).digest() == hashlib.sha256(actual[2]).digest(), route
    checks.append(route + ' identical to existing public service')
assert json.loads(request('/cloud/captchaImage')[2])['code'] == 200
assert request('/profile/private-course-resources/probe.pdf')[0] == 404
assert request('/cloud/swagger-ui.html')[0] == 404
assert request('/api/admin/content')[0] == 401
origin = 'https://kehoubang.cn'
initial = Path('/var/lib/khfwcms/admin-token').read_text().strip()
status, headers, body = request('/api/admin/login', method='POST', payload=json.dumps({'password': initial}),
    headers={'Origin': origin, 'Content-Type': 'application/json'})
assert status == 200, status
session = json.loads(body)
assert session['passwordChangeRequired'] is True
cookie = headers['Set-Cookie']
assert 'Secure' in cookie and 'HttpOnly' in cookie and 'SameSite=Strict' in cookie
auth = {'Origin': origin, 'Cookie': cookie.split(';')[0], 'X-CSRF-Token': session['csrfToken']}
assert request('/api/admin/content', headers=auth)[0] == 403
assert request('/api/admin/logout', method='POST', headers=auth)[0] == 200
print(json.dumps({'ok': True, 'staticFilesAndLegacyRoutes': checks, 'news': 2, 'courses': 55,
    'cmsInitialLogin': 'verified; owner password change still required',
    'privateResources': 'blocked', 'swagger': 'blocked'}, ensure_ascii=False, indent=2))
