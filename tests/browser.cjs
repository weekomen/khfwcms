const { chromium } = require('C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:3000'); await page.waitForSelector('.person');
    await page.evaluate(async () => { await Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => { }); })); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('img').evaluateAll(images => images.every(i => i.naturalWidth > 0)), true);
    await page.screenshot({ path: 'reference/desktop.png', fullPage: true });
    await page.getByRole('button', { name: '了解素质教育课程', exact: true }).click(); await page.waitForSelector('dialog[open]'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '技术团队', exact: true }).click(); assert.equal(await page.locator('.person').count(), 2);
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('http://127.0.0.1:3000'); await page.waitForSelector('.person');
    await page.evaluate(async () => { await Promise.all([...document.images].map(img => { img.loading = 'eager'; return img.decode().catch(() => { }); })); });
    await page.screenshot({ path: 'reference/mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: '展开导航' }).click(); await page.locator('nav a[href="#team"]').click(); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('http://127.0.0.1:3000/admin');
    await page.getByLabel('管理密钥').fill(fs.readFileSync('data/admin-token', 'utf8').trim()); await page.getByRole('button', { name: '登录后台' }).click(); await page.waitForSelector('#editor:not([hidden])');
    await page.getByRole('button', { name: '保存并更新官网' }).click(); await page.getByRole('status').filter({ hasText: '保存成功' }).waitFor();
    await page.getByRole('button', { name: '公司动态', exact: true }).click(); assert.equal(await page.locator('.edit-card').count(), 2);
    assert.equal(await page.getByLabel('在官网公开发布').first().isChecked(), false);
    await page.screenshot({ path: 'reference/admin.png', fullPage: true });
    await page.getByRole('button', { name: '退出登录' }).click(); await page.waitForSelector('#login:not([hidden])');
    assert.deepEqual(errors, []); console.log('PASS: desktop/mobile layout, all images, service dialog, team filter, mobile navigation, CMS login/save/drafts/logout; no browser errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
