const root = document.getElementById('content-page-main');
const params = new URLSearchParams(location.search);
const type = params.get('type') || 'business';
const requestedId = params.get('id') || '';
const asList = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const paragraphs = text => String(text || '').split(/\n\s*\n|\n/).map(value => value.trim()).filter(Boolean).map(value => {
  const heading = /^(#{1,3})\s+(.+)$/.exec(value);
  const node = document.createElement(heading ? (heading[1].length === 3 ? 'h3' : 'h2') : 'p'); node.textContent = heading ? heading[2] : value; return node;
});
const aliases = { 'business-supply': 'supply-chain', 'business-supply-chain': 'supply-chain', 'business-online': 'online-education', 'business-online-education': 'online-education', 'business-street': 'education-street', 'business-education-street': 'education-street', 'business-youth': 'youth-center', 'business-youth-center': 'youth-center', 'business-ai': 'ai-museum', 'business-ai-museum': 'ai-museum', 'invest-intro': 'intro', 'invest-meal': 'new-year-dinner' };
const showError = () => {
  const card = document.createElement('article'); card.className = 'content-page-card';
  const title = document.createElement('h1'); title.textContent = '内容不存在';
  const message = document.createElement('p'); message.className = 'content-page-summary'; message.textContent = '该页面可能已下线或尚未发布，请返回官网重新选择。';
  card.append(title, message); root.replaceChildren(card);
};
const make = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const openLightbox = (photos, startIndex) => {
  if (!photos.length) return;
  const dialog = make('dialog', 'event-lightbox');
  const frame = make('div', 'event-lightbox-frame');
  const close = make('button', 'event-lightbox-close', '关闭'); close.type = 'button'; close.setAttribute('aria-label', '关闭大图');
  const previous = make('button', 'event-lightbox-nav event-lightbox-prev', '‹'); previous.type = 'button'; previous.setAttribute('aria-label', '上一张');
  const next = make('button', 'event-lightbox-nav event-lightbox-next', '›'); next.type = 'button'; next.setAttribute('aria-label', '下一张');
  const stage = make('div', 'event-lightbox-stage'); stage.tabIndex = 0; stage.setAttribute('aria-label', '大图滚动区域');
  const image = make('img', 'event-lightbox-image');
  const caption = make('div', 'event-lightbox-caption');
  const tools = make('div', 'event-lightbox-tools');
  const autoplay = make('button', 'event-lightbox-autoplay', '自动播放'); autoplay.type = 'button'; autoplay.setAttribute('aria-pressed', 'false'); autoplay.setAttribute('aria-label', '自动播放照片');
  const scroll = make('button', 'event-lightbox-scroll', '滚动大图'); scroll.type = 'button'; scroll.setAttribute('aria-pressed', 'false');
  const download = make('a', 'event-lightbox-download', '下载图片'); download.setAttribute('download', '');
  const fullscreen = make('button', 'event-lightbox-fullscreen', '全屏'); fullscreen.type = 'button';
  const thumbPrevious = make('button', 'event-lightbox-thumbs-nav event-lightbox-thumbs-prev', '‹'); thumbPrevious.type = 'button'; thumbPrevious.setAttribute('aria-label', '向左滚动缩略图');
  const thumbNext = make('button', 'event-lightbox-thumbs-nav event-lightbox-thumbs-next', '›'); thumbNext.type = 'button'; thumbNext.setAttribute('aria-label', '向右滚动缩略图');
  const thumbs = make('div', 'event-lightbox-thumbs'); thumbs.setAttribute('aria-label', '照片缩略图列表');
  const thumbsWrap = make('div', 'event-lightbox-thumbs-wrap'); thumbsWrap.append(thumbPrevious, thumbs, thumbNext);
  const thumbNodes = photos.map((photo, photoIndex) => {
    const button = make('button', 'event-lightbox-thumb'); button.type = 'button'; button.setAttribute('aria-label', `查看第${photoIndex + 1}张照片`); button.dataset.index = String(photoIndex);
    const thumb = make('img', '', ''); thumb.src = photo.thumb || photo.src; thumb.alt = ''; thumb.loading = 'lazy'; thumb.decoding = 'async'; button.append(thumb); button.onclick = () => { index = photoIndex; update(); restartAutoplay(); }; thumbs.append(button); return button;
  });
  stage.append(image); tools.append(autoplay, scroll, download, fullscreen); frame.append(close, previous, next, stage, caption, tools, thumbsWrap); dialog.append(frame); document.body.append(dialog);
  let index = startIndex;
  let scrollMode = false;
  let playing = false;
  let autoplayTimer = 0;
  const autoplayInterval = 3500;
  const setScrollMode = enabled => {
    scrollMode = Boolean(enabled); stage.classList.toggle('is-scroll', scrollMode); scroll.setAttribute('aria-pressed', String(scrollMode)); scroll.textContent = scrollMode ? '适应窗口' : '滚动大图';
    stage.scrollTo({ top: 0, left: 0 }); if (scrollMode) stage.focus({ preventScroll: true });
  };
  const setAutoplayState = () => {
    autoplay.textContent = playing ? '暂停播放' : '自动播放'; autoplay.setAttribute('aria-pressed', String(playing)); autoplay.setAttribute('aria-label', playing ? '暂停自动播放' : '自动播放照片');
  };
  const stopAutoplay = () => {
    if (autoplayTimer) window.clearInterval(autoplayTimer);
    autoplayTimer = 0; playing = false; setAutoplayState();
  };
  const startAutoplay = () => {
    if (photos.length < 2) return;
    if (autoplayTimer) window.clearInterval(autoplayTimer);
    playing = true; setAutoplayState(); autoplayTimer = window.setInterval(() => { index += 1; update(); }, autoplayInterval);
  };
  const restartAutoplay = () => { if (playing) startAutoplay(); };
  const move = offset => { index += offset; update(); restartAutoplay(); };
  const update = () => {
    const photo = photos[(index + photos.length) % photos.length]; index = (index + photos.length) % photos.length;
    image.src = photo.src; image.alt = photo.filename || ''; caption.textContent = `${index + 1} / ${photos.length}${photo.tag ? ` · ${photo.tag}` : ''}${photo.filename ? ` · ${photo.filename}` : ''}`; download.href = photo.src; download.download = photo.filename || `photo-${photo.id}.jpg`;
    thumbNodes.forEach((node, photoIndex) => { const active = photoIndex === index; node.classList.toggle('selected', active); if (active) { node.setAttribute('aria-current', 'true'); node.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } else node.removeAttribute('aria-current'); });
    setScrollMode(Number(photo.height) > Number(photo.width) * 1.25);
  };
  autoplay.onclick = () => (playing ? stopAutoplay() : startAutoplay());
  close.onclick = () => dialog.close(); previous.onclick = () => move(-1); next.onclick = () => move(1); scroll.onclick = () => setScrollMode(!scrollMode);
  thumbPrevious.onclick = () => thumbs.scrollBy({ left: -Math.max(thumbs.clientWidth * .75, 240), behavior: 'smooth' }); thumbNext.onclick = () => thumbs.scrollBy({ left: Math.max(thumbs.clientWidth * .75, 240), behavior: 'smooth' });
  fullscreen.onclick = () => frame.requestFullscreen?.();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1); if (event.key === 'Escape') dialog.close(); });
  stage.addEventListener('keydown', event => { if (!scrollMode) return; if (event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); stage.scrollBy({ top: stage.clientHeight * .82, behavior: 'smooth' }); } if (event.key === 'PageUp') { event.preventDefault(); stage.scrollBy({ top: -stage.clientHeight * .82, behavior: 'smooth' }); } if (event.key === 'Home') { event.preventDefault(); stage.scrollTo({ top: 0, behavior: 'smooth' }); } if (event.key === 'End') { event.preventDefault(); stage.scrollTo({ top: stage.scrollHeight, behavior: 'smooth' }); } });
  dialog.addEventListener('close', () => { stopAutoplay(); dialog.remove(); }, { once: true }); setAutoplayState(); update(); dialog.showModal();
};
const renderEventGallery = async (card, page) => {
  const note = card.querySelector('.event-note');
  let event = { photos: [] }, manifestUnavailable = false;
  try {
    const response = await fetch('/assets/events/manifest.json'); if (!response.ok) throw Error('相册清单不可用');
    const manifest = await response.json(); event = manifest[page.id] || { photos: [] };
  } catch {
    manifestUnavailable = true;
  }
  // Imported photographs stay in their static manifest. CMS uploads append
  // without replacing that archive, and keep the order chosen in the editor.
  const sources = new Set(), ids = new Set();
  const photos = [...(Array.isArray(event.photos) ? event.photos : []), ...(Array.isArray(page.photos) ? page.photos : [])].filter(photo => {
    if (!photo || typeof photo.src !== 'string' || !photo.src || sources.has(photo.src)) return false;
    sources.add(photo.src); return true;
  }).map((photo, index) => {
    let id = String(photo.id || `photo-${index + 1}`);
    while (ids.has(id)) id = `photo-${index + 1}-${id}`;
    ids.add(id); return { ...photo, id, filename: photo.filename || '', tag: photo.tag || '' };
  });
  if (manifestUnavailable && !photos.length) {
    if (note) note.textContent = '现场照片暂时无法加载，请稍后再试。';
    return;
  }
  const hero = card.querySelector('.content-page-figure .content-page-image');
  if (hero && event.cover) { hero.src = event.cover; hero.alt = event.title || page.title || ''; }
  const gallery = make('section', 'event-gallery'); gallery.setAttribute('aria-labelledby', 'event-gallery-title');
  const heading = make('div', 'event-gallery-heading'); const title = make('h2', '', '现场照片'); title.id = 'event-gallery-title';
  const meta = make('div', 'event-gallery-meta'); [event.date, event.place, `${photos.length} 张照片`, photos.length && event.views ? `${event.views} 次浏览` : ''].filter(Boolean).forEach(value => meta.append(make('span', '', value)));
  heading.append(make('div', 'eyebrow', 'PHOTO LIVE / 现场相册'), title, make('p', 'event-gallery-subtitle', event.subtitle || (photos.length ? '记录每一次相聚的温度与笑容。' : '活动影像将在发布后更新。')), meta); gallery.append(heading);
  if (!photos.length) {
    if (note) note.textContent = '现场照片尚未上传，更新后会在这里展示。';
    gallery.append(make('p', 'event-gallery-empty', '现场照片待更新'));
    card.append(gallery);
    return;
  }
  if (note) note.textContent = '支持标签筛选、名称搜索、缩略图浏览、自动播放、滚动大图、全屏和下载。';
  const toolbar = make('div', 'event-gallery-toolbar'); const search = make('input', 'event-gallery-search'); search.type = 'search'; search.placeholder = '搜索照片名称'; search.setAttribute('aria-label', '搜索照片名称');
  const select = make('select', 'event-gallery-filter'); select.setAttribute('aria-label', '按标签筛选'); const allTags = make('option', '', '全部标签'); allTags.value = ''; select.append(allTags);
  const tags = new Set([...(Array.isArray(event.tags) ? event.tags.map(tag => tag.name) : []), ...photos.map(photo => photo.tag)].filter(Boolean));
  tags.forEach(tag => select.append(Object.assign(make('option', '', tag), { value: tag })));
  const status = make('span', 'event-gallery-status'); toolbar.append(search, select, status); gallery.append(toolbar);
  const grid = make('div', 'event-gallery-grid'); const more = make('button', 'event-gallery-more', '加载更多照片'); more.type = 'button'; gallery.append(grid, more); card.append(gallery);
  let filtered = photos; let shown = 0; const pageSize = 80;
  const draw = reset => {
    if (reset) { shown = 0; grid.replaceChildren(); }
    const query = search.value.trim().toLowerCase(); const tag = select.value;
    filtered = photos.filter(photo => (!tag || photo.tag === tag) && (!query || `${photo.filename} ${photo.tag}`.toLowerCase().includes(query)));
    const next = filtered.slice(shown, shown + pageSize); next.forEach(photo => { const button = make('button', 'event-photo-card'); button.type = 'button'; button.setAttribute('aria-label', `查看${photo.filename || '照片'}`); const image = make('img', 'event-photo-thumb'); image.src = photo.thumb || photo.src; image.alt = photo.filename || ''; image.loading = 'lazy'; image.decoding = 'async'; button.append(image); if (photo.tag) button.append(make('span', 'event-photo-tag', photo.tag)); button.onclick = () => openLightbox(filtered, filtered.indexOf(photo)); grid.append(button); }); shown += next.length; status.textContent = `显示 ${shown} / ${filtered.length} 张`;
    more.hidden = shown >= filtered.length; more.textContent = shown >= filtered.length ? '已显示全部照片' : `加载更多（剩余 ${filtered.length - shown}）`;
  };
  search.addEventListener('input', () => draw(true)); select.addEventListener('change', () => draw(true)); more.onclick = () => draw(false); draw(true);
};
const render = async data => {
  const collection = type === 'alliance' ? data.alliancePages : type === 'venture' ? data.venturePages : type === 'about' ? data.aboutPages : data.businessPages;
  const id = aliases[requestedId] || requestedId;
  const page = asList(collection).find(item => String(item.id || item.slug || '') === id) || asList(collection).find(item => String(item.title || item.name || '') === requestedId);
  if (!page || (['alliance', 'venture'].includes(type) && page.published === false)) return showError();
  const isDinner = type === 'venture' && String(page.id || '').startsWith('new-year-dinner');
  const hasGallery = isDinner || (type === 'venture' && Array.isArray(page.photos) && page.photos.length > 0);
  document.title = `课后邦｜${page.title || page.name || '内容介绍'}`;
  const card = document.createElement('article'); card.className = 'content-page-card';
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = type === 'alliance' ? 'ALLIANCE / 课后服务联盟' : type === 'venture' ? 'ZHILIN / 智邻精英汇' : type === 'about' ? 'ABOUT US / 关于课后邦' : 'CORE BUSINESS / 集团核心业务';
  const title = document.createElement('h1'); title.textContent = page.title || page.name || '内容介绍'; card.append(eyebrow, title);
  if (page.summary || page.subtitle) { const summary = document.createElement('p'); summary.className = 'content-page-summary'; summary.textContent = page.summary || page.subtitle; card.append(summary); }
  if (isDinner) {
    const switcher = document.createElement('nav'); switcher.className = 'event-switcher'; switcher.setAttribute('aria-label', '年夜饭年份');
    asList(data.venturePages).filter(item => /^new-year-dinner(?:-\d{4})?$/.test(String(item.id || '')) && item.published !== false).forEach(item => {
      const link = document.createElement('a'); link.href = `/content-page.html?type=venture&id=${encodeURIComponent(item.id)}`; link.textContent = item.title || '书院世家年夜饭'; link.className = item.id === page.id ? 'selected' : ''; if (item.id === page.id) link.setAttribute('aria-current', 'page'); else link.setAttribute('aria-label', `查看${link.textContent}`); switcher.append(link);
    });
    card.append(switcher);
  }
  if (hasGallery) { const liveNote = document.createElement('p'); liveNote.className = 'event-note'; liveNote.textContent = '正在加载现场照片…'; card.append(liveNote); }
  const image = page.image || page.cover;
  if (image) { const figure = document.createElement('figure'); figure.className = 'content-page-figure'; const node = document.createElement('img'); node.className = 'content-page-image'; node.src = image; node.alt = page.imageAlt || page.title || ''; node.loading = 'eager'; figure.append(node); card.append(figure); }
  const body = document.createElement('div'); body.className = 'content-page-body-copy'; body.append(...paragraphs(page.body || page.content || page.description));
  asList(page.sections).forEach(section => { const heading = section.heading || section.title; if (heading) { const h2 = document.createElement('h2'); h2.textContent = heading; body.append(h2); } body.append(...paragraphs(section.body || section.content || section.text)); });
  const bullets = asList(page.bullets || page.features || page.items); if (bullets.length) { const list = document.createElement('ul'); list.className = 'content-page-list'; bullets.forEach(item => { const li = document.createElement('li'); li.textContent = typeof item === 'string' ? item : item.title || item.name || item.text || ''; list.append(li); }); body.append(list); }
  if (!body.children.length) body.append(...paragraphs('页面内容正在完善，欢迎返回官网了解更多课后邦动态。'));
  card.append(body);
  if (page.longImage) { const figure = document.createElement('figure'); figure.className = 'content-page-figure content-page-long-figure'; const node = document.createElement('img'); node.className = 'content-page-image'; node.src = page.longImage; node.alt = `${page.title || ''}长图`; node.loading = 'lazy'; figure.append(node); card.append(figure); }
  root.replaceChildren(card);
  if (hasGallery) await renderEventGallery(card, page);
};
fetch('/api/content').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(render).catch(showError);
