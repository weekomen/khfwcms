import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHandoffPlan, safeRelativePath } from './create-handoff.mjs';

export async function verifyHandoff(directory) {
  const root = path.resolve(directory);
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error('请提供解压后普通 khfwcms 目录。');
  const found = new Map();
  const directories = [];
  async function walk(relative = '') {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (!safeRelativePath(name)) throw new Error(`不安全的路径：${name}`);
      if (entry.isSymbolicLink()) throw new Error(`包内不允许符号链接：${name}`);
      if (entry.isDirectory()) { directories.push(name); await walk(name); }
      else if (entry.isFile()) found.set(name, await readFile(path.join(root, ...name.split('/'))));
      else throw new Error(`包内不允许特殊文件：${name}`);
    }
  }
  await walk();
  const manifestBytes = found.get('HANDOVER-MANIFEST.json');
  if (!manifestBytes) throw new Error('缺少 HANDOVER-MANIFEST.json。');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.version !== 1 || manifest.archivePrefix !== 'khfwcms/' || !/^[a-f0-9]{40,64}$/.test(manifest.sourceCommit) || !Array.isArray(manifest.files)) throw new Error('交接清单格式不正确。');
  const expected = new Map();
  for (const file of manifest.files) {
    if (!safeRelativePath(file.path) || expected.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error('交接清单存在非法或重复文件。');
    expected.set(file.path, file);
  }
  const read = file => {
    const bytes = found.get(file);
    if (!bytes) throw new Error(`包内缺少文件：${file}`);
    return bytes;
  };
  const { files } = buildHandoffPlan([...expected.keys()].map(file => ({ path: file, mode: '100644', type: 'blob' })), read);
  if (files.length !== expected.size) throw new Error('清单包含不允许公开的路径。');
  const permitted = new Set([...expected.keys(), 'HANDOVER-MANIFEST.json']);
  for (const name of found.keys()) if (!permitted.has(name)) throw new Error(`包内存在清单以外的文件：${name}`);
  for (const name of directories) if (![...permitted].some(file => file.startsWith(name + '/'))) throw new Error(`包内存在清单以外的目录：${name}`);
  for (const file of files) {
    const declared = expected.get(file.path);
    if (file.size !== declared.size || file.sha256 !== declared.sha256) throw new Error(`文件校验失败：${file.path}`);
  }
  return { ok: true, directory: root, sourceCommit: manifest.sourceCommit, files: files.length, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex') };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) { console.error('用法：node scripts/verify-handoff.mjs <解压后的 khfwcms 目录>'); process.exitCode = 1; }
  else verifyHandoff(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
