const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let csrfToken = '', data, tab = 'site', dirty = false, saving = false, uploading = false, passwordChangeRequired = false;
const defaultServicePages = () => [
  { id: 'supply-chain', title: '课后邦供应链', summary: '连接课程、教具、耗材与交付服务，让好课程稳定抵达校园。', body: '## 连接课程与服务资源\n围绕学校课后服务需求，整合课程、教具、耗材、师资与运营资源，为合作伙伴提供从选品到交付的协同支持。', highlights: ['课程与教具资源整合', '标准化选品与交付', '区域合作与供应支持'] },
  { id: 'online-education', title: '线上素质教育', summary: '用数字化平台连接优质课程，让学习随时发生。', body: '## 让优质内容触达更多家庭\n结合直播、录播与互动工具，为家庭提供灵活的素质教育学习方式。', highlights: ['多元素质教育课程', '直播与录播结合', '学习反馈与家校沟通'] },
  { id: 'education-street', title: '教育一条街', summary: '汇聚多元教育场景与资源，打造开放的教育服务空间。', body: '## 连接家庭、学校与教育伙伴\n聚合课程体验、教育咨询、活动实践和社区服务，让教育资源在真实场景中被看见、被体验。', highlights: ['课程体验与主题活动', '家庭与学校服务', '教育资源开放合作'] },
  { id: 'growth-center', title: '青少年成长中心', summary: '围绕青少年成长需要，提供课程、活动与持续陪伴。', body: '## 陪伴每一个成长阶段\n提供课程学习、实践活动和成长记录相结合的服务，支持兴趣发展和综合素养提升。', highlights: ['兴趣课程与实践活动', '成长记录与成果展示', '团队协作与综合素养'] },
  { id: 'ai-museum', title: '人工智能科技馆', summary: '以机器人、人工智能和科技实践激发孩子的好奇心与创造力。', body: '## 在真实体验中认识人工智能\n通过展览、实验、机器人和编程项目，把抽象的科技知识变成可操作、可分享的学习体验。', highlights: ['人工智能与科技展陈', '机器人与编程实践', '项目式创作与成果分享'] }
];
const safeConnection = location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
// Remove credentials left by older versions; authentication uses an HttpOnly cookie.
try { sessionStorage.removeItem('khb-token'); } catch { }
const status = (message, error = false) => { $('#status').textContent = message; $('#status').classList.toggle('error', error); };
const changed = () => { dirty = true; status('有未保存的修改'); };
function showLogin(clear = false) {
  csrfToken = ''; $('#login').hidden = false; $('#editor').hidden = true; $('#security').hidden = true; $('#logout').hidden = true;
  $('#password-form').reset();
  if (clear) { data = null; dirty = false; $('#fields').replaceChildren(); }
}
function showPasswordPanel(open) {
  $('#password-panel').hidden = !open;
  $('#security-toggle').setAttribute('aria-expanded', String(open));
  $('#security-toggle').textContent = open ? '收起' : '修改密码';
  if (!open) $('#password-form').reset();
}
function setPasswordRequirement(required) {
  passwordChangeRequired = required;
  $('#security').hidden = false; $('#security-toggle').hidden = required;
  $('#security-note').textContent = required ? '首次登录：请先更换初始密码，再开始管理内容。' : '请使用独立长密码，不要与他人共用。';
  showPasswordPanel(required);
  if (required) $('#editor').hidden = true;
}
async function apiRequest(url, method = 'GET', body, contentType = 'application/json') {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = contentType;
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', headers,
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body });
  const result = await response.json();
  if (!response.ok) {
    const sessionLost = (response.status === 401 && url !== '/api/admin/login') || result.code === 'CSRF_INVALID';
    if (sessionLost) showLogin();
    if (result.code === 'PASSWORD_CHANGE_REQUIRED') setPasswordRequirement(true);
    const error = Error(result.error || '操作失败，请重试'); error.status = response.status;
    if (sessionLost && dirty) error.message = '登录已过期或状态已更新，请重新登录；当前未保存的编辑仍保留在此页面。';
    if (sessionLost && url !== '/api/admin/session') status(error.message, true);
    throw error;
  }
  return result;
}
const request = (method = 'GET', body) => apiRequest('/api/admin/content', method, body);
async function enterSession(session) {
  csrfToken = session.csrfToken;
  $('#login').hidden = true; $('#logout').hidden = false;
  setPasswordRequirement(session.passwordChangeRequired);
  if (passwordChangeRequired) { status('请设置新的管理密码。'); $('#current-password').focus(); return; }
  try { if (!dirty || !data) data = await request(); }
  catch (error) { showLogin(); throw error; }
  $('#editor').hidden = false;
  status(dirty ? '已重新登录，未保存的修改已保留，请检查后保存。' : ''); render();
}
$('#login-form').onsubmit = async e => {
  e.preventDefault();
  if (!safeConnection) return status('请通过 HTTPS 安全地址登录后台。', true);
  $('#login-submit').disabled = true; status('正在验证…');
  try { const session = await apiRequest('/api/admin/login', 'POST', { password: $('#password').value }); $('#password').value = ''; await enterSession(session); }
  catch (e) { status(e.message, true); }
  finally { $('#login-submit').disabled = false; }
};
$('#logout').onclick = async () => {
  if (dirty && !confirm('尚有未保存的修改，确定退出？')) return;
  $('#logout').disabled = true;
  try { await apiRequest('/api/admin/logout', 'POST', {}); showLogin(true); status('已安全退出。'); }
  catch (e) { if (e.status === 401) showLogin(true); status(e.message, true); }
  finally { $('#logout').disabled = false; }
};
$('#security-toggle').onclick = () => showPasswordPanel($('#password-panel').hidden);
$('#password-form').onsubmit = async e => {
  e.preventDefault();
  if (!safeConnection) return status('请通过 HTTPS 安全地址修改密码。', true);
  if (saving || uploading) return status('请等待当前保存或上传完成。', true);
  const newPassword = $('#new-password').value;
  if ([...newPassword].length < 15 || [...newPassword].length > 128) return status('新密码需要 15–128 个字符。', true);
  if (newPassword !== $('#confirm-password').value) return status('两次输入的新密码不一致。', true);
  if (dirty && !confirm('修改密码会退出登录，当前未保存的修改将丢失，是否继续？')) return;
  $('#password-submit').disabled = true; $('#editor').inert = true;
  try {
    await apiRequest('/api/admin/password', 'PUT', { currentPassword: $('#current-password').value, newPassword });
    showLogin(true); status('密码修改成功，请使用新密码重新登录。'); $('#password').focus();
  } catch (e) { status(e.message, true); }
  finally { $('#password-submit').disabled = false; $('#editor').inert = false; }
};
$('#connection-note').textContent = location.protocol === 'https:' ? '当前通过 HTTPS 安全连接。' : ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? '当前为本机管理。公网访问需要 HTTPS 安全连接。' : '请通过 HTTPS 安全地址登录后台。';
window.addEventListener('beforeunload', e => { if (dirty || uploading) { e.preventDefault(); e.returnValue = ''; } });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
function field(parent, obj, key, label, type = 'text', wide = false) {
  const box = el('div', 'form-field' + (wide ? ' wide' : '')); const id = 'f-' + crypto.randomUUID(); const l = el('label', '', label); l.htmlFor = id;
  const input = el(type === 'textarea' ? 'textarea' : 'input'); input.id = id; if (type !== 'textarea') input.type = type;
  if (key === 'features' || key === 'highlights') input.value = Array.isArray(obj[key]) ? obj[key].join('\n') : ''; else input.value = obj[key] ?? '';
  if (type === 'checkbox') { input.checked = obj[key]; box.classList.add('published-field'); }
  input.addEventListener('input', () => { obj[key] = type === 'checkbox' ? input.checked : type === 'number' ? Number(input.value) : (key === 'features' || key === 'highlights') ? input.value.split('\n').filter(Boolean) : input.value; changed(); });
  box.append(l, input); parent.append(box);
}
function photoPicker(item) {
  const box = el('div', 'photo-picker'); const button = el('button', 'photo-button'); button.type = 'button';
  button.setAttribute('aria-label', `上传${item.name}的照片`);
  const img = el('img'); img.src = item.image; img.alt = item.name;
  const caption = el('span', '', item.image === '/assets/logo.webp' ? '点击上传照片' : '点击更换照片'); button.append(img, caption);
  const input = el('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true;
  const message = el('p', 'photo-help', '支持 JPG、PNG、WebP，单张不超过 5 MB'); message.setAttribute('role', 'status');
  button.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files[0]; input.value = ''; if (!file || uploading || saving) return;
    const fail = text => { message.textContent = text; message.classList.add('upload-error'); };
    if (file.size > 5 * 1024 * 1024) return fail('图片超过 5 MB，请选择较小的图片。');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return fail('格式不支持，请选择 JPG、PNG 或 WebP 图片。');
    uploading = true; $('#save').disabled = true; $('#fields').inert = true;
    document.querySelectorAll('[data-tab], #logout').forEach(b => b.disabled = true);
    message.classList.remove('upload-error'); message.textContent = '正在上传…';
    try {
      let bitmap; try { bitmap = await createImageBitmap(file); } catch { throw Error('图片无法读取，请选择有效的图片文件。'); } finally { bitmap?.close(); }
      const result = await apiRequest('/api/admin/images', 'POST', file, file.type);
      item.image = result.url; img.src = result.url; caption.textContent = '点击更换照片'; changed(); message.textContent = '上传成功，保存后展示到官网。';
    } catch (e) { fail(e.message || '上传失败，请重试'); }
    finally { uploading = false; $('#save').disabled = false; $('#fields').inert = false; document.querySelectorAll('[data-tab], #logout').forEach(b => b.disabled = false); }
  };
  box.append(button, input, message); return box;
}
function servicePageImagePicker(item) {
  const box = el('div', 'service-page-image-picker'); const preview = el('img', 'service-page-thumb'); preview.alt = item.title || '业务入口图片'; if (item.coverImage) preview.src = item.coverImage; else preview.hidden = true;
  const button = el('button', 'add', item.coverImage ? '更换入口图片' : '添加入口图片'); button.type = 'button'; const input = el('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true; button.onclick = () => input.click(); input.onchange = async () => { const file = input.files[0]; input.value = ''; if (!file || uploading || saving) return; if (file.size > 5 * 1024 * 1024) return status('图片超过 5 MB，请选择较小的图片。', true); if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return status('格式不支持，请选择 JPG、PNG 或 WebP 图片。', true); uploading = true; button.disabled = true; try { const result = await apiRequest('/api/admin/images', 'POST', file, file.type); item.coverImage = result.url; preview.src = result.url; preview.hidden = false; button.textContent = '更换入口图片'; changed(); } catch (error) { status(error.message, true); } finally { uploading = false; button.disabled = false; } }; box.append(preview, button, input); return box;
}
function newsTypeField(parent, item) {
  const box = el('div', 'form-field'); const id = 'f-' + crypto.randomUUID(); const label = el('label', '', '文章类型'); label.htmlFor = id; const select = el('select'); select.id = id;
  [['wechat','公众号'],['company','企业动态']].forEach(([value, text]) => { const option = el('option', '', text); option.value = value; option.selected = (item.type || (item.source ? 'wechat' : 'company')) === value; select.append(option); });
  select.onchange = () => { item.type = select.value; if (item.type === 'company') item.source = ''; changed(); render(); }; box.append(label, select); parent.append(box);
}
function newsImageEditor(card, item) {
  item.blocks ||= [{ type: 'text', value: item.body || '' }];
  const textBlock = item.blocks.find(block => block.type === 'text') || { type: 'text', value: item.body || '' };
  if (!item.blocks.includes(textBlock)) item.blocks.unshift(textBlock);
  const box = el('div', 'news-block-editor'); box.append(el('h3', '', '文章正文与图片'));
  const text = el('textarea'); text.rows = 10; text.value = textBlock.value || item.body || ''; text.placeholder = '直接输入正文。使用空行自然分段，不需要逐段新增，也不使用首行缩进。';
  text.oninput = () => { textBlock.value = text.value; item.body = text.value; changed(); };
  const tools = el('div', 'news-editor-tools'); const style = el('select'); style.setAttribute('aria-label', '选中文字设置标题级别'); [['', '正文'], ['## ', '二级标题'], ['### ', '三级标题'], ['#### ', '四级标题']].forEach(([value, label]) => { const option = el('option', '', label); option.value = value; style.append(option); }); style.onchange = () => { const prefix = style.value; const start = text.selectionStart, end = text.selectionEnd; if (start === end) return; const selected = text.value.slice(start, end); const formatted = selected.split('\n').map(line => { const clean = line.replace(/^#{2,4}\s+/, ''); return prefix ? prefix + clean : clean; }).join('\n'); text.value = text.value.slice(0, start) + formatted + text.value.slice(end); textBlock.value = text.value; item.body = text.value; text.focus(); text.selectionStart = start; text.selectionEnd = start + formatted.length; style.value = ''; changed(); }; tools.append(el('span', 'news-editor-hint', '选中文字后设置：'), style);
  box.append(el('label', 'news-editor-label', '正文（空行自动分段；选择文字后可设置标题级别）'), tools, text);
  const list = el('div', 'news-block-list');
  const redraw = () => { list.replaceChildren(); item.blocks.filter(block => block.type === 'image').forEach((block, index) => { const row = el('div', 'news-block'); const img = el('img'); img.src = block.value; img.alt = block.caption || '文章图片'; img.style.width = '140px'; row.append(el('span', 'news-block-kind', `图片 ${index + 1}`), img); const size = el('input'); size.type = 'range'; size.min = 20; size.max = 100; size.value = block.width || 100; size.setAttribute('aria-label', '图片宽度'); size.oninput = () => { block.width = Number(size.value); img.style.width = `${block.width}%`; changed(); }; const remove = el('button', 'remove', '删除'); remove.type = 'button'; remove.onclick = () => { const at = item.blocks.indexOf(block); if (at >= 0) item.blocks.splice(at, 1); changed(); redraw(); }; row.append(el('span', 'image-size-label', `${size.value}%`), size, remove); size.oninput = () => { block.width = Number(size.value); img.style.width = `${block.width}%`; row.querySelector('.image-size-label').textContent = `${size.value}%`; changed(); }; list.append(row); }); };
  const addImage = el('button', 'add', '+ 添加图片'); addImage.type = 'button'; const input = el('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true; addImage.onclick = () => input.click(); input.onchange = async () => { const file = input.files[0]; input.value = ''; if (!file || uploading || saving) return; if (file.size > 5 * 1024 * 1024) return status('图片超过 5 MB，请选择较小的图片。', true); if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return status('格式不支持，请选择 JPG、PNG 或 WebP 图片。', true); uploading = true; addImage.disabled = true; try { const result = await apiRequest('/api/admin/images','POST',file,file.type); item.blocks.push({ type: 'image', value: result.url, width: 100, caption: '' }); changed(); redraw(); } catch (e) { status(e.message, true); } finally { uploading = false; addImage.disabled = false; } };
  box.append(list, addImage, input); card.append(box); redraw();
}
function render() {
  data.courses ||= []; data.servicePages ||= [];
  if (!data.servicePages.length) data.servicePages = defaultServicePages();
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('selected', b.dataset.tab === tab));
  const target = $('#fields'); target.replaceChildren();
  if (tab === 'site') {
    target.append(el('p', 'admin-note', '编辑首页文案与联系信息。未填写的电话、邮箱、地址和备案信息不会显示在官网。'));
    const card = el('div', 'edit-card'); const grid = el('div', 'form-grid');
    [['name', '品牌名称'], ['tagline', '品牌说明'], ['headline', '首页标题（换行显示）', 'textarea'], ['intro', '首页简介', 'textarea'], ['about', '公司介绍', 'textarea', true], ['phone', '合作电话'], ['email', '合作邮箱', 'email'], ['address', '公司地址'], ['filing', '备案信息']].forEach(([k, l, t, w]) => field(grid, data.site, k, l, t, w)); card.append(grid); target.append(card); return;
  }
  target.append(el('p', 'admin-note', tab === 'news' ? '将文章分为公众号和企业动态。企业动态会在新标签页打开详情，可添加段落和图片；公众号可填写原文链接。未勾选发布的文章仅保存在后台。' : tab === 'servicePages' ? '编辑五个业务入口的整页介绍。正文支持 Markdown 标题、列表和自然分段，保存后点击菜单会在新窗口打开对应介绍页。' : tab === 'team' ? '点击成员照片即可选择本机图片上传，完成编辑后点击“保存并更新官网”。' : '维护业务介绍与服务内容，每行填写一个服务要点。'));
  if (tab === 'courses') { target.replaceChildren(); target.append(el('p', 'course-page-note', '维护课程卡片和详情弹窗。详细介绍支持换行，学习内容每行填写一项。')); }
  data[tab].forEach((item, index) => {
    const card = el('article', 'edit-card'); const heading = el('div', 'card-heading'); const remove = el('button', 'remove', '删除'); remove.onclick = () => { if (confirm(`确定删除“${item.name || item.title || '新内容'}”？保存后生效。`)) { data[tab].splice(index, 1); changed(); render(); } };
    heading.append(el('h2', '', `${String(index + 1).padStart(2, '0')} / ${item.name || item.title || '新内容'}`), remove); card.append(heading);
    if (tab === 'team') card.append(photoPicker(item));
    const grid = el('div', 'form-grid'); let fields;
    if (tab === 'services') fields = [['title', '服务名称'], ['category', '服务分类'], ['subtitle', '副标题', 'text', true], ['description', '详细介绍', 'textarea', true], ['features', '服务要点（每行一个）', 'textarea', true]];
    if (tab === 'servicePages') fields = [['id', '入口编号'], ['title', '入口名称'], ['summary', '入口摘要', 'textarea', true], ['body', '正文（支持 Markdown）', 'textarea', true], ['highlights', '服务内容（每行一项）', 'textarea', true]];
    if (tab === 'courses') { item.description ??= ''; item.outline ??= ''; fields = [['title', '课程名称'], ['category', '课程分类'], ['summary', '卡片摘要', 'textarea', true], ['description', '详细介绍（弹窗）', 'textarea', true], ['outline', '学习内容（每行一项）', 'textarea', true]]; }
    if (tab === 'team') fields = [['name', '成员姓名'], ['role', '岗位职称'], ['category', '团队分类'], ['bio', '个人介绍', 'textarea', true]];
    if (tab === 'servicePages') { card.append(servicePageImagePicker(item)); fields = [['title', '入口标题'], ['summary', '入口简介', 'textarea', true], ['body', '整页正文（Markdown）', 'textarea', true], ['highlights', '服务要点（每行一个）', 'textarea', true]]; }
    if (tab === 'news') fields = [['title', '文章标题'], ['category', '文章分类'], ['date', '发布日期', 'date'], ...(item.type === 'wechat' || (!item.type && item.source) ? [['source', '公众号原文链接', 'url']] : []), ['summary', '摘要', 'textarea', true], ['published', '在官网公开发布', 'checkbox']];
    if (tab === 'news') newsTypeField(grid, item);
    fields.forEach(([k, l, t, w]) => field(grid, item, k, l, t, w)); card.append(grid);
    if (tab === 'news') newsImageEditor(card, item);
    target.append(card);
  });
  const add = el('button', 'add', '+ 新增' + ({ services: '服务', team: '成员', news: '文章', courses: '课程', servicePages: '业务入口' })[tab]); add.onclick = () => {
    const defaults = { services: { title: '新服务', subtitle: '', description: '', category: '课程服务', features: [] }, servicePages: { id: 'new-service-' + Date.now(), title: '新业务入口', summary: '', body: '', highlights: [] }, team: { name: '新成员', role: '', category: '管理团队', bio: '', image: '/assets/logo.webp' }, news: { id: crypto.randomUUID(), title: '新文章', category: '公司动态', type: 'company', date: new Date().toISOString().slice(0, 10), summary: '', body: '', source: '', blocks: [{ type: 'text', value: '' }], published: false } };
    defaults.courses = { title: '新课程', category: '美育类', summary: '', description: '', outline: '', page: 0 };
    defaults.servicePages = { id: crypto.randomUUID().replaceAll('-', ''), title: '新业务入口', summary: '', body: '## 新业务入口\n\n请填写 Markdown 正文。', highlights: [] };
    data[tab].push(defaults[tab]); changed(); render(); $('#fields').lastElementChild.previousElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }; target.append(add);
}
$('#save').onclick = async () => {
  if (saving || uploading) return; saving = true; $('#save').disabled = true; $('#fields').inert = true; status('正在保存…');
  try { await request('PUT', data); dirty = false; status('保存成功，官网内容已更新。'); } catch (e) { status('保存失败：' + e.message, true); }
  finally { saving = false; $('#save').disabled = false; $('#fields').inert = false; }
};
$('#login-submit').disabled = true;
if (safeConnection) apiRequest('/api/admin/session').then(enterSession).catch(e => { if (e.status !== 401) status(e.message, true); }).finally(() => { $('#login-submit').disabled = false; });
