import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { validateContent } from '../validation.mjs';

const seed = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'));
// Draft articles are private test fixtures, never part of the shipped seed.
const draftNews = [1, 2].map(index => ({
  id: 'test-draft-' + index, title: 'Test draft ' + index, category: 'Testing', date: '2026-09-23',
  summary: 'Test-only draft', body: 'Test-only unpublished content', source: 'https://example.com/article-' + index, published: false
}));
const validationFixture = { ...seed, news: draftNews };
const legacyPassword = 'test-only-legacy-token';
const password = 'River lantern walks across 48 hills!';
const nextPassword = 'Morning clouds rest beside 73 lakes!';

async function temporaryData() {
  const dir = await mkdtemp(path.join(tmpdir(), 'khb-test-'));
  await writeFile(path.join(dir, 'admin-token'), legacyPassword);
  return dir;
}
async function removeTemporaryData(dir) {
  // Never remove anything outside the test directory created by mkdtemp.
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
  assert.ok(path.basename(dir).startsWith('khb-test-'));
  await rm(dir, { recursive: true, force: true });
}
async function testServer(t, environment = {}) {
  const dir = await temporaryData();
  const port = 32000 + Math.floor(Math.random() * 10000);
  const origin = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => {
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  };
  t.after(async () => { await stop(); await removeTemporaryData(dir); });
  const start = async () => {
    let output = '';
    child = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DATA_DIR: dir, ADMIN_TOKEN: '', ADMIN_PASSWORD: '', PUBLIC_ORIGIN: '', TRUST_PROXY: '', HOST: '127.0.0.1', PORT: String(port), ...environment },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw Error(`Test server exited: ${output}`);
      try { if ((await fetch(origin + '/api/content')).ok) return; } catch {}
      await delay(100);
    }
    throw Error(`Test server timeout: ${output}`);
  };
  await start();
  return { dir, origin, stop, start, api: (route, options) => fetch(origin + route, options) };
}
function sessionHeaders(origin, session, extra = {}) {
  return { Origin: origin, 'Content-Type': 'application/json', Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken, ...extra };
}
async function login(api, origin, value, extra = {}) {
  const response = await api('/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify({ password: value }) });
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Path=\/api\/admin/i);
  assert.ok(body.csrfToken);
  return { ...body, cookie: setCookie.split(';')[0], setCookie };
}
async function changePassword(api, origin, session, currentPassword, newPassword, extra = {}) {
  return api('/api/admin/password', { method: 'PUT', headers: sessionHeaders(origin, session, extra), body: JSON.stringify({ currentPassword, newPassword }) });
}

test('content rejects unsafe URLs, assets and duplicate IDs', () => {
  validateContent(seed);
  const invalidCourse = structuredClone(seed); invalidCourse.courses[0].page = 33; assert.throws(() => validateContent(invalidCourse));
  for (const change of [c => c.news[0].source = 'javascript:alert(1)', c => c.team[0].image = '/../../secret', c => c.news[1].id = c.news[0].id]) { const c = structuredClone(validationFixture); change(c); assert.throws(() => validateContent(c)); }
});

test('legacy login migration, CSRF, CMS publication and persistence, and session revocation', async t => {
  const { dir, origin, api, stop, start } = await testServer(t);
  assert.equal((await api('/api/admin/content')).status, 401);
  assert.equal((await api('/api/admin/content', { headers: { Authorization: `Bearer ${legacyPassword}` } })).status, 401);
  assert.equal((await api('/api/admin/images', { method: 'POST', headers: { Origin: origin }, body: 'image' })).status, 401);
  const initial = await login(api, origin, legacyPassword);
  assert.equal(initial.passwordChangeRequired, true);
  assert.doesNotMatch(initial.setCookie, /;\s*Secure/i);
  const authText = await readFile(path.join(dir, 'admin-auth.json'), 'utf8');
  const initialAuth = JSON.parse(authText);
  assert.equal(initialAuth.algorithm, 'scrypt');
  assert.equal(initialAuth.N, 131072);
  assert.ok(Buffer.from(initialAuth.salt, 'base64').length >= 16);
  assert.ok(Buffer.from(initialAuth.hash, 'base64').length >= 32);
  assert.equal(authText.includes(legacyPassword), false);
  const restricted = await api('/api/admin/content', { headers: sessionHeaders(origin, initial) });
  assert.equal(restricted.status, 403);
  assert.equal((await restricted.json()).code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await changePassword(api, origin, initial, legacyPassword, 'password')).status, 400);
  assert.equal((await changePassword(api, origin, initial, legacyPassword, legacyPassword)).status, 400);
  assert.equal((await changePassword(api, origin, initial, 'wrong-current-password', password)).status, 400);
  const changed = await changePassword(api, origin, initial, legacyPassword, password);
  assert.equal(changed.status, 200, await changed.clone().text());
  assert.match(changed.headers.get('set-cookie'), /Max-Age=0/i);
  assert.equal((await api('/api/admin/session', { headers: sessionHeaders(origin, initial) })).status, 401);
  await assert.rejects(readFile(path.join(dir, 'admin-token')), { code: 'ENOENT' });
  const savedAuth = JSON.parse(await readFile(path.join(dir, 'admin-auth.json'), 'utf8'));
  assert.equal(savedAuth.passwordChangeRequired, false);
  assert.notEqual(savedAuth.salt, initialAuth.salt);
  assert.notEqual(savedAuth.hash, initialAuth.hash);
  assert.equal((await api('/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: legacyPassword }) })).status, 401);
  const session = await login(api, origin, password);
  const headers = sessionHeaders(origin, session);
  assert.equal(session.passwordChangeRequired, false);
  assert.equal((await api('/api/admin/session', { headers })).status, 200);
  assert.equal((await api('/api/admin/content', { method: 'PUT', headers: { Cookie: session.cookie, Origin: origin }, body: '{}' })).status, 403);
  assert.equal((await api('/api/admin/content', { method: 'PUT', headers: { ...headers, Origin: 'https://attacker.example' }, body: '{}' })).status, 403);
  const noOrigin = { ...headers }; delete noOrigin.Origin;
  assert.equal((await api('/api/admin/content', { method: 'PUT', headers: noOrigin, body: '{}' })).status, 403);
  assert.equal((await api('/api/admin/content', { method: 'PUT', headers: { ...headers, 'X-CSRF-Token': 'invalid-csrf-token' }, body: '{}' })).status, 403);
  assert.equal((await api('/api/admin/login', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })).status, 403);
  assert.equal((await api('/api/admin/session', { headers: { ...headers, 'X-Forwarded-For': '203.0.113.99' } })).status, 403);
  const image = await readFile(new URL('../public/assets/image5.webp', import.meta.url));
  assert.equal((await api('/api/admin/images', { method: 'POST', headers, body: 'not an image' })).status, 400);
  assert.equal((await api('/api/admin/images', { method: 'POST', headers, body: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 413);
  const upload = await api('/api/admin/images', { method: 'POST', headers, body: image });
  assert.equal(upload.status, 201);
  const uploaded = await upload.json();
  assert.deepEqual(Buffer.from(await (await api(uploaded.url)).arrayBuffer()), image);
  assert.equal((await api('/data/admin-token')).status, 404);
  assert.equal((await api('/data/admin-auth.json')).status, 404);
  assert.equal((await (await api('/api/content')).json()).news.length, 0);
  const content = await (await api('/api/admin/content', { headers })).json();
  content.team[0].image = uploaded.url;
  content.courses[0].summary = '课程简介保存验证';
  content.courses[0].description = '课程详细介绍保存验证';
  content.courses[0].outline = '学习内容一\n学习内容二';
  content.news = structuredClone(draftNews);
  content.news[0] = { ...content.news[0], title: '已发布测试文章', published: true, body: '测试内容', date: '2026-09-23' };
  assert.equal((await api('/api/admin/content', { method: 'PUT', headers, body: JSON.stringify(content) })).status, 200);
  const published = await (await api('/api/content')).json();
  assert.equal(published.news.length, 1);
  assert.equal(published.news[0].title, '已发布测试文章');
  assert.equal((await api('/api/admin/content', { method: 'PUT', headers, body: '{}' })).status, 400);
  const secondSession = await login(api, origin, password);
  assert.equal((await api('/api/admin/logout', { method: 'POST', headers })).status, 200);
  assert.equal((await api('/api/admin/session', { headers })).status, 401);
  assert.equal((await api('/api/admin/session', { headers: sessionHeaders(origin, secondSession) })).status, 200);
  const thirdSession = await login(api, origin, password);
  assert.equal((await changePassword(api, origin, secondSession, password, nextPassword)).status, 200);
  for (const revoked of [secondSession, thirdSession]) assert.equal((await api('/api/admin/session', { headers: sessionHeaders(origin, revoked) })).status, 401);
  const beforeRestart = await login(api, origin, nextPassword);
  await stop(); await start();
  assert.equal((await api('/api/admin/session', { headers: sessionHeaders(origin, beforeRestart) })).status, 401);
  await login(api, origin, nextPassword);
  const persisted = await (await api('/api/content')).json();
  assert.equal(persisted.news[0].title, '已发布测试文章');
  assert.equal(persisted.team[0].image, uploaded.url);
  assert.equal(persisted.courses[0].summary, '课程简介保存验证');
  assert.equal(persisted.courses[0].description, '课程详细介绍保存验证');
  assert.equal(persisted.courses[0].outline, '学习内容一\n学习内容二');
  const manual = await api('/assets/course-manual.pdf');
  assert.equal(manual.status, 200); assert.equal(manual.headers.get('content-type'), 'application/pdf');
  assert.equal((await api(uploaded.url)).status, 200);
  assert.equal((await api('/')).status, 200); assert.equal((await api('/admin')).status, 200);
});

test('public HTTPS cookies, strict proxy origin and brute-force protection survive forged XFF', async t => {
  const publicOrigin = 'https://cms.example.test';
  const { origin } = await testServer(t, { PUBLIC_ORIGIN: publicOrigin, TRUST_PROXY: 'loopback' });
  // Use HTTP directly because fetch may replace a caller-supplied Host header.
  const api = (route, options = {}) => new Promise((resolve, reject) => {
    const request = http.request(origin + route, { method: options.method || 'GET', headers: options.headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
    });
    request.on('error', reject);
    request.end(options.body);
  });
  const proxyHeaders = { Host: 'cms.example.test', 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '203.0.113.1' };
  for (const route of ['/admin', '/%61dmin.html', '/ADMIN.HTML']) {
    const redirect = await api(route);
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), publicOrigin + '/admin');
  }
  const securePage = await api('/admin', { headers: proxyHeaders });
  assert.equal(securePage.status, 200);
  assert.match(securePage.headers.get('cache-control'), /no-store/);
  assert.match(securePage.headers.get('strict-transport-security'), /max-age=/);
  const invalidProxyHeaders = [
    { Host: 'cms.example.test' },
    { ...proxyHeaders, 'X-Forwarded-Proto': 'http' },
    { ...proxyHeaders, 'X-Forwarded-Host': 'attacker.example' },
    { ...proxyHeaders, Forwarded: 'proto=https;host=cms.example.test' }
  ];
  for (const headers of invalidProxyHeaders) {
    const rejectedPage = await api('/admin', { headers });
    assert.equal(rejectedPage.status, 403);
    assert.equal(rejectedPage.headers.get('location'), null, 'a bad proxy configuration must not redirect back to the same admin URL');
    assert.match((await rejectedPage.json()).error, /代理配置不匹配/);
  }
  const otherHost = await api('/admin', { headers: { ...proxyHeaders, Host: 'another.example.test' } });
  assert.equal(otherHost.status, 308);
  assert.equal(otherHost.headers.get('location'), publicOrigin + '/admin');
  const initial = await login(api, publicOrigin, legacyPassword, proxyHeaders);
  assert.match(initial.setCookie, /;\s*Secure/i);
  assert.equal((await changePassword(api, publicOrigin, initial, legacyPassword, password, proxyHeaders)).status, 200);
  const session = await login(api, publicOrigin, password, proxyHeaders);
  const headers = sessionHeaders(publicOrigin, session, proxyHeaders);
  const trusted = await api('/api/admin/session', { headers });
  assert.equal(trusted.status, 200);
  assert.match(trusted.headers.get('strict-transport-security'), /max-age=/i);
  for (const invalid of invalidProxyHeaders) {
    const rejectedApi = await api('/api/admin/session', { headers: { ...invalid, Cookie: session.cookie, Origin: publicOrigin } });
    assert.equal(rejectedApi.status, 403, 'an existing session must not bypass proxy validation');
    assert.equal(rejectedApi.headers.get('location'), null);
  }
  assert.equal((await api('/api/admin/session', { headers: { ...headers, 'X-Forwarded-Proto': 'http' } })).status, 403);
  assert.equal((await api('/api/admin/session', { headers: { ...headers, Host: 'attacker.example' } })).status, 403);
  assert.equal((await api('/api/admin/session', { headers: { Cookie: session.cookie } })).status, 403);
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await api('/api/admin/login', { method: 'POST', headers: { ...proxyHeaders, Origin: publicOrigin, 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${attempt + 10}` }, body: JSON.stringify({ password: 'wrong-password' }) });
    assert.equal(response.status, 401);
  }
  const blocked = await api('/api/admin/login', { method: 'POST', headers: { ...proxyHeaders, Origin: publicOrigin, 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.200' }, body: JSON.stringify({ password }) });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal((await api('/api/content')).status, 200);
});

test('sessions expire after inactivity and after the absolute lifetime despite activity', async t => {
  const { createAdminAuth } = await import('../auth.mjs');
  const dir = await temporaryData();
  let now = Date.now();
  const auth = await createAdminAuth({ dataDir: dir, env: {}, now: () => now });
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    try { if (!await auth.handle(req, res, new URL(req.url, 'http://localhost'), send)) send(200, { ok: true }); }
    catch (error) { send(500, { error: error.message }); }
  });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await removeTemporaryData(dir); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const api = (route, options) => fetch(origin + route, options);
  const initial = await login(api, origin, legacyPassword);
  assert.equal((await changePassword(api, origin, initial, legacyPassword, password)).status, 200);
  const idle = await login(api, origin, password);
  now += 30 * 60 * 1000 + 1;
  assert.equal((await api('/api/admin/session', { headers: sessionHeaders(origin, idle) })).status, 401);
  const active = await login(api, origin, password);
  const startedAt = now;
  for (let step = 1; step < 24; step++) {
    now = startedAt + step * 20 * 60 * 1000;
    assert.equal((await api('/api/admin/session', { headers: sessionHeaders(origin, active) })).status, 200);
  }
  now = startedAt + 8 * 60 * 60 * 1000 + 1;
  assert.equal((await api('/api/admin/session', { headers: sessionHeaders(origin, active) })).status, 401);
});
