from pathlib import Path
from html import escape as e
out=Path(__file__).resolve().parents[1]/'docs'
sections=[]
def section(id,title,body):
 sections.append((id,title,f'<section id="{id}"><h2>{title}</h2>{body}</section>'))
def table(headers,rows):
 return '<div class="tablewrap"><table><thead><tr>'+''.join('<th>'+e(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+e(str(x))+'</td>' for x in r)+'</tr>' for r in rows)+'</tbody></table></div>'
def pre(s):return '<pre>'+e(s)+'</pre>'
section('overview','1．使用范围与核对日期','<p>供公司官网与课后邦平台维护人员查阅。依据 2026 年 9 月 30 日上线验收及随后读取的生产 Nginx、目录信息整理。本手册是核对快照，不会自动反映后续服务器变更。</p><p><strong>域名、URL 路径、磁盘目录是不同层次。</strong>Nginx 根据域名及路径分配请求；URL 中的目录名不一定对应同名磁盘文件夹。本文列出已核对的主要服务路径、已配置的特殊路径及相关磁盘目录，不逐项列出 Java 的全部业务 API、历史上传文件或所有 DNS 记录。</p>')
section('domains','2．域名入口',table(['域名 / 地址','用途','关系'],[
('https://kehoubang.cn/','公司官网','主域仍保留旧业务接口、H5 和文件路径'),
('https://www.kehoubang.cn/','官网别名','HTTPS 308 跳转主域，保留路径和参数；HTTP 跳转 HTTPS 主域'),
('https://kehoubang.cn/admin','官网内容后台','独立密码、独立内容数据；首次改密已由用户完成并核实'),
('https://khb.kehoubang.cn/','课后邦业务平台','原业务前端和 Java 后端；用户已确认登录、常用页面及文件正常')])+pre('浏览器 → Nginx（HTTPS 入口）\n  ├─ 主域官网页面 / 官网 API → Node.js 127.0.0.1:3000\n  ├─ khb 子域首页 → 原业务前端 web/\n  ├─ /cloud/ → Java 业务接口\n  ├─ /profile/ → Java 文件服务 → /data/uploads/\n  └─ /app/ → 原业务前端 web/app/'))
section('routes','3．URL 路径与处理关系', '<p>以下以主域为基准。路径中的“…”表示子路径，不是需要输入的字符。</p>'+table(['URL 路径','作用 / 行为','对应服务或目录'],[
('/、/index.html','官网首页','官网 Node → /opt/khfwcms/current/public/index.html'),
('/admin、/admin.html','官网管理页面','官网 Node → public/admin.html；管理 API 单独认证'),
('/api/content','读取公开内容，只展示已发布新闻','Node → /var/lib/khfwcms/content.json'),
('/api/admin/login、session、logout、password','后台认证、会话、退出、改密','官网 Node；登录与改密限速'),
('/api/admin/content','读取、保存后台内容','官网 Node；认证及 CSRF 保护'),
('/api/admin/images','后台图片上传','官网 Node → /var/lib/khfwcms/uploads/'),
('/assets/','官网和旧业务资源兼容','先查原 web/assets/；不存在时转官网 Node。官网固定资源来自 public/assets/，后台上传资源来自持久化 uploads/'),
('/admin.css、admin.js、app.js、courses.css、courses.js、platform-entry.js、site-theme.css、style.css、theme.css、theme.js、upload.css','官网根目录的脚本与样式','精确匹配后转官网 Node'),
('/cloud、/cloud/…','补齐斜线 / 原业务接口','Nginx → Java；包括原登录、业务及回调所经接口'),
('/cloud/profile/upload/…','上传文件访问及缓存配置','Java 127.0.0.1:8080；catalog-display/v1/ 有更具体的缓存路由'),
('/profile、/profile/…','补齐斜线 / 文件访问','/profile/ → Java 8080 的 /cloud/profile/；文件根为 /data/uploads/'),
('/profile/private-course-resources/…','禁止匿名直链私有课件','返回 404；不能用公共文件方式管理私有课件'),
('/app、/app/…、/app/assets/…','家长 / 教师 H5 及其资源','原业务 web/app/；页面回退 app/index.html，资源不存在返回 404'),
('/parent/…、/teacher/…','兼容旧 H5 地址','分别跳转 /app/parent/… 与 /app/teacher/…'),
('/deployment-board/…','业务发布记录看板','127.0.0.1:18770；主域收到新业务域 Referer 时跳回 khb 同路径'),
('/_AMapService/…','地图代理','高德服务；v4/map/styles 有专门规则；密钥不写入本手册'),
('/miniapp-uat/cloud、/miniapp-uat/cloud/…','历史配置的验收接口入口','补斜线后代理 127.0.0.1:18083/cloud/；本次仅确认配置存在，未确认验收服务当前可用'),
('/cloud/swagger-ui*、swagger-resources/、webjars/、v2/api-docs、v3/api-docs*、druid/','诊断 / API 文档入口限制','返回 404'),
('/#/...','旧业务平台书签','官网脚本跳转 khb 子域，保留参数和 hash；# 后的内容不是磁盘目录'),
('/#home 等','官网章节锚点','仍留在官网页面；不是服务器路由')])+'<p>其他旧图片、脚本、字体等扩展名路径由原静态文件规则处理；其余主域路径转官网服务，不存在的文件不自动成为页面。隐藏文件路径有拒绝规则。</p><p><strong>khb 子域：</strong>首页及普通前端路径使用原 <code>web/</code>，前端路由回退到业务 <code>index.html</code>；共用旧 <code>/cloud/</code>、<code>/profile/</code>、<code>/app/</code>、地图、看板等配置。khb 的 <code>/admin</code> 不是官网内容后台。HTTP 的 <code>/.well-known/acme-challenge/</code> 使用 <code>/var/www/letsencrypt</code>，用于证书验证。</p>')
section('manuals','4．三份在线资料',table(['资料','访问地址','磁盘位置 / 页数','官网入口'],[
('课程手册','https://kehoubang.cn/profile/upload/pdf/1/index.html','/data/uploads/upload/pdf/1/；39 页','已挂到导航及正文'),
('一校一案','https://kehoubang.cn/profile/upload/pdf/2/index.html','/data/uploads/upload/pdf/2/；20 页','已挂到导航及正文'),
('第 3 份，名称待确认','https://kehoubang.cn/profile/upload/pdf/3/index.html','/data/uploads/upload/pdf/3/；12 页','尚未添加菜单入口')])+pre('/data/uploads/upload/pdf/\n├── 1/index.html + image/page-0001.jpg … page-0039.jpg\n├── 2/index.html + image/page-0001.jpg … page-0020.jpg\n└── 3/index.html + image/page-01.jpg   … page-12.jpg')+'<p>三份文件仍在原上传目录，未迁入官网代码目录。第 1、2 份已完成浏览器全部图片解码及滚动到末页检查；第 3 份已检查阅读页和全部 12 张图片与磁盘文件一致。第 3 份图片使用两位编号，不能按前两份的四位编号推测地址。</p><p>现有阅读器通过纵向滚动阅读，没有内置 PDF 下载按钮。官网包内 <code>/assets/course-manual.pdf</code> 是另一份独立资源，不等同于三套阅读器目录。</p>')
section('disk','5．服务器目录结构',pre('官网代码与运行环境\n/opt/khfwcms/\n├── current → releases/website-v2026.09.30.1/\n│   ├── public/             官网 HTML / CSS / JS\n│   │   └── assets/         固定图片、二维码、PDF\n│   ├── data/               随代码交付的种子，不是生产实时内容\n│   ├── backups/            随代码交付的内容快照，不是自动备份目录\n│   ├── deploy/、docs/、scripts/、tests/、verification/\n│   └── server.mjs、auth.mjs、validation.mjs 等\n└── runtime/node-v24.21.0-linux-x64/\n\n官网持久化数据\n/var/lib/khfwcms/\n├── content.json            当前实际内容\n├── admin-auth.json         认证数据，不公开\n└── uploads/                后台上传图片，首次上传后创建\n\n业务平台\n/data/apps/edu-feiyue/current\n  → /data/releases/edu-feiyue/20260925-online-child-profile-r1/\n    ├── cloud.jar           Java 业务程序\n    ├── web/\n    │   ├── index.html\n    │   ├── assets/         业务前端资源\n    │   ├── app/            家长 / 教师 H5\n    │   ├── datav/          原业务子目录，具体用途未逐项核查\n    │   └── resource/       原业务资源子目录\n    └── admin/、migrations/ 以及发布清单、验收脚本等\n\n原业务文件存储\n/data/uploads/\n├── avatar/\n├── catalog-display-manifests-v1/\n└── upload/\n    ├── pdf/1/、pdf/2/、pdf/3/\n    ├── catalog-display/\n    ├── home/\n    ├── home-categories/\n    ├── 2026/\n    ├── content/\n    └── route-check/')+'<p><code>current</code> 是指向实际发布目录的符号链接，后续发布可能改变其目标。数据目录与代码目录分开，升级官网代码时不可用种子文件覆盖当前内容。</p>')
section('config','6．配置、服务和备份',table(['项目','位置 / 名称','说明'],[
('官网服务','khfwcms.service','独立账号；监听 127.0.0.1:3000'),
('业务服务','edu-server、edu-server-v4','本次官网上线未更新或重启 Java'),
('主域 / www 配置','/etc/nginx/sites-available/edu-feiyue','官网及旧路径兼容规则'),
('业务子域配置','/etc/nginx/sites-available/khb-business','新业务入口及证书验证'),
('官网代理 / 限流','/etc/nginx/snippets/khfwcms-proxy.conf；/etc/nginx/conf.d/60-khfwcms.conf','Node 代理与登录限流'),
('官网环境配置','/etc/khfwcms/khfwcms.env','运行配置，不应公开或直接放入文档'),
('主域 / www 证书','/etc/nginx/ssl/kehoubang.cn/','沿用原有效证书'),
('khb 证书','/etc/letsencrypt/live/khb.kehoubang.cn/','有效至 2026-12-29；续期演练通过，证书续期后日期会变化'),
('本次私有备份','/data/backups/edu-feiyue/20260930-company-website-r1/','原 Nginx、证书、源码、内容、运行包指纹、回退工具及验收记录'),
('改密后数据备份','上述备份目录 / website-data-after-owner-password.tar.gz','包括内容与认证数据，只在服务器受限目录保存')]))
section('change','7．需要修改时去哪里',table(['要做的事情','正确位置','核对事项'],[
('改公司介绍、课程或新闻','https://kehoubang.cn/admin','发布后核对官网；生产实际编辑及上传仍待使用验收'),
('上传官网图片','官网后台上传功能','实际图片写入持久化 uploads/；URL 使用 /assets/upload-…'),
('改官网布局、菜单或固定样式','独立官网源码仓库的 public/','测试、创建发布版本、备份后更新；不要只改线上临时文件'),
('更新三份阅读资料','/data/uploads/upload/pdf/ 对应编号目录','先备份，核对 index.html 总页数及图片编号；保留原 URL'),
('把第 3 份放到官网菜单','官网导航 / 正文入口代码','先确认资料名称及栏目；文件已存在不代表菜单已添加'),
('改业务功能或 H5','课后邦业务源码与发布流程','不是官网 CMS 管理范围'),
('改域名分流或代理','对应 Nginx 配置','先备份，nginx -t 通过后平滑重载'),
('官网入口回退','本次备份目录中的 rollback-existing-host.py','仅按上线交接操作；校验配置哈希，保留官网数据和 khb 域名')]))
section('checks','8．只读核对命令','<p>下面命令在已登录的服务器终端执行，不修改文件或重启服务。无需把任何密码、认证文件内容或完整含密钥配置复制到聊天中。</p>'+pre('''# 查看 current 实际指向
readlink -f /opt/khfwcms/current
readlink -f /data/apps/edu-feiyue/current

# 查看服务状态
systemctl is-active nginx khfwcms edu-server edu-server-v4

# 校验 Nginx 语法（不重载）
nginx -t

# 核对三个 HTTPS 入口
curl -I https://kehoubang.cn/
curl -I https://www.kehoubang.cn/
curl -I https://khb.kehoubang.cn/

# 查看资料目录与文件名（不读取文件内容）
find /data/uploads/upload/pdf -maxdepth 2 -type d
find /data/uploads/upload/pdf/3 -maxdepth 2 -type f

# 取官网公开内容中的数量
curl -fsS https://kehoubang.cn/api/content | python3 -c 'import json,sys; d=json.load(sys.stdin); print("新闻:",len(d["news"]),"课程:",len(d["courses"]))'
''')+'<p>上线时公开内容为两篇新闻、55 门课程；后台编辑后数量可以正常变化。HTTP 200 只证明请求成功，业务验收仍需登录并查看实际页面、图片和文件。</p>')
section('local','9．本机源码与交接位置',table(['用途','本机路径'],[
('官网独立源码','/Users/zma/Developer/kehou/khfwcms'),
('官网部署交接','/Users/zma/Developer/kehou/khfwcms/docs/DEPLOYMENT-20260930.md'),
('官网验收证据','/Users/zma/Developer/kehou/khfwcms/verification/20260930/'),
('业务开发源码','/Users/zma/Developer/kehou/khfw'),
('业务发布工作区','/Users/zma/Developer/kehou/khfw-release'),
('项目看板和派生资料','/Users/zma/Documents/ChatGPT/课后邦智校云平台'),
('本手册','/Users/zma/Documents/ChatGPT/课后邦智校云平台/output/官网运维手册/官网域名与目录说明手册.html')])+'<p>官网运行源码为 <code>website-v2026.09.30.1@7a71ac6</code>；部署工具记录为 <code>website-deployment-v2026.09.30.1@af6841e</code>。官网已建立云效独立私有仓库 KHB-Website（khfwcms），与业务平台仓库并列；main 为发布线，develop 为开发线。外部工作台同步仍待处理。官网管理员初始密码已失效，不包含在本手册中。</p>')
html='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>课后邦 · 官网域名与目录说明手册</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#172b40;font:16px/1.8 system-ui,-apple-system,"PingFang SC",sans-serif}header{background:#123861;color:white;padding:42px max(24px,calc((100% - 1100px)/2))}h1{margin:0;font-size:30px}header p{margin:8px 0 0;color:#dce8f5}main{max-width:1150px;margin:24px auto;padding:0 24px}.tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap}input{flex:1;min-width:240px;padding:12px;border:1px solid #bbc8d4;border-radius:7px;font:inherit}button{padding:12px 18px;background:#174f87;color:white;border:0;border-radius:7px;cursor:pointer;font:inherit}nav{display:flex;gap:8px 20px;flex-wrap:wrap;margin:18px 0}a{color:#175c9c;text-decoration:none}section{background:white;border:1px solid #dfe5eb;border-radius:12px;margin:22px 0;padding:24px}h2{margin:0 0 18px;font-size:23px;border-bottom:2px solid #e3edf6;padding-bottom:10px}.tablewrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:12px;text-align:left;vertical-align:top;border:1px solid #dce4eb;overflow-wrap:anywhere}th{background:#edf3f8}tbody tr:nth-child(even){background:#fafbfd}pre{background:#f0f4f8;padding:18px;border-radius:8px;overflow:auto;font:14px/1.8 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}code{font-size:14px;background:#eef3f7;padding:2px 4px;overflow-wrap:anywhere}.note{font-size:14px;color:#526478}footer{padding:18px 0 40px;text-align:center;color:#607284;font-size:13px}[hidden]{display:none!important}@media print{body{background:white;font-size:11pt}header{background:white;color:#123861;padding:10mm 0}header p{color:#456}.tools,nav,.note{display:none}main{margin:0;padding:0;max-width:none}section{border:0;padding:0;margin:8mm 0;break-inside:auto}h2{break-after:avoid}tr,pre{break-inside:avoid}th,td{padding:5px;font-size:9pt}section[hidden]{display:block!important}a{color:inherit}@page{size:A4;margin:15mm}}
</style></head><body><header><h1>课后邦 · 官网域名与目录说明手册</h1><p>查询路径 · 核对目录 · 确认修改位置｜核对快照：2026-09-30｜版本 1.0</p></header><main><div class="tools"><input id="search" type="search" aria-label="搜索手册" placeholder="搜索：如 /profile/、pdf/3、后台、备份"><button id="print">打印 / 保存为 PDF</button></div><p class="note" id="result">可按关键词筛选章节；清空搜索恢复全文。打印时自动包含全部章节。</p><nav>'''+''.join(f'<a href="#{id}">{title}</a>' for id,title,_ in sections)+'</nav>'+''.join(body for _,_,body in sections)+'''<footer>本手册仅供运维查阅；后续目录、域名或发布版本变更后应同步核对更新。</footer></main><script>
const input=document.querySelector('#search');input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();let n=0;for(const s of document.querySelectorAll('section')){s.hidden=!!q&&!s.textContent.toLowerCase().includes(q);if(!s.hidden)n++}document.querySelector('#result').textContent=q?'匹配 '+n+' 个章节；清空搜索恢复全文。':'可按关键词筛选章节；清空搜索恢复全文。打印时自动包含全部章节。'});document.querySelector('#print').addEventListener('click',()=>window.print());document.querySelector('nav').addEventListener('click',ev=>{if(ev.target.closest('a')){input.value='';input.dispatchEvent(new Event('input'))}});
</script></body></html>'''
(out/'官网域名与目录说明手册.html').write_text(html)
print(out/'官网域名与目录说明手册.html')
