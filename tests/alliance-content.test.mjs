import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, copyFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { applyBusinessDefaults } from '../business-content.mjs';
import { ALLIANCE_MENU_CHILDREN, ALLIANCE_NAV_ORDER, DEFAULT_ALLIANCE_PAGES, applyAllianceDefaults } from '../alliance-content.mjs';
import { validateContent } from '../validation.mjs';
import { validatePublicData, isAllowedPath } from '../scripts/create-handoff.mjs';

const seed = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'));
function legacyContent() {
  const content = structuredClone(seed);
  delete content.alliancePages;
  const roots = new Map(content.navigation.map(item => [item.id, item]));
  const courses = { id: 'courses', label: '课程资源库', href: '/courses.html', target: 'blank', children: ['美育类', '益智类', '科技类', '手工类'].map((label, index) => ({ id: `legacy-course-${index}`, label, href: `/courses.html?category=${encodeURIComponent(label)}`, target: 'blank', action: 'course-category', value: label })) };
  content.navigation = ['home', 'about', 'business'].map(id => roots.get(id)).concat(courses, roots.get('news'), roots.get('venture'), roots.get('contact'));
  roots.get('about').children = roots.get('about').children.filter(item => item.id !== 'course-library');
  return content;
}
async function temporaryDirectory(t, prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith(prefix));
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

test('legacy seven-root navigation migrates to the alliance menu and preserves the other about entries', () => {
  const legacy = legacyContent();
  const about = legacy.navigation.find(item => item.id === 'about');
  const originalAbout = structuredClone(about.children);
  about.children.push({ id: 'courses', label: '课程资源库', href: '/courses.html', target: '' }, { id: 'duplicate-library', label: '课程资源库', href: '/courses.html?category=美育类', target: '' });
  const content = applyAllianceDefaults(applyBusinessDefaults(legacy));
  assert.deepEqual(content.navigation.map(item => item.id), ALLIANCE_NAV_ORDER);
  assert.deepEqual(content.navigation.find(item => item.id === 'alliance').children, ALLIANCE_MENU_CHILDREN);
  assert.equal(content.navigation.length, 7);
  assert.ok(content.navigation.every(item => item.children.length <= 8));
  const updatedAbout = content.navigation.find(item => item.id === 'about').children;
  assert.deepEqual(updatedAbout.slice(0, -1), originalAbout);
  assert.equal(updatedAbout.filter(item => item.href === '/courses.html').length, 1);
  assert.equal(updatedAbout.at(-1).id, 'course-library');
  assert.equal(updatedAbout.at(-1).label, '课程资源库');
  assert.equal(updatedAbout.at(-1).target, 'blank');
  assert.ok(updatedAbout.some(item => item.label === '课程手册'));
  assert.equal(content.alliancePages.length, 3);
  assert.ok(content.alliancePages.every(page => page.published && page.body.includes('以正式公告为准')));
  validateContent(content);
});

test('edited alliance pages and migrated navigation remain intact and the combined migrations are idempotent', () => {
  const content = applyAllianceDefaults(legacyContent());
  const page = content.alliancePages[0];
  Object.assign(page, { title: '管理员维护的联盟标题', summary: '管理员维护的摘要', body: '尚未发布的联盟草稿', image: '/assets/alliance-cover.jpg', longImage: '/assets/alliance-long.jpg', published: false, order: 8 });
  const alliance = content.navigation.find(item => item.id === 'alliance');
  alliance.label = '管理员维护的联盟菜单';
  alliance.children[0].href = '#services'; alliance.children[0].label = '管理员维护的链接'; alliance.children[0].target = '';
  content.navigation.reverse();
  const before = JSON.stringify(content);
  assert.equal(JSON.stringify(applyAllianceDefaults(applyBusinessDefaults(content))), before);
  validateContent(content);
  const invalid = structuredClone(content); invalid.alliancePages[0].privateNote = 'not allowed';
  assert.throws(() => validateContent(invalid), /未声明字段/);
  assert.throws(() => validatePublicData(content, 'test fixture'), /未发布联盟页面/);
  assert.equal(isAllowedPath('alliance-content.mjs'), true);
});

test('legacy API reads do not rewrite runtime content and alliance drafts remain private after save and restart', async t => {
  const dir = await temporaryDirectory(t, 'khb-alliance-api-');
  const content = legacyContent();
  content.alliancePages = [{ ...structuredClone(DEFAULT_ALLIANCE_PAGES[0]), body: 'PRIVATE ALLIANCE DRAFT TEST', image: '/assets/alliance-draft.jpg', published: false }];
  const original = JSON.stringify(content, null, 2);
  await writeFile(path.join(dir, 'content.json'), original);
  const initialPassword = 'alliance-test-only-initial-password', password = 'Alliance test across 93 green rivers!';
  await writeFile(path.join(dir, 'admin-token'), initialPassword);
  const reservation = net.createServer().listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } };
  t.after(stop);
  const start = async () => {
    let output = '';
    child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, DATA_DIR: dir, ADMIN_TOKEN: '', PUBLIC_ORIGIN: '', TRUST_PROXY: '', HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', value => output += value); child.stderr.on('data', value => output += value);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw Error(`Test server exited: ${output}`);
      try { if ((await fetch(origin + '/api/content')).ok) return; } catch {}
      await delay(100);
    }
    throw Error('Test server startup timed out');
  };
  await start();
  let publicText = await (await fetch(origin + '/api/content')).text();
  assert.equal(publicText.includes('PRIVATE ALLIANCE DRAFT TEST'), false);
  assert.equal(JSON.parse(publicText).alliancePages.length, 2);
  assert.deepEqual(JSON.parse(publicText).navigation.map(item => item.id), ALLIANCE_NAV_ORDER);
  assert.equal(await readFile(path.join(dir, 'content.json'), 'utf8'), original);
  const login = async value => {
    const response = await fetch(origin + '/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }) });
    assert.equal(response.status, 200); return { ...(await response.json()), cookie: response.headers.get('set-cookie').split(';')[0] };
  };
  const headers = session => ({ Origin: origin, Cookie: session.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken });
  const initial = await login(initialPassword);
  assert.equal((await fetch(origin + '/api/admin/password', { method: 'PUT', headers: headers(initial), body: JSON.stringify({ currentPassword: initialPassword, newPassword: password }) })).status, 200);
  const session = await login(password);
  const editable = await (await fetch(origin + '/api/admin/content', { headers: headers(session) })).json();
  assert.equal(editable.alliancePages.length, 3);
  assert.equal(editable.alliancePages[0].body, 'PRIVATE ALLIANCE DRAFT TEST');
  editable.alliancePages[0].body = 'PRIVATE UPDATED ALLIANCE DRAFT TEST';
  editable.alliancePages[1].body = '已发布的成员页面测试内容';
  assert.equal((await fetch(origin + '/api/admin/content', { method: 'PUT', headers: headers(session), body: JSON.stringify(editable) })).status, 200);
  await stop(); await start();
  publicText = await (await fetch(origin + '/api/content')).text();
  assert.equal(publicText.includes('PRIVATE UPDATED ALLIANCE DRAFT TEST'), false);
  assert.equal(JSON.parse(publicText).alliancePages.find(page => page.id === 'third-members').body, '已发布的成员页面测试内容');
  const persisted = JSON.parse(await readFile(path.join(dir, 'content.json'), 'utf8'));
  assert.equal(persisted.alliancePages[0].body, 'PRIVATE UPDATED ALLIANCE DRAFT TEST');
  assert.equal(persisted.alliancePages[0].published, false);
  validateContent(persisted);
});

test('public backup excludes alliance drafts and uploaded alliance images while retaining only team uploads', async t => {
  const dir = await temporaryDirectory(t, 'khb-alliance-backup-');
  await mkdir(path.join(dir, 'scripts')); await mkdir(path.join(dir, 'data', 'uploads'), { recursive: true });
  for (const file of ['business-content.mjs', 'alliance-content.mjs', 'scripts/backup-content.mjs']) await copyFile(new URL('../' + file, import.meta.url), path.join(dir, file));
  const content = structuredClone(seed);
  content.alliancePages[0].body = 'PRIVATE ALLIANCE SNAPSHOT DRAFT TEST'; content.alliancePages[0].published = false;
  const teamUpload = `upload-${'a'.repeat(32)}.jpg`, allianceUpload = `upload-${'b'.repeat(32)}.jpg`;
  content.team[0].image = '/assets/' + teamUpload;
  content.alliancePages[1].image = '/assets/' + allianceUpload;
  content.alliancePages[1].longImage = '/assets/' + allianceUpload;
  const original = JSON.stringify(content);
  await writeFile(path.join(dir, 'data', 'content.json'), original);
  await writeFile(path.join(dir, 'data', 'uploads', teamUpload), 'public team fixture');
  await writeFile(path.join(dir, 'data', 'uploads', allianceUpload), 'private upload fixture');
  execFileSync(process.execPath, [path.join(dir, 'scripts', 'backup-content.mjs')], { cwd: dir, env: { ...process.env, DATA_DIR: path.join(dir, 'data') } });
  const text = await readFile(path.join(dir, 'backups', 'published-content.json'), 'utf8');
  assert.equal(text.includes('PRIVATE ALLIANCE SNAPSHOT DRAFT TEST'), false);
  const snapshot = JSON.parse(text);
  assert.equal(snapshot.alliancePages.length, 2);
  assert.equal(snapshot.alliancePages.find(page => page.id === 'third-members').image, '');
  assert.equal(snapshot.alliancePages.find(page => page.id === 'third-members').longImage, '');
  assert.deepEqual(await readdir(path.join(dir, 'backups', 'uploads')), [teamUpload]);
  assert.equal(await readFile(path.join(dir, 'data', 'content.json'), 'utf8'), original);
  validatePublicData(snapshot, 'test public backup');
});
