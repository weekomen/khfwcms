import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../validation.mjs';

// Export committed public files only. Never traverse the live data directory.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
if (git('status', '--porcelain', '--untracked-files=no').toString().trim()) {
  throw new Error('请先提交已验证的源码与文档，再生成交接包。运行数据不会加入交接包。');
}
const commit = git('rev-parse', 'HEAD').toString().trim();
const committedAt = git('show', '-s', '--format=%cI', 'HEAD').toString().trim();
const snapshot = JSON.parse(git('show', 'HEAD:backups/published-content.json').toString());
validateContent(snapshot);
if (snapshot.news.some(article => !article.published)) throw new Error('公开内容快照含未发布文章，停止打包。');
const referencedUploads = new Set(snapshot.team.map(member => path.posix.basename(member.image)).filter(name => /^upload-[a-f0-9]{32}\.(png|jpg|webp)$/.test(name)));
const tracked = git('ls-tree', '-r', '--name-only', '-z', 'HEAD').toString().split('\0').filter(Boolean);
const rootFiles = new Set(['.gitignore', 'AGENTS.md', 'README.md', 'package.json', 'server.mjs', 'auth.mjs', 'validation.mjs', 'data/seed.json', 'backups/published-content.json']);
const unsafe = /(^|\/)(\.env(?:\..*)?|admin-token|admin-auth\.json(?:\..*)?)$|\.(log|tmp)$/i;
const files = tracked.filter(file => {
  if (unsafe.test(file)) return false;
  if (file.startsWith('backups/uploads/')) return referencedUploads.has(path.posix.basename(file));
  return rootFiles.has(file) || /^(public|scripts|tests|docs|deploy)\//.test(file);
}).sort();
for (const name of referencedUploads) {
  if (!files.includes(`backups/uploads/${name}`)) throw new Error(`公开图片快照缺失：${name}，请先运行 backup-content.mjs 并提交。`);
}
for (const file of ['docs/DEPLOYMENT.md', 'docs/HANDOVER.md', 'deploy/khfwcms.service', 'deploy/nginx.conf', 'deploy/khfwcms.env.example', 'scripts/create-handoff.mjs']) {
  if (!files.includes(file)) throw new Error(`交接文件尚未提交：${file}`);
}
const manifest = {
  project: '课后邦企业官网与 CMS',
  repository: 'https://github.com/weekomen/khfwcms.git',
  sourceCommit: commit,
  committedAt,
  archivePrefix: 'khfwcms/',
  scope: 'Committed source, deployment documentation, public assets and published content snapshot only.',
  excluded: ['Git history', 'live content.json and drafts', 'credentials and environment files', 'logs and screenshots', 'unreferenced uploads', 'original working files'],
  initialization: 'Read docs/DEPLOYMENT.md before launch. Import backups/published-content.json only into a new empty DATA_DIR. Full private data requires a separate secure transfer.',
  files: files.map(file => ({ path: file, sha256: createHash('sha256').update(git('show', `HEAD:${file}`)).digest('hex') }))
};
const output = path.join(root, 'handoff', commit.slice(0, 12));
await mkdir(output, { recursive: true });
const manifestPath = path.join(output, 'HANDOVER-MANIFEST.json');
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const filename = `khfwcms-handover-${commit.slice(0, 12)}.zip`;
const archivePath = path.join(output, filename);
git('archive', '--format=zip', '--prefix=khfwcms/', `--mtime=${committedAt}`, `--add-file=${manifestPath}`, `--output=${archivePath}`, commit, '--', ...files);
const checksum = createHash('sha256').update(await readFile(archivePath)).digest('hex');
await writeFile(`${archivePath}.sha256`, `${checksum}  ${filename}\n`);
console.log(JSON.stringify({ archive: archivePath, checksum: `${archivePath}.sha256`, manifest: manifestPath, sourceCommit: commit, files: files.length }, null, 2));
