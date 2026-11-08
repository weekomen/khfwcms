import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, rename, open, unlink, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from './validation.mjs';
import { createAdminAuth } from './auth.mjs';
import { createConsultations } from './consultations.mjs';
import { applyBusinessDefaults } from './business-content.mjs';
import { applyAllianceDefaults } from './alliance-content.mjs';
import { applyEventAlbumDefaults } from './event-albums.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
await mkdir(dataDir, { recursive: true });
const contentPath = path.join(dataDir, 'content.json');
const seedPath = path.join(root, 'data/seed.json');
const seedContent = JSON.parse(await readFile(seedPath, 'utf8'));
validateContent(seedContent);
// A missing archive must never turn a legacy album into a managed empty list.
let eventManifest = null;
try { eventManifest = JSON.parse(await readFile(path.join(root, 'public/assets/events/manifest.json'), 'utf8')); } catch { }
const defaultCollections = ['navigation', 'aboutPages', 'businessPages', 'courseCategories', 'newsCategories', 'venturePages', 'contactTopics', 'alliancePages', 'featuredCourses'];
const legacyTeamCategories = new Set(['管理团队', '技术团队', '运营团队', '职能团队', '教学团队']);
const teamDepartments = new Map(seedContent.team.map(member => [member.name, member.category]));
function withDefaultCollections(content) {
  for (const key of defaultCollections) {
    // This is an in-memory migration for old content.json files. It never
    // writes the seed over an existing runtime file; the administrator must
    // explicitly save the returned object before the new collections persist.
    if (content[key] === undefined && seedContent[key] !== undefined) content[key] = structuredClone(seedContent[key]);
  }
  // Older runtime files did not have a separate course cover. Keep those
  // files readable while exposing the new field to the admin editor; the
  // administrator can explicitly save it when a cover is selected.
  for (const course of content.courses || []) if (course && typeof course === 'object') course.cover ??= '';
  for (const member of content.team || []) {
    if (legacyTeamCategories.has(member.category) && teamDepartments.has(member.name)) {
      member.category = teamDepartments.get(member.name);
    }
  }
  return applyEventAlbumDefaults(applyAllianceDefaults(applyBusinessDefaults(content)), eventManifest);
}
try { await readFile(contentPath); } catch { await writeFile(contentPath, JSON.stringify(seedContent, null, 2) + '\n'); }
const adminAuth = await createAdminAuth({ dataDir });
const consultations = await createConsultations({ dataDir });
let writing = Promise.resolve();
const videoLimit = 50 * 1024 * 1024;
const videoTypes = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
const mediaDir = path.join(dataDir, 'videos');
const mime = { '.pdf': 'application/pdf', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/admin/')) {
      if (await adminAuth.handle(req, res, url, send)) return;
    }
    if (await consultations.handle(req, res, url, send)) return;
    if (url.pathname === '/api/admin/videos') {
      if (req.method !== 'POST') return send(405, { error: '不支持此操作' });
      const type = req.headers['content-type'];
      const extension = Object.hasOwn(videoTypes, type) ? videoTypes[type] : '';
      if (!extension) return send(415, { error: '请选择 MP4 或 WebM 视频' });
      if (Number(req.headers['content-length']) > videoLimit) return send(413, { error: '视频不能超过 50 MB' });
      await mkdir(mediaDir, { recursive: true });
      const name = `course-${randomBytes(16).toString('hex')}.${extension}`;
      const destination = path.join(mediaDir, name);
      const temporary = destination + '.tmp';
      try {
        const file = await open(temporary, 'wx+');
        try {
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > videoLimit) return send(413, { error: '视频不能超过 50 MB' });
            await file.writeFile(chunk);
          }
          const header = Buffer.alloc(12);
          await file.read(header, 0, header.length, 0);
          const valid = extension === 'mp4' ? header.toString('ascii', 4, 8) === 'ftyp' :
            header.readUInt32BE(0) === 0x1a45dfa3;
          if (size < header.length || !valid) return send(400, { error: '视频文件格式无效' });
        } finally { await file.close(); }
        await rename(temporary, destination);
        return send(201, { url: `/media/${name}` });
      } finally { await unlink(temporary).catch(() => {}); }
    }
    if (url.pathname === '/api/admin/images') {
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
      if (req.method === 'GET') {
        const content = withDefaultCollections(JSON.parse(await readFile(contentPath, 'utf8')));
        content.news = (content.news || []).filter(n => n.published);
        content.alliancePages = (content.alliancePages || []).filter(page => page.published !== false);
        content.venturePages = (content.venturePages || []).filter(page => page.published !== false);
        return send(200, content);
      }
      return send(405, { error: '不支持此操作' });
    }
    if (url.pathname === '/api/admin/content') {
      if (req.method === 'GET') return send(200, withDefaultCollections(JSON.parse(await readFile(contentPath, 'utf8'))));
      if (req.method !== 'PUT') return send(405, { error: '不支持此操作' });
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) return send(413, { error: '内容过大' }); chunks.push(chunk); }
      let content; try { content = JSON.parse(Buffer.concat(chunks).toString('utf8')); validateContent(content); content = withDefaultCollections(content); validateContent(content); } catch (e) { return send(400, { error: e.message }); }
      const job = writing.then(async () => { await writeFile(contentPath + '.tmp', JSON.stringify(content, null, 2)); await rename(contentPath + '.tmp', contentPath); });
      writing = job.catch(() => { }); await job; return send(200, { ok: true });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: '不支持此操作' });
    if (/^\/media\/course-[a-f0-9]{32}\.(mp4|webm)$/.test(url.pathname)) {
      const file = path.join(mediaDir, path.basename(url.pathname));
      const { size } = await stat(file);
      let start = 0, end = size - 1;
      const headers = {
        'Content-Type': file.endsWith('.mp4') ? 'video/mp4' : 'video/webm',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable'
      };
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
          if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
        }
        if (!match || !(match[1] || match[2]) || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` });
          return res.end();
        }
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      }
      res.writeHead(range ? 206 : 200, { ...headers, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(file, { start, end });
      res.on('close', () => stream.destroy());
      stream.on('error', () => res.destroy());
      return stream.pipe(res);
    }
    if (/^\/assets\/upload-[a-f0-9]{32}\.(png|jpg|webp)$/.test(url.pathname)) {
      const buffer = await readFile(path.join(dataDir, 'uploads', path.basename(url.pathname)));
      res.writeHead(200, { 'Content-Type': mime[path.extname(url.pathname)], 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(req.method === 'HEAD' ? undefined : buffer);
    }
    const relative = url.pathname === '/' ? 'index.html' : url.pathname === '/admin' ? 'admin.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const publicRoot = path.join(root, 'public'); const file = path.resolve(publicRoot, relative);
    if (!file.startsWith(publicRoot + path.sep)) return send(403, { error: '无权访问' });
    const adminPage = file.toLowerCase() === path.join(publicRoot, 'admin.html').toLowerCase();
    if (adminPage && adminAuth.protectPage(req, res, send)) return;
    const buffer = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': adminPage ? 'no-store' : 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : buffer);
  } catch (e) { send(e.code === 'ENOENT' ? 404 : 500, { error: e.code === 'ENOENT' ? '页面不存在' : '服务暂时不可用' }); }
});
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.maxHeadersCount = 64;
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`课后邦官网：http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}\n管理后台：/admin\n管理凭据保存在本机数据目录；初次登录后必须设置新密码。`));
