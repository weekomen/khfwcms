import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { CORE_BUSINESSES, DEFAULT_BUSINESS_PAGES, applyBusinessDefaults } from '../business-content.mjs';
import { validateContent } from '../validation.mjs';

const seed = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'));
const legacyIds = ['supply-chain', 'online-education', 'education-street', 'youth-center', 'ai-museum'];
function legacyContent() {
  const content = structuredClone(seed);
  content.businessPages = content.businessPages.filter(page => legacyIds.includes(page.id));
  Object.assign(content.businessPages[0], { title: '课后邦供应链', image: '/assets/logo.png' });
  const business = content.navigation.find(item => item.id === 'business');
  business.href = '#services';
  business.children = business.children.filter(item => legacyIds.includes(item.id)).map(item => ({ ...item, label: item.id === 'supply-chain' ? '课后邦供应链' : item.label, href: `/content-page.html?type=business&id=${item.id}`, target: 'blank' }));
  let courses = content.navigation.find(item => item.id === 'courses');
  if (!courses) {
    courses = { id: 'courses', label: '课程资源库', href: '#course-catalog', action: 'course-category', children: ['美育类', '益智类', '科技类', '手工类'].map((label, index) => ({ id: `legacy-course-${index}`, label, href: '#course-catalog', action: 'course-category', value: label })) };
    content.navigation[content.navigation.findIndex(item => item.id === 'alliance')] = courses;
  }
  courses.href = '#course-catalog';
  courses.children.forEach(item => { item.href = '#course-catalog'; item.target = ''; });
  content.navigation.find(item => item.id === 'about').children = content.navigation.find(item => item.id === 'about').children.filter(item => item.id !== 'course-library');
  content.navigation.find(item => item.id === 'about').children.find(item => item.id === 'team').href = '#team';
  return content;
}

test('business migration adds the seven entries and six pages while preserving edited content and existing images', () => {
  const legacy = legacyContent();
  const supply = legacy.businessPages[0];
  Object.assign(supply, { title: '自定义供应链标题', summary: '学校维护的摘要', body: '学校维护的完整介绍', image: '/assets/custom-school.jpg', longImage: '/assets/custom-long.jpg' });
  legacy.businessPages.push({ id: 'custom-business', title: '自定义业务', summary: '自定义摘要', body: '自定义正文', image: '', longImage: '' });
  const business = legacy.navigation.find(item => item.id === 'business'); business.label = '自定义集团业务'; business.children[0].label = '自定义菜单名称';
  const original = structuredClone(supply);
  const content = applyBusinessDefaults(legacy);
  validateContent(content);
  assert.deepEqual(content.businessPages.find(page => page.id === 'supply-chain'), original);
  assert.equal(content.businessPages.length, 14);
  assert.deepEqual(content.businessPages.slice(0, 7).map(page => page.id), CORE_BUSINESSES.map(page => page.id));
  assert.ok(DEFAULT_BUSINESS_PAGES.every(page => content.businessPages.some(item => item.id === page.id)));
  assert.equal(content.navigation.find(item => item.id === 'business').label, '自定义集团业务');
  assert.equal(business.children.length, 7);
  assert.equal(business.children[0].label, '自定义菜单名称');
  assert.equal(business.children[0].href, '#after-school-supply');
  assert.equal(business.children[1].href, '#ai-school-supply');
  assert.equal(business.children[2].href, '/content-page.html?type=business&id=online-ai-study');
  assert.equal(content.navigation.find(item => item.id === 'courses').href, '/courses.html');
  assert.ok(content.navigation.find(item => item.id === 'courses').children.every(item => item.href.startsWith('/courses.html?category=') && item.target === 'blank'));
  assert.equal(content.navigation.find(item => item.id === 'about').children.find(item => item.id === 'team').href, '/team.html');
  const serialized = JSON.stringify(content);
  assert.equal(JSON.stringify(applyBusinessDefaults(content)), serialized);
});

test('only legacy default values migrate, and already edited seven-entry routes keep their values', () => {
  const content = applyBusinessDefaults(legacyContent());
  assert.equal(content.businessPages[0].title, '课后邦课后服务进校供应链');
  assert.equal(content.businessPages[0].image, '/assets/business-1.svg');
  const root = content.navigation.find(item => item.id === 'business');
  root.children[0].label = '已编辑的业务入口'; root.children[0].href = '/custom-route'; root.children[0].target = 'blank';
  const courses = content.navigation.find(item => item.id === 'courses'); courses.children[0].href = 'https://example.com/custom-course';
  applyBusinessDefaults(content);
  assert.equal(root.children[0].href, '/custom-route');
  assert.equal(root.children[0].label, '已编辑的业务入口');
  assert.equal(courses.children[0].href, 'https://example.com/custom-course');
  validateContent(JSON.parse(JSON.stringify(content)));
});

test('legacy business aliases reuse edited records, and canonical conflicts retain both records', () => {
  const legacy = legacyContent();
  const aliases = ['business-supply', 'business-online', 'business-street', 'business-youth', 'business-ai'];
  const originals = new Map();
  legacy.businessPages.forEach((page, index) => {
    const canonical = page.id;
    Object.assign(page, { id: aliases[index], title: `已维护业务 ${index + 1}`, summary: `已维护摘要 ${index + 1}`, body: `已维护正文 ${index + 1}`, image: `/assets/custom-business-${index + 1}.jpg`, longImage: `/assets/custom-business-long-${index + 1}.jpg` });
    originals.set(canonical, { ...structuredClone(page), id: canonical });
  });
  const migrated = applyBusinessDefaults(legacy);
  assert.equal(migrated.businessPages.length, 13);
  for (const [id, original] of originals) assert.deepEqual(migrated.businessPages.find(page => page.id === id), original);
  assert.equal(migrated.businessPages.some(page => aliases.includes(page.id)), false);
  validateContent(migrated);
  const once = JSON.stringify(migrated);
  assert.equal(JSON.stringify(applyBusinessDefaults(migrated)), once);

  const conflict = legacyContent();
  const canonical = conflict.businessPages[0];
  Object.assign(canonical, { title: '已维护标准编号页面', body: '标准编号的正文', image: '/assets/canonical-supply.jpg' });
  const alias = { ...structuredClone(canonical), id: 'business-supply', title: '另外维护的旧编号页面', body: '旧编号自己的正文', image: '/assets/alias-supply.jpg' };
  conflict.businessPages.push(alias);
  const before = [structuredClone(canonical), structuredClone(alias)];
  applyBusinessDefaults(conflict);
  assert.equal(conflict.businessPages.length, 14);
  assert.deepEqual(conflict.businessPages.find(page => page.id === 'supply-chain'), before[0]);
  assert.deepEqual(conflict.businessPages.find(page => page.id === 'business-supply'), before[1]);
  validateContent(conflict);
});

test('legacy runtime GET migration never writes the file, and administrator-saved edits survive a restart', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'khb-business-test-'));
  const original = JSON.stringify(legacyContent(), null, 2);
  await writeFile(path.join(dir, 'content.json'), original);
  const initialPassword = 'test-business-initial-password';
  const nextPassword = 'Business migration across 52 rivers!';
  await writeFile(path.join(dir, 'admin-token'), initialPassword);
  const reservation = net.createServer().listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } };
  t.after(async () => {
    await stop();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith('khb-business-test-'));
    await rm(dir, { recursive: true, force: true });
  });
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
  const publicContent = await (await fetch(origin + '/api/content')).json();
  assert.equal(publicContent.businessPages.length, 13);
  assert.equal(publicContent.navigation.find(item => item.id === 'business').children.length, 7);
  assert.equal(await readFile(path.join(dir, 'content.json'), 'utf8'), original);
  const login = async password => {
    const response = await fetch(origin + '/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    assert.equal(response.status, 200);
    return { ...(await response.json()), cookie: response.headers.get('set-cookie').split(';')[0] };
  };
  const headers = session => ({ Origin: origin, Cookie: session.cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken });
  const initial = await login(initialPassword);
  assert.equal((await fetch(origin + '/api/admin/password', { method: 'PUT', headers: headers(initial), body: JSON.stringify({ currentPassword: initialPassword, newPassword: nextPassword }) })).status, 200);
  const session = await login(nextPassword);
  const editable = await (await fetch(origin + '/api/admin/content', { headers: headers(session) })).json();
  Object.assign(editable.businessPages[0], { title: '学校维护的新标题', summary: '管理员维护首页整体介绍', image: '/assets/custom-home.jpg' });
  editable.businessPages.find(page => page.id === 'ai-study-system').body = '管理员维护的系统介绍';
  assert.equal((await fetch(origin + '/api/admin/content', { method: 'PUT', headers: headers(session), body: JSON.stringify(editable) })).status, 200);
  await stop(); await start();
  const persisted = await (await fetch(origin + '/api/content')).json();
  assert.equal(persisted.businessPages[0].title, '学校维护的新标题');
  assert.equal(persisted.businessPages[0].image, '/assets/custom-home.jpg');
  assert.equal(persisted.businessPages.find(page => page.id === 'ai-study-system').body, '管理员维护的系统介绍');
  validateContent(persisted);
});
