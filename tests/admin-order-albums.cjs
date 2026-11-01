const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// Routes use public seed fixtures only. This test never reads management
// credentials or writes the maintained content.json / uploads directory.
const origin = 'http://localhost:3196';
const csrf = 'isolated-order-album-fixture';
const png = fs.readFileSync(path.join('public', 'assets', 'logo.png'));
const fixture = JSON.parse(fs.readFileSync('data/seed.json', 'utf8'));
fixture.team = fixture.team.slice(0, 3);
fixture.courses = fixture.courses.slice(0, 3);
fixture.venturePages.push({ id: 'company-dinner', title: '公司年夜饭测试', summary: '独立相册', body: '官网活动记录', image: '', longImage: '', order: 99, published: true, photos: [] });
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const values = locator => locator.evaluateAll(inputs => inputs.map(input => input.value));

(async () => {
  const { validateContent } = await import('../validation.mjs');
  let persisted = structuredClone(fixture), uploads = 0, saves = 0, unavailableManifest = false;
  const uploadSources = [];
  const manifest = { 'new-year-dinner-2026': { title: '原有活动', photos: [{ id: 'old-1', src: '/assets/events/qa-original.png', filename: '原有现场.png', tag: '原有', width: 40, height: 30 }], tags: [{ name: '原有' }] } };
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route(`${origin}/**`, async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/admin/session') return route.fulfill({ json: { ok: true, csrfToken: csrf, passwordChangeRequired: false } });
      if (url.pathname === '/api/admin/content') {
        if (request.method() === 'PUT') {
          assert.equal(request.headers()['x-csrf-token'], csrf);
          const candidate = request.postDataJSON();
          validateContent(candidate);
          persisted = structuredClone(candidate); saves++;
          return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({ json: persisted });
      }
      if (url.pathname === '/api/admin/images') {
        assert.equal(request.method(), 'POST');
        assert.equal(request.headers()['x-csrf-token'], csrf);
        assert.equal(request.headers()['content-type'], 'image/png');
        uploads++;
        if (uploads === 2) return route.fulfill({ status: 500, json: { error: '测试上传失败' } });
        const source = `/assets/upload-${String(uploads).padStart(32, '0')}.png`;
        uploadSources.push(source);
        return route.fulfill({ status: 201, json: { url: source } });
      }
      if (url.pathname === '/api/content') return route.fulfill({ json: persisted });
      if (url.pathname === '/assets/events/manifest.json') return unavailableManifest ? route.fulfill({ status: 503, json: { error: 'fixture unavailable' } }) : route.fulfill({ json: manifest });
      if (/^\/assets\/upload-[a-f0-9]{32}\.png$/.test(url.pathname) || url.pathname === '/assets/events/qa-original.png') return route.fulfill({ body: png, contentType: 'image/png' });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: { error: 'Unexpected fixture endpoint' } });
      const file = url.pathname === '/' ? 'index.html' : url.pathname === '/admin' ? 'admin.html' : url.pathname.slice(1);
      const absolute = path.join('public', file);
      if (!fs.existsSync(absolute)) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ body: fs.readFileSync(absolute), contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`${origin}/admin`);
    await page.waitForSelector('#editor:not([hidden])');
    const cards = () => page.locator('#fields > .edit-card');
    const selectTab = async name => page.locator(`[data-tab="${name}"]`).click();
    const save = async () => { await page.locator('#save').click(); await page.locator('#status').filter({ hasText: '保存成功' }).waitFor(); };

    // Reordering never discards edits made before moving a record. Boundary
    // controls, direct positions, and insertion work without deleting followers.
    await selectTab('team');
    const names = await values(page.getByLabel('成员姓名', { exact: true }));
    const editedName = `${names[0]}（排序测试）`, editedBio = '未保存的介绍应跟随成员移动。';
    await page.getByLabel('成员姓名', { exact: true }).first().fill(editedName);
    await page.getByLabel('个人介绍', { exact: true }).first().fill(editedBio);
    assert.equal(await cards().first().locator('[data-reorder-action="up"]').isDisabled(), true);
    assert.equal(await cards().last().locator('[data-reorder-action="down"]').isDisabled(), true);
    await cards().first().locator('[data-reorder-action="down"]').click();
    assert.deepEqual(await values(page.getByLabel('成员姓名', { exact: true })), [names[1], editedName, names[2]]);
    assert.equal(await page.getByLabel('个人介绍', { exact: true }).nth(1).inputValue(), editedBio);
    await cards().nth(1).locator('[data-reorder-action="position-input"]').fill('3');
    await cards().nth(1).locator('[data-reorder-action="position"]').click();
    assert.deepEqual(await values(page.getByLabel('成员姓名', { exact: true })), [names[1], names[2], editedName]);
    await cards().last().locator('[data-reorder-action="top"]').click();
    assert.deepEqual(await values(page.getByLabel('成员姓名', { exact: true })), [editedName, names[1], names[2]]);
    await cards().first().locator('[data-reorder-action="position-input"]').fill('0');
    await cards().first().locator('[data-reorder-action="position"]').click();
    assert.deepEqual(await values(page.getByLabel('成员姓名', { exact: true })), [editedName, names[1], names[2]]);

    await selectTab('courses');
    const courseNames = await values(page.getByLabel('课程名称', { exact: true }));
    await cards().first().locator('[data-reorder-action="insert"]').click();
    assert.equal(await cards().count(), 4);
    await page.getByLabel('课程名称', { exact: true }).nth(1).fill('插入课程');
    assert.deepEqual(await values(page.getByLabel('课程名称', { exact: true })), [courseNames[0], '插入课程', courseNames[1], courseNames[2]]);
    await cards().last().locator('[data-reorder-action="top"]').click();
    assert.deepEqual(await values(page.getByLabel('课程名称', { exact: true })), [courseNames[2], courseNames[0], '插入课程', courseNames[1]]);

    await selectTab('navigation');
    const beforeRoots = await values(page.getByLabel('菜单 ID', { exact: true }));
    let about = cards().nth(beforeRoots.indexOf('about'));
    const beforeChildren = await values(about.getByLabel('显示名称', { exact: true }));
    const editedChild = '集团介绍（已编辑）';
    await about.getByLabel('显示名称', { exact: true }).first().fill(editedChild);
    await about.locator('.nested-card').first().locator('[data-reorder-action="down"]').click();
    about = cards().nth(beforeRoots.indexOf('about'));
    assert.deepEqual(await values(about.getByLabel('显示名称', { exact: true })), [beforeChildren[1], editedChild, ...beforeChildren.slice(2)]);
    await cards().first().locator(':scope > .reorder-controls [data-reorder-action="down"]').click();
    assert.deepEqual(await values(page.getByLabel('菜单 ID', { exact: true })), [beforeRoots[1], beforeRoots[0], ...beforeRoots.slice(2)]);

    // A mixed batch checks format/size before posting; a server failure does
    // not discard photographs that uploaded successfully earlier or later.
    await selectTab('venturePages');
    let album = page.locator('.album-editor[data-album-for="new-year-dinner-2027"]');
    await album.locator('[data-album-upload]').setInputFiles([
      { name: '相聚.png', mimeType: 'image/png', buffer: png },
      { name: '过大.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
      { name: '不支持.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
      { name: '失败.png', mimeType: 'image/png', buffer: png },
      { name: '团圆.png', mimeType: 'image/png', buffer: png }
    ]);
    await album.locator('.album-message').filter({ hasText: '成功上传 2 张，失败 3 张' }).waitFor();
    assert.equal(uploads, 3, 'Invalid file type/size must not reach the upload endpoint');
    assert.equal(await album.locator('.album-photo-card').count(), 2);
    assert.equal(await page.locator('#save').isEnabled(), true);
    await album.locator('.album-photo-card').last().locator('[data-reorder-action="top"]').click();
    await album.getByLabel('照片名称', { exact: true }).first().fill('团圆合影.png');
    await album.getByLabel('照片标签', { exact: true }).first().fill('合影');
    await album.locator('.album-photo-card').last().getByRole('button', { name: '移除相聚.png', exact: true }).click();
    assert.equal(await album.locator('.album-photo-card').count(), 1);
    await album.locator('[data-album-upload]').setInputFiles({ name: '晚宴.png', mimeType: 'image/png', buffer: png });
    await album.locator('.album-message').filter({ hasText: '成功上传 1 张' }).waitFor();
    assert.equal(await album.locator('.album-photo-card').count(), 2);
    const company = page.locator('.album-editor[data-album-for="company-dinner"]');
    await company.locator('[data-album-upload]').setInputFiles({ name: '公司合影.png', mimeType: 'image/png', buffer: png });
    await company.locator('.album-message').filter({ hasText: '成功上传 1 张' }).waitFor();
    await save();
    assert.equal(saves, 1);
    assert.equal(persisted.team[0].name, editedName);
    assert.equal(persisted.team[0].bio, editedBio);
    assert.equal(persisted.courses[2].title, '插入课程');
    assert.equal(persisted.navigation[0].id, beforeRoots[1]);
    assert.equal(persisted.navigation.find(item => item.id === 'about').children[1].label, editedChild);
    const dinner = persisted.venturePages.find(item => item.id === 'new-year-dinner-2027');
    assert.deepEqual(dinner.photos.map(photo => photo.filename), ['团圆合影.png', '晚宴.png']);
    assert.equal(dinner.photos[0].src, uploadSources[1]);
    assert.equal(dinner.photos[0].tag, '合影');
    assert.ok(dinner.photos.every(photo => photo.width > 0 && photo.height > 0));

    await page.reload(); await page.waitForSelector('#editor:not([hidden])');
    await selectTab('team');
    assert.deepEqual(await values(page.getByLabel('成员姓名', { exact: true })), [editedName, names[1], names[2]]);
    await selectTab('venturePages');
    album = page.locator('.album-editor[data-album-for="new-year-dinner-2027"]');
    await album.locator('summary').click();
    assert.deepEqual(await values(album.getByLabel('照片名称', { exact: true })), ['团圆合影.png', '晚宴.png']);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('外观', { exact: true }).selectOption('dark');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await selectTab('navigation');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.goto(`${origin}/team.html`); await page.waitForSelector('.person');
    assert.deepEqual(await page.locator('.person h3').allTextContents(), [editedName, names[1], names[2]]);
    await page.goto(`${origin}/content-page.html?type=venture&id=new-year-dinner-2027`);
    await page.waitForSelector('.event-photo-card');
    assert.deepEqual(await page.locator('.event-photo-thumb').evaluateAll(images => images.map(image => image.alt)), ['团圆合影.png', '晚宴.png']);
    await page.getByLabel('按标签筛选').selectOption('合影');
    assert.equal(await page.locator('.event-photo-card').count(), 1);
    await page.locator('.event-photo-card').click();
    assert.equal(await page.locator('.event-lightbox').evaluate(dialog => dialog.open), true);
    assert.equal(await page.locator('.event-lightbox-image').getAttribute('src'), dinner.photos[0].src);
    await page.getByRole('button', { name: '关闭大图', exact: true }).click();
    await page.getByLabel('按标签筛选').selectOption('');
    await page.getByLabel('搜索照片名称').fill('晚宴');
    assert.equal(await page.locator('.event-photo-card').count(), 1);
    assert.equal(await page.locator('.event-photo-thumb').getAttribute('alt'), '晚宴.png');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // Custom company pages work even when the static historical manifest is
    // unavailable; archived photographs remain visible on existing dinners.
    unavailableManifest = true;
    await page.goto(`${origin}/content-page.html?type=venture&id=company-dinner`);
    await page.waitForSelector('.event-photo-card');
    assert.equal(await page.locator('.event-photo-thumb').getAttribute('alt'), '公司合影.png');
    unavailableManifest = false;
    await page.goto(`${origin}/content-page.html?type=venture&id=new-year-dinner-2026`);
    await page.waitForSelector('.event-photo-card');
    assert.equal(await page.locator('.event-photo-thumb').getAttribute('alt'), '原有现场.png');
    assert.deepEqual(errors, []);
    console.log('PASS: persisted admin ordering and insertion retain edits, navigation children/roots reorder, partial album uploads validate type/size and retain successes, photograph reorder/remove/save/reload, custom and year-dinner public galleries, search/filter/lightbox, mobile dark layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
