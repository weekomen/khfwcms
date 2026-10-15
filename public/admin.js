const $ = selector => document.querySelector(selector);
const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
let csrfToken = '', data, tab = 'site', dirty = false, saving = false, uploading = false, passwordChangeRequired = false;
const safeConnection = location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
try { sessionStorage.removeItem('khb-token'); } catch { }
const status = (message, error = false) => { $('#status').textContent = message; $('#status').classList.toggle('error', error); };
const changed = () => { dirty = true; status('有未保存的修改'); };
const defaults = () => window.cloneKHBDefaults?.() || { navigation: [], businessPages: [], courseCategories: [], venturePages: [], contactTopics: [] };
function normalizeData() {
  const fallback = defaults();
  for (const key of ['navigation', 'businessPages', 'courseCategories', 'venturePages', 'contactTopics']) if (data[key] === undefined) data[key] = fallback[key] || [];
  data.services ||= []; data.courses ||= []; data.team ||= []; data.news ||= [];
  data.courses.forEach(course => { course.description ??= ''; course.outline ??= ''; course.page ??= 0; });
}
function showLogin(clear = false) {
  csrfToken = ''; $('#login').hidden = false; $('#editor').hidden = true; $('#security').hidden = true; $('#logout').hidden = true; $('#password-form').reset();
  if (clear) { data = null; dirty = false; $('#fields').replaceChildren(); }
}
function showPasswordPanel(open) { $('#password-panel').hidden = !open; $('#security-toggle').setAttribute('aria-expanded', String(open)); $('#security-toggle').textContent = open ? '收起' : '修改密码'; if (!open) $('#password-form').reset(); }
function setPasswordRequirement(required) { passwordChangeRequired = required; $('#security').hidden = false; $('#security-toggle').hidden = required; $('#security-note').textContent = required ? '首次登录：请先更换初始密码，再开始管理内容。' : '请使用独立长密码，不要与他人共用。'; showPasswordPanel(required); if (required) $('#editor').hidden = true; }
async function apiRequest(url, method = 'GET', body, contentType = 'application/json') {
  const headers = {}; if (body !== undefined) headers['Content-Type'] = contentType; if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', headers, body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body });
  const result = await response.json();
  if (!response.ok) { const sessionLost = response.status === 401 && url !== '/api/admin/login' || result.code === 'CSRF_INVALID'; if (sessionLost) showLogin(); if (result.code === 'PASSWORD_CHANGE_REQUIRED') setPasswordRequirement(true); const error = Error(result.error || '操作失败，请重试'); error.status = response.status; if (sessionLost && dirty) error.message = '登录已过期或状态已更新，请重新登录；当前未保存的编辑仍保留在此页面。'; if (sessionLost && url !== '/api/admin/session') status(error.message, true); throw error; }
  return result;
}
const request = (method = 'GET', body) => apiRequest('/api/admin/content', method, body);
async function enterSession(session) {
  csrfToken = session.csrfToken; $('#login').hidden = true; $('#logout').hidden = false; setPasswordRequirement(session.passwordChangeRequired);
  if (passwordChangeRequired) { status('请设置新的管理密码。'); $('#current-password').focus(); return; }
  try { if (!dirty || !data) data = await request(); } catch (error) { showLogin(); throw error; }
  normalizeData(); $('#editor').hidden = false; status(dirty ? '已重新登录，未保存的修改已保留，请检查后保存。' : ''); render();
}
$('#login-form').onsubmit = async event => { event.preventDefault(); if (!safeConnection) return status('请通过 HTTPS 安全地址登录后台。', true); $('#login-submit').disabled = true; status('正在验证…'); try { const session = await apiRequest('/api/admin/login', 'POST', { password: $('#password').value }); $('#password').value = ''; await enterSession(session); } catch (error) { status(error.message, true); } finally { $('#login-submit').disabled = false; } };
$('#logout').onclick = async () => { if (dirty && !confirm('尚有未保存的修改，确定退出？')) return; $('#logout').disabled = true; try { await apiRequest('/api/admin/logout', 'POST', {}); showLogin(true); status('已安全退出。'); } catch (error) { if (error.status === 401) showLogin(true); status(error.message, true); } finally { $('#logout').disabled = false; } };
$('#security-toggle').onclick = () => showPasswordPanel($('#password-panel').hidden);
$('#password-form').onsubmit = async event => { event.preventDefault(); if (!safeConnection) return status('请通过 HTTPS 安全地址修改密码。', true); if (saving || uploading) return status('请等待当前保存或上传完成。', true); const newPassword = $('#new-password').value; if ([...newPassword].length < 15 || [...newPassword].length > 128) return status('新密码需要 15–128 个字符。', true); if (newPassword !== $('#confirm-password').value) return status('两次输入的新密码不一致。', true); if (dirty && !confirm('修改密码会退出登录，当前未保存的修改将丢失，是否继续？')) return; $('#password-submit').disabled = true; $('#editor').inert = true; try { await apiRequest('/api/admin/password', 'PUT', { currentPassword: $('#current-password').value, newPassword }); showLogin(true); status('密码修改成功，请使用新密码重新登录。'); $('#password').focus(); } catch (error) { status(error.message, true); } finally { $('#password-submit').disabled = false; $('#editor').inert = false; } };
$('#connection-note').textContent = location.protocol === 'https:' ? '当前通过 HTTPS 安全连接。' : ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? '当前为本机管理。公网访问需要 HTTPS 安全连接。' : '请通过 HTTPS 安全地址登录后台。';
window.addEventListener('beforeunload', event => { if (dirty || uploading) { event.preventDefault(); event.returnValue = ''; } });
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; render(); });

function field(parent, object, key, label, type = 'text', wide = false, options = []) {
  const box = el('div', 'form-field' + (wide ? ' wide' : '')); const id = 'f-' + crypto.randomUUID(); const labelNode = el('label', '', label); labelNode.htmlFor = id;
  const input = type === 'textarea' ? el('textarea') : type === 'select' ? el('select') : el('input'); input.id = id;
  if (type === 'select') options.forEach(option => { const item = el('option', '', option[1]); item.value = option[0]; input.append(item); }); else if (type !== 'textarea') input.type = type;
  if (key === 'features') input.value = Array.isArray(object[key]) ? object[key].join('\n') : ''; else input.value = object[key] ?? '';
  if (type === 'checkbox') { input.checked = Boolean(object[key]); box.classList.add('published-field'); }
  input.addEventListener('input', () => { object[key] = type === 'checkbox' ? input.checked : type === 'number' ? Number(input.value) : key === 'features' ? input.value.split('\n').map(line => line.trim()).filter(Boolean) : input.value; changed(); });
  box.append(labelNode, input); parent.append(box); return input;
}
function imagePicker(item, key = 'image') {
  const box = el('div', 'photo-picker'); const button = el('button', 'photo-button'); button.type = 'button'; const title = item.name || item.title || '页面'; button.setAttribute('aria-label', `上传${title}图片`);
  const image = el('img'); image.src = item[key] || '/assets/logo.webp'; image.alt = title; const caption = el('span', '', item[key] ? '点击更换图片' : '点击上传图片'); button.append(image, caption);
  const input = el('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.hidden = true; const message = el('p', 'photo-help', '支持 JPG、PNG、WebP，单张不超过 5 MB'); message.setAttribute('role', 'status'); button.onclick = () => input.click();
  input.onchange = async () => { const file = input.files[0]; input.value = ''; if (!file || uploading || saving) return; const fail = text => { message.textContent = text; message.classList.add('upload-error'); }; if (file.size > 5 * 1024 * 1024) return fail('图片超过 5 MB，请选择较小的图片。'); if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return fail('格式不支持，请选择 JPG、PNG 或 WebP 图片。'); uploading = true; $('#save').disabled = true; $('#fields').inert = true; document.querySelectorAll('[data-tab], #logout').forEach(buttonNode => buttonNode.disabled = true); message.classList.remove('upload-error'); message.textContent = '正在上传…'; try { let bitmap; try { bitmap = await createImageBitmap(file); } catch { throw Error('图片无法读取，请选择有效的图片文件。'); } finally { bitmap?.close(); } const result = await apiRequest('/api/admin/images', 'POST', file, file.type); item[key] = result.url; image.src = result.url; caption.textContent = '点击更换图片'; changed(); message.textContent = '上传成功，保存后展示到官网。'; } catch (error) { fail(error.message || '上传失败，请重试'); } finally { uploading = false; $('#save').disabled = false; $('#fields').inert = false; document.querySelectorAll('[data-tab], #logout').forEach(buttonNode => buttonNode.disabled = false); } };
  box.append(button, input, message); return box;
}
function cardHeading(item, index, collection, card) {
  const heading = el('div', 'card-heading'); const remove = el('button', 'remove', '删除'); remove.onclick = () => { if (confirm(`确定删除“${item.name || item.title || '新内容'}”？保存后生效。`)) { data[collection].splice(index, 1); changed(); render(); } }; heading.append(el('h2', '', `${String(index + 1).padStart(2, '0')} / ${item.name || item.title || '新内容'}`), remove); card.append(heading);
}
const collectionInfo = {
  services: { note: '维护首页“集团核心业务”下方的服务卡片。', add: '服务', defaults: { title: '新服务', subtitle: '', description: '', category: '课程服务', features: [] } },
  businessPages: { note: '维护集团核心业务的五个独立页面。首页不展示这些页面卡片，导航下拉菜单打开新标签页。', add: '业务页面', defaults: { id: 'new-business', title: '新业务页面', summary: '', body: '', image: '/assets/logo.webp' } },
  courseCategories: { note: '维护课程资源库的分类说明和长图。每个分类下的课程在“课程目录”中维护。', add: '课程分类', defaults: { id: 'new-category', title: '新课程分类', description: '', image: '/assets/course-aesthetic.webp' } },
  courses: { note: '维护课程卡片和详情弹窗。手机端每类先展示 3 门，电脑端先展示 6 门。', add: '课程', defaults: { title: '新课程', category: '美育类', summary: '', description: '', outline: '', page: 0 } },
  team: { note: '维护核心团队资料。点击照片即可选择本机图片上传。', add: '成员', defaults: { name: '新成员', role: '', category: '管理团队', bio: '', image: '/assets/logo.webp' } },
  venturePages: { note: '维护智邻创投下的简介和书院世家年夜饭页面。', add: '创投页面', defaults: { id: 'new-venture', title: '新创投页面', summary: '', body: '', image: '/assets/logo.webp' } },
  contactTopics: { note: '维护联系我们下的商务合作、师资合作、人才招聘和联系方式说明。', add: '联系主题', defaults: { id: 'new-topic', title: '新联系主题', description: '' } }
};
function renderNavigationEditor(target) {
  target.append(el('p', 'admin-note', '编辑七个一级导航的名称、地址和下拉项目。保存后官网页眉会立即使用这里的内容。')); (data.navigation || []).forEach((item, index) => {
    const card = el('article', 'edit-card'); cardHeading(item, index, 'navigation', card); const grid = el('div', 'form-grid'); field(grid, item, 'label', '一级菜单名称'); field(grid, item, 'href', '一级菜单地址'); card.append(grid);
    const children = el('div', 'submenu-editor'); children.append(el('h3', '', '下拉二级菜单'));
    (item.children || []).forEach((child, childIndex) => { const row = el('div', 'submenu-row'); field(row, child, 'label', '名称'); field(row, child, 'href', '地址'); field(row, child, 'target', '打开方式', 'select', false, [['', '当前窗口'], ['blank', '新标签页']]); field(row, child, 'action', '行为', 'select', false, [['', '普通链接'], ['course-category', '课程分类'], ['news-group', '资讯分组'], ['contact-topic', '联系主题'], ['business', '业务页面'], ['venture', '创投页面']]); field(row, child, 'value', '行为值'); const remove = el('button', 'remove', '删除此项'); remove.type = 'button'; remove.onclick = () => { item.children.splice(childIndex, 1); changed(); render(); }; row.append(remove); children.append(row); });
    const add = el('button', 'add', '+ 新增二级菜单'); add.type = 'button'; add.onclick = () => { item.children ||= []; item.children.push({ id: `item-${crypto.randomUUID().slice(0, 8)}`, label: '新菜单项', href: '#', target: '', action: '', value: '' }); changed(); render(); }; children.append(add); card.append(children); target.append(card);
  });
  const addRoot = el('button', 'add', '+ 新增一级菜单'); addRoot.type = 'button'; addRoot.onclick = () => { data.navigation.push({ id: `menu-${crypto.randomUUID().slice(0, 8)}`, label: '新一级菜单', href: '#home', children: [] }); changed(); render(); }; target.append(addRoot);
}
function renderCollection(target, collection) {
  const info = collectionInfo[collection]; target.append(el('p', 'admin-note', info.note));
  data[collection].forEach((item, index) => { const card = el('article', 'edit-card'); cardHeading(item, index, collection, card); if (['businessPages', 'courseCategories', 'venturePages'].includes(collection)) card.append(imagePicker(item)); if (collection === 'team') card.append(imagePicker(item)); const grid = el('div', 'form-grid'); let fields = [];
    if (collection === 'services') fields = [['title', '服务名称'], ['category', '服务分类'], ['subtitle', '副标题', 'text', true], ['description', '详细介绍', 'textarea', true], ['features', '服务要点（每行一个）', 'textarea', true]];
    if (collection === 'businessPages') fields = [['id', '页面编号'], ['title', '页面标题'], ['summary', '页面摘要', 'textarea', true], ['body', '页面正文', 'textarea', true]];
    if (collection === 'courseCategories') fields = [['id', '分类编号'], ['title', '分类名称'], ['description', '分类说明', 'textarea', true]];
    if (collection === 'courses') fields = [['title', '课程名称'], ['category', '课程分类'], ['summary', '卡片摘要', 'textarea', true], ['description', '详细介绍（弹窗）', 'textarea', true], ['outline', '学习内容（每行一项）', 'textarea', true], ['page', '课程手册页码', 'number']];
    if (collection === 'team') fields = [['name', '成员姓名'], ['role', '岗位职称'], ['category', '团队分类'], ['bio', '个人介绍', 'textarea', true]];
    if (collection === 'venturePages') fields = [['id', '页面编号'], ['title', '页面标题'], ['summary', '页面摘要', 'textarea', true], ['body', '页面正文', 'textarea', true]];
    if (collection === 'contactTopics') fields = [['id', '主题编号'], ['title', '主题名称'], ['description', '主题说明', 'textarea', true]];
    fields.forEach(([key, label, type, wide]) => field(grid, item, key, label, type || 'text', wide)); card.append(grid); target.append(card); });
  const add = el('button', 'add', `+ 新增${info.add}`); add.type = 'button'; add.onclick = () => { data[collection].push(structuredClone(info.defaults)); changed(); render(); target.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }; target.append(add);
}
function renderNews(target) {
  target.append(el('p', 'admin-note', '集团动态和行业洞察都可以编辑。集团动态不需要填写公众号链接；行业洞察可填写 HTTPS 原文链接。')); data.news.forEach((item, index) => {
    item.group ||= /行业|政策|AI|人工智能/.test(`${item.category || ''}${item.title || ''}`) ? 'industry' : 'group'; const card = el('article', 'edit-card'); cardHeading(item, index, 'news', card); const grid = el('div', 'form-grid'); field(grid, item, 'title', '文章标题'); field(grid, item, 'category', '文章分类'); field(grid, item, 'date', '发布日期', 'date'); field(grid, item, 'group', '资讯分组', 'select', false, [['group', '集团动态'], ['industry', '行业洞察']]); if (item.group === 'industry') field(grid, item, 'source', '公众号或原文链接', 'url'); else item.source = ''; field(grid, item, 'summary', '摘要', 'textarea', true); field(grid, item, 'body', '文章正文', 'textarea', true); field(grid, item, 'published', '在官网公开发布', 'checkbox'); card.append(grid); target.append(card);
  });
  const add = el('button', 'add', '+ 新增文章'); add.type = 'button'; add.onclick = () => { data.news.push({ id: crypto.randomUUID(), title: '新文章', category: '集团动态', group: 'group', date: new Date().toISOString().slice(0, 10), summary: '', body: '', source: '', published: false }); changed(); render(); }; target.append(add);
}
function render() {
  normalizeData(); document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('selected', button.dataset.tab === tab)); const target = $('#fields'); target.replaceChildren();
  if (tab === 'site') { target.append(el('p', 'admin-note', '编辑首页文案、关于课后邦介绍和联系方式。')); const card = el('div', 'edit-card'); const grid = el('div', 'form-grid'); [['name', '品牌名称'], ['tagline', '品牌说明'], ['headline', '首页标题（换行显示）', 'textarea'], ['intro', '首页简介', 'textarea'], ['about', '课后邦集团介绍', 'textarea', true], ['phone', '合作电话'], ['email', '合作邮箱', 'email'], ['address', '公司地址'], ['filing', '备案信息']].forEach(([key, label, type, wide]) => field(grid, data.site, key, label, type || 'text', wide)); card.append(grid); target.append(card); return; }
  if (tab === 'navigation') return renderNavigationEditor(target);
  if (tab === 'news') return renderNews(target);
  renderCollection(target, tab);
}
$('#save').onclick = async () => { if (saving || uploading) return; saving = true; $('#save').disabled = true; $('#fields').inert = true; status('正在保存…'); try { await request('PUT', data); dirty = false; status('保存成功，官网内容已更新。'); } catch (error) { status('保存失败：' + error.message, true); } finally { saving = false; $('#save').disabled = false; $('#fields').inert = false; } };
$('#login-submit').disabled = true;
if (safeConnection) apiRequest('/api/admin/session').then(enterSession).catch(error => { if (error.status !== 401) status(error.message, true); }).finally(() => { $('#login-submit').disabled = false; });
