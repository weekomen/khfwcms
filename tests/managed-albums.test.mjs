import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { applyEventAlbumDefaults } from '../event-albums.mjs';
import { validateContent } from '../validation.mjs';
import { preparePublicContent } from '../scripts/backup-content.mjs';
import { validatePublicData } from '../scripts/create-handoff.mjs';

const seed = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../public/assets/events/manifest.json', import.meta.url), 'utf8'));
const page = (content, id) => content.venturePages.find(item => item.id === id);
const added = { id: 'photo-added', src: '/assets/added.jpg', filename: '新增合影.jpg', tag: '合影', width: 800, height: 600 };

test('legacy albums expose all 995 archive photos and existing additions without mutating the archive', () => {
  const content = structuredClone(seed), archiveBefore = JSON.stringify(manifest);
  page(content, 'new-year-dinner').photos = [structuredClone(added)];
  applyEventAlbumDefaults(content, manifest);
  assert.equal(page(content, 'new-year-dinner').photos.length, 541);
  assert.equal(page(content, 'new-year-dinner-2026').photos.length, 455);
  assert.deepEqual(page(content, 'new-year-dinner-2027').photos, []);
  assert.equal(page(content, 'new-year-dinner-2027').albumManaged, true);
  assert.deepEqual(page(content, 'new-year-dinner').photos.at(-1), added);
  assert.equal(page(content, 'new-year-dinner').photos[0].thumb, manifest['new-year-dinner'].photos[0].thumb);
  assert.equal(page(content, 'new-year-dinner').photos[0].createdAt, undefined);
  assert.equal(JSON.stringify(manifest), archiveBefore);
  validateContent(content);
});

test('managed ordering, edits, replacements and deliberate empty lists remain authoritative', () => {
  const content = applyEventAlbumDefaults(structuredClone(seed), manifest);
  const dinner = page(content, 'new-year-dinner'), removed = dinner.photos.shift();
  dinner.photos.reverse();
  Object.assign(dinner.photos[0], { filename: '修改后的照片名称.jpg', tag: '桌餐', src: '/assets/replaced.webp' });
  delete dinner.photos[0].thumb;
  page(content, 'new-year-dinner-2026').photos = [];
  const before = JSON.stringify(content);
  applyEventAlbumDefaults(content, manifest);
  assert.equal(JSON.stringify(content), before);
  assert.equal(dinner.photos.some(photo => photo.src === removed.src), false);
  assert.deepEqual(page(content, 'new-year-dinner-2026').photos, []);
  validateContent(content);
  const snapshot = preparePublicContent(content, manifest).content;
  assert.deepEqual(page(snapshot, 'new-year-dinner').photos, dinner.photos);
  assert.deepEqual(page(snapshot, 'new-year-dinner-2026').photos, []);
  validatePublicData(snapshot, 'Managed album snapshot');
});

test('missing archives do not convert legacy galleries to empty managed lists', () => {
  const content = structuredClone(seed), before = JSON.stringify(content);
  applyEventAlbumDefaults(content, null);
  assert.equal(JSON.stringify(content), before);
  const custom = page(content, 'zhilin-hub');
  custom.photos = [structuredClone(added)];
  applyEventAlbumDefaults(content, {});
  assert.equal(custom.albumManaged, true);
  assert.deepEqual(custom.photos, [added]);
});

test('photo validation permits nested archive images and thumbnails while rejecting unsafe paths or flags', () => {
  const content = applyEventAlbumDefaults(structuredClone(seed), manifest);
  validateContent(content);
  const dinner = page(content, 'new-year-dinner');
  for (const bad of ['/assets/events/../secret.jpg', '/assets/events/dinner/../../secret.jpg', '/assets/events/dinner/%2e%2e/secret.jpg', '/assets/events/dinner/a%2fb.jpg', '/assets/events/dinner/a.jpg?x=1', '/assets/events/dinner/photo.svg', '//example.com/photo.jpg', 'https://example.com/photo.jpg', '/assets/other/folder/photo.jpg']) {
    const candidate = structuredClone(content); page(candidate, 'new-year-dinner').photos[0].src = bad;
    assert.throws(() => validateContent(candidate), undefined, bad);
    const thumbnail = structuredClone(content); page(thumbnail, 'new-year-dinner').photos[0].thumb = bad;
    assert.throws(() => validateContent(thumbnail), undefined, `thumbnail ${bad}`);
  }
  dinner.albumManaged = 'true'; assert.throws(() => validateContent(content), /相册管理状态/);
  dinner.albumManaged = true; delete dinner.photos; assert.throws(() => validateContent(content), /照片列表/);
});

test('unapproved uploaded thumbnails are removed from snapshots and rejected by public handoff validation', () => {
  const content = applyEventAlbumDefaults(structuredClone(seed), manifest);
  const dinner = page(content, 'new-year-dinner');
  dinner.photos[0].thumb = `/assets/upload-${'c'.repeat(32)}.jpg`;
  assert.throws(() => validatePublicData(content, 'Unsafe thumbnail'), /相册上传照片/);
  const snapshot = preparePublicContent(content, manifest).content;
  assert.equal(page(snapshot, 'new-year-dinner').photos[0].thumb, undefined);
  validatePublicData(snapshot, 'Safe snapshot');
});

test('admin album CRUD persists across restart and never resurrects archive deletions', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'khb-managed-album-'));
  const original = JSON.stringify(seed, null, 2);
  await writeFile(path.join(dir, 'content.json'), original);
  const initialPassword = 'managed-album-test-initial-password', password = 'Managed album across sixteen rivers!';
  await writeFile(path.join(dir, 'admin-token'), initialPassword);
  const reservation = net.createServer().listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => { if (child && child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } };
  t.after(async () => {
    await stop();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith('khb-managed-album-'));
    await rm(dir, { recursive: true, force: true });
  });
  const start = async () => {
    let output = '';
    child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATA_DIR: dir, ADMIN_TOKEN: '', HOST: '127.0.0.1', PORT: String(port), PUBLIC_ORIGIN: '', TRUST_PROXY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', value => output += value); child.stderr.on('data', value => output += value);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw Error(`Fixture server exited: ${output}`);
      try { if ((await fetch(origin + '/api/content')).ok) return; } catch { }
      await delay(100);
    }
    throw Error('Fixture server startup timeout');
  };
  const login = async value => {
    const response = await fetch(origin + '/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }) });
    assert.equal(response.status, 200);
    return { ...(await response.json()), cookie: response.headers.get('set-cookie').split(';')[0] };
  };
  const headers = session => ({ Origin: origin, Cookie: session.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken });
  await start();
  const initial = await login(initialPassword);
  assert.equal((await fetch(origin + '/api/admin/password', { method: 'PUT', headers: headers(initial), body: JSON.stringify({ currentPassword: initialPassword, newPassword: password }) })).status, 200);
  let session = await login(password);
  const editable = await (await fetch(origin + '/api/admin/content', { headers: headers(session) })).json();
  assert.equal(page(editable, 'new-year-dinner').photos.length, 540);
  assert.equal(page(editable, 'new-year-dinner-2026').photos.length, 455);
  assert.equal(await readFile(path.join(dir, 'content.json'), 'utf8'), original, 'Reading legacy galleries must not rewrite runtime content');
  const dinner = page(editable, 'new-year-dinner'), removed = dinner.photos.shift();
  dinner.photos.reverse(); dinner.photos[0].filename = '管理员修改.jpg'; dinner.photos[0].tag = '合影';
  Object.assign(dinner.photos[1], { src: '/assets/replacement.png', width: 1600, height: 900 }); delete dinner.photos[1].thumb;
  dinner.photos.push(structuredClone(added));
  page(editable, 'new-year-dinner-2026').photos = [];
  page(editable, 'new-year-dinner-2027').photos.push({ ...added, id: 'photo-2027', src: '/assets/2027.jpg' });
  editable.venturePages.push({ id: 'private-company-dinner', title: '未发布年夜饭', summary: '', body: '', published: false, albumManaged: true, photos: [structuredClone(added)] });
  const expected = structuredClone(dinner.photos);
  // Force a transport boundary inside a Chinese character. The large album
  // must preserve names and tags when request chunks do not align with UTF-8.
  const bytes = Buffer.from(JSON.stringify(editable));
  const split = bytes.indexOf(Buffer.from('管理员修改')) + 1;
  assert.ok(split > 1);
  const saved = await new Promise((resolve, reject) => {
    const request = http.request(origin + '/api/admin/content', { method: 'PUT', headers: { ...headers(session), 'Content-Length': bytes.length } }, response => {
      let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject); request.write(bytes.subarray(0, split));
    setTimeout(() => request.end(bytes.subarray(split)), 20);
  });
  assert.equal(saved.status, 200, saved.body);
  await stop(); await start();
  const published = await (await fetch(origin + '/api/content')).json();
  assert.deepEqual(page(published, 'new-year-dinner').photos, expected);
  assert.equal(page(published, 'new-year-dinner').photos.some(photo => photo.src === removed.src), false);
  assert.deepEqual(page(published, 'new-year-dinner-2026').photos, []);
  assert.equal(page(published, 'new-year-dinner-2026').albumManaged, true);
  assert.equal(page(published, 'new-year-dinner-2027').photos.length, 1);
  assert.equal(published.venturePages.some(item => item.id === 'private-company-dinner'), false);
  session = await login(password);
  const admin = await (await fetch(origin + '/api/admin/content', { headers: headers(session) })).json();
  assert.equal(page(admin, 'private-company-dinner').photos.length, 1);
  assert.deepEqual(page(admin, 'new-year-dinner').photos, expected);
  validateContent(published);
});
