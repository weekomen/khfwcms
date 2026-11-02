import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usage = '用法：npm run start:cpolar -- https://当前公网域名';

export function parsePublicOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('请输入完整的 HTTPS 公网地址，例如 https://example.cpolar.cn'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || /[\\\s]/.test(value)) {
    throw new Error('请输入 HTTPS 域名，不要包含 /admin、账号、密码、查询参数或通配符。');
  }
  if (!url.hostname || url.hostname.includes('*') || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('请输入实际的公网 HTTPS 域名。');
  }
  return url.origin;
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(usage); return; }
  if (args.length > 1) throw new Error(usage);
  let value = args[0];
  if (!value && process.stdin.isTTY) {
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try { value = (await input.question('本次 cpolar HTTPS 公网地址（不含 /admin）：')).trim(); }
    finally { input.close(); }
  }
  if (!value) throw new Error(usage);
  const publicOrigin = parsePublicOrigin(value);
  const port = process.env.PORT || '3000';
  console.log(`公网后台：${publicOrigin}/admin`);
  console.log(`本机后台：http://127.0.0.1:${port}/admin`);
  console.log('本次地址仅在进程中生效。域名变化后，按 Ctrl+C 停止，再使用新地址启动。');
  const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
    cwd: root, shell: false, stdio: 'inherit',
    env: { ...process.env, HOST: '127.0.0.1', PUBLIC_ORIGIN: publicOrigin, TRUST_PROXY: 'loopback' }
  });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); resolve(); });
  }).finally(() => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
