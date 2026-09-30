import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const deriveKey = promisify(scrypt);
const SCRYPT = Object.freeze({ N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
const COOKIE = 'khb_admin_session';
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 256;
const MAX_IPS = 1024;
const INVALID_LOGIN = '登录信息不正确，请重试';

function loopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function passwordLength(value) {
  return typeof value === 'string' ? [...value].length : 0;
}

function sessionKey(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cookieValue(req) {
  const values = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return '';
  const value = values[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}

function policyFromEnvironment(env) {
  if (env.TRUST_PROXY && env.TRUST_PROXY !== 'loopback') throw new Error('TRUST_PROXY 仅支持 loopback');
  if (!env.PUBLIC_ORIGIN) {
    if (env.TRUST_PROXY) throw new Error('启用反向代理时必须配置 HTTPS PUBLIC_ORIGIN');
    return { publicOrigin: null, trustProxy: false };
  }
  const parsed = new URL(env.PUBLIC_ORIGIN);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('PUBLIC_ORIGIN 必须是完整 HTTPS 站点来源，例如 https://www.example.com');
  }
  return { publicOrigin: parsed.origin, publicHost: parsed.host, trustProxy: env.TRUST_PROXY === 'loopback' };
}

function requestContext(req, policy) {
  const host = req.headers.host;
  if (typeof host !== 'string' || !host || /[\s/@\\?#]/.test(host)) return null;
  let hostUrl;
  try { hostUrl = new URL(`http://${host}`); } catch { return null; }
  const forwarded = Object.keys(req.headers).some(name => name === 'forwarded' || name.startsWith('x-forwarded-'));
  const localSocket = loopback(req.socket.remoteAddress);
  if (!policy.publicOrigin) {
    if (!localSocket || !['localhost', '127.0.0.1', '[::1]'].includes(hostUrl.hostname) || forwarded) return null;
    return { origin: `http://${hostUrl.host}`, secure: false };
  }
  if (hostUrl.host !== policy.publicHost) return null;
  const trustedProxy = policy.trustProxy && localSocket;
  if (forwarded && !trustedProxy) return null;
  if (trustedProxy) {
    if (req.headers['x-forwarded-proto'] !== 'https') return null;
    if (req.headers['x-forwarded-host'] && req.headers['x-forwarded-host'] !== policy.publicHost) return null;
    if (req.headers.forwarded) return null;
  } else if (!req.socket.encrypted) return null;
  return { origin: policy.publicOrigin, secure: true };
}

async function readJson(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    const error = new Error('请使用 JSON 格式提交'); error.status = 415; throw error;
  }
  if (Number(req.headers['content-length']) > 8192) {
    const error = new Error('请求内容过大'); error.status = 413; throw error;
  }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) { const error = new Error('请求内容过大'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { const error = new Error('请求格式不正确'); error.status = 400; throw error; }
}

export async function createAdminAuth({ dataDir, env = process.env, now = Date.now }) {
  const policy = policyFromEnvironment(env);
  await mkdir(dataDir, { recursive: true });
  const authPath = path.join(dataDir, 'admin-auth.json');
  const initialPath = path.join(dataDir, 'admin-token');
  let hashing = false;
  let passwordChangeInProgress = false;
  async function hashPassword(password, salt) {
    if (hashing) { const error = new Error('认证请求繁忙，请稍后再试'); error.status = 429; throw error; }
    hashing = true;
    try { return await deriveKey(password, salt, 64, SCRYPT); } finally { hashing = false; }
  }
  async function newRecord(password, passwordChangeRequired) {
    const salt = randomBytes(32);
    const hash = await hashPassword(password, salt);
    return { version: 1, algorithm: 'scrypt', salt: salt.toString('base64'), hash: hash.toString('base64'), N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, passwordChangeRequired };
  }
  async function persist(record) {
    await writeFile(`${authPath}.tmp`, JSON.stringify(record, null, 2), { mode: 0o600 });
    await rename(`${authPath}.tmp`, authPath);
  }
  let credentials;
  try {
    credentials = JSON.parse(await readFile(authPath, 'utf8'));
    if (credentials.version !== 1 || credentials.algorithm !== 'scrypt' || credentials.N !== SCRYPT.N || credentials.r !== SCRYPT.r || credentials.p !== SCRYPT.p ||
        typeof credentials.salt !== 'string' || Buffer.from(credentials.salt, 'base64').length !== 32 ||
        typeof credentials.hash !== 'string' || Buffer.from(credentials.hash, 'base64').length !== 64 || typeof credentials.passwordChangeRequired !== 'boolean') {
      throw new Error('管理凭据文件格式不正确，请恢复有效备份');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    let initialPassword = env.ADMIN_TOKEN;
    if (!initialPassword) {
      try { initialPassword = (await readFile(initialPath, 'utf8')).trim(); }
      catch (readError) { if (readError.code !== 'ENOENT') throw readError; }
    }
    if (!initialPassword) {
      initialPassword = randomBytes(32).toString('base64url');
      await writeFile(initialPath, initialPassword, { mode: 0o600 });
    }
    credentials = await newRecord(initialPassword, true);
    await persist(credentials);
  }

  const sessions = new Map();
  const failures = new Map();
  let globalRequests = [];
  let globalFailures = [];
  let globallyLockedUntil = 0;

  function clean() {
    const time = now();
    for (const [key, session] of sessions) {
      if (time - session.lastUsed >= IDLE_MS || time - session.createdAt >= ABSOLUTE_MS) sessions.delete(key);
    }
    for (const [ip, entry] of failures) {
      if (entry.lockedUntil <= time && time - entry.lastFailure >= LOCK_MS) failures.delete(ip);
    }
    globalRequests = globalRequests.filter(timeOfRequest => time - timeOfRequest < 60000);
    globalFailures = globalFailures.filter(timeOfFailure => time - timeOfFailure < LOCK_MS);
  }
  function retry(res, send, seconds = 1) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(seconds))));
    send(429, { error: '尝试过于频繁，请稍后再试' });
    return true;
  }
  function rateLimited(req, res, send) {
    clean();
    const time = now();
    const entry = failures.get(req.socket.remoteAddress);
    const until = Math.max(entry?.lockedUntil || 0, globallyLockedUntil);
    if (until > time) return retry(res, send, (until - time) / 1000);
    if (hashing || passwordChangeInProgress) return retry(res, send);
    if (globalRequests.length >= 60) return retry(res, send, (globalRequests[0] + 60000 - time) / 1000);
    if (!entry && failures.size >= MAX_IPS) return retry(res, send, 60);
    globalRequests.push(time);
    return false;
  }
  function fail(req) {
    const time = now(), ip = req.socket.remoteAddress;
    const entry = failures.get(ip) || { count: 0, lastFailure: time, lockedUntil: 0 };
    entry.count += 1; entry.lastFailure = time;
    if (entry.count >= 5) entry.lockedUntil = time + LOCK_MS;
    failures.set(ip, entry);
    globalFailures.push(time);
    if (globalFailures.length >= 50) globallyLockedUntil = time + LOCK_MS;
  }
  function setCookie(res, value, secure, clear = false) {
    res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : ABSOLUTE_MS / 1000}${secure ? '; Secure' : ''}`);
  }
  async function verify(password, snapshot) {
    if (!passwordLength(password) || passwordLength(password) > 256) return false;
    const actual = await hashPassword(password, Buffer.from(snapshot.salt, 'base64'));
    return timingSafeEqual(actual, Buffer.from(snapshot.hash, 'base64'));
  }
  function sessionPayload(session) {
    return { ok: true, csrfToken: session.csrfToken, passwordChangeRequired: credentials.passwordChangeRequired };
  }

  async function handle(req, res, url, send) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Frame-Options', 'DENY');
    const context = requestContext(req, policy);
    if (!context) { send(403, { error: '管理登录仅允许本机访问或已配置的 HTTPS 站点' }); return true; }
    if (context.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const origin = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    if ((origin && origin !== context.origin) || (fetchSite && !['same-origin', 'none'].includes(fetchSite))) {
      send(403, { error: '请求来源不受信任' }); return true;
    }
    const mutating = !['GET', 'HEAD'].includes(req.method);
    if (mutating && origin !== context.origin) { send(403, { error: '请求来源不受信任' }); return true; }
    clean();
    try {
      if (url.pathname === '/api/admin/login') {
        if (req.method !== 'POST') { send(405, { error: '不支持此操作' }); return true; }
        if (rateLimited(req, res, send)) return true;
        const { password } = await readJson(req);
        const snapshot = credentials;
        if (!await verify(password, snapshot) || credentials !== snapshot) {
          fail(req); send(401, { error: INVALID_LOGIN }); return true;
        }
        if (passwordChangeInProgress) return retry(res, send);
        failures.delete(req.socket.remoteAddress);
        const previous = cookieValue(req);
        if (previous) sessions.delete(sessionKey(previous));
        const value = randomBytes(32).toString('base64url');
        const session = { csrfToken: randomBytes(32).toString('base64url'), createdAt: now(), lastUsed: now() };
        if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
        sessions.set(sessionKey(value), session);
        setCookie(res, value, context.secure);
        send(200, sessionPayload(session)); return true;
      }

      const value = cookieValue(req);
      const key = value ? sessionKey(value) : '';
      const session = sessions.get(key);
      if (!session) { setCookie(res, '', context.secure, true); send(401, { error: '登录已过期，请重新登录' }); return true; }
      if (mutating && !safeEqual(req.headers['x-csrf-token'], session.csrfToken)) {
        send(403, { error: '登录状态已更新，请重新登录后重试', code: 'CSRF_INVALID' }); return true;
      }
      session.lastUsed = now();

      if (url.pathname === '/api/admin/session') {
        if (req.method !== 'GET') { send(405, { error: '不支持此操作' }); return true; }
        send(200, sessionPayload(session)); return true;
      }
      if (url.pathname === '/api/admin/logout') {
        if (req.method !== 'POST') { send(405, { error: '不支持此操作' }); return true; }
        sessions.delete(key); setCookie(res, '', context.secure, true);
        send(200, { ok: true }); return true;
      }
      if (url.pathname === '/api/admin/password') {
        if (req.method !== 'PUT') { send(405, { error: '不支持此操作' }); return true; }
        if (rateLimited(req, res, send)) return true;
        const { currentPassword, newPassword } = await readJson(req);
        const length = passwordLength(newPassword);
        if (length < 15 || length > 128) { send(400, { error: '新密码须为 15–128 个字符，建议使用独立的长密码' }); return true; }
        if (safeEqual(currentPassword, newPassword)) { send(400, { error: '新密码需要与当前密码不同' }); return true; }
        const snapshot = credentials;
        if (!await verify(currentPassword, snapshot)) {
          fail(req); send(400, { error: INVALID_LOGIN }); return true;
        }
        if (credentials !== snapshot || !sessions.has(key)) {
          setCookie(res, '', context.secure, true); send(401, { error: '登录已过期，请重新登录' }); return true;
        }
        if (passwordChangeInProgress) return retry(res, send);
        passwordChangeInProgress = true;
        try {
          const record = await newRecord(newPassword, false);
          await persist(record);
          credentials = record;
          sessions.clear();
          failures.delete(req.socket.remoteAddress);
          try { await unlink(initialPath); } catch (error) { if (error.code !== 'ENOENT') console.warn('管理密码已更新，但旧初始凭据文件未能清理。'); }
          setCookie(res, '', context.secure, true);
          send(200, { ok: true }); return true;
        } finally { passwordChangeInProgress = false; }
      }
      if (credentials.passwordChangeRequired) {
        send(403, { error: '请先更新初始管理密码', code: 'PASSWORD_CHANGE_REQUIRED' }); return true;
      }
      return false;
    } catch (error) {
      if (error.status === 429) return retry(res, send);
      if (error.status) { send(error.status, { error: error.message }); return true; }
      throw error;
    }
  }

  function protectPage(req, res, send) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    const context = requestContext(req, policy);
    if (context) {
      if (context.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      return false;
    }
    if (policy.publicOrigin && req.headers.host !== policy.publicHost) {
      res.writeHead(308, { Location: `${policy.publicOrigin}/admin`, 'Cache-Control': 'no-store' });
      res.end();
    } else send(403, { error: policy.publicOrigin
      ? '管理代理配置不匹配，请核对 PUBLIC_ORIGIN、TRUST_PROXY 和代理的 HTTPS/Host 请求头'
      : '管理登录仅允许本机访问或已配置的 HTTPS 站点；内网穿透请先配置 HTTPS PUBLIC_ORIGIN 和 TRUST_PROXY=loopback，再重启服务' });
    return true;
  }

  return { handle, protectPage };
}
