const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let token = sessionStorage.getItem('khb-token') || '', data, tab = 'site', dirty = false, saving = false, uploading = false;
const status = (message, error = false) => { $('#status').textContent = message; $('#status').classList.toggle('error', error); };
const changed = () => { dirty = true; status('有未保存的修改'); };
async function request(method = 'GET', body) { const r = await fetch('/api/admin/content', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const result = await r.json(); if (!r.ok) throw Error(result.error || '操作失败'); return result; }
async function login() { try { data = await request(); sessionStorage.setItem('khb-token', token); $('#token').value = ''; $('#login').hidden = true; $('#editor').hidden = false; $('#logout').hidden = false; status(''); render(); } catch (e) { sessionStorage.removeItem('khb-token'); token = ''; status(e.message, true); } }
$('#login-form').onsubmit = e => { e.preventDefault(); token = $('#token').value.trim(); login(); };
$('#logout').onclick = () => { if (dirty && !confirm('尚有未保存的修改，确定退出？')) return; sessionStorage.removeItem('khb-token'); token = ''; data = null; dirty = false; location.reload(); };
window.addEventListener('beforeunload', e => { if (dirty || uploading) { e.preventDefault(); e.returnValue = ''; } });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
function field(parent, obj, key, label, type = 'text', wide = false) {
  const box = el('div', 'form-field' + (wide ? ' wide' : '')); const id = 'f-' + crypto.randomUUID(); const l = el('label', '', label); l.htmlFor = id;
  const input = el(type === 'textarea' ? 'textarea' : 'input'); input.id = id; if (type !== 'textarea') input.type = type;
  if (key === 'features') input.value = obj[key].join('\n'); else input.value = obj[key];
  if (type === 'checkbox') { input.checked = obj[key]; box.classList.add('published-field'); }
  input.addEventListener('input', () => { obj[key] = type === 'checkbox' ? input.checked : type === 'number' ? Number(input.value) : key === 'features' ? input.value.split('\n').filter(Boolean) : input.value; changed(); });
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
      const response = await fetch('/api/admin/images', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type }, body: file });
      const result = await response.json(); if (!response.ok) throw Error(result.error || '上传失败，请重试');
      item.image = result.url; img.src = result.url; caption.textContent = '点击更换照片'; changed(); message.textContent = '上传成功，保存后展示到官网。';
    } catch (e) { fail(e.message || '上传失败，请重试'); }
    finally { uploading = false; $('#save').disabled = false; $('#fields').inert = false; document.querySelectorAll('[data-tab], #logout').forEach(b => b.disabled = false); }
  };
  box.append(button, input, message); return box;
}
function render() {
  data.courses ||= [];
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('selected', b.dataset.tab === tab));
  const target = $('#fields'); target.replaceChildren();
  if (tab === 'site') {
    target.append(el('p', 'admin-note', '编辑首页文案与联系信息。未填写的电话、邮箱、地址和备案信息不会显示在官网。'));
    const card = el('div', 'edit-card'); const grid = el('div', 'form-grid');
    [['name', '品牌名称'], ['tagline', '品牌说明'], ['headline', '首页标题（换行显示）', 'textarea'], ['intro', '首页简介', 'textarea'], ['about', '公司介绍', 'textarea', true], ['phone', '合作电话'], ['email', '合作邮箱', 'email'], ['address', '公司地址'], ['filing', '备案信息']].forEach(([k, l, t, w]) => field(grid, data.site, k, l, t, w)); card.append(grid); target.append(card); return;
  }
  target.append(el('p', 'admin-note', tab === 'news' ? '未勾选发布的文章仅保存在后台。补齐公众号标题、日期和正文后，再勾选发布并保存。正文使用纯文本，自动保留换行。' : tab === 'team' ? '点击成员照片即可选择本机图片上传，完成编辑后点击“保存并更新官网”。' : '维护业务介绍与服务内容，每行填写一个服务要点。'));
  if (tab === 'courses') { target.replaceChildren(); target.append(el('p', 'course-page-note', '维护课程卡片和详情弹窗。详细介绍支持换行，学习内容每行填写一项。')); }
  data[tab].forEach((item, index) => {
    const card = el('article', 'edit-card'); const heading = el('div', 'card-heading'); const remove = el('button', 'remove', '删除'); remove.onclick = () => { if (confirm(`确定删除“${item.name || item.title || '新内容'}”？保存后生效。`)) { data[tab].splice(index, 1); changed(); render(); } };
    heading.append(el('h2', '', `${String(index + 1).padStart(2, '0')} / ${item.name || item.title || '新内容'}`), remove); card.append(heading);
    if (tab === 'team') card.append(photoPicker(item));
    const grid = el('div', 'form-grid'); let fields;
    if (tab === 'services') fields = [['title', '服务名称'], ['category', '服务分类'], ['subtitle', '副标题', 'text', true], ['description', '详细介绍', 'textarea', true], ['features', '服务要点（每行一个）', 'textarea', true]];
    if (tab === 'courses') { item.description ??= ''; item.outline ??= ''; fields = [['title', '课程名称'], ['category', '课程分类'], ['summary', '卡片摘要', 'textarea', true], ['description', '详细介绍（弹窗）', 'textarea', true], ['outline', '学习内容（每行一项）', 'textarea', true]]; }
    if (tab === 'team') fields = [['name', '成员姓名'], ['role', '岗位职称'], ['category', '团队分类'], ['bio', '个人介绍', 'textarea', true]];
    if (tab === 'news') fields = [['title', '文章标题'], ['category', '文章分类'], ['date', '发布日期', 'date'], ['source', '公众号原文链接', 'url'], ['summary', '摘要', 'textarea', true], ['body', '文章正文', 'textarea', true], ['published', '在官网公开发布', 'checkbox']];
    fields.forEach(([k, l, t, w]) => field(grid, item, k, l, t, w)); card.append(grid); target.append(card);
  });
  const add = el('button', 'add', '+ 新增' + ({ services: '服务', team: '成员', news: '文章', courses: '课程' })[tab]); add.onclick = () => {
    const defaults = { services: { title: '新服务', subtitle: '', description: '', category: '课程服务', features: [] }, team: { name: '新成员', role: '', category: '管理团队', bio: '', image: '/assets/logo.webp' }, news: { id: crypto.randomUUID(), title: '新文章', category: '公司动态', date: new Date().toISOString().slice(0, 10), summary: '', body: '', source: '', published: false } };
    defaults.courses = { title: '新课程', category: '美育类', summary: '', description: '', outline: '', page: 0 };
    data[tab].push(defaults[tab]); changed(); render(); $('#fields').lastElementChild.previousElementSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }; target.append(add);
}
$('#save').onclick = async () => {
  if (saving || uploading) return; saving = true; $('#save').disabled = true; $('#fields').inert = true; status('正在保存…');
  try { await request('PUT', data); dirty = false; status('保存成功，官网内容已更新。'); } catch (e) { status('保存失败：' + e.message, true); }
  finally { saving = false; $('#save').disabled = false; $('#fields').inert = false; }
};
if (token) login();
