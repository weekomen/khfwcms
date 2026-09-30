import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../validation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootFiles = new Set(['.gitignore', 'AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'server.mjs', 'auth.mjs', 'validation.mjs', 'data/seed.json', 'backups/published-content.json']);
const supportFiles = new Set([
  'docs/DEPLOYMENT.md', 'docs/HANDOVER.md', 'docs/ACCEPTANCE.md',
  'deploy/khfwcms.service', 'deploy/nginx.conf', 'deploy/nginx-bootstrap.conf', 'deploy/khfwcms-proxy.conf', 'deploy/khfwcms.env.example',
  'scripts/backup-content.mjs', 'scripts/create-handoff.mjs', 'scripts/verify-handoff.mjs',
  'tests/cms.test.mjs', 'tests/handoff.test.mjs', 'tests/browser.cjs', 'tests/site-interactions.cjs'
]);
export const requiredFiles = [
  'README.md', 'package.json', 'server.mjs', 'auth.mjs', 'validation.mjs', 'data/seed.json', 'backups/published-content.json',
  'public/index.html', 'public/app.js', 'public/style.css', 'public/site-theme.css', 'public/courses.js', 'public/courses.css',
  'public/admin.html', 'public/admin.js', 'public/admin.css', 'public/upload.css', 'public/theme.js', 'public/theme.css',
  'docs/DEPLOYMENT.md', 'docs/HANDOVER.md', 'docs/ACCEPTANCE.md', ...[...supportFiles].filter(file => file.startsWith('deploy/') || file.startsWith('scripts/'))
];
const uploadName = /^upload-[a-f0-9]{32}\.(png|jpg|webp)$/;
const knownFields = {
  root: ['site', 'services', 'courses', 'team', 'news'],
  site: ['name', 'tagline', 'headline', 'intro', 'about', 'phone', 'email', 'address', 'filing'],
  services: ['title', 'subtitle', 'description', 'category', 'features'],
  courses: ['title', 'category', 'summary', 'description', 'outline', 'page'],
  team: ['name', 'role', 'bio', 'category', 'image'],
  news: ['id', 'title', 'category', 'date', 'summary', 'body', 'source', 'published']
};
export function validatePublicData(content, label) {
  validateContent(content);
  const checkKeys = (value, allowed, location) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} 含未声明字段 ${location}.${key}，请先确认公开范围。`);
  };
  checkKeys(content, knownFields.root, 'root');
  checkKeys(content.site, knownFields.site, 'site');
  for (const collection of ['services', 'courses', 'team', 'news']) {
    for (const [index, item] of (content[collection] || []).entries()) checkKeys(item, knownFields[collection], `${collection}[${index}]`);
  }
  if (content.news.some(article => !article.published)) throw new Error(`${label} 含未发布文章，停止打包。`);
}
export function safeRelativePath(file) {
  return typeof file === 'string' && !!file && !/[\\\x00-\x1f:]/.test(file) && !path.posix.isAbsolute(file) && file.split('/').every(part => part && part !== '.' && part !== '..');
}
export function isAllowedPath(file, referencedUploads = new Set()) {
  if (!safeRelativePath(file)) return false;
  if (rootFiles.has(file) || supportFiles.has(file)) return true;
  if (/^public\/[a-zA-Z0-9_-]+\.(html|css|js)$/.test(file)) return true;
  if (file === 'public/assets/course-manual.pdf') return true;
  const asset = /^public\/assets\/([a-zA-Z0-9_.-]+\.(png|jpe?g|webp|svg|gif|ico))$/.exec(file);
  if (asset) return !uploadName.test(asset[1]) && !/(?:^|[-_.])(admin-token|admin-auth|secret|credential|screenshot|clipboard)(?:[-_.]|$)/i.test(asset[1]);
  const upload = /^backups\/uploads\/([^/]+)$/.exec(file);
  return !!upload && uploadName.test(upload[1]) && referencedUploads.has(upload[1]);
}
function validateEnvironmentExample(bytes) {
  const allowed = new Set(['NODE_ENV', 'HOST', 'PORT', 'DATA_DIR', 'PUBLIC_ORIGIN', 'TRUST_PROXY']);
  for (const line of bytes.toString('utf8').split(/\r?\n/)) {
    const text = line.trim();
    if (/^(?:#\s*)?(?:[A-Z_]*(?:TOKEN|PASSWORD|SECRET|KEY))\s*=\s*\S/i.test(text)) throw new Error('环境示例包含凭据赋值，停止打包。');
    if (!text || text.startsWith('#')) continue;
    const match = /^([A-Z_]+)=(.*)$/.exec(text);
    if (!match || !allowed.has(match[1])) throw new Error('环境示例包含非公开配置或未知变量，停止打包。');
    if (match[1] === 'PUBLIC_ORIGIN') {
      const url = new URL(match[2]);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('环境示例 PUBLIC_ORIGIN 必须是不含凭据的 HTTPS 来源。');
    }
  }
}
export function buildHandoffPlan(entries, readCommitted) {
  const snapshot = JSON.parse(readCommitted('backups/published-content.json').toString('utf8'));
  const seed = JSON.parse(readCommitted('data/seed.json').toString('utf8'));
  validatePublicData(snapshot, '公开快照');
  validatePublicData(seed, '初始化内容');
  const referencedUploads = new Set(snapshot.team.map(member => path.posix.basename(member.image)).filter(name => uploadName.test(name)));
  const selected = entries.filter(entry => isAllowedPath(entry.path, referencedUploads)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const names = new Set();
  const folded = new Set();
  for (const entry of selected) {
    if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) throw new Error(`不允许归档符号链接、子模块或特殊文件：${entry.path}`);
    if (names.has(entry.path) || folded.has(entry.path.toLowerCase())) throw new Error(`归档路径重复或存在大小写冲突：${entry.path}`);
    names.add(entry.path); folded.add(entry.path.toLowerCase());
  }
  for (const file of requiredFiles) if (!names.has(file)) throw new Error(`交接文件尚未提交：${file}`);
  for (const content of [seed, snapshot]) {
    for (const member of content.team) {
      const name = path.posix.basename(member.image);
      const file = uploadName.test(name) ? `backups/uploads/${name}` : `public${member.image}`;
      if (!names.has(file)) throw new Error(`公开团队图片缺失：${file}`);
    }
  }
  const files = selected.map(entry => {
    const bytes = readCommitted(entry.path);
    if (entry.path === 'deploy/khfwcms.env.example') validateEnvironmentExample(bytes);
    if (/\.(?:mjs|cjs|js|json|md|conf|service|example|html|css)$/.test(entry.path) && /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/.test(bytes.toString('utf8'))) {
      throw new Error(`文件含疑似私钥或访问令牌：${entry.path}`);
    }
    return { path: entry.path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  return { files, referencedUploads };
}
async function ensureLocalDirectory(directory) {
  await mkdir(directory, { recursive: true });
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`输出目录必须为普通本地目录：${directory}`);
}
export async function createHandoff() {
  // Read only committed public blobs; never traverse or copy the live DATA_DIR.
  const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  if (git('status', '--porcelain', '--untracked-files=no').toString().trim()) throw new Error('请先提交已验证的源码与文档，再生成交接包。');
  const help = spawnSync('git', ['archive', '-h'], { cwd: root, encoding: 'utf8' });
  if (help.error) throw help.error;
  if (!`${help.stdout}${help.stderr}`.includes('--mtime')) throw new Error('当前 Git 不支持可复现归档的 --mtime，请更新 Git 后重试。');
  const commit = git('rev-parse', 'HEAD').toString().trim();
  const committedAt = git('show', '-s', '--format=%cI', commit).toString().trim();
  const entries = git('ls-tree', '-r', '-z', commit).toString().split('\0').filter(Boolean).map(line => {
    const match = /^(\d+) (\w+) [a-f0-9]+\t(.+)$/.exec(line);
    if (!match) throw new Error('无法识别 Git 文件清单。');
    return { mode: match[1], type: match[2], path: match[3] };
  });
  const { files } = buildHandoffPlan(entries, file => git('show', `${commit}:${file}`));
  const manifest = {
    version: 1, project: '课后邦企业官网与 CMS', repository: 'https://github.com/weekomen/khfwcms.git',
    sourceCommit: commit, committedAt, archivePrefix: 'khfwcms/',
    scope: 'Exact committed source, deployment documentation, public assets and published content only.',
    excluded: ['Git history', 'live content.json and drafts', 'credentials and active environment files', 'logs and screenshots', 'unreferenced uploads', 'original working files'],
    initialization: 'Read docs/DEPLOYMENT.md before launch. Import the public snapshot only into a new empty DATA_DIR; full private data needs a separate secure transfer.',
    files
  };
  await ensureLocalDirectory(path.join(root, 'handoff'));
  const output = path.join(root, 'handoff', commit.slice(0, 12));
  await ensureLocalDirectory(output);
  const manifestPath = path.join(output, 'HANDOVER-MANIFEST.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const filename = `khfwcms-handover-${commit.slice(0, 12)}.zip`;
  const archivePath = path.join(output, filename);
  // Disable platform line-ending conversion: manifest hashes refer to exact Git blobs.
  // add-file uses the prefix active at this option, so the manifest is inside khfwcms/.
  git('-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'archive', '--format=zip', '--prefix=khfwcms/', `--mtime=${committedAt}`, `--add-file=${manifestPath}`, `--output=${archivePath}.tmp`, commit, '--', ...files.map(file => file.path));
  await rename(`${archivePath}.tmp`, archivePath);
  const checksum = createHash('sha256').update(await readFile(archivePath)).digest('hex');
  await writeFile(`${archivePath}.sha256`, `${checksum}  ${filename}\n`);
  return { archive: archivePath, checksum: `${archivePath}.sha256`, manifest: manifestPath, sourceCommit: commit, files: files.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createHandoff().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
