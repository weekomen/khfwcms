const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
(async () => {
  // Tests must never edit the maintained website database.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'khb-browser-'));
  const port = 42000 + Math.floor(Math.random() * 10000), origin = `http://127.0.0.1:${port}`;
  const initial = 'browser-fixture-initial-password', password = 'browser-fixture-new-long-password';
  let child, browser;
  try {
    child = spawn(process.execPath, ['server.mjs'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, DATA_DIR: dir, ADMIN_TOKEN: initial, HOST: '127.0.0.1', PORT: String(port), PUBLIC_ORIGIN: '', TRUST_PROXY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error('Fixture server exited'); }), new Promise((_, reject) => setTimeout(() => reject(Error('Server timeout')), 10000).unref())]);
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await fs.mkdir('reference', { recursive: true });
    await page.goto(`${origin}/admin`);
    const login = async value => { await page.getByLabel('管理密码', { exact: true }).fill(value); await page.getByRole('button', { name: '登录后台' }).click(); };
    await login(initial); await page.waitForSelector('#password-panel:not([hidden])');
    assert.equal(await page.locator('#editor').isVisible(), false);
    await page.getByLabel('当前密码', { exact: true }).fill(initial);
    await page.getByLabel('新密码', { exact: true }).fill(password); await page.getByLabel('确认新密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: '保存新密码' }).click();
    await page.getByRole('status').filter({ hasText: '密码修改成功' }).waitFor();
    await login(password); await page.waitForSelector('#editor:not([hidden])');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('khb-token')), null);
    assert.ok((await context.cookies()).some(c => c.httpOnly && c.sameSite === 'Strict'));
    assert.equal(await page.evaluate(() => document.cookie), '');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByLabel('外观').selectOption('dark');
    await page.screenshot({ path: 'reference/secure-admin-mobile.png' });
    const intro = page.getByLabel('首页简介', { exact: true }), edited = (await intro.inputValue()) + '\n浏览器隔离测试';
    await intro.fill(edited);
    const second = await context.newPage(); await second.goto(`${origin}/admin`); await second.waitForSelector('#editor:not([hidden])');
    await second.getByRole('button', { name: '退出登录', exact: true }).click(); await second.waitForSelector('#login:not([hidden])');
    await page.getByRole('button', { name: '保存并更新官网' }).click();
    await page.getByRole('status').filter({ hasText: '未保存的编辑仍保留' }).waitFor();
    await login(password); await page.waitForSelector('#editor:not([hidden])'); assert.equal(await intro.inputValue(), edited);
    await page.getByRole('button', { name: '保存并更新官网' }).click(); await page.getByRole('status').filter({ hasText: '保存成功' }).waitFor();
    assert.equal((await (await fetch(`${origin}/api/content`)).json()).site.intro, edited);
    await intro.fill(edited + '\n多标签页恢复');
    await second.getByLabel('管理密码', { exact: true }).fill(password);
    await second.getByRole('button', { name: '登录后台' }).click();
    await second.waitForSelector('#editor:not([hidden])');
    await page.getByRole('button', { name: '保存并更新官网' }).click();
    await page.getByRole('status').filter({ hasText: '未保存的编辑仍保留' }).waitFor();
    await login(password); await page.waitForSelector('#editor:not([hidden])');
    assert.equal(await intro.inputValue(), edited + '\n多标签页恢复');
    await page.getByRole('button', { name: '保存并更新官网' }).click();
    await page.getByRole('status').filter({ hasText: '保存成功' }).waitFor();
    await page.reload(); await page.waitForSelector('#editor:not([hidden])');
    await page.getByRole('button', { name: '课程目录', exact: true }).click();
    assert.equal(await page.getByLabel('详细介绍（弹窗）', { exact: true }).count(), 55);
    await page.getByRole('button', { name: '退出登录', exact: true }).click(); await page.waitForSelector('#login:not([hidden])');
    assert.equal((await context.cookies()).length, 0);
    await page.screenshot({path: 'reference/secure-login-mobile.png'});
    await page.setViewportSize({width:1440,height:1000}); await page.getByLabel('外观').selectOption('light');
    await page.screenshot({path:'reference/secure-login-desktop.png'});
    assert.deepEqual(errors, []);
    console.log('PASS: initial password change, private cookie, session restore, expired-session edit recovery, save and logout.');
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    if (path.dirname(dir) === os.tmpdir() && path.basename(dir).startsWith('khb-browser-')) await fs.rm(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
