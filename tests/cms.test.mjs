import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { validateContent } from '../validation.mjs';
const seed = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'));
test('content rejects unsafe URLs, assets and duplicate IDs', () => {
  validateContent(seed);
  const invalidCourse = structuredClone(seed); invalidCourse.courses[0].page = 33; assert.throws(() => validateContent(invalidCourse));
  for (const change of [c => c.news[0].source = 'javascript:alert(1)', c => c.team[0].image = '/../../secret', c => c.news[1].id = c.news[0].id]) { const c = structuredClone(seed); change(c); assert.throws(() => validateContent(c)); }
});
test('CMS authentication, draft isolation, publication, persistence and static isolation', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'khb-test-')); const port = 32000 + Math.floor(Math.random() * 10000); let child;
  const start = async () => { child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATA_DIR: dir, ADMIN_TOKEN: 'test-only-token', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] }); await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error('server exited'); }), new Promise((_, reject) => setTimeout(() => reject(Error('server timeout')), 5000).unref())]); };
  const stop = async () => { if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); } };
  const api = (route, options) => fetch(`http://127.0.0.1:${port}${route}`, options);
  const headers = { Authorization: 'Bearer test-only-token', 'Content-Type': 'application/json' };
  try {
    await start();
    assert.equal((await api('/api/admin/content')).status, 401);
    const image = await readFile(new URL('../public/assets/image5.webp', import.meta.url));
    assert.equal((await api('/api/admin/images', { method: 'POST', body: image })).status, 401);
    assert.equal((await api('/api/admin/images', { method: 'POST', headers, body: 'not an image' })).status, 400);
    assert.equal((await api('/api/admin/images', { method: 'POST', headers, body: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 413);
    const upload = await api('/api/admin/images', { method: 'POST', headers, body: image });
    assert.equal(upload.status, 201); const uploaded = await upload.json();
    assert.deepEqual(Buffer.from(await (await api(uploaded.url)).arrayBuffer()), image);
    assert.equal((await api('/data/admin-token')).status, 404);
    assert.equal((await (await api('/api/content')).json()).news.length, 0);
    const content = await (await api('/api/admin/content', { headers })).json();
    content.team[0].image = uploaded.url;
    content.courses[0].summary = '课程简介保存验证';
    content.news[0] = { ...content.news[0], title: '已发布测试文章', published: true, body: '测试内容', date: '2026-09-23' };
    assert.equal((await api('/api/admin/content', { method: 'PUT', headers, body: JSON.stringify(content) })).status, 200);
    const published = await (await api('/api/content')).json(); assert.equal(published.news.length, 1); assert.equal(published.news[0].title, '已发布测试文章');
    assert.equal((await api('/api/admin/content', { method: 'PUT', headers, body: '{}' })).status, 400);
    await stop(); await start(); assert.equal((await (await api('/api/content')).json()).news[0].title, '已发布测试文章');
    assert.equal((await (await api('/api/content')).json()).team[0].image, uploaded.url);
    assert.equal((await (await api('/api/content')).json()).courses[0].summary, '课程简介保存验证');
    const manual = await api('/assets/course-manual.pdf'); assert.equal(manual.status, 200); assert.equal(manual.headers.get('content-type'), 'application/pdf');
    assert.equal((await api(uploaded.url)).status, 200);
    assert.equal((await api('/')).status, 200); assert.equal((await api('/admin')).status, 200);
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
