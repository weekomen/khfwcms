# 课后邦官网与 CMS 技术交接

本文按交付代码说明现有行为。Linux 安装与运维见 [部署文档](DEPLOYMENT.md)，上线检查及责任签收见 [验收清单](ACCEPTANCE.md)，本地启动见 [README](../README.md)。实际交付版本以源码 ZIP 内的 `HANDOVER-MANIFEST.json` 为准；文档和配置模板不表示已完成公网部署。

## 1. 系统范围与结构

这是单站点、单管理员的企业官网与内容后台。前端为原生 HTML/CSS/JavaScript；后端使用 Node.js 内置 HTTP、文件和加密模块，没有数据库、前端构建步骤或第三方运行依赖。**本仓库不包含独立“课后邦系统”的业务代码**，也没有学校、机构、教师、家长等业务账户体系。

### 域名与交付范围

| 规划地址 | 用途及目标行为 | 当前交付边界 |
| --- | --- | --- |
| `https://kehoubang.cn` | 官网唯一规范地址 | 本仓库的官网；DNS、证书及公网访问待现场验收 |
| `https://www.kehoubang.cn` | 官网别名，以 `308` 跳转到 `https://kehoubang.cn`，保留路径和查询参数 | 两个域名展示同一官网；不是第二套 CMS |
| `https://kehoubang.cn/admin` | 官网内容管理后台 | 本仓库 CMS；管理 API 位于同源 `/api/admin/*` |
| `https://khb.kehoubang.cn` | 独立“课后邦系统”，用途已确认 | 本包只预留域名规划；未交付该系统源码或完成其部署 |

官网生产 `PUBLIC_ORIGIN` 统一为 `https://kehoubang.cn`。管理员从裸域 `/admin` 登录，`www` 不另设登录来源；该约定避免 Cookie、Origin 和 CSRF 来源分散。`khb` 的代码来源、服务器入口、数据和账号体系应由独立系统负责人另外交接；不能仅通过添加 DNS 或把它指向官网进程，认定业务系统已经上线。

```text
访客浏览器 ── GET /api/content ──┐
                               ├─ Node.js ── DATA_DIR/content.json
后台浏览器 ── /api/admin/* ─────┘       ├──── DATA_DIR/uploads/
             Cookie + CSRF             └──── DATA_DIR/admin-auth.json

官网入口：kehoubang.cn HTTPS 反向代理 → 127.0.0.1:3000
官网别名：www.kehoubang.cn → 308 → kehoubang.cn（保留路径/查询）
独立业务系统：khb.kehoubang.cn（预留，不在此进程范围内）
静态页面和随源码发布的素材：public/
```

| 文件或目录 | 接手时关注的内容 |
| --- | --- |
| `server.mjs` | HTTP 路由、静态文件、图片上传、读取和保存内容；默认监听 `127.0.0.1:3000` |
| `auth.mjs` | 密码初始化及哈希、会话、CSRF、同源/HTTPS 检查和登录限流 |
| `validation.mjs` | 保存内容时的字段、数量、链接和路径校验 |
| `public/index.html`、`public/app.js` | 官网栏目、团队、服务卡片、新闻链接、二维码与详情弹窗 |
| `public/courses.js`、`public/courses.css` | 课程分类、默认展示数量、展开收起、课程详情 |
| `public/document-return.js`、`public/document-return.css` | 阅读器的“返回官网”按钮，由 Nginx 为独立阅读器 HTML 引入 |
| `public/style.css`、`public/site-theme.css` | 官网布局、响应式样式、夜间模式覆盖 |
| `public/admin.html`、`public/admin.js`、`public/admin.css`、`public/upload.css` | 登录、改密、栏目编辑、照片上传与保存状态 |
| `public/theme.js`、`public/theme.css` | 官网和后台共用的主题偏好 |
| `public/assets/` | Logo、首屏照片、团队照片、课程配图、平台二维码等公开素材 |
| `data/seed.json` | 数据目录没有 `content.json` 时使用的初始化内容，不能替代现有运行数据 |
| `backups/published-content.json`、`backups/uploads/` | 可进入公开仓库的内容快照及配套公开图片 |
| `scripts/backup-content.mjs` | 生成公开内容快照；使用 `DATA_DIR` 或默认 `data/` |
| `scripts/create-handoff.mjs` | 从已提交的 Git HEAD 导出白名单源码 ZIP、文件清单与 SHA-256 校验文件 |
| `scripts/start-tunnel.mjs` | 以明确指定的 HTTPS 地址启动 cpolar 等同机穿透的后台访问；保留数据目录和凭据 |
| `docs/DEPLOYMENT.md`、`deploy/` | Linux 部署步骤与域名、HTTPS、服务配置模板 |
| `docs/ACCEPTANCE.md` | 本次版本的部署验收、交接责任及签收记录模板 |
| `tests/` | API/认证自动测试及独立浏览器检查脚本 |

`package.json` 声明 Node.js ≥20；公开备份脚本使用 `import.meta.dirname`，实际需要 Node.js 20.11 或更新版本。生产运行版本按部署文档统一，不要使用不再受维护的旧运行时。`npm start` 与 `npm run dev` 都只是启动 `node server.mjs`，没有自动重载。临时穿透使用 `npm run start:tunnel -- https://实际公网域名`，不是默认放行任意外网域名；具体条件见 README 的 cpolar 说明。

## 2. 已实现的官网功能

- **产品与服务**：服务卡片直接展示名称、副标题、详细介绍和全部服务要点，无“了解更多”弹窗。文字来自 CMS 的 `services`。
- **课程目录**：交付内容包含 55 门课程，分为美育、益智、科技、劳动四类；分类由实际数据生成。视口宽度 ≤600px 时，每类默认展示 3 门，其余宽度展示 6 门，可展开全部，切换分类时重新收起。详情使用站内弹窗，显示介绍和按行拆分的学习内容。
- **在线资料入口**：页眉提供“课程手册 / 一校一案 / 公司展册”；“从优质课程，到每一次落地”旁提供“全部课程手册”，“课程落地与配套服务”旁提供“一校一案”。课程手册指向 `https://kehoubang.cn/profile/upload/pdf/1/index.html`，一校一案指向 `https://kehoubang.cn/profile/upload/pdf/2/index.html`，公司展册指向 `https://kehoubang.cn/profile/upload/pdf/3/index.html`，均为带 `noopener noreferrer` 的新标签页链接。配置位置为 `public/index.html`，目前不由 CMS 编辑。窄屏导航可展开和滚动访问。
- **阅读器返回入口**：上述三个阅读器及其手机 HTML 子页面通过 Nginx `sub_filter` 引入独立脚本，右上角显示“← 返回官网”。按钮使用固定官网地址，在当前阅读标签页跳转，不依赖历史记录或原首页标签。脚本只作用于三个资料目录的顶层页面，避免嵌套 iframe 和重复加载生成多个按钮。未改动原阅读器文件；已有站点必须合并部署配置才能启用。真实阅读器的翻页和全屏布局需上线验收。
- **专业团队**：按分类查看，默认只展示一排，数量按当前网格列数计算，常见桌面 4 人、手机 2 人；可以展开/收起。点击成员查看照片、职称和简介，切换团队分类不会改变课程分类。
- **公司动态**：仅显示已发布文章，按日期字符串倒序排列。存在有效 HTTPS 原文链接时，在新标签页打开；无链接时显示“文章链接待补充”，不弹出文章详情。后台保存的正文仍可通过公开 API 的已发布文章读取。
- **联系与主题**：电话和邮箱链接、微信/视频号/快手/抖音二维码放大、返回顶部；官网和后台均支持日间、夜间和跟随系统。偏好保存在当前浏览器同源 `localStorage` 的 `khb-admin-theme`，不涉及认证信息。

首屏照片为 `public/assets/hero-office.jpg`，引用位置在 `public/style.css`；平台名称、提示及二维码路径在 `public/app.js`。这些素材和课程分类配图尚无后台上传入口。课程 `page` 字段仅为兼容旧数据保留，单门课程详情使用弹窗；课程手册、一校一案和公司展册通过上述独立链接打开。`public/assets/course-manual.pdf` 仍属于公开静态文件，但它不是三个在线 HTML 阅读器的完整文件包，不能替代它们的部署。

三份在线资料与官网共用裸域。交接接收方应取得原托管方导出的完整公开阅读器文件（HTML、脚本、样式、图片、字体或 PDF 等依赖），按 [部署文档](DEPLOYMENT.md) 第 7 节保持原访问路径。Nginx 模板为其预留 `/srv/kehoubang-documents/profile/upload/pdf/` 静态目录，Node 与 CMS 不负责生成或管理这些文件；当前源码交接包不含该目录。

## 3. 内容模型与维护

运行内容为一个 JSON 对象，包含 `site`、`services`、`courses`、`team`、`news`。字符串通常上限 10,000 个 JavaScript 字符；整次保存请求上限为 512,000 字节，因此各字段单独合法不代表整份内容一定可提交。

| 字段 | 结构与校验 |
| --- | --- |
| `site` | `name`、`tagline`、`headline`、`intro`、`about`、`phone`、`email`、`address`、`filing`，均为字符串。品牌名和首页标题非空；邮箱填写时须通过格式检查 |
| `services` | 最多 24 项；每项 `title`、`subtitle`、`description`、`category` 为字符串；`features` 为最多 12 项的字符串数组 |
| `courses` | 可省略，最多 200 项；`title`、`category`、`summary` 为字符串，前两项非空；`description`、`outline` 可选；`page` 必须为 0–32 的整数，新增项默认为 0 |
| `team` | 最多 100 项；`name`、`role`、`bio`、`category`、`image` 为字符串。图片路径最多 150 字符，须符合 `/assets/文件名`，文件名只含英文字母、数字、下划线、点、连字符 |
| `news` | 最多 100 项；`id`、`title`、`category`、`date`、`summary`、`body`、`source` 为字符串；`id` 非空且唯一；`published` 为布尔值。正文最多 50,000 字符；日期可空，非空须为 `YYYY-MM-DD` 格式；原文地址可空，非空只接受 HTTPS |

校验逻辑以 `validation.mjs` 为准，目前不检查日期是否为真实日历日期，也不自动剔除额外属性。除未发布新闻外，内容会进入公开 API；不要在内容对象中夹带内部备注、凭据或其他私密字段。

后台操作顺序：

1. 登录 `/admin`，初次登录先设置新密码，再重新登录。
2. 选择“网站设置 / 产品与服务 / 课程目录 / 专业团队 / 公司动态”进行维护。服务要点、课程学习内容每行一项；正文使用纯文本，不支持富文本 HTML。
3. 团队照片点击图片即可选择本机文件。浏览器先检查格式、大小及能否解码；上传成功后仍须点击“保存并更新官网”，成员引用才生效。
4. 新闻勾选“在官网公开发布”后保存，才会出现在公开 API 和官网；取消勾选再保存即可撤下。其他栏目没有草稿/发布开关，保存即公开。
5. 新增、删除及编辑统一由“保存并更新官网”提交整份内容。删除先在页面确认，保存后生效；当前没有回收站、版本历史或排序拖拽，除新闻按日期排序外，列表按保存的数组顺序展示。

内容写入在当前进程中排队，先写临时文件再替换 `content.json`。这可以避免同一进程内交叉写文件，但没有版本冲突检查；两个人或两个页面先后保存时，后一次整份数据可能覆盖前一次修改。安排一位维护者操作，保存后检查官网。

会话失效时，未保存编辑仅保留在当前页面内存，重新登录后可以继续保存；刷新、关闭页面或主动退出可能丢失这些编辑。浏览器离开提醒不是自动保存或持久化草稿。

## 4. 登录与 API 约定

后台使用一个管理员密码，无用户名。首次初始化可以读取既有 `admin-token` 或 `ADMIN_TOKEN`，否则生成随机初始密码；第一次登录必须换为 15–128 个字符的新密码。已有 `admin-auth.json` 时，`ADMIN_TOKEN` 不会重置现有密码。

凭据以随机盐和 scrypt 哈希保存，参数为 `N=131072, r=8, p=1`，不存明文新密码。成功改密删除初始密码文件并撤销所有会话。忘记密码的停服恢复步骤见 [README](../README.md)；不得删除整个数据目录。

登录返回会话 Cookie `khb_admin_session`（`HttpOnly`、`SameSite=Strict`、`Path=/api/admin`，公网 HTTPS 使用 `Secure`）及 JSON 中的 CSRF token。后台只在内存持有 CSRF token，密码不进入浏览器存储；旧版 Bearer 管理密钥已不再支持。空闲 30 分钟或登录满 8 小时过期，重启也会清空会话。

管理请求先校验访问上下文：未配置公网来源时，仅允许本机连接和本机 Host；公网必须匹配 `PUBLIC_ORIGIN`，按部署文档通过同机 HTTPS 反代。写请求必须带匹配的 `Origin`，除登录外还须带 `X-CSRF-Token`。读请求也会拒绝明确的跨站来源。`/admin` 是登录页面入口，不能把“页面能够打开”视为已经获得数据权限。

| Method / 路径 | 认证与请求 | 成功响应 / 作用 | 主要业务错误 |
| --- | --- | --- | --- |
| `GET /api/content` | 无认证 | `200`，公开内容；过滤 `published=false` 新闻 | `500` 读取/解析失败 |
| `POST /api/admin/login` | 同源；JSON `{password}` | `200`，设置 Cookie，返回 `{ok, csrfToken, passwordChangeRequired}` | `401` 密码不正确；`429` 频繁尝试 |
| `GET /api/admin/session` | 会话 Cookie | `200`，返回当前 CSRF token 与是否必须改密 | `401` 会话失效 |
| `POST /api/admin/logout` | Cookie + CSRF + Origin | `200 {ok:true}`，撤销当前会话并清理 Cookie | `401/403` 登录或 CSRF 无效 |
| `PUT /api/admin/password` | Cookie + CSRF + Origin；JSON `{currentPassword,newPassword}` | `200 {ok:true}`，保存密码并撤销全部会话 | `400` 密码长度、相同密码或当前密码错误；`429` 限流 |
| `GET /api/admin/content` | Cookie，已完成首次改密 | `200`，完整内容，包含未发布文章 | `401` 无会话；`403` 尚未改密 |
| `PUT /api/admin/content` | Cookie + CSRF + Origin，已改密；完整 JSON 内容 | `200 {ok:true}`，保存整份内容 | `400` JSON/字段校验失败；`413` 大于 512,000 字节 |
| `POST /api/admin/images` | Cookie + CSRF + Origin，已改密；原始图片二进制，不是 multipart | `201 {url:"/assets/upload-….扩展名"}` | `400` 图片签名不符；`413` 大于 5×1024×1024 字节 |

共同错误为 JSON `{error}`：不支持的请求方法 `405`，来源、代理、HTTPS 或 CSRF 不合规 `403`，会话失效 `401`，内部故障 `500`。认证 JSON 接口（登录、改密）还可能返回 `415`（非 `application/json`）、`400`（格式错误）、`413`（超过 8,192 字节）。首次改密限制返回 `code: PASSWORD_CHANGE_REQUIRED`；CSRF 失效返回 `code: CSRF_INVALID`。校验顺序会影响最先收到的错误码，不应只按状态码假定失败原因。

登录/改密按连接 IP 记录失败：5 次连续失败冷却 15 分钟；另有全局每分钟 60 次认证请求、15 分钟内 50 次失败后的冷却以及密码运算并发限制。`429` 带 `Retry-After`。反向代理模式下，应用看到的是代理 IP，所有访问者共享该额度；不要将这一机制当作按真实用户独立限流。公网还需要部署层的限流。

## 5. 素材、运行数据与交付包

| 内容 | 存放与访问方式 | 备份属性 |
| --- | --- | --- |
| 随源码发布的素材 | `public/assets/` → `/assets/文件名` | 公开源码包中保留 |
| 上传的团队照片 | `DATA_DIR/uploads/upload-<32位十六进制随机值>.(jpg\|png\|webp)` → `/assets/同名文件` | 完整私有备份保留；公开快照仅复制公开团队引用素材 |
| 实际运行内容 | `DATA_DIR/content.json` | 私有备份，可包含草稿；不提交到公开 GitHub |
| 管理凭据 | `DATA_DIR/admin-auth.json`，以及改密前可能存在的 `admin-token` | 私密；不进入公开源码包或 GitHub |

后台上传仅支持 JPG、PNG、WebP，单张最多 5 MB。服务端按文件特征识别格式，没有图片重新编码、像素尺寸限制或恶意文件扫描；上传成功会立即创建可通过随机 URL 访问的文件，即使尚未保存成员引用，也不能把它当作私密文件仓库。替换或删除成员不会自动删除旧图片，清理前应核对引用并做私有备份。上传文件使用长缓存且不可变，因此替换内容应产生新文件名。

公开源码 ZIP 不包含完整运行 `content.json`、实际运行中的未发布文章、`admin-auth.json`、`admin-token`、环境文件、日志、临时截图、原始 PPT/剪贴板/提取工作文件，也不包含完整上传目录。`data/seed.json` 是初始化样例，新闻列表为空；`backups/published-content.json` 是公开快照，当前包含两篇已发布新闻。新空数据目录需要展示已确认的公开内容时，按部署文档导入公开快照；不要把 seed 当作最新运行数据。包内文件与清单所指提交保持一致，请按交付清单核对。

运行 `node scripts/backup-content.mjs` 会过滤未发布新闻，并复制当前团队引用的上传图片；它不会复制认证文件，也不会自动删除 `backups/uploads/` 中以往复制的文件。打包或提交前仍需按最新快照检查图片引用，避免把无关文件混入公开交付。

**完整迁移须在本地停服后，通过私密渠道迁移实际 `DATA_DIR`**，包含运行内容、草稿、上传图片及决定保留的凭据。接收端核对权限、文件完整性及实际数据目录后再启动；相关操作见 [部署文档](DEPLOYMENT.md)。若只从公开快照恢复，草稿不会恢复，管理员需要重新初始化。不要用种子或公开快照覆盖已有、尚未备份的运行内容。

### 重新生成和校验源码交接包

在具有 Git 历史的源码仓库中，先生成公开快照、检查公开素材、完成验证并提交，再执行：

```bash
node scripts/create-handoff.mjs
```

脚本要求已跟踪文件无未提交改动，仅导出已提交的 HEAD，不打包工作区中的未跟踪文件。输出位于忽略目录 `handoff/<提交前12位>/`，包含 `khfwcms-handover-<提交前12位>.zip`、同名 `.zip.sha256` 和 `HANDOVER-MANIFEST.json`。ZIP 内顶层为 `khfwcms/`；清单记录完整提交号、提交时间及每个源码文件的 SHA-256。上传快照按当前公开团队引用再次过滤，缺少所需图片或快照含未发布新闻时停止打包。

接收方先将 ZIP 和对应 `.sha256` 放到同一目录，将下例的提交标识替换为实际值后校验：

```bash
sha256sum -c khfwcms-handover-xxxxxxxxxxxx.zip.sha256
```

通过后再解压，并核对包内 `HANDOVER-MANIFEST.json` 的 `sourceCommit` 和逐文件哈希。详细校验、导入公开快照和首次启动步骤见 [Linux 部署与验收文档](DEPLOYMENT.md)。ZIP 不包含 `.git`；要重新生成版本包，应从 Git 仓库检出对应提交。Windows 上的源码测试或解压验收不等于已完成 Linux 服务器部署验收。

## 6. 验证方式与边界

开发过程中已在 Windows 环境完成过 API/认证和浏览器功能验证；这属于历史开发验证，不是当前交付包在 Linux 或真实域名上的验收结论。本次版本的提交号、执行日期、环境、结果与证据应记录到 [验收清单](ACCEPTANCE.md)。当前没有可据此宣称完成 `kehoubang.cn`、`www` 或 `khb` 公网验收的记录。

在源码根目录执行：

```bash
npm test
```

它运行 `tests/cms.test.mjs` 和 `tests/tunnel.test.mjs`，使用临时数据目录和测试凭据，覆盖内容校验、旧凭据迁移、首次改密、Cookie/CSRF、HTTPS/反代来源、错误代理不循环跳转、穿透启动参数、登录限流、会话过期/撤销、上传限制、草稿隔离、保存和重启持久化、私有文件不可通过静态路径访问。不会修改正式运行数据；不依赖额外 npm 包。

可选浏览器检查：

| 脚本 | 实际覆盖与运行要求 |
| --- | --- |
| `node tests/browser.cjs` | 启动临时数据服务；验证移动后台初始改密、Cookie、重新登录保留编辑、保存及退出 |
| `node tests/site-interactions.cjs` | 路由模拟 seed/API；验证 55 门课程弹窗、二维码、返回顶部和移动深色布局；不验证真实 API 或 HTTPS |
| `node tests/document-navigation.cjs` | 隔离阅读器 HTML 样本，验证三个资料的外链、返回官网、重复加载/iframe 隔离及手机导航；不替代真实阅读器验收 |

浏览器脚本需要 Playwright，且当前使用 `channel: 'msedge'`；默认模块路径是开发机 Windows 路径。接手方应通过 `PLAYWRIGHT_PATH` 指向可用的 Playwright 模块，并提供 Microsoft Edge，或调整测试中的浏览器启动配置；它们不是开箱即用的 Linux 无头测试环境，也不是部署或运行网站的依赖。运行前建立 `reference/` 目录，截图仅保存在该忽略目录。课程检查脚本对 55 门课程、每门 3 条学习内容等有固定断言，内容变更后须同步测试数据与预期。

测试通过不代表公网环境验收或渗透测试完成。真实 DNS、证书、`www` 跳转、管理登录、代理头和备份恢复须在目标环境验证；步骤见部署文档，结果填入验收清单。

## 7. 已知限制与接手清单

此实现适合单实例、单管理员、小规模内容维护。会话、限流和写队列只存在进程内；没有共享会话存储、数据库事务、跨实例锁、账号分权、MFA、操作审计、内容版本回滚、计划发布、公众号自动同步或监控告警。不得让多个 Node 进程共同写同一个数据目录。联系区没有咨询提交表单或邮件发送后端。

接手责任、内容授权、域名/证书、私有恢复演练和上线签收统一在 [验收清单](ACCEPTANCE.md) 填写，避免技术交接与部署人员各自保留不同版本的结论。移交密码、DNS、服务器和备份访问权限时使用私密渠道，不把账户资料填入公开文档。

后续代码修改遵循 [AGENTS.md](../AGENTS.md)：修改前备份，验证完成后再次提交/推送到指定 GitHub 仓库，不强制推送；只提交公开源码、公开素材和公开快照。推送失败须明确记录，不能视为云端备份已完成。
