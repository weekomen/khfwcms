const root = document.getElementById('content-page-main');
const params = new URLSearchParams(location.search);
const type = params.get('type') || 'business';
const requestedId = params.get('id') || '';
const asList = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const paragraphs = text => String(text || '').split(/\n\s*\n|\n/).map(value => value.trim()).filter(Boolean).map(value => {
  const node = document.createElement('p'); node.textContent = value; return node;
});
const aliases = { 'business-supply': 'supply-chain', 'business-online': 'online-education', 'business-street': 'education-street', 'business-youth': 'youth-center', 'business-ai': 'ai-museum', 'invest-intro': 'intro', 'invest-meal': 'new-year-dinner' };
const showError = () => {
  const card = document.createElement('article'); card.className = 'content-page-card';
  const title = document.createElement('h1'); title.textContent = '内容不存在';
  const message = document.createElement('p'); message.className = 'content-page-summary'; message.textContent = '该页面可能已下线或尚未发布，请返回官网重新选择。';
  card.append(title, message); root.replaceChildren(card);
};
const render = data => {
  const collection = type === 'venture' ? data.venturePages : type === 'about' ? data.aboutPages : data.businessPages;
  const id = aliases[requestedId] || requestedId;
  const page = asList(collection).find(item => String(item.id || item.slug || '') === id) || asList(collection).find(item => String(item.title || item.name || '') === requestedId);
  if (!page) return showError();
  document.title = `课后邦｜${page.title || page.name || '内容介绍'}`;
  const card = document.createElement('article'); card.className = 'content-page-card';
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = type === 'venture' ? 'ZHILIN VENTURE / 智邻创投' : 'CORE BUSINESS / 集团核心业务';
  const title = document.createElement('h1'); title.textContent = page.title || page.name || '内容介绍'; card.append(eyebrow, title);
  if (page.summary || page.subtitle) { const summary = document.createElement('p'); summary.className = 'content-page-summary'; summary.textContent = page.summary || page.subtitle; card.append(summary); }
  if (type === 'venture' && String(page.id || '').startsWith('new-year-dinner')) {
    const switcher = document.createElement('nav'); switcher.className = 'event-switcher'; switcher.setAttribute('aria-label', '年夜饭年份');
    [{ id: 'new-year-dinner-2026', label: '2026书院世家年夜饭' }, { id: 'new-year-dinner', label: '2025书院世家年夜饭' }].forEach(item => {
      const link = document.createElement('a'); link.href = `/content-page.html?type=venture&id=${item.id}`; link.textContent = item.label; link.className = item.id === page.id ? 'selected' : ''; if (item.id !== page.id) link.setAttribute('aria-label', `查看${item.label}`); switcher.append(link);
    });
    card.append(switcher);
    const liveNote = document.createElement('p'); liveNote.className = 'event-note'; liveNote.textContent = '进入照片直播页，可浏览活动照片并使用原页面提供的筛选、搜索、下载与分享功能。'; card.append(liveNote);
    if (page.externalLink) { const action = document.createElement('a'); action.className = 'event-action'; action.href = page.externalLink; action.target = '_blank'; action.rel = 'noopener noreferrer'; action.textContent = '打开照片直播 ↗'; card.append(action); }
  }
  const image = page.image || page.cover;
  if (image) { const figure = document.createElement('figure'); figure.className = 'content-page-figure'; const node = document.createElement('img'); node.className = 'content-page-image'; node.src = image; node.alt = page.imageAlt || page.title || ''; node.loading = 'eager'; figure.append(node); card.append(figure); }
  const body = document.createElement('div'); body.className = 'content-page-body-copy'; body.append(...paragraphs(page.body || page.content || page.description));
  asList(page.sections).forEach(section => { const heading = section.heading || section.title; if (heading) { const h2 = document.createElement('h2'); h2.textContent = heading; body.append(h2); } body.append(...paragraphs(section.body || section.content || section.text)); });
  const bullets = asList(page.bullets || page.features || page.items); if (bullets.length) { const list = document.createElement('ul'); list.className = 'content-page-list'; bullets.forEach(item => { const li = document.createElement('li'); li.textContent = typeof item === 'string' ? item : item.title || item.name || item.text || ''; list.append(li); }); body.append(list); }
  if (!body.children.length) body.append(...paragraphs('页面内容正在完善，欢迎返回官网了解更多课后邦动态。'));
  card.append(body);
  if (page.longImage) { const figure = document.createElement('figure'); figure.className = 'content-page-figure content-page-long-figure'; const node = document.createElement('img'); node.className = 'content-page-image'; node.src = page.longImage; node.alt = `${page.title || ''}长图`; node.loading = 'lazy'; figure.append(node); card.append(figure); }
  root.replaceChildren(card);
};
fetch('/api/content').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(render).catch(showError);
