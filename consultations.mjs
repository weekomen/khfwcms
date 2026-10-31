import { randomBytes } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const WINDOW_MS = 15 * 60 * 1000;
const DUPLICATE_MS = 10 * 60 * 1000;
const MAX_RECORDS = 5000;
const MAX_SOURCES = 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });
const localSocket = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

function sameOrigin(req) {
  const origin = req.headers.origin, host = req.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string' || /[\s/@\\?#]/.test(host)) return false;
  try {
    const parsed = new URL(origin), target = new URL(`http://${host}`);
    // TLS may end at Nginx/cpolar. The browser Origin must still name the
    // request's own host; forwarded headers cannot authorize another origin.
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.origin === origin && parsed.host === target.host &&
      (!req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']));
  } catch { return false; }
}

async function readJson(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw fail(415, '请使用 JSON 格式提交');
  if (Number(req.headers['content-length']) > 4096) throw fail(413, '提交内容过大');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw fail(413, '提交内容过大');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw fail(400, '提交格式不正确'); }
}

function validateSubmission(body) {
  if (typeof body.name !== 'string' || /[\x00-\x1f\x7f]/.test(body.name)) throw fail(400, '请填写有效姓名');
  const name = body.name.trim();
  if ([...name].length < 1 || [...name].length > 40) throw fail(400, '姓名请填写 1–40 个字符');
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '').replace(/^(?:\+86|0086)/, '') : '';
  if (!/^1[3-9]\d{9}$/.test(phone)) throw fail(400, '请填写有效的 11 位手机号码');
  if (body.consent !== true) throw fail(400, '请先同意为本次咨询联系您');
  if (body.website !== undefined && typeof body.website !== 'string') throw fail(400, '提交格式不正确');
  const page = body.page === undefined ? '/' : body.page;
  if (typeof page !== 'string' || page.length > 300 || !page.startsWith('/') || page.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(page)) throw fail(400, '咨询来源不正确');
  return { name, phone, page: page.split('#')[0], honeypot: !!body.website?.trim() };
}

export async function createConsultations({ dataDir, env = process.env, now = Date.now }) {
  const file = path.join(dataDir, 'consultations.json');
  let items = [];
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (saved.version !== 1 || !Array.isArray(saved.items) || saved.items.length > MAX_RECORDS || saved.items.some(item =>
      !item || !/^[a-f0-9]{32}$/.test(item.id) || typeof item.name !== 'string' || !/^1[3-9]\d{9}$/.test(item.phone) ||
      typeof item.page !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) || !['new', 'contacted'].includes(item.status))) {
      throw new Error('咨询记录文件格式不正确，请恢复有效的私有备份');
    }
    items = saved.items;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let writing = Promise.resolve();
  const sources = new Map();
  let globalAttempts = [];
  async function persist(next) {
    await writeFile(`${file}.tmp`, JSON.stringify({ version: 1, items: next }, null, 2) + '\n', { mode: 0o600 });
    await rename(`${file}.tmp`, file);
    items = next;
  }
  function enqueue(operation) {
    const job = writing.then(operation);
    writing = job.catch(() => {});
    return job;
  }
  function source(req) {
    // Trust the overwritten X-Real-IP only on the explicitly configured local
    // reverse proxy. Arbitrary client XFF headers never create new buckets.
    if (env.TRUST_PROXY === 'loopback' && localSocket(req.socket.remoteAddress) && req.headers['x-forwarded-proto'] === 'https' &&
        typeof req.headers['x-real-ip'] === 'string' && /^[a-fA-F0-9:.]{3,45}$/.test(req.headers['x-real-ip'])) return req.headers['x-real-ip'];
    return req.socket.remoteAddress || 'unknown';
  }
  function rateLimit(req, res) {
    const time = now();
    globalAttempts = globalAttempts.filter(value => time - value < WINDOW_MS);
    for (const [key, attempts] of sources) {
      const active = attempts.filter(value => time - value < WINDOW_MS);
      if (active.length) sources.set(key, active); else sources.delete(key);
    }
    const key = source(req), attempts = sources.get(key) || [];
    if (attempts.length >= 20 || globalAttempts.length >= 200 || (!sources.has(key) && sources.size >= MAX_SOURCES)) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((WINDOW_MS - (time - (attempts[0] ?? globalAttempts[0] ?? time))) / 1000))));
      throw fail(429, '提交过于频繁，请稍后再试');
    }
    attempts.push(time); sources.set(key, attempts); globalAttempts.push(time);
  }
  async function handle(req, res, url, send) {
    const publicRoute = url.pathname === '/api/consultations';
    const adminList = url.pathname === '/api/admin/consultations';
    const adminItem = /^\/api\/admin\/consultations\/([a-f0-9]{32})$/.exec(url.pathname);
    if (!publicRoute && !adminList && !adminItem) return false;
    try {
      if (publicRoute) {
        if (req.method !== 'POST') { send(405, { error: '不支持此操作' }); return true; }
        if (!sameOrigin(req)) throw fail(403, '请求来源不受信任');
        rateLimit(req, res);
        const submission = validateSubmission(await readJson(req));
        if (!submission.honeypot) await enqueue(async () => {
          if (items.some(item => item.phone === submission.phone && now() - Date.parse(item.createdAt) < DUPLICATE_MS)) return;
          if (items.length >= MAX_RECORDS) throw fail(503, '咨询暂时无法提交，请通过官网联系方式与我们联系');
          const item = { id: randomBytes(16).toString('hex'), name: submission.name, phone: submission.phone, page: submission.page, createdAt: new Date(now()).toISOString(), status: 'new' };
          await persist([...items, item]);
        });
        send(201, { ok: true }); return true;
      }
      if (adminList) {
        if (req.method !== 'GET') { send(405, { error: '不支持此操作' }); return true; }
        await writing;
        send(200, { items: structuredClone(items).reverse() }); return true;
      }
      if (!['PATCH', 'DELETE'].includes(req.method)) { send(405, { error: '不支持此操作' }); return true; }
      const body = req.method === 'PATCH' ? await readJson(req) : null;
      if (body && !['new', 'contacted'].includes(body.status)) throw fail(400, '请选择有效的咨询状态');
      const updated = await enqueue(async () => {
        const index = items.findIndex(item => item.id === adminItem[1]);
        if (index < 0) throw fail(404, '咨询记录不存在');
        if (req.method === 'DELETE') { await persist(items.filter((_, position) => position !== index)); return null; }
        const item = { ...items[index], status: body.status };
        const next = [...items]; next[index] = item; await persist(next); return item;
      });
      send(200, updated ? { ok: true, item: updated } : { ok: true }); return true;
    } catch (error) {
      if (error.status) { send(error.status, { error: error.message }); return true; }
      throw error;
    }
  }
  return { handle };
}
