const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let csrfToken = '', data, tab = 'site', dirty = false, saving = false, uploading = false, passwordChangeRequired = false;
let consultationView = 0;
const safeConnection = location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
// Remove credentials left by older versions; authentication uses an HttpOnly cookie.
try { sessionStorage.removeItem('khb-token'); } catch { }
const status = (message, error = false) => { $('#status').textContent = message; $('#status').classList.toggle('error', error); };
const changed = () => { dirty = true; status('有未保存的修改'); syncAdminTabLabels(); };
function showLogin(clear = false) {
  csrfToken = ''; $('#login').hidden = false; $('#editor').hidden = true; $('#security').hidden = true; $('#logout').hidden = true;
  consultationView++;
  if (tab === 'consultations') $('#fields').replaceChildren();
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
const newId = prefix => `${prefix}-${crypto.randomUUID()}`;
const NAVIGATION_DEFAULTS = [
  { id: 'home', label: '首页', href: '#home', children: [] },
  { id: 'about', label: '关于课后邦', href: '#about', children: [
    { id: 'about-intro', label: '课后邦集团介绍', href: '#about', action: '' },
    { id: 'brochure', label: '公司展册', href: 'https://kehoubang.cn/profile/upload/pdf/3/index.html', target: 'blank' },
    { id: 'handbook', label: '课程手册', href: 'https://kehoubang.cn/profile/upload/pdf/1/index.html', target: 'blank' },
    { id: 'school-plan', label: '一校一案', href: 'https://kehoubang.cn/profile/upload/pdf/2/index.html', target: 'blank' },
    { id: 'team', label: '核心团队', href: '/team.html', target: 'blank', action: '' },
    { id: 'course-library', label: '课程资源库', href: '/courses.html', target: 'blank', action: '' }
  ] },
  { id: 'business', label: '集团核心业务', href: '#business-showcase', action: 'business', children: [
    { id: 'supply-chain', label: '课后邦课后服务进校供应链', href: '#after-school-supply', target: '', action: 'business', value: 'supply-chain' },
    { id: 'ai-school-supply', label: '课后邦人工智能进校供应链', href: '#ai-school-supply', target: '', action: 'business', value: 'ai-school-supply' },
    { id: 'online-ai-study', label: '线上AI伴学', href: '/content-page.html?type=business&id=online-ai-study', target: 'blank', action: 'business', value: 'online-ai-study' },
    { id: 'online-education', label: '线上素质教育', href: '/content-page.html?type=business&id=online-education', target: 'blank', action: 'business', value: 'online-education' },
    { id: 'education-street', label: '教育一条街', href: '/content-page.html?type=business&id=education-street', target: 'blank', action: 'business', value: 'education-street' },
    { id: 'youth-center', label: '青少年成长中心', href: '/content-page.html?type=business&id=youth-center', target: 'blank', action: 'business', value: 'youth-center' },
    { id: 'ai-museum', label: '人工智能科技馆', href: '/content-page.html?type=business&id=ai-museum', target: 'blank', action: 'business', value: 'ai-museum' }
  ] },
  { id: 'alliance', label: '课后服务联盟', href: '/content-page.html?type=alliance&id=alliance-intro', target: 'blank', action: '', children: [
    { id: 'alliance-intro', label: '全国课后服务行业联盟介绍', href: '/content-page.html?type=alliance&id=alliance-intro', target: 'blank', action: '' },
    { id: 'third-members', label: '第三届成员介绍及理事单位招募', href: '/content-page.html?type=alliance&id=third-members', target: 'blank', action: '' },
    { id: 'past-conferences', label: '历届大会展示', href: 'https://mp.weixin.qq.com/s/Yw8dvTeQqkIkpR571V8kxA', target: 'blank', action: '' },
    { id: 'third-conference-plan', label: '第三届全国课后服务行业大会计划', href: '/content-page.html?type=alliance&id=third-conference-plan', target: 'blank', action: '' }
  ] },
  { id: 'venture', label: '智邻精英汇', href: '/content-page.html?type=venture&id=zhilin-hub', action: 'venture', children: [
    { id: 'zhilin-hub', label: '智邻精英汇', href: '/content-page.html?type=venture&id=zhilin-hub', target: 'blank', action: 'venture', value: 'zhilin-hub' },
    { id: 'venture-intro', label: '智邻创投', href: '/content-page.html?type=venture&id=intro', action: 'venture', value: 'intro' },
    { id: 'new-year-dinner', label: '2025年书院世家别墅区年夜饭', href: '/content-page.html?type=venture&id=new-year-dinner', action: 'venture', value: 'new-year-dinner' },
    { id: 'new-year-dinner-2026', label: '2026年书院世家别墅区年夜饭', href: '/content-page.html?type=venture&id=new-year-dinner-2026', action: 'venture', value: 'new-year-dinner-2026' },
    { id: 'new-year-dinner-2027', label: '2027年书院世家别墅区年夜饭', href: '/content-page.html?type=venture&id=new-year-dinner-2027', action: 'venture', value: 'new-year-dinner-2027' }
  ] },
  { id: 'news', label: '新闻资讯', href: '#news', action: 'news-group', children: [
    { id: 'group-news', label: '集团动态', href: '#news', action: 'news-group', value: 'group' },
    { id: 'industry-news', label: '行业洞察', href: '#news', action: 'news-group', value: 'industry' }
  ] },
  { id: 'contact', label: '联系我们', href: '#contact', action: 'contact-topic', children: [
    { id: 'contact-info', label: '联系方式', href: '#contact', action: 'contact-topic', value: 'info' }
  ] }
];
const ARRAY_TABS = ['aboutPages', 'businessPages', 'alliancePages', 'courseCategories', 'courses', 'team', 'venturePages', 'news', 'contactTopics', 'services'];
const CORE_BUSINESS_IDS = ['supply-chain', 'ai-school-supply', 'online-ai-study', 'online-education', 'education-street', 'youth-center', 'ai-museum'];
const FIXED_BUSINESS_IDS = new Set([...CORE_BUSINESS_IDS, 'supply-system', 'supply-courses', 'supply-school-plan', 'ai-study-system', 'ai-portals', 'ai-school-model']);
const FIXED_ALLIANCE_IDS = new Set(['alliance-intro', 'third-members', 'third-conference-plan']);
const NAV_TAB_ROOTS = {
  aboutPages: 'about',
  businessPages: 'business',
  alliancePages: 'alliance',
  venturePages: 'venture',
  contactTopics: 'contact'
};
const NAV_ROOT_INDEX = { about: 1, business: 2, alliance: 3, venture: 4, news: 5, contact: 6 };
const NAV_ROOT_ALIASES = {
  about: new Set(['about', 'about-us', '关于课后邦']),
  business: new Set(['business', 'core-business', 'group-business', 'product-service', '集团核心业务', '产品与服务']),
  alliance: new Set(['alliance', 'after-school-alliance', '课后服务联盟']),
  news: new Set(['news', 'news-information', 'company-news', '公司动态', '新闻资讯']),
  venture: new Set(['venture', 'zhi-lin', 'zhilin', '智邻创投', '智邻精英汇']),
  contact: new Set(['contact', 'contact-us', '联系我们'])
};
function findNavigationRoot(rootKey) {
  const aliases = NAV_ROOT_ALIASES[rootKey] || new Set([rootKey]);
  const navigation = Array.isArray(data?.navigation) ? data.navigation : data?.navigation && typeof data.navigation === 'object' ? Object.values(data.navigation) : [];
  const match = navigation.find(item => {
    const values = [item.id, item.key, item.slug, item.label, item.title].map(value => String(value || '').trim().toLowerCase());
    return values.some(value => aliases.has(value));
  });
  // Keep the CMS tabs useful when an editor also changes an internal menu ID.
  // The seven top-level items have a stable documented order, so use it only
  // as a fallback after the explicit ID/key/label match.
  return match || navigation[NAV_ROOT_INDEX[rootKey]];
}
function findFixedNewsRoot() {
  return (data?.navigation || []).find(item => [item.id, item.label].some(value => NAV_ROOT_ALIASES.news.has(String(value || '').trim().toLowerCase())));
}
function syncAdminTabLabels() {
  if (!data || !Array.isArray(data.navigation)) return;
  document.querySelectorAll('[data-tab]').forEach(button => {
    const rootKey = NAV_TAB_ROOTS[button.dataset.tab];
    if (!rootKey) return;
    const root = findNavigationRoot(rootKey);
    if (root?.label || root?.title) button.textContent = root.label || root.title;
  });
}
function newsGroupForCategory(category) {
  const value = String(category || '').trim();
  if (['行业洞察', '行业资讯', '政策解读'].includes(value)) return 'industry';
  if (['集团动态', '公司动态', '企业动态'].includes(value)) return 'group';
  return '';
}
function ensureDataShape() {
  data.courses ||= [];
  ARRAY_TABS.forEach(key => {
    if (!Array.isArray(data[key])) data[key] = key === 'alliancePages' && data[key] && typeof data[key] === 'object' ? Object.values(data[key]) : [];
  });
  if (!Array.isArray(data.navigation)) data.navigation = structuredClone(NAVIGATION_DEFAULTS);
  data.navigation.forEach(item => { item.children ||= []; item.id ||= newId('nav'); item.label ??= item.title ?? '新菜单'; item.href ??= '#home'; });
  data.navigation.forEach(item => item.children.forEach(child => { child.id ||= newId('nav-item'); child.label ??= child.title ?? '新菜单项'; child.href ??= '#home'; }));
  data.aboutPages.forEach(item => { item.id ||= newId('about'); item.title ??= '新页面'; item.summary ??= ''; item.body ??= ''; item.link ??= ''; item.target ??= ''; item.order ??= 0; item.published ??= true; });
  data.businessPages.forEach(item => { item.id ||= newId('business'); item.title ??= '新业务'; item.summary ??= ''; item.body ??= ''; });
  data.alliancePages.forEach(item => { item.id ||= newId('alliance'); item.title ??= '新联盟页面'; item.summary ??= ''; item.body ??= ''; item.image ??= ''; item.longImage ??= ''; item.order ??= 0; item.published ??= false; });
  data.courseCategories.forEach(item => { item.id ||= newId('course-category'); item.title ??= '新分类'; item.description ??= ''; item.order ??= 0; item.published ??= true; });
  data.newsCategories = structuredClone(FIXED_NEWS_CATEGORIES);
  const newsRoot = findFixedNewsRoot();
  if (newsRoot) newsRoot.children = structuredClone(NAVIGATION_DEFAULTS.find(item => item.id === 'news').children);
  data.venturePages.forEach(item => { item.id ||= newId('venture'); item.title ??= '新页面'; item.summary ??= ''; item.body ??= ''; item.order ??= 0; item.published ??= true; });
  data.contactTopics.forEach(item => { item.id ||= newId('contact'); item.title ??= '新联系栏目'; item.description ??= ''; item.order ??= 0; item.published ??= true; });
  data.news.forEach(item => {
    item.id ||= newId('news');
    item.category ??= item.group === 'industry' ? '行业洞察' : '集团动态';
    item.group = newsGroupForCategory(item.category) || (item.group === 'industry' ? 'industry' : 'group');
    item.source ??= ''; item.image ??= ''; item.longImage ??= '';
  });
  data.courses.forEach(item => { item.description ??= ''; item.grades ??= ''; item.outline ??= ''; item.cover ??= ''; item.longImage ??= ''; item.page ??= 0; });
}
function field(parent, obj, key, label, type = 'text', wide = false, options = {}) {
  const box = el('div', 'form-field' + (wide ? ' wide' : '')); const id = 'f-' + crypto.randomUUID(); const l = el('label', '', label); l.htmlFor = id;
  let input;
  if (type === 'textarea') input = el('textarea');
  else if (type === 'select') {
    input = el('select'); (options.choices || []).forEach(choice => { const option = el('option'); option.value = choice.value; option.textContent = choice.label; input.append(option); });
  } else { input = el('input'); input.type = type; }
  input.id = id;
  if (options.readOnly) input.readOnly = true;
  if (key === 'features') input.value = Array.isArray(obj[key]) ? obj[key].join('\n') : (obj[key] ?? '');
  else if (type === 'checkbox') input.checked = Boolean(obj[key]);
  else input.value = obj[key] ?? '';
  if (type === 'checkbox') { box.classList.add('published-field'); }
  const update = () => {
    obj[key] = type === 'checkbox' ? input.checked : type === 'number' ? (input.value === '' ? 0 : Number(input.value)) : key === 'features' ? input.value.split('\n').filter(Boolean) : input.value;
    changed(); options.onChange?.(obj[key]);
  };
  input.addEventListener(type === 'select' || type === 'checkbox' ? 'change' : 'input', update);
  box.append(l, input); parent.append(box); return input;
}
function photoPicker(item, key = 'image', label = '图片') {
  const box = el('div', 'photo-picker'); const button = el('button', 'photo-button'); button.type = 'button';
  const name = item.name || item.title || '页面'; button.setAttribute('aria-label', `上传${name}${label}`);
  const img = el('img'); img.src = item[key] || '/assets/logo.png'; img.alt = `${name}${label}`;
  const caption = el('span', '', item[key] ? '点击更换' + label : '点击上传' + label); button.append(img, caption);
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
      item[key] = result.url; img.src = result.url; caption.textContent = '点击更换' + label; changed(); message.textContent = '上传成功，保存后展示到官网。';
    } catch (e) { fail(e.message || '上传失败，请重试'); }
    finally { uploading = false; $('#save').disabled = false; $('#fields').inert = false; document.querySelectorAll('[data-tab], #logout').forEach(b => b.disabled = false); }
  };
  box.append(button, input, message); return box;
}
const targetChoices = [{ value: '', label: '本窗口打开' }, { value: 'blank', label: '新窗口打开' }];
const actionChoices = [{ value: '', label: '普通链接' }, { value: 'business', label: '集团核心业务' }, { value: 'course-category', label: '课程分类' }, { value: 'news-group', label: '新闻分组' }, { value: 'venture', label: '智邻创投' }, { value: 'contact-topic', label: '联系栏目' }];
const FIXED_NEWS_CATEGORIES = [
  { id: 'group', title: '集团动态', description: '公司活动、嘉年华新闻', order: 1, published: true },
  { id: 'industry', title: '行业洞察', description: '课后服务、AI 素质教育政策解读', order: 2, published: true }
];
function renderNavigation(target) {
  target.append(el('p', 'admin-note', '维护官网的七个一级菜单及下拉二级菜单。数组顺序就是官网显示顺序；链接、打开方式和动作均可编辑。'));
  data.navigation.forEach((item, index) => {
    const fixedNews = item === findFixedNewsRoot();
    const card = el('article', 'edit-card'); const heading = el('div', 'card-heading'); const remove = el('button', 'remove', '删除');
    remove.onclick = () => { if (confirm(`确定删除“${item.label || '新菜单'}”？保存后生效。`)) { data.navigation.splice(index, 1); changed(); render(); } };
    heading.append(el('h2', '', `${String(index + 1).padStart(2, '0')} / ${item.label || '新菜单'}`)); if (!fixedNews) heading.append(remove); card.append(heading);
    const grid = el('div', 'form-grid'); field(grid, item, 'id', '菜单 ID'); field(grid, item, 'label', '菜单名称'); field(grid, item, 'href', '链接地址'); field(grid, item, 'target', '打开方式', 'select', false, { choices: targetChoices }); field(grid, item, 'action', '交互动作', 'select', false, { choices: actionChoices }); field(grid, item, 'value', '动作参数'); card.append(grid);
    const childHead = el('div', 'nested-heading'); childHead.append(el('h3', '', '二级菜单')); card.append(childHead);
    if (fixedNews) {
      card.append(el('p', 'admin-note', '新闻资讯下固定保留以下两个二级菜单，可在“新闻资讯”的文章分类中填写对应名称。'));
      FIXED_NEWS_CATEGORIES.forEach(category => {
        const childCard = el('div', 'nested-card'); childCard.append(el('strong', '', category.title), el('p', '', category.description)); card.append(childCard);
      });
      target.append(card); return;
    }
    item.children.forEach((child, childIndex) => {
      const childCard = el('div', 'nested-card'); const childGrid = el('div', 'form-grid'); const childRemove = el('button', 'remove', '删除此项');
      childRemove.type = 'button'; childRemove.onclick = () => { item.children.splice(childIndex, 1); changed(); render(); };
      const childTitle = el('div', 'nested-card-heading'); childTitle.append(el('strong', '', `${String(childIndex + 1).padStart(2, '0')} / ${child.label || '新菜单项'}`), childRemove); childCard.append(childTitle);
      field(childGrid, child, 'id', '菜单项 ID'); field(childGrid, child, 'label', '显示名称'); field(childGrid, child, 'href', '链接地址'); field(childGrid, child, 'target', '打开方式', 'select', false, { choices: targetChoices }); field(childGrid, child, 'action', '交互动作', 'select', false, { choices: actionChoices }); field(childGrid, child, 'value', '动作参数'); childCard.append(childGrid); card.append(childCard);
    });
    const addChild = el('button', 'add nested-add', '+ 新增二级菜单'); addChild.type = 'button'; addChild.onclick = () => { item.children.push({ id: newId('nav-item'), label: '新菜单项', href: '#home', target: '', action: '', value: '' }); changed(); render(); }; card.append(addChild); target.append(card);
  });
  const add = el('button', 'add', '+ 新增一级菜单'); add.onclick = () => { data.navigation.push({ id: newId('nav'), label: '新一级菜单', href: '#home', target: '', action: '', value: '', children: [] }); changed(); render(); }; target.append(add);
}
function collectionFields(collection, item) {
  if (collection === 'aboutPages') return [['id', '页面 ID'], ['title', '页面标题'], ['summary', '页面摘要', 'textarea', true], ['body', '页面正文', 'textarea', true], ['link', '外部链接'], ['target', '打开方式', 'select', false, { choices: targetChoices }], ['order', '排序号', 'number'], ['published', '在官网公开发布', 'checkbox']];
  if (collection === 'businessPages') return [['id', '业务 ID', 'text', false, { readOnly: FIXED_BUSINESS_IDS.has(item.id) }], ['title', '业务名称'], ['summary', CORE_BUSINESS_IDS.includes(item.id) ? '首页整体介绍 / 业务摘要' : '详情页摘要', 'textarea', true], ['body', '业务介绍', 'textarea', true]];
  if (collection === 'alliancePages') return [['id', '页面 ID', 'text', false, { readOnly: FIXED_ALLIANCE_IDS.has(item.id) }], ['title', '页面标题'], ['summary', '页面摘要', 'textarea', true], ['body', '页面正文', 'textarea', true], ['order', '排序号', 'number'], ['published', '在官网公开发布', 'checkbox']];
  if (collection === 'courseCategories') return [['id', '分类 ID'], ['title', '分类名称'], ['description', '分类说明', 'textarea', true], ['order', '排序号', 'number'], ['published', '在官网公开发布', 'checkbox']];
  if (collection === 'courses') return [['title', '课程名称'], ['category', '课程分类'], ['grades', '适用年级'], ['summary', '卡片摘要', 'textarea', true], ['description', '详细介绍（弹窗）', 'textarea', true], ['outline', '学习内容（每行一项）', 'textarea', true], ['page', '课程手册页码', 'number']];
  if (collection === 'team') return [['name', '成员姓名'], ['role', '岗位职称'], ['category', '团队分类'], ['bio', '个人介绍', 'textarea', true]];
  if (collection === 'news') return [['title', '文章标题'], ['category', '文章分类', 'text', false, { onChange: value => { item.group = newsGroupForCategory(value) || item.group; } }], ['date', '发布日期', 'date'], ['source', '公众号原文链接', 'url'], ['summary', '摘要', 'textarea', true], ['body', '文章正文', 'textarea', true], ['published', '在官网公开发布', 'checkbox']];
  if (collection === 'venturePages') return [['id', '页面 ID'], ['title', '页面标题'], ['summary', '页面摘要', 'textarea', true], ['body', '页面正文', 'textarea', true], ['order', '排序号', 'number'], ['published', '在官网公开发布', 'checkbox']];
  if (collection === 'contactTopics') return [['id', '栏目 ID'], ['title', '栏目名称'], ['description', '栏目说明', 'textarea', true], ['order', '排序号', 'number'], ['published', '在官网公开发布', 'checkbox']];
  return [['title', '服务名称'], ['category', '服务分类'], ['subtitle', '副标题', 'text', true], ['description', '详细介绍', 'textarea', true], ['features', '服务要点（每行一个）', 'textarea', true]];
}
function collectionDefault(collection) {
  if (collection === 'aboutPages') return { id: newId('about'), title: '新页面', summary: '', body: '', link: '', target: '', order: 0, published: false };
  if (collection === 'businessPages') return { id: newId('business'), title: '新业务', summary: '', body: '', image: '/assets/logo.png', longImage: '' };
  if (collection === 'alliancePages') return { id: newId('alliance'), title: '新联盟页面', summary: '', body: '', image: '', longImage: '', order: 0, published: false };
  if (collection === 'courseCategories') return { id: newId('course-category'), title: '新分类', description: '', image: '/assets/logo.png', longImage: '', order: 0, published: true };
  if (collection === 'courses') return { title: '新课程', category: '美育类', summary: '', description: '', grades: '', outline: '', page: 0, cover: '', longImage: '' };
  if (collection === 'team') return { name: '新成员', role: '', category: '管理团队', bio: '', image: '/assets/logo.png' };
  if (collection === 'news') return { id: newId('news'), title: '新文章', group: 'group', category: '集团动态', date: new Date().toISOString().slice(0, 10), summary: '', body: '', source: '', image: '', longImage: '', published: false };
  if (collection === 'venturePages') return { id: newId('venture'), title: '新页面', summary: '', body: '', image: '/assets/logo.png', longImage: '', order: 0, published: false };
  if (collection === 'contactTopics') return { id: newId('contact'), title: '新联系栏目', description: '', order: 0, published: true };
  return { title: '新服务', subtitle: '', description: '', category: '课程服务', features: [] };
}
function renderCollection(target, collection) {
  const notes = {
    aboutPages: '编辑“关于课后邦”下的集团介绍、公司展册、课程手册、一校一案和核心团队页面。',
    businessPages: '维护七大核心业务与六个详情页面。前七项封面同时用于首页业务切换图，前两项摘要用于首页整体介绍；标题、摘要、正文和图片均可编辑。固定入口 ID 只读，修改后点击保存。',
    alliancePages: '维护联盟介绍、第三届成员与理事单位招募、第三届大会计划三页。固定页面 ID 只读且不可删除；可编辑标题、摘要、正文、封面、长图、发布状态和排序。正式信息请核实后发布，“历届大会展示”链接在七大导航中维护。',
    courseCategories: '维护“关于课后邦 → 课程资源库”的分类和分类长图；课程卡片的详细内容在“课程目录”中编辑。',
    courses: '维护“关于课后邦 → 课程资源库”的课程卡片、独立封面、分类、适用年级、弹窗介绍和课程长图。简介与适用年级显示在详情图片前；年级未填写时显示“待补充”。课程手册页码填 0 表示不关联 PDF。',
    team: '点击成员照片即可选择本机图片上传，完成编辑后点击“保存并更新官网”。',
    news: '编辑文章标题、分类、日期、摘要与正文。公众号原文链接选填；未勾选发布的文章只保存在后台。',
    venturePages: '编辑智邻精英汇介绍、智邻创投和历年书院世家别墅区年夜饭页面。',
    contactTopics: '编辑联系我们下的联系方式栏目。旧数据中的商务合作、师资合作和人才招聘记录仅作兼容保留，官网不会展示。',
    services: '兼容旧版本的产品与服务字段；新官网请优先编辑“集团核心业务”。'
  };
  target.append(el('p', 'admin-note', notes[collection] || '维护栏目内容。'));
  data[collection].forEach((item, index) => {
    const card = el('article', 'edit-card'); const heading = el('div', 'card-heading'); const name = item.name || item.title || '新内容'; const remove = el('button', 'remove', '删除');
    remove.onclick = () => { if (confirm(`确定删除“${name}”？保存后生效。`)) { data[collection].splice(index, 1); changed(); render(); } };
    const fixedPage = (collection === 'businessPages' && FIXED_BUSINESS_IDS.has(item.id)) || (collection === 'alliancePages' && FIXED_ALLIANCE_IDS.has(item.id));
    heading.append(el('h2', '', `${String(index + 1).padStart(2, '0')} / ${name}`)); if (!fixedPage) heading.append(remove); card.append(heading);
    const imageKeys = collection === 'team' ? [['image', '成员照片']] : collection === 'businessPages' ? [['image', CORE_BUSINESS_IDS.includes(item.id) ? '首页切换图 / 封面图' : '封面图'], ['longImage', '长图']] : collection === 'alliancePages' || collection === 'courseCategories' || collection === 'venturePages' ? [['image', '封面图'], ['longImage', '长图']] : collection === 'courses' ? [['cover', '课程封面'], ['longImage', '课程长图']] : [];
    imageKeys.forEach(([key, label]) => card.append(photoPicker(item, key, label)));
    const grid = el('div', 'form-grid'); collectionFields(collection, item).forEach(([key, label, type, wide, options]) => field(grid, item, key, label, type, wide, options || {})); card.append(grid); target.append(card);
  });
  const labels = { aboutPages: '页面', businessPages: '业务', alliancePages: '联盟页面', courseCategories: '课程分类', courses: '课程', team: '成员', news: '文章', venturePages: '页面', contactTopics: '联系栏目', services: '服务' };
  const add = el('button', 'add', '+ 新增' + labels[collection]); add.onclick = () => { data[collection].push(collectionDefault(collection)); changed(); render(); const cards = target.querySelectorAll('.edit-card'); cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }; target.append(add);
}
function consultationPage(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value) || value.length > 500) return '';
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin ? url.pathname + url.search + url.hash : '';
  } catch { return ''; }
}
function renderConsultations(target, view) {
  const session = csrfToken;
  const workspace = el('section', 'consultation-inbox');
  const current = () => tab === 'consultations' && consultationView === view && csrfToken === session && !!session && workspace.isConnected;
  const toolbar = el('div', 'consultation-toolbar');
  const heading = el('div'); heading.append(el('h2', '', '合作咨询'), el('p', 'admin-note', '咨询记录独立保存，标记和删除会立即生效。网站内容的未保存修改仍会保留。'));
  const refresh = el('button', 'consultation-refresh', '刷新记录'); refresh.type = 'button'; refresh.onclick = () => render();
  toolbar.append(heading, refresh);
  const message = el('p', 'consultation-message', '正在加载咨询记录…'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
  const list = el('div', 'consultation-list');
  workspace.append(toolbar, message, list); target.append(workspace);
  let items = [], visible = 50, busy = false;
  const update = async (item, method, body) => {
    if (busy || !current()) return;
    if (method === 'DELETE' && !confirm(`确定删除“${item.name || '此用户'}”的咨询记录？此操作会立即生效。`)) return;
    busy = true;
    workspace.querySelectorAll('button').forEach(button => { button.disabled = true; });
    message.classList.remove('error'); message.textContent = method === 'DELETE' ? '正在删除…' : '正在更新状态…';
    try {
      const result = await apiRequest('/api/admin/consultations/' + encodeURIComponent(item.id), method, body);
      if (!current()) return;
      items = method === 'DELETE' ? items.filter(entry => entry.id !== item.id) : items.map(entry => entry.id === item.id ? (result.item || { ...entry, ...body }) : entry);
      busy = false; draw();
      message.textContent = method === 'DELETE' ? '咨询记录已删除。' : body.status === 'contacted' ? '已标记为已联系。' : '已恢复为待联系。';
    } catch (error) {
      if (!current()) return;
      message.classList.add('error'); message.textContent = error.message || '操作失败，请重试。';
    } finally {
      busy = false;
      if (current()) workspace.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  };
  const draw = () => {
    list.replaceChildren(); refresh.disabled = false;
    const pending = items.filter(item => item.status !== 'contacted').length;
    message.classList.remove('error'); message.textContent = items.length ? `共 ${items.length} 条咨询，${pending} 条待联系。` : '暂时没有咨询记录，访客提交后会显示在这里。';
    items.slice(0, visible).forEach(item => {
      const card = el('article', 'consultation-record');
      const recordHeading = el('div', 'consultation-record-heading');
      recordHeading.append(el('h3', '', item.name || '未填写姓名'), el('span', 'consultation-state' + (item.status === 'contacted' ? ' contacted' : ''), item.status === 'contacted' ? '已联系' : '待联系'));
      const details = el('dl', 'consultation-details');
      const detail = (label, value) => { const box = el('div'); box.append(el('dt', '', label), value); details.append(box); };
      const phone = el('dd');
      if (/^1[3-9]\d{9}$/.test(item.phone || '')) { const link = el('a', '', item.phone); link.href = 'tel:' + item.phone; phone.append(link); }
      else phone.textContent = item.phone || '—';
      detail('联系电话', phone);
      const date = new Date(item.createdAt);
      detail('提交时间', el('dd', '', Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })));
      const page = consultationPage(item.page), source = el('dd', 'consultation-source');
      if (page) { const link = el('a', '', page); link.href = page; link.target = '_blank'; link.rel = 'noopener noreferrer'; source.append(link); }
      else source.textContent = '未记录';
      detail('来源页面', source);
      const actions = el('div', 'consultation-record-actions');
      const toggle = el('button', 'consultation-toggle', item.status === 'contacted' ? '恢复待联系' : '标记已联系'); toggle.type = 'button';
      toggle.onclick = () => update(item, 'PATCH', { status: item.status === 'contacted' ? 'new' : 'contacted' });
      const remove = el('button', 'remove', '删除记录'); remove.type = 'button'; remove.onclick = () => update(item, 'DELETE');
      actions.append(toggle, remove); card.append(recordHeading, details, actions); list.append(card);
    });
    if (items.length > visible) {
      const more = el('button', 'add consultation-more', `加载更多（剩余 ${items.length - visible} 条）`); more.type = 'button';
      more.onclick = () => { visible += 50; draw(); }; list.append(more);
    }
  };
  refresh.disabled = true;
  apiRequest('/api/admin/consultations').then(result => {
    if (!current()) return;
    items = (Array.isArray(result.items) ? result.items : []).filter(item => item && typeof item.id === 'string').sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    draw();
  }).catch(error => {
    if (!current()) return;
    refresh.disabled = false; message.classList.add('error'); message.textContent = error.message || '咨询记录加载失败，请刷新重试。';
  });
}
function render() {
  const view = ++consultationView;
  ensureDataShape();
  syncAdminTabLabels();
  $('#save').hidden = tab === 'consultations';
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('selected', b.dataset.tab === tab));
  const target = $('#fields'); target.replaceChildren();
  if (tab === 'site') {
    target.append(el('p', 'admin-note', '编辑首页文案与联系信息。未填写的电话、邮箱、地址和备案信息不会显示在官网。'));
    const card = el('div', 'edit-card'); const grid = el('div', 'form-grid');
    [['name', '品牌名称'], ['tagline', '品牌说明'], ['headline', '首页标题（换行显示）', 'textarea'], ['intro', '首页简介', 'textarea'], ['about', '公司介绍', 'textarea', true], ['phone', '合作电话'], ['email', '合作邮箱', 'email'], ['address', '公司地址'], ['filing', '备案信息']].forEach(([k, l, t, w]) => field(grid, data.site, k, l, t, w)); card.append(grid); target.append(card); return;
  }
  if (tab === 'navigation') return renderNavigation(target);
  if (tab === 'consultations') return renderConsultations(target, view);
  if (ARRAY_TABS.includes(tab)) return renderCollection(target, tab);
}
$('#save').onclick = async () => {
  if (tab === 'consultations' || saving || uploading) return; saving = true; $('#save').disabled = true; $('#fields').inert = true; status('正在保存…');
  try { await request('PUT', data); dirty = false; status('保存成功，官网内容已更新。'); } catch (e) { status('保存失败：' + e.message, true); }
  finally { saving = false; $('#save').disabled = false; $('#fields').inert = false; }
};
$('#login-submit').disabled = true;
if (safeConnection) apiRequest('/api/admin/session').then(enterSession).catch(e => { if (e.status !== 401) status(e.message, true); }).finally(() => { $('#login-submit').disabled = false; });
