// Isolated browser fixtures: never writes CMS data or contacts the live website.
// Set PLAYWRIGHT_PATH and optionally PLAYWRIGHT_CHANNEL for another local runtime.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const origin = 'https://kehoubang.cn';
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
const nginx = fs.readFileSync(path.join(root, 'deploy/nginx.conf'), 'utf8');
const injection = nginx.match(/sub_filter\s+'<\/body>'\s+'([^']+)'\s*;/)?.[1];
assert.ok(injection, 'Deployment must inject the return control before the closing body');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const urls = [1, 2, 3].map(id => `${origin}/profile/upload/pdf/${id}/index.html`);

function readerFixture(pathname) {
  // Simulates the case-insensitive HTML substitution, including an uppercase
  // exporter closing tag. Nginx configuration is validated separately.
  const frame = pathname.endsWith('/mobile/index.html') ? '' : '<iframe title="Reader inner frame" src="/profile/upload/pdf/1/mobile/index.html"></iframe>';
  return `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reader fixture</title><style>body{margin:0;min-height:1800px}a{color:red;font-size:50px}iframe{margin-top:90px;width:200px;height:150px}</style></head><body><h1>Document fixture</h1>${frame}</BODY></html>`.replace(/<\/body>/i, injection);
}

async function assertReturnLink(page, label) {
  const button = page.locator('#khb-return-home');
  await button.waitFor({ state: 'visible' });
  assert.equal(await button.count(), 1, `${label}: one return control`);
  assert.equal(await button.getAttribute('href'), `${origin}/`);
  assert.equal(await button.getAttribute('target'), '_self');
  assert.equal(await button.textContent(), '← 返回官网');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('khb-return-home')).position === 'fixed');
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${label}: return control inside viewport`);
  assert.ok(box.height >= 44, `${label}: mobile-sized touch target`);
}

async function assertHeaderLayout(page, label) {
  const result = await page.evaluate(() => {
    const header = document.querySelector('header');
    const visible = element => getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { label: element.id || element.className || element.tagName, x: box.x, y: box.y, right: box.right, bottom: box.bottom };
    };
    return {
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      header: rect(header),
      children: [...header.children].filter(visible).map(rect),
      links: [...header.querySelectorAll('nav a')].filter(visible).map(rect)
    };
  });
  assert.equal(result.overflow, false, `${label}: no page horizontal overflow`);
  for (const box of [...result.children, ...result.links]) {
    assert.ok(box.x >= -1 && box.right <= result.width + 1, `${label}: ${box.label} inside viewport`);
  }
  // Direct header items (brand, navigation, appearance/contact, menu) must not
  // collide. Navigation drops below the header when the menu is expanded.
  for (let i = 0; i < result.children.length; i++) {
    for (let j = i + 1; j < result.children.length; j++) {
      const a = result.children[i], b = result.children[j];
      const overlap = Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
      assert.equal(overlap, false, `${label}: ${a.label} overlaps ${b.label}`);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    // Route at context level so the first popup request is also intercepted.
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      assert.equal(url.origin, origin, `Unexpected nonfixture request: ${url.href}`);
      if (url.pathname === '/api/content') return route.fulfill({ json: seed });
      if (/^\/profile\/upload\/pdf\/\d+\//.test(url.pathname) || url.pathname === '/unrelated.html') {
        return route.fulfill({ body: readerFixture(url.pathname), contentType: mime['.html'] });
      }
      const file = path.join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: 'Fixture file not found' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    await page.goto(`${origin}/`);
    await page.locator('.course-card').first().waitFor();
    const entries = [
      ['#nav', '课程手册（新标签页打开）', urls[0]],
      ['#nav', '一校一案（新标签页打开）', urls[1]],
      ['#nav', '公司展册（新标签页打开）', urls[2]],
      ['#services', '全部课程手册（新标签页打开）', urls[0]],
      ['#services', '一校一案（新标签页打开）', urls[1]]
    ];
    for (const [selector, name, url] of entries) {
      const link = page.locator(selector).getByRole('link', { name, exact: true });
      assert.equal(await link.count(), 1, `${name}: one website entry`);
      assert.equal(await link.getAttribute('href'), url);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.match(await link.getAttribute('rel'), /\bnoopener\b/);
      const popupPromise = page.waitForEvent('popup');
      await link.click();
      const popup = await popupPromise;
      await popup.waitForURL(url);
      await assertReturnLink(popup, name);
      assert.equal(await popup.evaluate(() => window.opener), null, `${name}: no opener dependency`);
      await popup.frameLocator('iframe').locator('h1').waitFor();
      assert.equal(await popup.frameLocator('iframe').locator('#khb-return-home').count(), 0, `${name}: iframe has no duplicate button`);
      const count = context.pages().length;
      await popup.getByRole('link', { name: '← 返回官网', exact: true }).click();
      await popup.waitForURL(`${origin}/`);
      assert.equal(context.pages().length, count, `${name}: return uses the same tab`);
      await popup.close();
    }

    // Directly opened mobile readers also work, without a referring website tab.
    const reader = await context.newPage();
    for (const width of [320, 390]) {
      await reader.setViewportSize({ width, height: 844 });
      for (const colorScheme of ['light', 'dark']) {
        await reader.emulateMedia({ colorScheme });
        await reader.goto(`${origin}/profile/upload/pdf/1/mobile/index.html`);
        await assertReturnLink(reader, `${width}px ${colorScheme} mobile reader`);
        await reader.addScriptTag({ url: `${origin}/document-return.js` });
        assert.equal(await reader.locator('#khb-return-home').count(), 1, 'Repeated injection is idempotent');
        assert.equal(await reader.locator('#khb-document-return-style').count(), 1, 'Repeated injection has one stylesheet');
        await reader.evaluate(() => history.replaceState(null, '', location.href));
        await reader.locator('#khb-return-home').click();
        await reader.waitForURL(`${origin}/`);
      }
    }
    for (const pathname of ['/unrelated.html', '/profile/upload/pdf/4/index.html', '/profile/upload/pdf/12/index.html']) {
      await reader.goto(`${origin}${pathname}`);
      assert.equal(await reader.locator('#khb-return-home').count(), 0, `${pathname}: unrelated page unchanged`);
      assert.equal(await reader.locator('#khb-document-return-style').count(), 0);
    }
    await reader.close();

    await page.goto(`${origin}/`);
    for (const width of [1201, 1280, 1401, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await assertHeaderLayout(page, `${width}px desktop`);
      assert.equal(await page.locator('#nav').isVisible(), true);
      assert.equal(await page.locator('#nav a').count(), 8);
    }
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.getByLabel('外观', { exact: true }).selectOption(theme);
        await assertHeaderLayout(page, `${width}px ${theme} mobile closed`);
        await page.locator('.menu-toggle').click();
        await assertHeaderLayout(page, `${width}px ${theme} mobile open`);
        await page.locator('#nav a').last().scrollIntoViewIfNeeded();
        const lastBox = await page.locator('#nav a').last().boundingBox();
        assert.ok(lastBox.y >= 0 && lastBox.y + lastBox.height <= 844, 'Last menu entry reachable');
        await page.locator('.menu-toggle').click();
      }
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('.menu-toggle').click();
    await page.locator('#nav a').last().scrollIntoViewIfNeeded();
    const lastBox = await page.locator('#nav a').last().boundingBox();
    assert.ok(lastBox.y >= 94 && lastBox.y + lastBox.height <= 390, 'Landscape last menu entry scrolls into view');
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#nav a').last().click();
    const popup = await popupPromise;
    await popup.waitForURL(urls[2]);
    await assertReturnLink(popup, 'landscape company brochure');
    await popup.close();
    assert.equal(await page.locator('#nav').isVisible(), false, 'Navigation closes after the document opens');
    assert.deepEqual(errors, []);
    console.log('PASS: 5 document links; 3 reader return controls; same-tab return; iframe/duplicate/path guards; mobile readers in light/dark; 4 desktop header widths; 320/390px menus; 844x390px last menu entry. All requests used isolated fixtures.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
