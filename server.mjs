import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from './validation.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
await mkdir(dataDir, { recursive: true });
const contentPath = path.join(dataDir, 'content.json');
try { await readFile(contentPath); } catch { await writeFile(contentPath, await readFile(path.join(root, 'data/seed.json'))); }
let token = process.env.ADMIN_TOKEN;
if (!token) { try { token = (await readFile(path.join(dataDir, 'admin-token'), 'utf8')).trim(); } catch { token = randomBytes(24).toString('hex'); await writeFile(path.join(dataDir, 'admin-token'), token, { mode: 0o600 }); } }
let writing = Promise.resolve();
const mime = { '.pdf': 'application/pdf', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function authorized(req) { const input = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, '')); const expected = Buffer.from(token); return input.length === expected.length && timingSafeEqual(input, expected); }
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/admin/images') {
      if (!authorized(req)) return send(401, { error: '管理密钥不正确，请重新登录' });
      if (req.method !== 'POST') return send(405, { error: '不支持此操作' });
      const limit = 5 * 1024 * 1024;
      if (Number(req.headers['content-length']) > limit) return send(413, { error: '图片不能超过 5 MB' });
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > limit) return send(413, { error: '图片不能超过 5 MB' }); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      let ext;
      if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') ext = 'png';
      else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) ext = 'jpg';
      else if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) ext = 'webp';
      if (!ext) return send(400, { error: '请选择有效的 JPG、PNG 或 WebP 图片' });
      const name = `upload-${randomBytes(16).toString('hex')}.${ext}`;
      await mkdir(path.join(dataDir, 'uploads'), { recursive: true });
      await writeFile(path.join(dataDir, 'uploads', name), bytes, { flag: 'wx' });
      return send(201, { url: `/assets/${name}` });
    }
    if (url.pathname === '/api/content') {
      if (req.method === 'GET') { const content = JSON.parse(await readFile(contentPath, 'utf8')); content.news = content.news.filter(n => n.published); return send(200, content); }
      return send(405, { error: '不支持此操作' });
    }
    if (url.pathname === '/api/admin/content') {
      if (!authorized(req)) return send(401, { error: '管理密钥不正确，请重新登录' });
      if (req.method === 'GET') return send(200, JSON.parse(await readFile(contentPath, 'utf8')));
      if (req.method !== 'PUT') return send(405, { error: '不支持此操作' });
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 512000) return send(413, { error: '内容过大' }); }
      let content; try { content = JSON.parse(body); validateContent(content); } catch (e) { return send(400, { error: e.message }); }
      const job = writing.then(async () => { await writeFile(contentPath + '.tmp', JSON.stringify(content, null, 2)); await rename(contentPath + '.tmp', contentPath); });
      writing = job.catch(() => { }); await job; return send(200, { ok: true });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: '不支持此操作' });
    if (/^\/assets\/upload-[a-f0-9]{32}\.(png|jpg|webp)$/.test(url.pathname)) {
      const buffer = await readFile(path.join(dataDir, 'uploads', path.basename(url.pathname)));
      res.writeHead(200, { 'Content-Type': mime[path.extname(url.pathname)], 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(req.method === 'HEAD' ? undefined : buffer);
    }
    const relative = url.pathname === '/' ? 'index.html' : url.pathname === '/admin' ? 'admin.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const publicRoot = path.join(root, 'public'); const file = path.resolve(publicRoot, relative);
    if (!file.startsWith(publicRoot + path.sep)) return send(403, { error: '无权访问' });
    const buffer = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : buffer);
  } catch (e) { send(e.code === 'ENOENT' ? 404 : 500, { error: e.code === 'ENOENT' ? '页面不存在' : '服务暂时不可用' }); }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`课后邦官网：http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}\n管理后台：/admin\n管理密钥：${process.env.ADMIN_TOKEN ? '由 ADMIN_TOKEN 环境变量设置' : path.join(dataDir, 'admin-token')}`));
