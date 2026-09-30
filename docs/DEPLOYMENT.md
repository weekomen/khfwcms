# 课后邦官网部署与运维手册

本手册交付可执行的配置与操作步骤，**不表示 DNS、服务器或证书已实际配置完成**。采用 Ubuntu 24.04 LTS、Node.js 24 LTS、Nginx、systemd 单进程；其他发行版需调整软件安装和配置目录。本仓库没有数据库、第三方运行依赖或前端构建步骤，不需要 `npm ci`。

## 1. 域名与系统边界

| 地址 | 用途 | 实现 |
| --- | --- | --- |
| `https://kehoubang.cn` | 官网主站 | Nginx → 本机 `127.0.0.1:3000` |
| `https://www.kehoubang.cn` | 官网别名 | 308 跳转裸域，保留路径和查询参数 |
| `https://kehoubang.cn/admin` | 本项目 CMS 后台 | 与官网同源，使用独立管理员密码 |
| `https://khb.kehoubang.cn` | 独立课后邦业务系统 | 另行部署，与本 CMS 的进程、数据及登录无关 |

`khb` 是用户确认的独立业务系统。本交接包不含其源码，不知道其实际服务器、应用端口、数据库或发布流程，也不会把该域名代理到官网的 3000 端口。该系统负责人应单独完成其域名、证书及应用发布。官网证书和配置不依赖 `khb` 的上线状态。

官网统一使用裸域：当前认证只接受一个 `PUBLIC_ORIGIN`，不要填写逗号分隔的多个域名，也不要通过篡改浏览器 `Origin` 来兼容 www 登录。管理员从主域 `/admin` 进入。

## 2. 上线前准备与 DNS

准备官网服务器公网 IP、服务器 SSH 权限、域名 DNS 管理权限、证书通知邮箱，以及负责保管 CMS 密码和私有数据的接手人。以下 IP 都需填写实际值，文档不提供或猜测生产 IP。

| DNS 主机记录 | 类型 | 记录值 | 负责人 |
| --- | --- | --- | --- |
| `@` | A | 官网服务器 IPv4 | 官网运维 |
| `www` | CNAME | `kehoubang.cn` | 官网运维 |
| `khb` | A，或服务商指定的 CNAME | 独立业务系统的服务器/接入地址 | 业务系统运维 |

只有服务器确实支持 IPv6 时才添加对应 AAAA；删除或纠正指向旧主机的 AAAA，避免部分访客或证书验证访问错误服务器。不要创建将全部子域名送入官网的通配符反代。若使用 CDN，先按服务商说明完成回源 HTTPS 和可信代理配置；本模板按浏览器直接访问 Nginx 编写，没有配置 CDN 真实 IP 信任。

官网防火墙和云安全组开放 TCP 80、443；SSH 仅向运维来源开放。不要开放 3000。若服务器已有其他网站，先备份 Nginx 配置，不能覆盖或删除它们的站点。本文只安装名为 `khfwcms` 的站点和服务。

核对 DNS（结果需与实际服务器一致；若没有 `dig`，先完成第 3 节的 `dnsutils` 安装）：

```bash
dig +short kehoubang.cn A
dig +short www.kehoubang.cn CNAME
dig +short kehoubang.cn AAAA
dig +short khb.kehoubang.cn A
```

### 已有域名的切换顺序

若裸域目前承载旧站或业务系统，先记录旧 DNS 值、TTL、站点配置和需要保留的路径，与两套系统负责人安排维护窗口。先在新服务器安装官网、迁移内容及下文的在线手册，再切换 @ / www；`khb` 的变更由独立系统负责人按自己的发布步骤实施，并核对登录回调、接口地址和文件链接。不要把整套旧业务的上传目录公开给新官网。

如已能在新入口安装有效官网证书，可在改 DNS 前使用第 8 节的 `curl --resolve` 和测试电脑 hosts 检查新入口；否则本手册的 HTTP webroot 签发需要 @ / www 先到新服务器，应在维护窗口执行，首次签发期间官网返回临时 503。需要无停机切换时，应由运维提前通过服务商支持的 DNS 验证等方式准备证书。新官网、三份资料和独立系统完成各自验收前保留旧服务器与回退记录，验证失败时恢复对应旧 DNS/入口配置。

## 3. 安装运行环境

在新的 Ubuntu 服务器执行；若已安装受维护的 Node.js 24 和 Nginx，可核对版本、路径后跳过相应安装。更新已有服务器的软件前遵循该服务器的维护流程。

```bash
sudo apt update
sudo apt install -y nginx certbot unzip ca-certificates curl xz-utils dnsutils
```

Node.js 20 已结束官方维护，新部署选择 Node.js 24 LTS。下面从 Node.js 官方下载当前 24.x 的 Linux 包，并校验 SHA-256；支持 x86_64 和 aarch64。

```bash
mkdir -p "$HOME/khfwcms-install"
cd "$HOME/khfwcms-install"
case "$(uname -m)" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64) NODE_ARCH=arm64 ;;
  *) echo '请从 Node.js 官方选择适合此架构的发行包'; exit 1 ;;
esac
curl -fSLo SHASUMS256.txt https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
NODE_ARCHIVE=$(awk -v arch="$NODE_ARCH" '$2 ~ ("^node-v24\\.[0-9]+\\.[0-9]+-linux-" arch "\\.tar\\.xz$") { print $2 }' SHASUMS256.txt)
test -n "$NODE_ARCHIVE" || exit 1
curl -fSLO "https://nodejs.org/dist/latest-v24.x/$NODE_ARCHIVE"
awk -v file="$NODE_ARCHIVE" '$2 == file' SHASUMS256.txt | sha256sum -c - || exit 1
# 校验失败时停止，不解压。
sudo tar -xJf "$NODE_ARCHIVE" -C /opt
sudo ln -s "/opt/${NODE_ARCHIVE%.tar.xz}/bin/node" /usr/local/bin/node
sudo ln -s "/opt/${NODE_ARCHIVE%.tar.xz}/bin/npm" /usr/local/bin/npm
/usr/local/bin/node --version
command -v node
```

如果 `/usr/local/bin/node` 或 npm 已存在，`ln -s` 会失败；不要盲目强制覆盖，核对现有安装。服务模板的 `ExecStart` 使用 `/usr/local/bin/node`，需要与实际路径一致。不要让 systemd 依赖交互式 shell 的 nvm 配置。

## 4. 导入源码与核验交接包

交接文件为同一提交的 ZIP、`.zip.sha256` 和清单。将 ZIP 与 SHA 文件上传到仅接手人可访问的工作目录，文件名中的提交标识以本次实际交付为准。

```bash
cd "$HOME/khfwcms-install"
sha256sum -c khfwcms-handover-xxxxxxxxxxxx.zip.sha256 || exit 1
unzip khfwcms-handover-xxxxxxxxxxxx.zip
cd khfwcms
node scripts/verify-handoff.mjs . || exit 1
node -p "require('./HANDOVER-MANIFEST.json').sourceCommit"
npm test || exit 1
```

SHA 校验失败即停止，重新取得原始文件。逐文件校验命令以包内 `scripts/verify-handoff.mjs` 说明为准。测试使用临时数据目录，不操作正式内容。

创建专用系统账号与版本目录（已有账号或目录时先检查，不要重复创建）：

```bash
sudo useradd --system --home-dir /var/lib/khfwcms --shell /usr/sbin/nologin khfwcms
sudo install -d -m 0755 /opt/khfwcms/releases /etc/khfwcms
sudo install -d -o khfwcms -g khfwcms -m 0700 /var/lib/khfwcms
KHB_RELEASE=$(node -p "require('./HANDOVER-MANIFEST.json').sourceCommit.slice(0,12)")
case "$KHB_RELEASE" in ''|*[!0-9a-f]*) echo '版本号无效'; exit 1 ;; esac
sudo test ! -e "/opt/khfwcms/releases/$KHB_RELEASE" || exit 1
sudo cp -a . "/opt/khfwcms/releases/$KHB_RELEASE"
sudo chown -R root:root "/opt/khfwcms/releases/$KHB_RELEASE"
sudo chmod -R u=rwX,go=rX "/opt/khfwcms/releases/$KHB_RELEASE"
sudo ln -s "/opt/khfwcms/releases/$KHB_RELEASE" /opt/khfwcms/current
```

代码由 root 管理，应用账号只写数据目录。`current` 若已存在应按升级流程操作，不覆盖现有上线版本。源码 ZIP 没有 `.git`，重新构建交接包需从 Git 仓库检出相同提交。

## 5. 初始化或迁移内容（二选一）

### A. 新站只导入当前公开内容

确认目标 `/var/lib/khfwcms` 没有正在使用的内容文件。以下检查用于防止以快照覆盖管理员已经维护的数据。

```bash
sudo test ! -e /var/lib/khfwcms/content.json || { echo '已有运行内容，请改用备份/迁移流程'; exit 1; }
sudo install -o khfwcms -g khfwcms -m 0600 \
  /opt/khfwcms/current/backups/published-content.json /var/lib/khfwcms/content.json
sudo install -d -o khfwcms -g khfwcms -m 0700 /var/lib/khfwcms/uploads
# 若交接包存在 backups/uploads，则复制其中随公开快照交付的图片。
if [ -d /opt/khfwcms/current/backups/uploads ]; then
  sudo cp -a /opt/khfwcms/current/backups/uploads/. /var/lib/khfwcms/uploads/
  sudo chown -R khfwcms:khfwcms /var/lib/khfwcms/uploads
  sudo find /var/lib/khfwcms/uploads -type f -exec chmod 0600 {} +
fi
```

公开快照不含草稿和管理员凭据。若不导入快照，新建实例会使用 `data/seed.json` 的初始化样例，不能代表当前官网内容。

### B. 保留现有全部内容与草稿

不要先执行 A。源站停服，记录实际 `DATA_DIR`，通过私密渠道传输该目录的完整备份（`content.json`、`uploads/`，以及决定保留的 `admin-auth.json`）。核对传输校验值，接收端保持停服，在一个空目录解包核验后再放入 `/var/lib/khfwcms`，属主设为 `khfwcms:khfwcms`，目录 0700、文件 0600。

是否沿用认证文件由交接双方明确：保留 `admin-auth.json` 会沿用现有密码，但会话不会迁移；不移交凭据时，应在接收端新数据目录内不放认证文件，由系统生成新初始密码。不要删除源站凭据或仅有的备份。移交后实际管理员自行改密，密码不写在文档或公开仓库中。

**已有内容不可被种子/公开快照覆盖。源码包不能恢复未发布文章，完整数据和认证文件只能做私有移交。**

## 6. 配置 systemd 并启动 Node

```bash
sudo install -o root -g root -m 0600 /opt/khfwcms/current/deploy/khfwcms.env.example /etc/khfwcms/khfwcms.env
sudo install -o root -g root -m 0644 /opt/khfwcms/current/deploy/khfwcms.service /etc/systemd/system/khfwcms.service
sudo systemctl daemon-reload
sudo systemctl enable --now khfwcms
sudo systemctl status khfwcms --no-pager
curl -fsS http://127.0.0.1:3000/api/content >/dev/null
```

模板已设置以下值；Node 不会自动读取 `.env`，由 systemd 的 `EnvironmentFile` 注入：

```ini
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATA_DIR=/var/lib/khfwcms
PUBLIC_ORIGIN=https://kehoubang.cn
TRUST_PROXY=loopback
```

不要设置固定的 `ADMIN_TOKEN`。新数据目录由服务生成随机初始密码，完成首次改密后初始文件自动删除。配置了 PUBLIC_ORIGIN 后，本机直接 HTTP 访问管理 API 返回 403 是正常的，公开 `/api/content` 仍可用于存活检查。

运行一个 Node 进程即可；不要用多个 PM2/容器实例共享本目录。会话、限流、文件写入队列都是进程内状态。模板启用非 root 用户和 systemd 文件写入隔离；如果改变数据目录，还必须同步服务中的 `ReadWritePaths` 等设置。

## 7. 官网 HTTPS：先申请证书，再启用正式配置

### 保留课程手册、一校一案和公司展册的原地址

官网最新版本的五处资料入口使用下面三个地址；它们与官网共用裸域，并非可以随官网迁移而保持不变的第三方站点。

| 公开地址 | Nginx 模板对应磁盘文件 |
| --- | --- |
| `https://kehoubang.cn/profile/upload/pdf/1/index.html` | `/srv/kehoubang-documents/profile/upload/pdf/1/index.html` |
| `https://kehoubang.cn/profile/upload/pdf/2/index.html` | `/srv/kehoubang-documents/profile/upload/pdf/2/index.html` |
| `https://kehoubang.cn/profile/upload/pdf/3/index.html` | `/srv/kehoubang-documents/profile/upload/pdf/3/index.html` |

**源码 ZIP 不包含这三个 HTML 阅读器的完整资源。** 请从原托管负责人取得经确认可公开的导出文件：包括三份阅读器的 HTML、JS、CSS、图片、字体、PDF 及共享依赖，保持相对路径结构。现有 `public/assets/course-manual.pdf` 只是单个 PDF，不能代替上述导出包。先在原页面浏览器 Network 中核对完整翻页所请求的路径；若共享依赖在 `/profile/upload/pdf/` 之外，需单独确认公开范围并为必要路径配置托管，不能扩大为公开整个旧业务目录。

以下示例假定核验后的导出目录为 `$HOME/khfwcms-install/manual-export/pdf/`，其中直接包含 `1/`、`2/`、`3/` 和所需公共资源。只在新建的空目标目录执行；若现有 Nginx 已正确托管这些路径，可保留原配置和路径，再合并官网代理配置。

```bash
KHB_MANUAL_SOURCE="$HOME/khfwcms-install/manual-export/pdf"
test -f "$KHB_MANUAL_SOURCE/1/index.html" && test -f "$KHB_MANUAL_SOURCE/2/index.html" && test -f "$KHB_MANUAL_SOURCE/3/index.html" || exit 1
# 模板拒绝跟随符号链接，导出资源应为普通目录和文件。
test -z "$(find "$KHB_MANUAL_SOURCE" -type l -print -quit)" || exit 1
sudo install -d -m 0755 /srv/kehoubang-documents/profile/upload
sudo test ! -e /srv/kehoubang-documents/profile/upload/pdf || { echo '已有手册目录，请先备份并核对，不覆盖'; exit 1; }
sudo cp -a "$KHB_MANUAL_SOURCE" /srv/kehoubang-documents/profile/upload/pdf
sudo chown -R root:root /srv/kehoubang-documents
sudo find /srv/kehoubang-documents -type d -exec chmod 0755 {} +
sudo find /srv/kehoubang-documents -type f -exec chmod 0644 {} +
```

正式 Nginx 模板中的 `location ^~ /profile/upload/pdf/` 从该目录只读提供文件，缺失文件返回 404，不会转入 CMS。所有上层目录须允许 Nginx 用户遍历，保留发行版的 `mime.types` 配置；完整阅读器是否能运行仍须浏览器验收。模板的目录不随官网源码版本切换而删除，应单独备份。

若继续使用原托管服务，运维应使用已核实的独立上游并保留原路径，确认协议、TLS、Host 和所需依赖后替换这一 location。**不能反代到 `https://kehoubang.cn` 自身形成循环，也不能假定独立 `khb` 系统会提供这些文件。** 未取得完整资源或核验原托管路由前，不完成正式域名切换。不要把阅读器直接放进 Node 的 `public/` 后忽略其严格 CSP 对旧阅读器脚本的影响。

### 首次证书与官网入口

DNS 的 @ 和 www 必须先到达官网服务器，80 端口可访问。若已有同名站点配置，先私下备份并合并，不要让同一域名重复定义。`deploy/nginx-bootstrap.conf` 只用于第一次申请官网证书，不代理明文登录。

```bash
sudo install -d -m 0755 /var/www/letsencrypt /etc/nginx/snippets
sudo install -m 0644 /opt/khfwcms/current/deploy/nginx-bootstrap.conf /etc/nginx/sites-available/khfwcms
sudo ln -s /etc/nginx/sites-available/khfwcms /etc/nginx/sites-enabled/khfwcms
sudo nginx -t || exit 1
sudo systemctl enable --now nginx
sudo systemctl reload nginx
# 将下面邮箱替换为证书负责人真实邮箱，并阅读和接受 ACME 服务条款。
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  --cert-name kehoubang.cn -d kehoubang.cn -d www.kehoubang.cn \
  --email REPLACE_WITH_CERTIFICATE_CONTACT_EMAIL --agree-tos
```

www 即使只做跳转也需要有效证书，因为 TLS 握手发生在 HTTP 跳转之前。本证书只含裸域和 www，不申请 `khb` 或通配符证书。证书成功后才能启用引用证书文件的正式配置：

```bash
sudo install -m 0644 /opt/khfwcms/current/deploy/khfwcms-proxy.conf /etc/nginx/snippets/khfwcms-proxy.conf
# 正式模板使用 HTML 过滤和关闭预压缩静态文件，确认两个模块可用。
sudo nginx -V 2>&1 | grep -- --with-http_sub_module || exit 1
sudo nginx -V 2>&1 | grep -- --with-http_gzip_static_module || exit 1
sudo install -m 0644 /opt/khfwcms/current/deploy/nginx.conf /etc/nginx/sites-available/khfwcms
sudo nginx -t && sudo systemctl reload nginx
```

模板适配 Ubuntu 24.04 的 Nginx 配置格式（`listen 443 ssl http2`）。较新 Nginx 可能提示该写法弃用；按目标版本文档调整，但必须先 `nginx -t` 再 reload。官网仅在裸域 HTTPS 的 location 中代理到 Node，固定主域 Host 并覆盖转发头，拒绝未知主机名；不重写 Cookie 或 Origin。HTTP 请求除 ACME 验证路径外全部跳转到 HTTPS 主域，www HTTPS 也保留 `$request_uri` 跳转。

模板为登录/改密按连接 IP 加 Nginx 限流；应用还保留 5 次失败冷却 15 分钟。应用看到的是本机代理，应用级失败额度会被共享，不能把它当作消除所有拒绝服务攻击的保障。已知管理员 IP 时可由运维对全部后台入口和管理 API 加白名单，注意精确匹配的 login/password location 也必须覆盖。

HSTS 未添加 `includeSubDomains` 或 preload，避免把未知独立业务系统的策略强行改变。

### 已有站点更新：阅读器的“返回官网”按钮

本次源码增加 `public/document-return.js`、`public/document-return.css`。先按代码升级流程发布新版本，确保 `https://kehoubang.cn/document-return.js` 和 `/document-return.css` 均可访问，再将模板中以下指令合并到现有 `/profile/upload/pdf/` 的 location 内，执行 `sudo nginx -t && sudo systemctl reload nginx`。保留原静态目录或已核验上游；**只上传首页不会让独立阅读器出现按钮，不要用模板覆盖现场其他站点。**

```nginx
gzip_static off;
sub_filter_once on;
sub_filter '</body>' '<script defer src="/document-return.js"></script></body>';
```

`sub_filter` 默认只修改 `text/html`，不修改 PDF、图片、CSS、JS；`gzip_static off` 防止优先返回已压缩的 `.gz` 文件而错过 HTML 替换，正常动态 gzip 可保留。如果实际使用反向代理托管阅读器，同时在该 location 设置 `proxy_set_header Accept-Encoding "";`，并核验上游确实返回未预压缩 HTML。脚本只在 `/profile/upload/pdf/1/`、`2/`、`3/` 的顶层页面显示按钮，在当前阅读标签页返回官网，避免新开一层标签或依赖浏览器后退。手机子页面同样适用。

若目标 Nginx 缺少上述模块，或阅读器 HTML 没有结束 `</body>` 标签，可由阅读器维护人把同一行 `<script defer src="/document-return.js"></script>` 加入每个顶层入口和手机 HTML 页面，改用不含上述三行的原静态配置；脚本重复加载也只生成一个按钮。不要为了这个按钮放宽 CMS 的 CSP。若导出 HTML 有独立的 CSP 或 `<base>` 配置，需确认允许这两个同源资源，且脚本实际从官网加载。

清理 CDN/浏览器中旧阅读器 HTML 的缓存，并检查响应正文确实包含脚本：

```bash
curl -fsS https://kehoubang.cn/document-return.js >/dev/null
curl -fsS https://kehoubang.cn/document-return.css >/dev/null
for KHB_DOCUMENT_ID in 1 2 3; do
  curl --compressed -fsS "https://kehoubang.cn/profile/upload/pdf/$KHB_DOCUMENT_ID/index.html" | grep -F '/document-return.js' || exit 1
done
```

随后在实际桌面/手机阅读器中确认右上角“← 返回官网”可点击，打开资料的新标签页会回到 `https://kehoubang.cn/`，原官网标签保持不变；检查按钮没有遮挡翻页、缩放或菜单。如阅读器使用浏览器全屏，需同时检查全屏和退出后的行为。本地样本验证不能替代这里的真实导出页面验收。

### 证书续期

```bash
sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/bin/sh' '/usr/sbin/nginx -t && /bin/systemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-khfwcms-nginx >/dev/null
sudo chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-khfwcms-nginx
sudo systemctl enable --now certbot.timer
sudo systemctl list-timers certbot.timer
sudo certbot renew --dry-run
```

核对 nginx/systemctl 实际路径。`--dry-run` 验证续期流程，部署钩子的实际重载还应单独验证或按 Certbot 支持的 `--run-deploy-hooks` 选项演练。保留 HTTP ACME location，证书到期前由运维检查告警和续期日志。

## 8. 首次登录与现场验收

用仅管理员可见的终端查看初始密码：`sudo cat /var/lib/khfwcms/admin-token`。不要录屏、复制到交接文档、工单或代码中。访问 **https://kehoubang.cn/admin**，首次改为独立的 15–128 字符长密码，再重新登录。若沿用已有认证文件，则使用原管理员密码并在交接后改密。

```bash
curl -I 'http://kehoubang.cn/services?check=1'
curl -I 'https://www.kehoubang.cn/admin?check=1'
curl -I https://kehoubang.cn/
curl -fsS https://kehoubang.cn/api/content >/dev/null
curl -fsS https://kehoubang.cn/profile/upload/pdf/1/index.html >/dev/null
curl -fsS https://kehoubang.cn/profile/upload/pdf/2/index.html >/dev/null
curl -fsS https://kehoubang.cn/profile/upload/pdf/3/index.html >/dev/null
sudo ss -ltnp | grep ':3000'
```

预期：前两项为 308，Location 指向 `https://kehoubang.cn` 且保留原路径/参数；主站为 200；3000 仅监听 127.0.0.1。带路径跳转仅保证路径保留，不代表 `/services` 是独立页面（官网采用锚点导航）。

新入口已安装有效证书时，可在公开 DNS 切换前指定新 IP 检查（将示例值替换为真实官网 IPv4，不使用 `-k` 跳过证书验证）：

```bash
KHB_WEBSITE_IP=REPLACE_WITH_WEBSITE_IPV4
curl --resolve "kehoubang.cn:443:$KHB_WEBSITE_IP" -fsS https://kehoubang.cn/ >/dev/null
curl --resolve "www.kehoubang.cn:443:$KHB_WEBSITE_IP" -I 'https://www.kehoubang.cn/admin?check=1'
curl --resolve "kehoubang.cn:443:$KHB_WEBSITE_IP" -fsS https://kehoubang.cn/profile/upload/pdf/1/index.html >/dev/null
curl --resolve "kehoubang.cn:443:$KHB_WEBSITE_IP" -fsS https://kehoubang.cn/profile/upload/pdf/2/index.html >/dev/null
curl --resolve "kehoubang.cn:443:$KHB_WEBSITE_IP" -fsS https://kehoubang.cn/profile/upload/pdf/3/index.html >/dev/null
```

上述命令只核对入口响应。还需使用指向新 IP 的测试浏览器，从页眉打开三份在线资料，并检查产品栏目中的课程手册和一校一案入口，核对新标签页地址、完整翻页、图片和脚本加载，确认无资源 404 或混合内容。手机横屏时导航应可滚动到最后两项。读者实际阅读验收完成后再确认这些链接已迁移。

在浏览器验证：证书覆盖两个官网域名、无混合内容、后台可登录和改密、服务卡片无多余详情按钮、手机课程初显 3 门、课程弹窗、团队展开、新闻外链、二维码和夜间模式。上传一张授权的测试图片并保存，再核对官网与重启后数据；涉及上线内容的测试由内容负责人选定条目。

测试 Cookie 具有 HttpOnly、SameSite=Strict 和 Secure。重启后应重新登录，跨站请求应被拒绝。登录失败限流请在验收窗口或预生产验证，避免故意锁住正在工作的管理员。完整签收表见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 9. 独立系统 khb.kehoubang.cn 的交接要求

由独立业务系统负责人确定它的实际服务器或接入网关。可以与官网同服务器，也可以分开；DNS 必须指向它自己的入口。同机时使用另一套 `server_name khb.kehoubang.cn` 虚拟主机及独立 upstream，不能复用 `khfwcms-proxy.conf`、3000 端口、官网数据目录或本 CMS 的管理员凭据。

独立系统负责人需交付：对应源码版本、启动方式、上游地址/端口、数据库及其他依赖、私有配置传递方式、健康检查、备份恢复和登录回调/外部接入域名配置（如有）。这些信息没有提供前，不生成假定可用的反代配置，也不将域名展示为已上线。

业务系统单独申请覆盖 `khb.kehoubang.cn` 的 HTTPS 证书并配置续期。若选用 HTTP webroot 验证，其 Nginx 也需提供自己的 `/.well-known/acme-challenge/` 路径；实际 webroot 与官网服务器不一定相同。可使用同一 DNS 服务商，但证书、续期、数据与发布应分开管理。

验收时检查 `khb` 进入独立业务系统、浏览器证书正确、系统登录与功能正常，且不会展示官网或官网 CMS。交接双方分别签收官网与业务系统，不能以官网测试通过代替业务系统验收。

## 10. 私有备份、恢复与升级回滚

### 运行数据私有备份

公开 GitHub 只保存代码和公开快照；完整数据（含草稿）及认证文件需要私有备份。为获得一致的文件集合，在维护窗口暂停编辑并停服复制。下面脚本先创建受保护备份目录，停服后打包数据和服务配置，并用退出钩子恢复服务；不会把备份推送到 GitHub。

```bash
sudo bash <<'BACKUP'
set -euo pipefail
umask 077
backup_dir="/var/backups/khfwcms/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$backup_dir"
readlink -f /opt/khfwcms/current > "$backup_dir/release-path.txt"
systemctl stop khfwcms
trap 'systemctl start khfwcms' EXIT
tar -C /var/lib -czf "$backup_dir/data.tar.gz" khfwcms
cp /etc/khfwcms/khfwcms.env "$backup_dir/"
cp /etc/systemd/system/khfwcms.service "$backup_dir/"
cp /etc/nginx/sites-available/khfwcms "$backup_dir/nginx.conf"
cp /etc/nginx/snippets/khfwcms-proxy.conf "$backup_dir/"
(cd "$backup_dir" && sha256sum data.tar.gz > data.tar.gz.sha256)
# 此维护窗口应同时暂停手册发布，备份完整的独立静态目录。
if [ -d /srv/kehoubang-documents ]; then
  tar -C /srv -czf "$backup_dir/documents.tar.gz" kehoubang-documents
  (cd "$backup_dir" && sha256sum documents.tar.gz > documents.tar.gz.sha256)
fi
BACKUP
```

备份目录可能包含认证哈希和草稿，只能给授权人员访问。再通过加密渠道保存到独立私有存储，并制定保留周期。首次正式上线前做一次恢复演练，不能仅检查“备份文件存在”。证书私钥、DNS 与服务器访问权限由服务器运维另行保管。

### 恢复原则

停服后先另存当前数据，校验所选备份的 SHA-256。在全新临时目录解压检查文件清单、JSON 和图片引用，再切换到已核验的恢复目录；不要直接对正在使用的目录执行覆盖解压。恢复 `/var/lib/khfwcms` 后重新设置属主与 0700/0600 权限，确认 systemd 数据路径正确再启动。恢复认证文件会恢复对应密码，但不会恢复旧会话；安全事件后的恢复应让管理员重新设置密码。

在线手册需要另外恢复 `documents.tar.gz` 对应的 `/srv/kehoubang-documents`，校验 SHA-256、目录结构与所有阅读器依赖，恢复 root 属主、目录 0755 和文件 0644，并核对 Nginx 路由。若使用其他静态目录或独立托管，调整备份和恢复范围。它不在 `data.tar.gz` 或源码 ZIP 中，不能随代码回滚省略。

### 代码升级与回滚

1. 记录当前 `readlink -f /opt/khfwcms/current`，完成私有数据备份；保留旧版本目录。
2. 在新目录校验新源码包、执行测试；检查是否包含内容模型/认证格式变更。不要将新包的 seed 或公开快照复制进现有运行数据。
3. 在维护窗口停服，把 `current` 指向已验证的新版本，然后启动。配置模板发生变更时，先比较合并现场配置，不盲目覆盖环境文件或证书配置。
4. 用浏览器和 `curl` 做第 8 节验收。失败时停服，把 `current` 切回记录的旧版本；若数据格式也改变，按变更说明选用兼容备份恢复。记录回滚时间及恢复期间可能丢失的内容编辑。

更换软链接示例（将 `TARGET_RELEASE` 换成已存在并验证的完整版本目录）：

```bash
TARGET_RELEASE=/opt/khfwcms/releases/REPLACE_WITH_VERIFIED_COMMIT
sudo test -f "$TARGET_RELEASE/server.mjs" || exit 1
sudo test -L /opt/khfwcms/current || exit 1
sudo systemctl stop khfwcms
sudo ln -sfn "$TARGET_RELEASE" /opt/khfwcms/current
sudo systemctl start khfwcms
sudo systemctl status khfwcms --no-pager
```

不要删除 `/var/lib/khfwcms`，也不要并行启动两个实例共同写入它。

## 11. 常见故障

忘记管理密码时，只有具备服务器权限的运维可以重置：先停服并确认实际 DATA_DIR，私下保存必要备份；检查 `/etc/khfwcms/khfwcms.env` 和服务配置中没有 `ADMIN_TOKEN`，仅删除该数据目录下的 `admin-auth.json` 和 `admin-token`，保留 `content.json` 与 `uploads/`。重新启动会生成新初始密码，经既有 HTTPS 后台完成首次改密；不要删除整个数据目录，不在命令行直接填写新密码。若数据目录存在残留 `admin-auth.json.tmp`，停服核验后同时清理。

| 现象 | 检查与处理 |
| --- | --- |
| Nginx 502 | `systemctl status khfwcms`、`journalctl -u khfwcms -n 80`；核对 Node 路径、数据权限、127.0.0.1:3000 与是否内存不足 |
| 后台 403 | 裸域地址、PUBLIC_ORIGIN、TRUST_PROXY、Host/XFH/XFP 是否一致；反代必须本机连接，不得改写 Origin |
| www 后台无法登录 | 先确认 www 已跳转到裸域；不要在两个域名分别打开不同后台副本 |
| 429 登录限制 | 按 Retry-After 等待；排查失败请求来源和共享额度；不要通过关闭所有防护解决 |
| 413 上传失败 | 应用最大 5 MiB，Nginx 模板同为 5m；检查实际图片大小和是否经过更小限制的网关 |
| 更新代码后内容变旧 | 核对 DATA_DIR 与 current；确认没有导入 seed/公开快照覆盖原数据 |
| 上传图片 404 | 核对 content.json 中引用与 DATA_DIR/uploads，确保迁移时一并复制且服务用户可读 |
| 课程手册/一校一案/公司展册 404 或空白 | 检查 `/srv/kehoubang-documents/profile/upload/pdf/1/`、`2/`、`3/` 及完整依赖是否迁移；核对专用 Nginx location、MIME 类型和浏览器 Network 错误，不能只复制入口 HTML |
| 阅读器无返回官网按钮 | 确认新 JS/CSS 已发布、Nginx 过滤已重载、HTML 响应包含脚本，排查旧缓存、预压缩响应、CSP、缺失结束 body 标签和 iframe 顶层入口 |
| 证书申请/续期失败 | 检查 A/AAAA/CNAME、80端口、ACME路径、服务商访问限制和证书日志 |
| 修改密码后需要重登 | 设计行为，全部会话撤销；原初始密码也不再有效 |

日志只在受控终端查看；不要把敏感请求头、Cookie、密码或完整运行数据贴入公开 Issue。部署变更与故障处理应记入运维记录。

## 12. 参考与验证状态

- [Node.js 官方版本状态](https://nodejs.org/en/about/previous-releases)：选择受维护的 24 LTS；精确补丁版本以服务器安装时为准。
- [Nginx server_name](https://nginx.org/en/docs/http/server_names.html)、[反向代理模块](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)、[请求限速](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)。
- [Nginx 静态路径 root](https://nginx.org/en/docs/http/ngx_http_core_module.html#root)、[try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files)：保留在线手册路径并对缺失资源返回 404。
- [Nginx sub_filter](https://nginx.org/en/docs/http/ngx_http_sub_module.html)、[gzip_static](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html)：仅为 HTML 响应引入返回官网脚本。
- [Certbot 使用与续期](https://eff-certbot.readthedocs.io/en/stable/using.html)：webroot 多域证书及部署钩子。

当前交付在 Windows 工作区完成源码和包验证；未连接目标 Linux 主机，未修改 DNS，未申请生产证书，未执行生产 Nginx/systemd 安装。现场需要完成 `nginx -t`、Node.js 24 上的测试、续期演练及验收表。此限制不影响将源码、配置和文档交给部署负责人继续执行。
