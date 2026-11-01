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

async function createPage(browser, reducedMotion = 'no-preference', imageShape = 'wide') {
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
    // Exercise a photograph shape as well as the wide placeholders, without
    // reading maintained runtime content or administrator credentials.
    if (imageShape === 'photo' && url.pathname === '/assets/business-1.svg') {
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1396" height="1048" viewBox="0 0 1396 1048"><rect width="1396" height="1048" fill="#a8c9e5"/><path d="M0 0h1396v1048H0z" fill="none" stroke="#24539a" stroke-width="18"/><text x="698" y="550" text-anchor="middle" font-size="96" fill="#163966">4:3 PHOTO</text></svg>' });
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const absolute = path.join('public', file);
    if (!fs.existsSync(absolute)) return route.fulfill({ status: 404, body: 'Not found' });
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ body: fs.readFileSync(absolute), contentType: type });
  });
  await page.goto(origin);
  await page.waitForSelector('#business-tabs [role="tab"]');
  await showShowcase(page);
  return { page, errors };
}

async function settleLayout(page) {
  await page.clock.runFor(100);
  // IntersectionObserver is driven by rendering, not only the fake timer.
  await page.waitForTimeout(60);
}
async function showShowcase(page) {
  await page.evaluate(() => document.getElementById('business-showcase').scrollIntoView({ block: 'start', behavior: 'instant' }));
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
  assert.equal((await page.locator('#business-feature-counter').textContent()).trim(), `${String(index + 1).padStart(2, '0')} / 07`);
  assert.equal((await page.locator('#business-feature-index').textContent()).trim(), `${String(index + 1).padStart(2, '0')} / CORE BUSINESS`);
}
async function expectOneAutomaticStep(page, index) {
  await advance(page, 6100);
  await assertSlide(page, (index + 1) % ids.length);
}
async function assertBusinessLayout(page, viewport) {
  await page.locator('#business-feature-image').evaluate(image => image.decode());
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const tabs = document.getElementById('business-tabs');
    return {
      hero: rect('#home'), showcase: rect('#business-showcase'), panel: rect('#business-feature-panel'),
      heading: rect('#business-showcase .business-showcase-heading'), tabs: rect('#business-tabs'),
      image: rect('#business-feature-image'), copy: rect('.business-feature-copy'), title: rect('#business-feature-title'), counter: rect('#business-feature-counter'),
      reference: rect('#after-school-supply .section-head'), scrollable: tabs.scrollWidth > tabs.clientWidth
    };
  });
  const label = `${viewport.width}x${viewport.height}`;
  assert.ok(layout.hero.bottom <= layout.showcase.top + 1, `The office hero must precede the separate business showcase at ${label}`);
  for (const [name, bounds] of Object.entries({ showcase: layout.showcase, heading: layout.heading, tabs: layout.tabs, panel: layout.panel })) {
    assert.ok(Math.abs(bounds.left - layout.reference.left) <= 1, `Business ${name} must align with the next section's left edge at ${label}`);
    assert.ok(Math.abs(bounds.right - layout.reference.right) <= 1, `Business ${name} must align with the next section's right edge at ${label}`);
  }
  assert.ok(layout.tabs.bottom <= layout.panel.top + 1, `The image must follow the seven business tabs at ${label}`);
  assert.ok(layout.image.width > 0 && layout.image.height > 0, `The business image must have visible dimensions at ${label}`);
  assert.ok(layout.copy.top >= layout.panel.top - 1 && layout.copy.bottom <= layout.panel.bottom, `The complete business caption must remain inside the image at ${label}`);
  assert.ok(layout.title.left >= layout.panel.left && layout.title.right <= layout.panel.right, `The overlaid title must remain inside the image horizontally at ${label}`);
  assert.ok(layout.title.top >= layout.panel.top - 1 && layout.title.bottom <= layout.panel.bottom, `The overlaid title must remain inside the image vertically at ${label}`);
  assert.ok(layout.counter.top >= layout.panel.top && layout.counter.bottom <= layout.panel.bottom, `The slide counter must remain inside the image at ${label}`);
  if (viewport.width <= 1000) assert.equal(layout.scrollable, true, `Small screens must scroll the seven business tabs horizontally at ${label}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No page-wide horizontal overflow at ${label}`);
}
const responsiveViewports = [
  { width: 1440, height: 900 }, { width: 929, height: 657 }, { width: 768, height: 800 },
  { width: 390, height: 844 }, { width: 320, height: 740 }
];
async function assertResponsiveLayout(page) {
  const previous = await slideIndex(page);
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await showShowcase(page);
    // The first two long titles and summaries are the tightest caption cases.
    for (const index of [0, 1]) {
      await page.locator('#business-tabs [role="tab"]').nth(index).dispatchEvent('click');
      await assertBusinessLayout(page, viewport);
    }
  }
  await page.locator('#business-tabs [role="tab"]').nth(previous).dispatchEvent('click');
}
async function assertDestinations(page) {
  const tabs = page.locator('#business-tabs [role="tab"]');
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
  const course = page.locator('#after-school-cards a').nth(1);
  assert.equal(await course.getAttribute('href'), '/courses.html');
  assert.equal(await course.getAttribute('target'), '_blank');
  const plan = page.locator('#after-school-cards a').nth(2);
  assert.equal(await plan.getAttribute('href'), 'https://kehoubang.cn/profile/upload/pdf/2/index.html');
  assert.equal(await plan.getAttribute('target'), '_blank');
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const normal = await createPage(browser);
    let page = normal.page;
    const tabs = page.locator('#business-tabs [role="tab"]');
    assert.equal(await page.locator('#home > .hero-image[role="img"]').count(), 1);
    assert.equal(await page.locator('#home > .hero-content.wrap').count(), 1);
    assert.equal(await page.locator('#home .hero-note, #home .hero-index').count(), 2);
    assert.equal(await page.locator('#home + section#business-showcase.wrap > #business-feature-panel').count(), 1);
    assert.equal(await page.locator('#business-showcase').evaluate(section => Boolean(section.closest('#home'))), false);
    assert.equal(await page.locator('#home #business-feature-image').count(), 0);
    assert.equal(await page.locator('.business-feature').count(), 1);
    assert.equal(await tabs.count(), 7);
    assert.deepEqual(await tabs.locator('.business-tab-index').allTextContents(), ['01', '02', '03', '04', '05', '06', '07']);
    assert.equal(await page.locator('#business-feature-counter').isVisible(), true);
    assert.equal(await page.locator('#business-autoplay, #business-previous, #business-next').count(), 0);
    await assertSlide(page, 0);
    await advance(page, 5000); await assertSlide(page, 0);
    await advance(page, 1100); await assertSlide(page, 1);

    // Manual selection keeps the existing destinations and resets the interval.
    await assertDestinations(page);
    await advance(page, 5000); await assertSlide(page, 6);
    await advance(page, 1100); await assertSlide(page, 0);

    // Hover suspends rotation only until the pointer leaves the business showcase.
    const rect = await page.locator('#business-showcase').boundingBox();
    await page.mouse.move(rect.x + Math.min(200, rect.width / 2), rect.y + Math.min(200, rect.height / 2));
    let index = await slideIndex(page);
    await advance(page, 7000); await assertSlide(page, index);
    await page.mouse.move(0, 0); await expectOneAutomaticStep(page, index);

    // A hidden document and an offscreen showcase pause the same timer. They do
    // not permanently disable automatic playback when visibility returns.
    index = await slideIndex(page);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await advance(page, 7000); await assertSlide(page, index);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expectOneAutomaticStep(page, index);
    index = await slideIndex(page);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await settleLayout(page);
    assert.ok(await page.locator('#business-showcase').evaluate(section => section.getBoundingClientRect().bottom < 0));
    index = await slideIndex(page);
    await advance(page, 7000); await assertSlide(page, index);
    await showShowcase(page); await expectOneAutomaticStep(page, index);

    // Keyboard tab navigation temporarily pauses while focus is visible in
    // the carousel, then resumes after focus moves back to the page header.
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight'); await assertSlide(page, 1);
    assert.equal(await tabs.nth(1).evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('End'); await assertSlide(page, 6);
    await page.keyboard.press('Home'); await assertSlide(page, 0);
    await page.keyboard.press('ArrowLeft'); await assertSlide(page, 6);
    await page.keyboard.press('ArrowRight'); await assertSlide(page, 0);
    await advance(page, 7000); await assertSlide(page, 0);
    await page.locator('.brand').first().focus();
    await showShowcase(page); await expectOneAutomaticStep(page, 0);

    await assertResponsiveLayout(page);
    // Keyboard selection reveals offscreen tabs in the phone's horizontal list.
    await tabs.first().focus();
    await page.keyboard.press('End');
    await settleLayout(page);
    assert.equal(await tabs.last().evaluate(button => {
      const tab = button.getBoundingClientRect(), list = button.parentElement.getBoundingClientRect();
      return tab.left >= list.left - 1 && tab.right <= list.right + 1;
    }), true);
    await page.keyboard.press('Home');
    await assertSlide(page, 0);
    await page.getByLabel('外观').selectOption('dark');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(os.tmpdir(), 'khfwcms-hero-carousel-mobile-dark.png') });
    assert.deepEqual(normal.errors, []);
    await page.close();

    // The requested initial automatic playback also applies to reduced-motion
    // mode; that mode changes visual transitions rather than the six-second cadence.
    const reduced = await createPage(browser, 'reduce', 'photo');
    page = reduced.page;
    await assertSlide(page, 0); await expectOneAutomaticStep(page, 0);
    assert.equal(await page.locator('#business-feature-counter').isVisible(), true);
    assert.equal(await page.locator('#business-autoplay').count(), 0);
    await page.locator('#business-tabs [role="tab"]').first().dispatchEvent('click');
    await assertResponsiveLayout(page);
    await page.getByLabel('外观').selectOption('dark');
    await assertResponsiveLayout(page);
    assert.deepEqual(reduced.errors, []);
    await page.close();
    console.log('PASS: classic office hero followed by separate business showcase, seven numbered scrollable tabs and counter, unchanged destinations, six-second autoplay scoped to showcase visibility/interaction, keyboard navigation, five responsive sizes and dark layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
