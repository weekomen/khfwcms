# 2026-09-30 公司官网部署交接

状态：官网已上线，业务入口已由用户登录验收；CMS 首次改密已完成并在服务器核实，实际内容编辑及图片上传待用户使用验收。

## 入口

| 地址 | 用途 |
| --- | --- |
| https://kehoubang.cn | 公司官网 |
| https://www.kehoubang.cn | 308 跳转主域，保留路径和参数 |
| https://kehoubang.cn/admin | 官网内容后台，密码独立于业务平台 |
| https://khb.kehoubang.cn | 课后邦业务平台 |

用户在本次会话确认新业务入口“已登录，常用页面和文件正常”。原主域 `#/…` 书签自动转到新业务域名；官网普通页内锚点不跳转。新域名需重新登录，不复制旧域认证数据。

## 实际部署

- 独立源码仓库：`/Users/zma/Developer/kehou/khfwcms`，当前无远端，未声称云效同步。
- 运行源码标签：`website-v2026.09.30.1`，提交 `7a71ac6`。Nginx 合并及验收脚本后续独立记录，不移动已部署标签。
- 源码目录：`/opt/khfwcms/releases/website-v2026.09.30.1`，`/opt/khfwcms/current` 指向该目录。
- 官方 Node.js `v24.21.0` Linux x64，安装包经官方 SHASUMS256 校验。
- systemd `khfwcms` 使用无登录权限的独立账号；仅监听 `127.0.0.1:3000`，内存上限 512 MiB、CPUQuota 100%。
- 数据：`/var/lib/khfwcms`；环境：`/etc/khfwcms/khfwcms.env`。数据目录权限 0700，与代码分离。
- 首次导入 `backups/published-content.json`：两篇新闻、55 门课程。未用缺少新闻的种子文件替代。
- `khb` 和 `www` A 记录由用户在阿里云添加，权威 DNS 已核实。新 khb 证书有效至 2026-12-29；certbot 续期演练成功，使用现有 Nginx 重载钩子。主域与 www 保留原有效证书。
- 原 Nginx 文件按现场配置合并，保留 `/cloud/`、`/app/`、`/profile/`、回调所经业务代理、AMap 和其他旧路由。旧业务 `/assets/` 优先，官网资源无重名冲突。
- 主域发布记录菜单收到新业务域名 Referer 时定向回新域，保留同源 iframe；其他既有域名不改。
- Java 双实例 PID 377526 / 377796、零重启，运行 JAR SHA256 `d38db929fca057e18e1dced4d7cd72872af7de57e25aa981f714071cd3d5d6bd` 与部署前一致。本次未部署 Java、变更业务数据库或上传小程序。

## 核验结果

- 本机 Node 24：9 项通过；服务器 Node 24：8 项通过，源码归档缺少 Git 元数据导致 1 项归档重现测试按设计跳过。
- 隔离 CMS 浏览器测试：首次改密、CSRF、会话到期、编辑发布、退出与上传/持久化相关服务测试通过。生产初始登录、Secure/HttpOnly/SameSite Cookie 和首次改密限制通过；不将隔离测试等同于用户生产改密。
- 官网 33 个静态文件经实际 Nginx 返回的字节哈希与源码一致；两篇新闻、55 门课程完整。390 像素布局、55 个课程弹窗和四个二维码通过本地浏览器测试。
- 主域、www、新业务域和四个既有租户域的证书及页面检查通过；H5、验证码接口正常。受保护课件和诊断接口仍拒绝匿名访问。
- 两份手册旧托管路径保留，分别 39 页、20 页，共 59 页 JPEG 全部检查成功。现有阅读器是纵向滚动页，不含 PDF 下载按钮；不将其描述为已验收下载功能。包内独立 `course-manual.pdf` 经静态文件完整性核验。
- 官网单独重启后内容保持；从私有备份恢复的隔离服务返回两篇新闻、55 门课程，恢复演练已停止。
- 未进行真实支付或支付回调重放；本次保留原相关代理配置，不将接口可用等同于真实交易验收。

证据位于 `verification/20260930/`；`public-probes.json` 是上线后实际 TLS/资源核验，`browser-public.json` 在公网浏览器检查成功后生成。

最终公网浏览器验收已通过：桌面官网、390 像素手机布局、旧 `#/login` 书签跳转；两份手册全部 39 / 20 页图片解码成功且能滚动到末页。截图和 `browser-public.json` 已保存。

配置与回退工具对应 `website-deployment-v2026.09.30.1@af6841e`；运行代码仍为 `website-v2026.09.30.1@7a71ac6`。最终服务、配置哈希和改密结果见 `final-state.json`，不含密码或认证哈希。

## 备份与回退

私有服务器备份：`/data/backups/edu-feiyue/20260930-company-website-r1`。包含部署前 Nginx/证书、源代码归档、内容备份、运行包指纹、最终候选配置和探针结果。用户改密后另保存 `website-data-after-owner-password.tar.gz`。含凭据的归档只保留在服务器受限目录，不能放入 Git 或交接公开文件。

仅回退主域入口，保留官网数据及新业务域名：

```sh
python3 /data/backups/edu-feiyue/20260930-company-website-r1/rollback-existing-host.py /data/backups/edu-feiyue/20260930-company-website-r1
```

脚本先校验当前配置仍为本次上线版本，再恢复部署前入口并 `nginx -t` / 平滑重载；配置有后续改动则拒绝覆盖。未在生产触发回退，避免打断已上线官网。

排查官网服务：`systemctl status khfwcms`、`journalctl -u khfwcms`。更新代码时不覆盖 `/var/lib/khfwcms`，先备份持久化内容及认证文件。恢复旧认证备份会恢复旧密码，须单独处理。

## 用户待完成

1. 首次改密已由用户完成；服务器核实 `passwordChangeRequired=false` 且初始 token 已移除。本机 `.local/initial-cms-password.txt` 保存的初始密码已失效。
2. 用自己的新密码验证后台编辑与图片上传，再确认官网效果。不要把新密码发到聊天或记录文件。
3. 后续如需一键下载两份在线手册，提供对应原始 PDF 后再添加下载入口。

本地项目摘要及看板按真实状态同步；外部 KHB 工作台仍待同步。
