const {chromium} = require(process.env.PLAYWRIGHT_PATH);
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true, proxy:{server:'socks5://127.0.0.1:7897'}});
  const result = {website:false, mobile:false, legacyBookmark:false, manuals:[]};
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    await page.goto('https://kehoubang.cn/', {waitUntil:'networkidle',timeout:60000});
    await page.waitForSelector('.course-card');
    await page.getByRole('link',{name:'平台登录 ↗',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'平台登录 ↗',exact:true}).getAttribute('href'), 'https://khb.kehoubang.cn/');
    assert.deepEqual(errors, []);
    await page.screenshot({path:'verification/20260930/public-desktop.png'});
    result.website=true;
    await page.setViewportSize({width:390,height:844});
    await page.locator('#platform-grid').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'verification/20260930/public-mobile.png'});
    result.mobile=true;
    await page.goto('about:blank');
    await page.goto('https://kehoubang.cn/#/login', {waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForURL('https://khb.kehoubang.cn/**', {timeout:30000,waitUntil:'domcontentloaded'});
    result.legacyBookmark=true;
    for (const [id,total] of [[1,39],[2,20]]) {
      await page.goto(`https://kehoubang.cn/profile/upload/pdf/${id}/index.html`, {waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(n=>document.images.length===n && [...document.images].every(i=>i.complete && i.naturalWidth>0), total, {timeout:240000});
      await page.locator('.page').last().scrollIntoViewIfNeeded();
      assert.equal(await page.locator('.page-num').last().textContent(),`${total} / ${total}`);
      await page.screenshot({path:`verification/20260930/manual-${id}-last-page.png`});
      result.manuals.push({id,decodedPages:total,scrollToLastPage:true});
    }
    fs.writeFileSync('verification/20260930/browser-public.json',JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
