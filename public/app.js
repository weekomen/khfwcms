const $ = selector => document.querySelector(selector);
const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const dialog = $('#detail');

function detail(nodes) {
  $('#detail-content').replaceChildren(...nodes);
  const heading = $('#detail-content').querySelector('h2');
  if (heading) { heading.id = 'detail-title'; dialog.setAttribute('aria-labelledby', 'detail-title'); }
  dialog.showModal(); dialog.scrollTop = 0; document.body.classList.add('modal-open');
}
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
$('.dialog-close').onclick = () => dialog.close();
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
});

const nav = $('#nav');
const menuToggle = $('.menu-toggle');
const closeNav = () => {
  nav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  nav.querySelectorAll('[data-nav-parent]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  nav.querySelectorAll('.nav-group.open').forEach(group => group.classList.remove('open'));
};
menuToggle.onclick = () => {
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
};
nav.querySelectorAll('[data-nav-parent]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  const group = button.closest('[data-nav-group]');
  const open = group.classList.toggle('open');
  nav.querySelectorAll('[data-nav-group].open').forEach(other => {
    if (other !== group) { other.classList.remove('open'); other.querySelector('[data-nav-parent]')?.setAttribute('aria-expanded', 'false'); }
  });
  button.setAttribute('aria-expanded', String(open));
  if (group.dataset.navKey === 'contact') document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
function handleNavLink(event, link) {
  if (link.dataset.managedPage === 'true') {
    event.preventDefault();
    closeNav();
    window.open(link.href, '_blank', 'noopener,noreferrer');
    return;
  }
  const courseCategory = link.dataset.courseCategory;
  if (courseCategory && window.selectCourseCategory) { event.preventDefault(); window.selectCourseCategory(courseCategory); }
  const newsCategory = link.dataset.newsCategory;
  if (newsCategory && window.selectNewsCategory) { event.preventDefault(); window.selectNewsCategory(newsCategory); }
  const topic = link.dataset.contactTopic;
  if (topic) window.selectContactTopic?.(topic);
  // Core team is a section on the home page.  Handle it explicitly so the
  // dynamically rebuilt menu scrolls reliably after the dropdown closes.
  if (link.dataset.teamLink === 'true' || link.hash === '#team') {
    event.preventDefault();
    closeNav();
    const team = document.querySelector('#team');
    if (team) {
      history.replaceState(null, '', '#team');
      team.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
    return;
  }
  if (link.target !== '_blank') closeNav();
}
nav.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (link && nav.contains(link)) handleNavLink(event, link);
});
document.addEventListener('click', event => { if (!nav.contains(event.target) && !menuToggle.contains(event.target)) closeNav(); });

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    const hash = '#' + entry.target.id;
    document.querySelectorAll('nav .nav-link').forEach(link => {
      const active = link.hash === hash;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-nav-group]').forEach(group => {
      group.classList.toggle('active', [...group.querySelectorAll('a')].some(link => link.hash === hash));
    });
  }
}, { rootMargin: '-20% 0px -55% 0px' });
document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));

const backToTop = $('#back-to-top');
const updateBackToTop = () => { backToTop.hidden = window.scrollY < 450; };
window.addEventListener('scroll', updateBackToTop, { passive: true }); updateBackToTop();
backToTop.onclick = () => { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); $('.brand').focus({ preventScroll: true }); };

const platforms = [
  { name: '微信', image: '/assets/qr-wechat.jpg', note: '使用微信扫码' },
  { name: '视频号', image: '/assets/qr-channels.jpg', note: '课后邦教育科技集团' },
  { name: '快手', image: '/assets/qr-kuaishou.png', note: '快手 ID：2544355795' },
  { name: '抖音', image: '/assets/qr-douyin.png', note: '抖音号：Aaron1331' }
];
platforms.forEach(platform => {
  const button = el('button', 'platform-card'); button.type = 'button'; button.setAttribute('aria-label', `放大${platform.name}二维码`);
  const image = el('img', 'platform-qr'); image.src = platform.image; image.alt = `${platform.name}二维码`; image.loading = 'lazy';
  button.append(image, el('strong', '', platform.name), el('span', '', platform.note), el('small', '', '点击放大扫码'));
  button.onclick = () => { const large = el('img', 'qr-large'); large.src = platform.image; large.alt = `${platform.name}二维码原图`; detail([el('h2', '', platform.name), el('p', '', platform.note), large]); };
  $('#platform-grid').append(button);
});

const asList = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const safeSlug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
const pageText = page => page.body ?? page.content ?? page.description ?? page.summary ?? '';
const pageImage = page => page.image ?? page.longImage ?? page.cover ?? '';
const makeParagraphs = text => String(text || '').split(/\n\s*\n|\n/).map(value => value.trim()).filter(Boolean).map(value => el('p', '', value));

const defaultPages = [
  { group: 'businessPages', slug: 'business-supply', title: '课后邦供应链', summary: '连接优质课程、师资与服务资源，为学校和合作伙伴提供稳定的课程供应与交付支持。', body: '从资源筛选、课程研发到交付保障，课后邦供应链持续完善服务标准，让每一门好课程都能稳定抵达真实课堂。', bullets: ['课程资源整合与评估', '师资与交付标准建设', '区域项目协同支持'] },
  { group: 'businessPages', slug: 'business-online', title: '线上素质教育', summary: '以线上内容和数字化工具，延伸课后学习场景。', body: '围绕孩子的兴趣成长与家庭陪伴，提供可持续的线上课程、内容运营和学习支持，帮助优质教育资源跨越地域抵达更多家庭。', bullets: ['线上课程内容', '学习陪伴服务', '数字化运营支持'] },
  { group: 'businessPages', slug: 'business-street', title: '教育一条街', summary: '汇聚多元教育服务，打造开放共享的成长空间。', body: '教育一条街连接学校、家庭、机构和社区，把课程体验、文化活动与成长服务放在更贴近生活的场景中。', bullets: ['课程体验与展示', '社区教育活动', '多方资源共建'] },
  { group: 'businessPages', slug: 'business-youth', title: '青少年成长中心', summary: '关注每个年龄阶段的成长需要，提供综合实践与发展支持。', body: '以青少年成长为核心，融合素质课程、实践活动和成长指导，帮助孩子发现兴趣、建立自信、拓展视野。', bullets: ['兴趣发展课程', '实践与研学活动', '成长陪伴与指导'] },
  { group: 'businessPages', slug: 'business-ai', title: '人工智能科技馆', summary: '让孩子在真实体验中认识科技、理解人工智能。', body: '以人工智能、机器人和科学实践为主题，打造可参与、可探索、可分享的科技教育空间，培养面向未来的创造力。', bullets: ['AI 科普体验', '机器人与编程实践', '科技主题活动'] },
  { group: 'venturePages', slug: 'invest-intro', title: '智邻创投简介', summary: '发现教育与成长领域的长期价值，连接更多创新伙伴。', body: '智邻创投关注教育、科技与社区成长的交叉机会，以长期主义支持有创造力的团队与项目。', bullets: ['教育创新项目', '科技与内容融合', '伙伴共创与成长'] },
  { group: 'venturePages', slug: 'invest-meal', title: '书院世家年夜饭', summary: '一场连接社区、文化与亲情的年度相聚。', body: '书院世家年夜饭以团聚为起点，将地方文化、社区交流和家庭记忆融入年度活动，让每一次相聚都留下温暖的故事。', bullets: ['社区文化交流', '家庭团聚活动', '城市美好生活'] }
];
const pageAliases = {
  '课后邦供应链': 'business-supply', '线上素质教育': 'business-online', '教育一条街': 'business-street',
  '青少年成长中心': 'business-youth', '人工智能科技馆': 'business-ai', '简介': 'invest-intro', '智邻创投简介': 'invest-intro', '书院世家年夜饭': 'invest-meal'
};

function renderManagedPages(data) {
  const root = $('#managed-pages-list');
  const custom = [
    ...asList(data.businessPages).map(page => ({ ...page, _pageGroup: 'businessPages' })),
    ...asList(data.venturePages).map(page => ({ ...page, _pageGroup: 'venturePages' })),
    ...asList(data.aboutPages).map(page => ({ ...page, _pageGroup: 'aboutPages' }))
  ];
  const businessSlugs = { 'supply-chain': 'business-supply', 'online-education': 'business-online', 'education-street': 'business-street', 'youth-center': 'business-youth', 'ai-museum': 'business-ai' };
  const ventureSlugs = { intro: 'invest-intro', 'new-year-dinner': 'invest-meal' };
  const pageSlug = page => {
    const raw = page.slug || page.key || page.id || pageAliases[page.title || page.name];
    if (page._pageGroup === 'businessPages') return businessSlugs[raw] || (String(raw).startsWith('business-') ? raw : `business-${safeSlug(raw)}`);
    if (page._pageGroup === 'venturePages') return ventureSlugs[raw] || (String(raw).startsWith('invest-') ? raw : `invest-${safeSlug(raw)}`);
    return safeSlug(raw);
  };
  const bySlug = new Map();
  custom.forEach(page => { const slug = pageSlug(page); if (slug) bySlug.set(slug, { ...page, slug }); });
  const pages = defaultPages.map(page => ({ ...page, ...(bySlug.get(page.slug) || {}) }));
  custom.forEach(page => {
    const slug = pageSlug(page);
    if (slug && !pages.some(item => item.slug === slug)) pages.push({ ...page, slug, title: page.title || page.name || '未命名页面' });
  });
  root.replaceChildren();
  pages.forEach(page => {
    const article = el('article', 'managed-page'); article.id = `page-${safeSlug(page.slug)}`;
    const body = el('div', 'managed-page-copy');
    body.append(el('div', 'eyebrow', page.eyebrow || 'KEHOU BANG / 内容页面'), el('h3', '', page.title || page.name || '未命名页面'));
    if (page.summary || page.subtitle) body.append(el('p', 'managed-page-summary', page.summary || page.subtitle));
    makeParagraphs(pageText(page)).forEach(paragraph => body.append(paragraph));
    asList(page.sections).forEach(section => {
      if (section.heading || section.title) body.append(el('h4', '', section.heading || section.title));
      makeParagraphs(section.body ?? section.content ?? section.text).forEach(paragraph => body.append(paragraph));
    });
    const bullets = asList(page.bullets || page.features || page.items);
    if (bullets.length) { const list = el('ul', 'managed-page-list'); bullets.forEach(item => list.append(el('li', '', typeof item === 'string' ? item : item.title || item.name || item.text || ''))); body.append(list); }
    const image = pageImage(page);
    if (image) { const figure = el('figure', 'managed-page-visual'); const img = el('img'); img.src = image; img.alt = page.imageAlt || page.title || ''; img.loading = 'lazy'; figure.append(img); article.append(figure); }
    article.append(body); root.append(article);
  });
  $('#managed-pages').hidden = pages.length === 0;
  // A managed page can be opened in a new tab with a hash.  Its article is
  // created asynchronously after /api/content returns, so perform the hash
  // scroll again once the DOM exists.
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (hash && hash.startsWith('page-')) {
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'auto', block: 'start' }));
  }
}

function normalizeNewsCategory(value) {
  return ({ '公司动态': '集团动态', '企业动态': '集团动态', '行业资讯': '行业洞察', '政策解读': '行业洞察' })[value] || value;
}
let renderNewsList = () => {};
window.selectNewsCategory = category => renderNewsList(normalizeNewsCategory(category));

function renderNews(data) {
  const list = $('#news-list'); const filter = $('#news-filters');
  const categories = asList(data.newsCategories).map(item => typeof item === 'string' ? item : item.label || item.name || item.title).filter(Boolean);
  const available = [...new Set([...categories.map(normalizeNewsCategory), '集团动态', '行业洞察'])];
  let selected = '';
  const drawFilters = () => {
    filter.replaceChildren();
    ['全部资讯', ...available].forEach(category => { const button = el('button', '', category); button.type = 'button'; button.classList.toggle('selected', (!selected && category === '全部资讯') || selected === category); button.setAttribute('aria-pressed', String((!selected && category === '全部资讯') || selected === category)); button.onclick = () => { selected = category === '全部资讯' ? '' : category; renderNewsList(selected); }; filter.append(button); });
  };
  renderNewsList = category => {
    selected = normalizeNewsCategory(category || ''); drawFilters(); list.replaceChildren();
    const news = asList(data.news).filter(item => !selected || normalizeNewsCategory(item.category) === selected).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!news.length) { const empty = el('div', 'news-empty'); empty.append(el('span', '', '↗'), el('div', '', '暂无该分类资讯，新的故事正在发生。')); list.append(empty); return; }
    news.forEach(item => {
      let source; try { const url = new URL(item.source || item.url); if (url.protocol === 'https:') source = url.href; } catch { }
      const industry = item.group === 'industry' || normalizeNewsCategory(item.category) === '行业洞察';
      const href = source && industry ? source : `/article.html?id=${encodeURIComponent(item.id)}`;
      const row = el('a', 'news-row'); row.href = href; row.target = '_blank'; row.rel = 'noopener noreferrer'; row.setAttribute('aria-label', `${item.title}（在新标签页打开）`);
      const copy = el('div');
      if (item.image) { const thumb = el('img', 'news-thumb'); thumb.src = item.image; thumb.alt = ''; thumb.loading = 'lazy'; copy.append(thumb); }
      copy.append(el('h3', '', item.title), el('p', '', item.summary || ''));
      if (!item.body && !source) copy.append(el('small', 'muted', '文章内容待补充'));
      row.append(el('time', '', item.date || ''), copy, el('span', '', '↗'));
      list.append(row);
    });
  };
  drawFilters(); renderNewsList('');
}

function applyNavigationData(data) {
  const items = asList(data.navigation);
  const home = items.find(item => (item.key || item.id) === 'home' || item.label === '首页') || items[0];
  if (home) {
    const homeLink = nav.querySelector('.nav-link');
    homeLink.textContent = home.label || home.title || '首页';
    homeLink.href = home.href || '#home';
    if (home.target === 'blank' || home.target === '_blank') { homeLink.target = '_blank'; homeLink.rel = 'noopener noreferrer'; }
  }
  const business = { 'supply-chain': 'business-supply', 'online-education': 'business-online', 'education-street': 'business-street', 'youth-center': 'business-youth', 'ai-museum': 'business-ai' };
  const venture = { intro: 'invest-intro', 'venture-intro': 'invest-intro', 'new-year-dinner': 'invest-meal', 'venture-dinner': 'invest-meal', dinner: 'invest-meal' };
  const managedPageUrl = (type, rawValue) => {
    const raw = String(rawValue || '').trim();
    const map = type === 'business' ? business : venture;
    const normalized = pageAliases[raw] || raw;
    const legacy = map[normalized] || normalized;
    const idMap = type === 'business'
      ? { 'business-supply': 'supply-chain', 'business-online': 'online-education', 'business-street': 'education-street', 'business-youth': 'youth-center', 'business-ai': 'ai-museum' }
      : { 'invest-intro': 'intro', 'invest-meal': 'new-year-dinner' };
    const id = idMap[legacy] || legacy.replace(/^(business|invest)-/, '') || safeSlug(raw);
    return `/content-page.html?type=${type}&id=${encodeURIComponent(id)}`;
  };
  const pageUrl = child => {
    const value = child.href || child.url || '';
    const raw = String(child.value || child.slug || child.key || child.id || child.label || '').trim();
    if (child.action === 'business') {
      if (/^\/content-page\.html/i.test(value)) return value;
      return managedPageUrl('business', raw);
    }
    if (child.action === 'venture') {
      if (/^\/content-page\.html/i.test(value)) return value;
      return managedPageUrl('venture', raw);
    }
    return value || `#page-${safeSlug(child.slug || child.key || child.label)}`;
  };
  const navGroups = [...nav.querySelectorAll('[data-nav-group]')];
  items.forEach((item, itemIndex) => {
    const rawKey = item.key || item.id || safeSlug(item.label || item.title);
    const key = ({ 'core-business': 'business', 'group-business': 'business', 'product-service': 'business', 'resource-library': 'courses', 'course-library': 'courses', 'news-information': 'news', 'zhi-lin': 'venture', 'contact-us': 'contact' })[rawKey] || rawKey;
    // Keep edited CMS menus connected to the fixed seven-section shell even
    // when an editor changes both a root ID and its display label.  The CMS
    // documents array order, so index-1 is a safe final fallback (home has no
    // .nav-group element).
    const group = navGroups.find(candidate => candidate.dataset.navKey === key || candidate.querySelector('.nav-parent')?.textContent.trim().startsWith(item.label || item.title || '\u0000')) || (itemIndex > 0 ? navGroups[itemIndex - 1] : null);
    if (!group) return;
    const label = item.label || item.title; if (label) group.querySelector('.nav-parent').firstChild.textContent = label + ' ';
    // 联系我们只保留联系方式入口；旧内容文件中可能仍有历史合作/招聘子项，
    // 前台统一过滤掉，避免升级已有站点时把旧按钮重新显示出来。
    const children = asList(item.children || item.items || item.submenu).filter(child => {
      if (key !== 'contact') return true;
      const value = String(child.value || child.id || child.label || child.title || '').trim().toLowerCase();
      return value === 'info' || value === 'contact-info' || value === '联系方式';
    }); if (!children.length) return;
    const dropdown = group.querySelector('.nav-dropdown'); dropdown.replaceChildren();
    children.forEach(child => {
      const link = el('a', 'nav-sublink', child.label || child.title || child.name || '未命名'); link.href = pageUrl(child);
      if (child.action === 'course-category') { link.href = 'https://kehoubang.cn/profile/upload/pdf/1/index.html'; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      if (child.action === 'news-group') { link.dataset.newsCategory = child.value === 'industry' ? '行业洞察' : child.value === 'group' ? '集团动态' : child.value || child.label; link.href = '#news'; }
      if (child.action === 'contact-topic') { link.dataset.contactTopic = ({ business: '商务合作', teachers: '师资合作', careers: '人才招聘', info: '联系方式' })[child.value] || child.value || child.label; link.href = '#contact'; }
      if (child.id === 'team' || child.key === 'team' || child.value === 'team' || link.hash === '#team') link.dataset.teamLink = 'true';
      // Business and venture entries are managed pages.  Open them in a new
      // tab even when older content records did not store target="blank".
      const managedPage = child.action === 'business' || child.action === 'venture' || /^\/content-page\.html\?type=(business|venture)/i.test(link.href);
      if (managedPage) link.dataset.managedPage = 'true';
      if (managedPage || child.target === 'blank' || child.target === '_blank' || child.external || /^https?:/.test(link.href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      dropdown.append(link);
    });
  });
}
window.selectContactTopic = topic => { const heading = $('#contact-topic'); if (heading) heading.textContent = topic; };

async function init() {
  try {
    const response = await fetch('/api/content'); if (!response.ok) throw Error();
    const data = await response.json(); const site = data.site || {};
    document.title = `${site.name || '课后邦'}｜${site.tagline || '素质教育 · 课后服务'}`;
    $('.brand b').textContent = site.name || '课后邦'; $('#headline').textContent = site.headline || ''; $('#intro').textContent = site.intro || ''; $('#about-copy').textContent = site.about || '';
    $('#copyright').textContent = `© ${new Date().getFullYear()} ${site.name || '课后邦'} 版权所有`; $('#filing').textContent = site.filing || '';
    applyNavigationData(data); renderManagedPages(data);
    let teamExpanded = false; const teamToggle = el('button', 'team-toggle'); teamToggle.type = 'button'; teamToggle.setAttribute('aria-controls', 'team-grid'); $('#team-grid').after(teamToggle);
    const updateTeamVisibility = () => { const cards = [...$('#team-grid').children]; const columns = Math.max(1, getComputedStyle($('#team-grid')).gridTemplateColumns.split(' ').length); cards.forEach((card, index) => { card.hidden = !teamExpanded && index >= columns; }); teamToggle.hidden = cards.length <= columns; teamToggle.textContent = teamExpanded ? '收起团队 ↑' : `展开更多团队（${Math.max(0, cards.length - columns)}） ↓`; teamToggle.setAttribute('aria-expanded', String(teamExpanded)); };
    teamToggle.onclick = () => { teamExpanded = !teamExpanded; updateTeamVisibility(); }; new ResizeObserver(updateTeamVisibility).observe($('#team-grid'));
    const renderTeam = category => { teamExpanded = false; $('#team-grid').replaceChildren(); asList(data.team).filter(person => category === '全部团队' || person.category === category).forEach(person => { const card = el('button', 'person'); const portrait = el('div', 'portrait'); const image = el('img'); image.src = person.image; image.alt = person.name; image.loading = 'lazy'; portrait.append(image); card.append(portrait, el('h3', '', person.name), el('p', '', person.role)); card.onclick = () => detail([image.cloneNode(), el('h2', '', person.name), el('div', 'eyebrow', person.role), el('p', '', person.bio)]); $('#team-grid').append(card); }); document.querySelectorAll('#team-filters button').forEach(button => { const active = button.textContent === category; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); }); updateTeamVisibility(); };
    ['全部团队', ...new Set(asList(data.team).map(person => person.category).filter(Boolean))].forEach(category => { const button = el('button', '', category); button.type = 'button'; button.onclick = () => renderTeam(category); $('#team-filters').append(button); }); renderTeam('全部团队');
    renderNews(data);
    const contact = $('#contact-info'); contact.append(el('div', 'contact-info-label', '期待与您携手，共建优质教育服务'));
    // 兼容旧数据中的商务合作、师资合作和人才招聘记录，但官网只展示联系方式。
    const infoRecord = asList(data.contactTopics).find(item => {
      if (typeof item === 'string') return item === '联系方式';
      const value = String(item.id || item.key || item.label || item.title || item.name || '').trim().toLowerCase();
      return value === 'info' || value === 'contact-info' || value === '联系方式';
    });
    const infoTopic = typeof infoRecord === 'string' ? infoRecord : infoRecord?.label || infoRecord?.title || infoRecord?.name || '联系方式';
    const topicList = el('div', 'contact-topics'); const button = el('button', '', infoTopic); button.type = 'button'; button.onclick = () => window.selectContactTopic(infoTopic); topicList.append(button); contact.append(topicList);
    const topicHeading = el('strong', '', '合作咨询'); topicHeading.id = 'contact-topic'; contact.append(topicHeading);
    if (site.phone) { const phone = el('a', 'contact-line', site.phone); phone.href = 'tel:' + site.phone.replace(/[^+\d-]/g, ''); contact.append(phone); }
    if (site.email) { const email = el('a', 'contact-line', site.email); email.href = 'mailto:' + site.email; contact.append(email); }
    if (site.address) contact.append(el('p', '', site.address));
    if (!site.phone && !site.email) contact.append(el('p', 'contact-placeholder', '合作联系方式即将公布，感谢您的关注。'));
  } catch { $('#error').textContent = '网站内容暂时无法加载，请刷新页面重试。'; $('#error').hidden = false; }
}
init();
