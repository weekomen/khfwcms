const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');

// Only public fixtures are read. Authentication, content writes and uploads
// are isolated routes; the maintained content.json and credentials are unused.
const origin = 'http://localhost:3194';
const csrf = 'isolated-managed-album-fixture';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=', 'base64');
const uploadImage = fs.readFileSync('public/assets/logo.png');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

(async () => {
  const { applyEventAlbumDefaults } = await import('../event-albums.mjs');
  const { validateContent } = await import('../validation.mjs');
  const fixture = JSON.parse(fs.readFileSync('data/seed.json', 'utf8'));
  fixture.team = fixture.team.slice(0, 3); fixture.courses = fixture.courses.slice(0, 3);
  const manifest = JSON.parse(fs.readFileSync('public/assets/events/manifest.json', 'utf8'));
  const year2025 = 'new-year-dinner', year2026 = 'new-year-dinner-2026';
  assert.equal(manifest[year2025].photos.length, 540);
  assert.equal(manifest[year2026].photos.length, 455);
  // Unique labels let searches find archived records from beyond page one.
  manifest[year2025].photos[0].filename = '原有首张待删除.jpg';
  manifest[year2025].photos.at(-1).filename = '末页旧照片定位.jpg';
  manifest[year2025].photos.at(-1).tag = '末页原片';
  manifest[year2025].cover = manifest[year2025].photos[0].src;
  for (const id of [year2025, year2026]) {
    const page = fixture.venturePages.find(item => item.id === id);
    delete page.photos; delete page.albumManaged; page.published = true;
  }
  fixture.venturePages.push({ id: 'company-dinner', title: '公司年夜饭测试', summary: '公司活动相册', body: '活动记录', image: '/assets/logo.png', longImage: '', order: 99, published: true });
  manifest['company-dinner'] = { photos: [1, 2].map(index => ({ id: `company-old-${index}`, src: `/assets/events/company-dinner/old-${index}.png`, filename: `公司原片${index}.png`, tag: '公司', width: 600, height: 400 })) };
  let persisted = applyEventAlbumDefaults(structuredClone(fixture), manifest);
  validateContent(persisted);
  const photosFor = id => persisted.venturePages.find(item => item.id === id).photos;
  const oldFirst = structuredClone(photosFor(year2025)[0]);
  const oldLast = structuredClone(photosFor(year2025).at(-1));
  const deleted2026 = [];
  let uploadRequests = 0, failUploadAt = -1, saves = 0, failManifest = false;
  const errors = [];
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route(`${origin}/**`, async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/admin/session') return route.fulfill({ json: { csrfToken: csrf, passwordChangeRequired: false } });
      if (url.pathname === '/api/admin/content') {
        if (request.method() === 'PUT') {
          assert.equal(request.headers()['x-csrf-token'], csrf);
          const candidate = request.postDataJSON(); validateContent(candidate);
          persisted = structuredClone(candidate); saves++;
          return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({ json: applyEventAlbumDefaults(structuredClone(persisted), manifest) });
      }
      if (url.pathname === '/api/admin/images') {
        assert.equal(request.headers()['x-csrf-token'], csrf);
        assert.equal(request.headers()['content-type'], 'image/png');
        uploadRequests++;
        if (uploadRequests === failUploadAt) return route.fulfill({ status: 500, json: { error: '隔离测试上传失败' } });
        return route.fulfill({ status: 201, json: { url: `/assets/upload-${String(uploadRequests).padStart(32, '0')}.png` } });
      }
      if (url.pathname === '/api/content') return route.fulfill({ json: applyEventAlbumDefaults(structuredClone(persisted), manifest) });
      if (url.pathname === '/assets/events/manifest.json') return route.fulfill(failManifest ? { status: 503, body: 'Unavailable' } : { json: manifest });
      // Thousands of photographs are represented by tiny pixels so this test
      // exercises management and rendering without retaining full image data.
      if (/\.(png|jpe?g|webp)$/i.test(url.pathname)) return route.fulfill({ body: pixel, contentType: 'image/png' });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: { error: 'Unexpected fixture endpoint' } });
      const file = url.pathname === '/admin' ? 'admin.html' : url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const absolute = path.join('public', file);
      if (!fs.existsSync(absolute)) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ body: fs.readFileSync(absolute), contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    const album = id => page.locator(`.album-editor[data-album-for="${id}"]`);
    const card = (id, photoId) => album(id).locator(`.album-photo-card[data-photo-id="${photoId}"]`);
    const countIs = async (id, count) => assert.match(await album(id).locator('.album-total').textContent(), new RegExp(`${count}\\s*张`));
    const enterEditor = async () => {
      await page.goto(`${origin}/admin`); await page.waitForSelector('#editor:not([hidden])');
      await page.locator('[data-tab="venturePages"]').click();
    };
    const openAlbum = async id => {
      if (!await album(id).locator('details').evaluate(node => node.open)) await album(id).locator('summary').click();
      await album(id).locator('summary').filter({ hasText: '收起管理' }).waitFor();
      await album(id).locator('.album-photo-list > *').first().waitFor();
    };
    const save = async () => {
      const before = saves; await page.locator('#save').click();
      await page.locator('#status').filter({ hasText: '保存成功' }).waitFor();
      assert.equal(saves, before + 1);
    };
    const openPublic = async id => {
      await page.goto(`${origin}/content-page.html?type=venture&id=${id}`);
      await page.waitForSelector('.event-gallery');
    };

    await enterEditor();
    await countIs(year2025, 540); await countIs(year2026, 455);
    assert.equal(await album(year2025).locator('.album-photo-card').count(), 0, 'Collapsed large albums should not render hundreds of editor cards');
    await openAlbum(year2025);
    assert.equal(await album(year2025).locator('.album-photo-card').count(), 24);
    assert.equal(await album(year2025).locator('.album-photo-thumb').first().getAttribute('src'), oldFirst.thumb || oldFirst.src);
    await album(year2025).locator('.album-next').click();
    assert.match(await album(year2025).locator('.album-page-info').textContent(), /2/);

    // Search the complete archived list, then move a filtered result using its
    // absolute position in all 540 photographs rather than the filtered index.
    await album(year2025).getByLabel('搜索相册照片', { exact: true }).fill(oldLast.filename);
    assert.equal(await album(year2025).locator('.album-photo-card').count(), 1);
    assert.equal(await card(year2025, oldLast.id).locator('[data-reorder-action="position-input"]').inputValue(), '540');
    await card(year2025, oldLast.id).locator('[data-reorder-action="top"]').click();
    assert.equal(await card(year2025, oldLast.id).locator('[data-reorder-action="position-input"]').inputValue(), '1');
    await card(year2025, oldLast.id).getByLabel('照片名称', { exact: true }).fill('原图已改名.png');
    await card(year2025, oldLast.id).getByLabel('照片标签', { exact: true }).fill('合影更新');
    await card(year2025, oldLast.id).locator('.album-preview').click();
    assert.equal(await page.locator('#admin-album-preview').evaluate(dialog => dialog.open), true);
    assert.equal(await page.locator('#admin-album-preview img').getAttribute('src'), oldLast.src);
    await page.locator('[data-album-preview-close]').click();
    await card(year2025, oldLast.id).locator('[data-album-replace]').setInputFiles({ name: '替换原片.png', mimeType: 'image/png', buffer: uploadImage });
    await album(year2025).locator('.album-message').filter({ hasText: '图片已更换' }).waitFor();
    const replacement = '/assets/upload-00000000000000000000000000000001.png';
    // Rename/tag changes remain attached to the same record after replacement.
    await album(year2025).getByLabel('搜索相册照片', { exact: true }).fill('原图已改名');
    assert.equal(await card(year2025, oldLast.id).locator('.album-photo-thumb').getAttribute('src'), replacement);

    // New uploads, invalid local files and a failed HTTP request can coexist;
    // successful files remain available for saving and do not replace history.
    failUploadAt = uploadRequests + 2;
    await album(year2025).locator('[data-album-upload]').setInputFiles([
      { name: '新增合影.png', mimeType: 'image/png', buffer: uploadImage },
      { name: '过大.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
      { name: '不支持.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
      { name: '上传失败.png', mimeType: 'image/png', buffer: uploadImage },
      { name: '新增晚宴.png', mimeType: 'image/png', buffer: uploadImage }
    ]);
    await album(year2025).locator('.album-message').filter({ hasText: '成功上传 2 张，失败 3 张' }).waitFor();
    assert.equal(uploadRequests, 4, 'Unsupported and oversized files must be rejected before upload');
    await countIs(year2025, 542);
    await album(year2025).getByLabel('搜索相册照片', { exact: true }).fill(oldFirst.filename);
    await card(year2025, oldFirst.id).locator('.remove').click();
    await countIs(year2025, 541);

    // Batch deletion retains selection across pages of an archived album.
    await openAlbum(year2026);
    const firstSelected = photosFor(year2026)[0].id, secondSelected = photosFor(year2026)[24].id;
    deleted2026.push(firstSelected, secondSelected);
    await card(year2026, firstSelected).locator('.album-select').check();
    await album(year2026).locator('.album-next').click();
    await card(year2026, secondSelected).locator('.album-select').check();
    await album(year2026).locator('.album-delete-selected').click();
    await countIs(year2026, 453);

    // A small custom historical album can be emptied entirely through the UI.
    await openAlbum('company-dinner');
    await album('company-dinner').locator('.album-select-page').click();
    await album('company-dinner').locator('.album-delete-selected').click();
    await countIs('company-dinner', 0);
    await save();
    const edited = photosFor(year2025)[0];
    assert.equal(edited.id, oldLast.id); assert.equal(edited.src, replacement);
    assert.equal(edited.filename, '原图已改名.png'); assert.equal(edited.tag, '合影更新');
    assert.ok(!edited.thumb || edited.thumb === replacement, 'Replacement must not retain a stale archived thumbnail');
    assert.equal(photosFor(year2025).length, 541);
    assert.equal(photosFor(year2025).some(photo => photo.id === oldFirst.id), false);
    assert.equal(photosFor(year2026).length, 453);
    assert.ok(deleted2026.every(id => !photosFor(year2026).some(photo => photo.id === id)));
    assert.deepEqual(photosFor('company-dinner'), []);
    assert.ok(persisted.venturePages.filter(item => [year2025, year2026, 'company-dinner'].includes(item.id)).every(item => item.albumManaged === true));

    await enterEditor();
    await countIs(year2025, 541); await countIs(year2026, 453);
    await openAlbum(year2025);
    await album(year2025).getByLabel('搜索相册照片', { exact: true }).fill(oldFirst.filename);
    assert.equal(await album(year2025).locator('.album-photo-card').count(), 0, 'Saved removals must not reappear on reload');
    await album(year2025).getByLabel('搜索相册照片', { exact: true }).fill('原图已改名');
    await album(year2025).getByLabel('按相册标签筛选', { exact: true }).selectOption('合影更新');
    assert.equal(await album(year2025).locator('.album-photo-card').count(), 1);
    assert.equal(await card(year2025, oldLast.id).getByLabel('照片名称', { exact: true }).inputValue(), '原图已改名.png');
    await page.screenshot({ path: path.join(os.tmpdir(), 'khfwcms-managed-albums-desktop.png') });

    // Public pages use the saved list exclusively even though the archive
    // continues to contain the replaced/deleted photographs.
    await openPublic(year2025);
    assert.match(await page.locator('.event-gallery-meta').textContent(), /541\s*张/);
    assert.equal(await page.locator('.content-page-figure .content-page-image').first().getAttribute('src'), replacement, 'A removed cover must fall back to a remaining photograph');
    await page.getByLabel('按标签筛选', { exact: true }).selectOption('合影更新');
    await page.getByLabel('搜索照片名称', { exact: true }).fill('原图已改名');
    assert.equal(await page.locator('.event-photo-card').count(), 1);
    assert.equal(await page.locator('.event-photo-thumb').getAttribute('src'), replacement);
    await page.locator('.event-photo-card').click();
    assert.equal(await page.locator('.event-lightbox-image').getAttribute('src'), replacement);
    assert.equal(await page.locator('.event-lightbox-download').getAttribute('href'), replacement);
    await page.getByRole('button', { name: '关闭大图', exact: true }).click();
    await page.getByLabel('按标签筛选', { exact: true }).selectOption('');
    await page.getByLabel('搜索照片名称', { exact: true }).fill(oldFirst.filename);
    assert.equal(await page.locator('.event-photo-card').count(), 0);
    await openPublic(year2026);
    assert.match(await page.locator('.event-gallery-meta').textContent(), /453\s*张/);
    await page.getByLabel('搜索照片名称', { exact: true }).fill(manifest[year2026].photos[0].filename);
    assert.equal(await page.locator('.event-photo-card').count(), 0, 'The static archive must not resurrect a deleted record');
    await openPublic('company-dinner');
    assert.equal(await page.locator('.event-photo-card').count(), 0);
    assert.equal(await page.locator('.event-gallery-empty').count(), 1);

    // Deliberately empty authoritative lists remain empty, including when
    // static metadata cannot be fetched, rather than reverting to 540 photos.
    persisted.venturePages.find(item => item.id === year2025).photos = [];
    failManifest = true;
    await openPublic(year2025);
    assert.equal(await page.locator('.event-photo-card').count(), 0);
    assert.equal(await page.locator('.event-gallery-empty').count(), 1);
    failManifest = false;
    await enterEditor(); await openAlbum(year2026);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('外观', { exact: true }).selectOption('dark');
    await album(year2026).scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await album(year2026).locator('.album-photo-card').count(), 24);
    await page.screenshot({ path: path.join(os.tmpdir(), 'khfwcms-managed-albums-mobile-dark.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: all 995 archived photos are managed in paginated editors; full-list search/reorder, original-photo preview/edit/replace/delete, cross-page batch deletion, partial upload recovery, save/reload, authoritative public lists and empty albums, mobile dark layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
