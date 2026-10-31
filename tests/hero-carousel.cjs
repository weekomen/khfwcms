const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const origin = 'http://localhost:3197';
const ids = ['supply-chain', 'ai-school-supply', 'online-ai-study', 'online-education', 'education-street', 'youth-center', 'ai-museum'];
// Only public seed data is read. Each image is distinct so transitions are
// observable without using maintained content or administrator credentials.
const data = JSON.parse(fs.readFileSync('data/seed.json', 'utf8'));
for (const [index, id] of ids.entries()) {
  const page = data.businessPages.find(item => item.id === id);
  assert.ok(page, `Missing public business fixture: ${id}`);
  page.image = `/assets/business-${index + 1}.svg`;
}

async function createPage(browser, reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  assert.ok(page.clock, 'Playwright page.clock is required for this test');
  const time = new Date('2026-10-31T00:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/content') return route.fulfill({ json: data });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: { error: 'Unexpected test endpoint' } });
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const absolute = path.join('public', file);
    if (!fs.existsSync(absolute)) return route.fulfill({ status: 404, body: 'Not found' });
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ body: fs.readFileSync(absolute), contentType: type });
  });
  await page.goto(origin);
  await page.waitForSelector('#business-tabs [role="tab"]');
  await showHero(page);
  return { page, errors };
}

async function settleLayout(page) {
  await page.clock.runFor(100);
  // IntersectionObserver is driven by rendering, not only the fake timer.
  await page.waitForTimeout(60);
}
async function showHero(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.mouse.move(0, 0);
  await settleLayout(page);
}
const advance = (page, milliseconds) => page.clock.fastForward(milliseconds);
const slideIndex = async page => ids.indexOf(await page.locator('#business-feature').getAttribute('data-business-id'));
async function assertSlide(page, index) {
  assert.equal(await slideIndex(page), index, `Expected slide ${index + 1}`);
  assert.equal(await page.locator('#business-feature-image').getAttribute('src'), `/assets/business-${index + 1}.svg`);
  assert.equal(await page.locator('#business-tabs [aria-selected="true"]').count(), 1);
  assert.equal(await page.locator('#business-tabs [role="tab"]').nth(index).getAttribute('aria-selected'), 'true');
}
async function expectOneAutomaticStep(page, index) {
  await advance(page, 6100);
  await assertSlide(page, (index + 1) % ids.length);
}
async function assertBusinessLayout(page, viewport) {
  await page.locator('#business-feature-image').evaluate(image => image.decode());
  const layout = await page.evaluate(() => {
    const image = document.getElementById('business-feature-image');
    const panel = document.getElementById('business-feature-panel').getBoundingClientRect();
    const navigation = document.getElementById('business-showcase').getBoundingClientRect();
    const bounds = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    // With contain and top alignment, this is the rendered source-image area,
    // excluding any letterboxing in the element's larger CSS box.
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    return {
      fit: style.objectFit, position: style.objectPosition, viewportWidth: innerWidth,
      navigation: { left: navigation.left, right: navigation.right, top: navigation.top },
      panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom },
      image: { left: bounds.left + (bounds.width - width) / 2, right: bounds.left + (bounds.width + width) / 2, top: bounds.top, bottom: bounds.top + height, width, height }
    };
  });
  const label = `${viewport.width}x${viewport.height}`;
  assert.ok(Math.abs(layout.navigation.left) <= 1, `Business navigation must reach the left edge at ${label}`);
  assert.ok(Math.abs(layout.navigation.right - layout.viewportWidth) <= 1, `Business navigation must reach the right edge at ${label}`);
  assert.equal(layout.fit, 'contain', `Business images must be fully contained at ${label}`);
  assert.ok(['top', '0%', '0px'].includes(layout.position.trim().split(/\s+/).at(-1)), `Business images must align to the top at ${label}: ${layout.position}`);
  assert.ok(layout.image.width > 0 && layout.image.height > 0, `Business image must have a decoded visible area at ${label}`);
  if (viewport.width > 760) {
    assert.ok(layout.image.left >= layout.panel.left - 1 && layout.image.right <= layout.panel.right + 1 && layout.image.top >= layout.panel.top - 1 && layout.image.bottom <= layout.panel.bottom + 1, `The complete business image must fit inside the visible hero panel at ${label}`);
    assert.ok(layout.image.bottom <= layout.navigation.top + 1, `Business navigation must not cover the rendered image at ${label}: image bottom ${layout.image.bottom}, navigation top ${layout.navigation.top}`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const normal = await createPage(browser);
    let page = normal.page;
    const tabs = page.locator('#business-tabs [role="tab"]');
    assert.equal(await page.locator('#home > #business-feature-panel.hero-image').count(), 1);
    assert.equal(await page.locator('#business-showcase').evaluate(section => Boolean(section.closest('#home'))), true);
    assert.equal(await page.locator('.business-feature').count(), 1);
    assert.equal(await tabs.count(), 7);
    assert.equal(await page.locator('#business-feature-counter, #business-autoplay').count(), 0);
    await assertSlide(page, 0);
    await advance(page, 5000); await assertSlide(page, 0);
    await advance(page, 1100); await assertSlide(page, 1);

    // Manual selection resets the six-second interval and then keeps rotating.
    for (let index = 0; index < ids.length; index++) {
      await tabs.nth(index).dispatchEvent('click');
      await assertSlide(page, index);
      const feature = page.locator('#business-feature');
      if (index < 2) {
        assert.equal(await feature.getAttribute('href'), index === 0 ? '#after-school-supply' : '#ai-school-supply');
        assert.equal(await feature.getAttribute('target'), null);
      } else {
        assert.equal(await feature.getAttribute('href'), index === 3 ? '/courses.html' : `/content-page.html?type=business&id=${ids[index]}`);
        assert.equal(await feature.getAttribute('target'), '_blank');
        assert.match(await feature.getAttribute('rel'), /noopener/);
      }
    }
    await advance(page, 5000); await assertSlide(page, 6);
    await advance(page, 1100); await assertSlide(page, 0);
    await page.locator('#business-previous').click({ force: true });
    await page.mouse.move(0, 0); await assertSlide(page, 6);
    await page.locator('#business-next').click({ force: true });
    await page.mouse.move(0, 0); await assertSlide(page, 0);
    await expectOneAutomaticStep(page, 0);

    // Hover suspends rotation only until the pointer leaves the hero.
    const rect = await page.locator('#home').boundingBox();
    await page.mouse.move(rect.x + Math.min(200, rect.width / 2), rect.y + Math.min(200, rect.height / 2));
    let index = await slideIndex(page);
    await advance(page, 7000); await assertSlide(page, index);
    await page.mouse.move(0, 0); await expectOneAutomaticStep(page, index);

    // A hidden document and an offscreen hero pause the same timer. They do
    // not permanently disable automatic playback when visibility returns.
    index = await slideIndex(page);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await advance(page, 7000); await assertSlide(page, index);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expectOneAutomaticStep(page, index);
    index = await slideIndex(page);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await settleLayout(page);
    assert.ok(await page.locator('#home').evaluate(hero => hero.getBoundingClientRect().bottom < 0));
    index = await slideIndex(page);
    await advance(page, 7000); await assertSlide(page, index);
    await showHero(page); await expectOneAutomaticStep(page, index);

    // Keyboard tab navigation temporarily pauses while focus is visible in
    // the carousel, then resumes after focus moves back to the page header.
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight'); await assertSlide(page, 1);
    assert.equal(await tabs.nth(1).evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('End'); await assertSlide(page, 6);
    await page.keyboard.press('Home'); await assertSlide(page, 0);
    await advance(page, 7000); await assertSlide(page, 0);
    await page.locator('.brand').first().focus();
    await showHero(page); await expectOneAutomaticStep(page, 0);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(viewport);
      await showHero(page);
      const visible = await tabs.evaluateAll(buttons => buttons.map(button => { const r = button.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
      assert.deepEqual(visible, Array(7).fill(true), `All seven business buttons must be in the first viewport at ${viewport.width}x${viewport.height}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await assertBusinessLayout(page, viewport);
    }
    await page.getByLabel('外观').selectOption('dark');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'khfwcms-hero-carousel-mobile-dark.png') });
    assert.deepEqual(normal.errors, []);
    await page.close();

    // The requested initial automatic playback also applies to reduced-motion
    // mode; that mode changes visual transitions rather than the six-second cadence.
    const reduced = await createPage(browser, 'reduce');
    page = reduced.page;
    await assertSlide(page, 0); await expectOneAutomaticStep(page, 0);
    assert.equal(await page.locator('#business-feature-counter, #business-autoplay').count(), 0);
    assert.deepEqual(reduced.errors, []);
    await page.close();
    console.log('PASS: full-width navigation and contained top-aligned hero images; seven first-viewport buttons, six-second autoplay, wraparound, manual reset, temporary pauses, links, reduced-motion cadence and mobile dark layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
