(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'consultation-dialog';
  dialog.className = 'consultation-dialog';
  dialog.setAttribute('aria-labelledby', 'consultation-title');
  dialog.setAttribute('aria-describedby', 'consultation-intro');
  dialog.innerHTML = `
    <button class="consultation-close" type="button" aria-label="关闭咨询">×</button>
    <div class="consultation-heading">
      <span class="consultation-eyebrow">LET’S CONNECT</span>
      <h2 id="consultation-title">免费咨询</h2>
      <p id="consultation-intro">留下您的联系方式，我们将尽快与您联系，<br>为您介绍课程与合作方案。</p>
    </div>
    <form class="consultation-form">
      <fieldset>
        <label for="consultation-name"><span aria-hidden="true">*</span> 姓名</label>
        <input id="consultation-name" name="name" type="text" autocomplete="name" maxlength="40" placeholder="请输入您的姓名" required autofocus>
        <label for="consultation-phone"><span aria-hidden="true">*</span> 手机号</label>
        <input id="consultation-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="请输入您的手机号码" required>
        <div class="consultation-trap" aria-hidden="true"><label for="consultation-website">网站</label><input id="consultation-website" name="website" type="text" autocomplete="off" tabindex="-1"></div>
        <label class="consultation-consent"><input name="consent" type="checkbox" required><span>我同意课后邦使用姓名和手机号联系我，所填信息仅用于本次咨询沟通。</span></label>
      </fieldset>
      <p class="consultation-status" role="alert" aria-live="polite" hidden></p>
      <button class="consultation-submit" type="submit">提交咨询 <span aria-hidden="true">→</span></button>
      <p class="consultation-privacy">您的联系方式仅供课后邦工作人员查看</p>
    </form>
    <div class="consultation-success" hidden>
      <span class="consultation-success-icon" aria-hidden="true">✓</span>
      <h3 id="consultation-success-title" tabindex="-1">咨询已提交</h3>
      <p>感谢您的信任，我们将尽快与您联系。</p>
      <button class="consultation-submit" type="button">完成</button>
    </div>
    <div class="consultation-footer"><ul><li>专人对接咨询</li><li>根据需求介绍合作方案</li><li>清晰了解课程与服务</li></ul><span class="consultation-brand"><img src="/assets/logo.png" alt=""><small>课后邦</small></span></div>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const fields = form.querySelector('fieldset');
  const nameInput = form.elements.namedItem('name');
  const phoneInput = form.elements.namedItem('phone');
  const submit = form.querySelector('[type="submit"]');
  const status = form.querySelector('.consultation-status');
  const success = dialog.querySelector('.consultation-success');
  let submitting = false;
  let submitted = false;
  const showStatus = message => { status.textContent = message; status.hidden = !message; };
  const close = () => dialog.close();
  dialog.querySelector('.consultation-close').addEventListener('click', close);
  success.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('close', () => document.documentElement.classList.remove('consultation-open'));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-consultation-open]');
    if (!trigger) return;
    event.preventDefault();
    if (dialog.open) return;
    if (submitted) {
      submitted = false; success.hidden = true; form.hidden = false;
      dialog.querySelector('.consultation-heading').hidden = false;
      dialog.setAttribute('aria-labelledby', 'consultation-title');
      dialog.setAttribute('aria-describedby', 'consultation-intro');
    }
    showStatus('');
    dialog.showModal();
    document.documentElement.classList.add('consultation-open');
    if (!submitting) nameInput.focus();
  });
  phoneInput.addEventListener('input', () => phoneInput.setCustomValidity(''));
  nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const name = nameInput.value.trim();
    const phone = phoneInput.value.replace(/[\s()-]/g, '').replace(/^(?:\+86|0086)/, '');
    nameInput.setCustomValidity(name ? '' : '请输入您的姓名');
    phoneInput.setCustomValidity(/^1[3-9]\d{9}$/.test(phone) ? '' : '请输入有效的 11 位手机号码');
    if (!form.reportValidity()) return;
    const payload = { name, phone, consent: form.elements.namedItem('consent').checked, website: form.elements.namedItem('website').value, page: (location.pathname + location.search).slice(0, 200) };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    submitting = true; fields.disabled = true; submit.disabled = true;
    submit.textContent = '正在提交…'; form.setAttribute('aria-busy', 'true'); showStatus('');
    try {
      const response = await fetch('/api/consultations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(payload), signal: controller.signal });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || '暂时无法提交，请稍后重试。');
      form.reset(); form.hidden = true; success.hidden = false;
      dialog.querySelector('.consultation-heading').hidden = true;
      dialog.setAttribute('aria-labelledby', 'consultation-success-title');
      dialog.removeAttribute('aria-describedby');
      submitted = true;
      if (dialog.open) success.querySelector('h3').focus();
    } catch (error) {
      showStatus(error.name === 'AbortError' ? '网络响应较慢，请稍后重试。' : error instanceof SyntaxError || error instanceof TypeError ? '暂时无法提交，请检查网络后重试。' : error.message);
    } finally {
      clearTimeout(timer); submitting = false; fields.disabled = false; submit.disabled = false;
      submit.innerHTML = '提交咨询 <span aria-hidden="true">→</span>'; form.removeAttribute('aria-busy');
    }
  });
})();
