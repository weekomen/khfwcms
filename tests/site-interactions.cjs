const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const data = JSON.parse(fs.readFileSync('data/seed.json','utf8'));
  fs.mkdirSync('reference', { recursive: true });
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chromium',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://localhost:3199/**',async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/admin/session') return route.fulfill({status:401,json:{error:'请登录'}});
      if (url.pathname === '/api/admin/login') return route.fulfill({json:{ok:true,csrfToken:'browser-fixture',passwordChangeRequired:false}});
      if (url.pathname.startsWith('/api/')) return route.fulfill({json:data});
      // Exercise every dialog without retaining all decoded tall posters in one
      // browser process. Real image bytes are checked separately on live pages.
      if (/^\/assets\/course-[a-f0-9]{24}\.(jpg|png|webp)$/.test(url.pathname)) return route.fulfill({body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'),contentType:'image/gif'});
      const file = url.pathname==='/'?'index.html':url.pathname==='/admin'?'admin.html':url.pathname.slice(1);
      await route.fulfill({body:fs.readFileSync(path.join('public',file)),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});
    });
    await page.goto('http://localhost:3199/'); await page.waitForSelector('#business-tabs [role="tab"]');
    assert.equal(await page.locator('#home > #business-feature-panel.hero-image').count(),1);
    assert.equal(await page.locator('#business-showcase').evaluate(section => Boolean(section.closest('#home'))),true);
    assert.equal(await page.locator('.business-feature').count(),1);
    const businessTabs = page.locator('#business-tabs [role="tab"]');
    assert.equal(await businessTabs.count(),7);
    const businessImage = index => data.businessPages.find(page => page.id === ['supply-chain','ai-school-supply','online-ai-study','online-education','education-street','youth-center','ai-museum'][index])?.image || `/assets/business-${index + 1}.svg`;
    assert.equal(await page.locator('#business-feature-image').getAttribute('src'),businessImage(0));
    await businessTabs.nth(6).click();
    assert.equal(await page.locator('#business-feature-image').getAttribute('src'),businessImage(6));
    assert.equal(await page.locator('#business-feature').getAttribute('data-business-id'),'ai-museum');
    await businessTabs.first().click();
    assert.equal(await page.locator('#business-feature').getAttribute('href'),'#after-school-supply');
    await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.locator('#back-to-top').isVisible(),false);
    await page.screenshot({path:'reference/hero-business-desktop.png'});
    await page.goto('http://localhost:3199/courses.html'); await page.waitForSelector('.course-card');
    assert.equal(await page.locator('#course-catalog a').count(),0);
    let checked = 0;
    for (const category of [...new Set(data.courses.map(c=>c.category === '劳动类' ? '手工类' : c.category))]) {
      await page.getByRole('button',{name:category,exact:true}).click();
      if (await page.locator('#course-catalog .team-toggle').isVisible()) await page.locator('#course-catalog .team-toggle').click();
      const buttons=page.locator('.course-detail-button');
      for(let i=0;i<await buttons.count();i++) {
        await buttons.nth(i).click();
        assert.equal(await page.locator('#detail').evaluate(d=>d.open),true);
        const title = await page.locator('#detail h2').textContent();
        const course = data.courses.find(course => course.title === title && (course.category === '劳动类' ? '手工类' : course.category) === category);
        assert.equal(await page.locator('.course-description').textContent(), course.description || course.summary || '课程简介待补充。');
        assert.equal(await page.locator('.course-outline li').count(), String(course.outline || '').split('\n').filter(line => line.trim()).length);
        if (course.cover) assert.equal(await page.locator('.course-detail-cover').getAttribute('src'),course.cover);
        assert.equal(await page.locator('.course-long-image').count(),course.longImage ? 1 : 0);
        if (course.longImage) assert.equal(await page.locator('.course-long-image').getAttribute('src'),course.longImage);
        assert.equal(await page.locator('.course-grades dd').textContent(), course.grades?.trim() || '待补充');
        assert.equal(await page.locator('#detail-content').evaluate(root => {
          const overview = root.querySelector('.course-overview');
          return [...root.querySelectorAll('img')].every(image => Boolean(overview.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING));
        }), true);
        await page.keyboard.press('Escape'); checked++;
      }
    }
    assert.equal(checked,data.courses.length);
    await page.goto('http://localhost:3199/'); await page.waitForSelector('#platform-grid button');
    for (const name of ['微信','视频号','快手','抖音']) {
      await page.getByRole('button',{name:`放大${name}二维码`}).click();
      await page.locator('.qr-large').evaluate(img=>img.decode());
      assert.ok(await page.locator('.qr-large').evaluate(img=>img.naturalWidth>500));
      await page.keyboard.press('Escape');
    }
    await page.locator('#platform-grid').scrollIntoViewIfNeeded(); await page.screenshot({path:'reference/contact-platforms.png'});
    await page.getByRole('button',{name:'返回顶部',exact:true}).click();
    await page.waitForFunction(()=>scrollY===0);
    await page.setViewportSize({width:390,height:844});
    await page.goto('http://localhost:3199/courses.html?category=%E7%A7%91%E6%8A%80%E7%B1%BB'); await page.waitForSelector('.course-card');
    await page.getByLabel('外观').selectOption('dark');
    assert.equal(await page.locator('.course-filters .selected').textContent(),'科技类');
    assert.equal(await page.locator('.course-card').count(),3);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.goto('http://localhost:3199/'); await page.waitForSelector('#platform-grid button');
    await page.screenshot({path:'reference/hero-business-mobile.png'});
    await page.locator('#platform-grid').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'放大抖音二维码'}).click(); assert.ok(await page.locator('#detail').evaluate(d=>d.scrollWidth<=d.clientWidth)); await page.keyboard.press('Escape');
    await page.goto('http://localhost:3199/team.html'); await page.waitForSelector('.person');
    assert.equal(await page.locator('.person').count(),data.team.length);
    await page.locator('.person').first().click(); assert.equal(await page.locator('#detail').evaluate(d=>d.open),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.person').first().evaluate(button=>button===document.activeElement),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.goto('http://localhost:3199/admin');await page.getByLabel('管理密码',{exact:true}).fill('test');await page.getByRole('button',{name:'登录后台'}).click();await page.getByRole('button',{name:'课程目录',exact:true}).click();
    assert.equal(await page.getByLabel('详细介绍（弹窗）',{exact:true}).count(),data.courses.length);
    assert.equal(await page.getByLabel('学习内容（每行一项）',{exact:true}).count(),data.courses.length);
    assert.equal(await page.getByLabel('适用年级',{exact:true}).count(),data.courses.length);
    assert.deepEqual(errors,[]);
    console.log(`PASS: homepage, standalone course/team pages, all ${checked} course dialogs, query category, mobile 3-course preview, team focus restore, QR images and editable details.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
