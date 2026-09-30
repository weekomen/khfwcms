"""Render reviewed additions against the saved live site, without touching a host."""
import hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[1]
original = (root / '.local/nginx-before.conf').read_text()
output = root / '.local/rendered'
output.mkdir(exist_ok=True)
needle = 'server {\n    listen 443 ssl http2 default_server;'
assert original.count(needle) == 1
tls = original[original.index(needle):]
assert tls.count('server_name kehoubang.cn www.kehoubang.cn;') == 1
business_tls = tls.replace(' default_server', '').replace(
    'server_name kehoubang.cn www.kehoubang.cn;', 'server_name khb.kehoubang.cn;'
).replace('/etc/nginx/ssl/kehoubang.cn/kehoubang.cn.pem',
          '/etc/letsencrypt/live/khb.kehoubang.cn/fullchain.pem'
).replace('/etc/nginx/ssl/kehoubang.cn/kehoubang.cn.key',
          '/etc/letsencrypt/live/khb.kehoubang.cn/privkey.pem')
business_http = '''server {
    listen 80;
    listen [::]:80;
    server_name khb.kehoubang.cn;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 308 https://khb.kehoubang.cn$request_uri; }
}

'''
(output / 'khb-business').write_text(business_http + business_tls)

proxy = 'include /etc/nginx/snippets/khfwcms-proxy.conf;'
additions = '''    # Company website: all legacy API, H5, profile and document locations remain above.
    location = /api/admin/login {
        client_max_body_size 8k;
        limit_req zone=khfwcms_login burst=5 nodelay;
        limit_req_status 429;
        INCLUDE_PROXY
    }
    location = /api/admin/password {
        client_max_body_size 8k;
        limit_req zone=khfwcms_login burst=5 nodelay;
        limit_req_status 429;
        INCLUDE_PROXY
    }
    location ^~ /api/admin/ {
        client_max_body_size 5m;
        INCLUDE_PROXY
    }
    location = /api/content { INCLUDE_PROXY }
    location = /admin { INCLUDE_PROXY }
    location = / { INCLUDE_PROXY }
    location ^~ /assets/ {
        # Existing hashed business assets have priority. Website name collisions are checked before cutover.
        try_files $uri @khfwcms;
    }
    location @khfwcms {
        client_max_body_size 5m;
        INCLUDE_PROXY
    }
'''.replace('INCLUDE_PROXY', proxy)
for asset in sorted((root / 'public').iterdir()):
    if asset.is_file():
        additions += f'    location = /{asset.name} {{ {proxy} }}\n'
old_root = '    location / {\n        try_files $uri $uri/ /index.html;\n    }'
assert tls.count(old_root) == 1
apex_tls = tls.replace('server_name kehoubang.cn www.kehoubang.cn;', 'server_name kehoubang.cn;')
board_location = '    location ^~ /deployment-board/ {\n'
assert apex_tls.count(board_location) == 1
apex_tls = apex_tls.replace(board_location, board_location + '''        # Keep the existing absolute menu URL in the new business origin.
        if ($http_referer ~ "^https://khb\\.kehoubang\\.cn(?:/|$)") {
            return 302 https://khb.kehoubang.cn$request_uri;
        }
''')
apex_tls = apex_tls.replace(old_root, additions + '''    location / {
        client_max_body_size 5m;
        INCLUDE_PROXY
    }'''.replace('INCLUDE_PROXY', proxy))
www = '''
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.kehoubang.cn;
    ssl_certificate /etc/nginx/ssl/kehoubang.cn/kehoubang.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/kehoubang.cn/kehoubang.cn.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    return 308 https://kehoubang.cn$request_uri;
}
'''
prefix = original[:original.index(needle)]
(output / 'edu-feiyue').write_text(prefix + apex_tls + www)
staging = apex_tls.replace('listen 443 ssl http2 default_server;', 'listen 127.0.0.1:13443 ssl http2;')
staging = staging.replace('    listen [::]:443 ssl http2 default_server;\n', '')
(output / 'khfwcms-staging').write_text(staging)
(output / '60-khfwcms.conf').write_text('limit_req_zone $binary_remote_addr zone=khfwcms_login:10m rate=5r/m;\n')
(output / 'baseline.sha256').write_text(hashlib.sha256(original.encode()).hexdigest() + '\n')
print('Rendered business and website sites; live files unchanged.')
