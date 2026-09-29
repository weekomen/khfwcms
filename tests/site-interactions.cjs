const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/zhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const data = JSON.parse(fs.readFileSync('data/seed.json','utf8'));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://localhost:3199/**',async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) return route.fulfill({json:data});
      const file = url.pathname==='/'?'index.html':url.pathname==='/admin'?'admin.html':url.pathname.slice(1);
      await route.fulfill({body:fs.readFileSync(path.join('public',file)),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});
    });
    await page.goto('http://localhost:3199/'); await page.waitForSelector('.course-card');
    assert.match(await page.locator('.hero-image').evaluate(e=>getComputedStyle(e).backgroundImage),/hero-office.jpg/);
    assert.equal(await page.locator('#back-to-top').isVisible(),false);
    await page.screenshot({path:'reference/hero-office-desktop.png'});
    assert.equal(await page.locator('#course-catalog a').count(),0);
    let checked = 0;
    for (const category of [...new Set(data.courses.map(c=>c.category))]) {
      await page.getByRole('button',{name:category,exact:true}).click();
      await page.locator('#course-catalog .team-toggle').click();
      const buttons=page.locator('.course-detail-button');
      for(let i=0;i<await buttons.count();i++) {
        await buttons.nth(i).click();
        assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);
        assert.ok((await page.locator('.course-description').textContent()).length>35);
        assert.equal(await page.locator('.course-outline li').count(),3);
        await page.keyboard.press('Escape'); checked++;
      }
    }
    assert.equal(checked,55);
    for (const name of ['微信','视频号','快手','抖音']) {
      await page.getByRole('button',{name:`放大${name}二维码`}).click();
      await page.locator('.qr-large').evaluate(img=>img.decode());
      assert.ok(await page.locator('.qr-large').evaluate(img=>img.naturalWidth>500));
      await page.keyboard.press('Escape');
    }
    await page.locator('#platform-grid').scrollIntoViewIfNeeded(); await page.screenshot({path:'reference/contact-platforms.png'});
    await page.getByRole('button',{name:'返回顶部',exact:true}).click();
    await page.waitForFunction(()=>scrollY===0);
    await page.setViewportSize({width:390,height:844}); await page.getByLabel('外观').selectOption('dark');
    await page.screenshot({path:'reference/hero-office-mobile.png'});
    await page.locator('#platform-grid').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'放大抖音二维码'}).click(); assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth)); await page.keyboard.press('Escape');
    await page.goto('http://localhost:3199/admin');await page.getByLabel('管理密钥').fill('test');await page.getByRole('button',{name:'登录后台'}).click();await page.getByRole('button',{name:'课程目录',exact:true}).click();
    assert.equal(await page.getByLabel('详细介绍（弹窗）',{exact:true}).count(),55);
    assert.equal(await page.getByLabel('学习内容（每行一项）',{exact:true}).count(),55);
    assert.deepEqual(errors,[]);
    console.log('PASS: new hero, all 55 course dialogs, no PDF navigation, 4 original QR images, back to top, mobile dark layout, editable details.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
