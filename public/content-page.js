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
const make = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const openLightbox = (photos, startIndex) => {
  const dialog = make('dialog', 'event-lightbox');
  const frame = make('div', 'event-lightbox-frame');
  const close = make('button', 'event-lightbox-close', '关闭'); close.type = 'button'; close.setAttribute('aria-label', '关闭大图');
  const previous = make('button', 'event-lightbox-nav event-lightbox-prev', '‹'); previous.type = 'button'; previous.setAttribute('aria-label', '上一张');
  const next = make('button', 'event-lightbox-nav event-lightbox-next', '›'); next.type = 'button'; next.setAttribute('aria-label', '下一张');
  const image = make('img', 'event-lightbox-image');
  const caption = make('div', 'event-lightbox-caption');
  const tools = make('div', 'event-lightbox-tools');
  const download = make('a', 'event-lightbox-download', '下载图片'); download.setAttribute('download', '');
  const fullscreen = make('button', 'event-lightbox-fullscreen', '全屏'); fullscreen.type = 'button';
  tools.append(download, fullscreen); frame.append(close, previous, next, image, caption, tools); dialog.append(frame); document.body.append(dialog);
  let index = startIndex;
  const update = () => {
    const photo = photos[(index + photos.length) % photos.length]; index = (index + photos.length) % photos.length;
    image.src = photo.src; image.alt = photo.filename || ''; caption.textContent = `${index + 1} / ${photos.length}${photo.tag ? ` · ${photo.tag}` : ''}${photo.filename ? ` · ${photo.filename}` : ''}`; download.href = photo.src; download.download = photo.filename || `photo-${photo.id}.jpg`;
  };
  close.onclick = () => dialog.close(); previous.onclick = () => { index -= 1; update(); }; next.onclick = () => { index += 1; update(); };
  fullscreen.onclick = () => frame.requestFullscreen?.();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') { index -= 1; update(); } if (event.key === 'ArrowRight') { index += 1; update(); } if (event.key === 'Escape') dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove(), { once: true }); update(); dialog.showModal();
};
const renderEventGallery = async (card, page) => {
  const response = await fetch('/assets/events/manifest.json'); if (!response.ok) return;
  const manifest = await response.json(); const event = manifest[page.id]; if (!event) return;
  const hero = card.querySelector('.content-page-figure .content-page-image');
  if (hero && event.cover) { hero.src = event.cover; hero.alt = event.title || page.title || ''; }
  const gallery = make('section', 'event-gallery'); gallery.setAttribute('aria-labelledby', 'event-gallery-title');
  const heading = make('div', 'event-gallery-heading'); const title = make('h2', '', '现场照片'); title.id = 'event-gallery-title';
  const meta = make('div', 'event-gallery-meta'); [event.date, event.place, `${event.photos.length} 张照片`, `${event.views || 0} 次浏览`].filter(Boolean).forEach(value => meta.append(make('span', '', value)));
  heading.append(make('div', 'eyebrow', 'PHOTO LIVE / 现场相册'), title, make('p', 'event-gallery-subtitle', event.subtitle || '记录每一次相聚的温度与笑容。'), meta); gallery.append(heading);
  const toolbar = make('div', 'event-gallery-toolbar'); const search = make('input', 'event-gallery-search'); search.type = 'search'; search.placeholder = '搜索照片名称'; search.setAttribute('aria-label', '搜索照片名称');
  const select = make('select', 'event-gallery-filter'); select.setAttribute('aria-label', '按标签筛选'); const allTags = make('option', '', '全部标签'); allTags.value = ''; select.append(allTags); (event.tags || []).forEach(tag => select.append(Object.assign(make('option', '', tag.name), { value: tag.name })));
  const status = make('span', 'event-gallery-status'); toolbar.append(search, select, status); gallery.append(toolbar);
  const grid = make('div', 'event-gallery-grid'); const more = make('button', 'event-gallery-more', '加载更多照片'); more.type = 'button'; gallery.append(grid, more); card.append(gallery);
  let filtered = event.photos; let shown = 0; const pageSize = 80;
  const draw = reset => {
    if (reset) { shown = 0; grid.replaceChildren(); }
    const query = search.value.trim().toLowerCase(); const tag = select.value;
    filtered = event.photos.filter(photo => (!tag || photo.tag === tag) && (!query || `${photo.filename} ${photo.tag}`.toLowerCase().includes(query)));
    const next = filtered.slice(shown, shown + pageSize); next.forEach(photo => { const button = make('button', 'event-photo-card'); button.type = 'button'; button.setAttribute('aria-label', `查看${photo.filename || '照片'}`); const image = make('img', 'event-photo-thumb'); image.src = photo.thumb || photo.src; image.alt = photo.filename || ''; image.loading = 'lazy'; image.decoding = 'async'; button.append(image); if (photo.tag) button.append(make('span', 'event-photo-tag', photo.tag)); button.onclick = () => openLightbox(filtered, filtered.indexOf(photo)); grid.append(button); }); shown += next.length; status.textContent = `显示 ${shown} / ${filtered.length} 张`;
    more.hidden = shown >= filtered.length; more.textContent = shown >= filtered.length ? '已显示全部照片' : `加载更多（剩余 ${filtered.length - shown}）`;
  };
  search.addEventListener('input', () => draw(true)); select.addEventListener('change', () => draw(true)); more.onclick = () => draw(false); draw(true);
};
const render = async data => {
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
    const liveNote = document.createElement('p'); liveNote.className = 'event-note'; liveNote.textContent = '活动照片已导入官网本地相册，支持标签筛选、名称搜索、缩略图浏览、大图查看、全屏和下载。'; card.append(liveNote);
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
  if (type === 'venture' && String(page.id || '').startsWith('new-year-dinner')) await renderEventGallery(card, page);
};
fetch('/api/content').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(render).catch(showError);
