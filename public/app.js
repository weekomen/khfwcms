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
  nav.querySelectorAll('.nav-group').forEach(group => { group.classList.remove('open'); group.classList.add('nav-dismissed'); });
};
nav.querySelectorAll('[data-nav-group]').forEach(group => {
  group.addEventListener('mouseenter', () => group.classList.remove('nav-dismissed'));
  group.querySelector('[data-nav-parent]').addEventListener('focus', () => group.classList.remove('nav-dismissed'));
});
menuToggle.onclick = () => {
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
};
nav.querySelectorAll('[data-nav-parent]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  const group = button.closest('[data-nav-group]');
  group.classList.remove('nav-dismissed');
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
  const newsCategory = link.dataset.newsCategory;
  if (newsCategory && window.selectNewsCategory) { event.preventDefault(); window.selectNewsCategory(newsCategory); }
  const schoolBusiness = { '#after-school-supply': 'supply-chain', '#ai-school-supply': 'ai-school-supply' }[link.hash];
  if (schoolBusiness) window.selectHomeBusiness?.(schoolBusiness);
  closeNav();
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
const pageAliases = {
  '课后邦供应链': 'business-supply', '线上素质教育': 'business-online', '教育一条街': 'business-street',
  '青少年成长中心': 'business-youth', '人工智能科技馆': 'business-ai', '简介': 'invest-intro', '智邻创投简介': 'invest-intro', '书院世家年夜饭': 'invest-meal'
};

function normalizeNewsCategory(value) {
  return ({ '公司动态': '集团动态', '企业动态': '集团动态', '行业资讯': '行业洞察', '政策解读': '行业洞察' })[value] || value;
}
const FIXED_NEWS_MENU = [
  { id: 'group-news', label: '集团动态', href: '#news', action: 'news-group', value: 'group' },
  { id: 'industry-news', label: '行业洞察', href: '#news', action: 'news-group', value: 'industry' }
];
const newsCategoryOf = item => item.group === 'industry' ? '行业洞察' : item.group === 'group' ? '集团动态' : normalizeNewsCategory(item.category) === '行业洞察' ? '行业洞察' : '集团动态';
let renderNewsList = () => {};
window.selectNewsCategory = category => renderNewsList(normalizeNewsCategory(category));

function renderNews(data) {
  const list = $('#news-list'); const filter = $('#news-filters');
  const available = FIXED_NEWS_MENU.map(item => item.label);
  let selected = '';
  const drawFilters = () => {
    filter.replaceChildren();
    ['全部资讯', ...available].forEach(category => { const button = el('button', '', category); button.type = 'button'; button.classList.toggle('selected', (!selected && category === '全部资讯') || selected === category); button.setAttribute('aria-pressed', String((!selected && category === '全部资讯') || selected === category)); button.onclick = () => { selected = category === '全部资讯' ? '' : category; renderNewsList(selected); }; filter.append(button); });
  };
  renderNewsList = category => {
    selected = normalizeNewsCategory(category || ''); drawFilters(); list.replaceChildren();
    const news = asList(data.news).filter(item => !selected || newsCategoryOf(item) === selected).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!news.length) { const empty = el('div', 'news-empty'); empty.append(el('span', '', '↗'), el('div', '', '暂无该分类资讯，新的故事正在发生。')); list.append(empty); return; }
    news.forEach(item => {
      let source; try { const url = new URL(item.source || item.url); if (url.protocol === 'https:') source = url.href; } catch { }
      const href = source || `/article.html?id=${encodeURIComponent(item.id)}`;
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
    return type === 'business' ? window.homeBusinessDestination(id) : `/content-page.html?type=${type}&id=${encodeURIComponent(id)}`;
  };
  const pageUrl = child => {
    const value = child.href || child.url || '';
    const raw = String(child.value || child.slug || child.key || child.id || child.label || '').trim();
    if (child.action === 'business') {
      const pageId = /^\/content-page\.html/i.test(value) ? new URL(value, location.origin).searchParams.get('id') : raw;
      return managedPageUrl('business', pageId || raw);
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
    const children = (key === 'news' ? FIXED_NEWS_MENU : asList(item.children || item.items || item.submenu)).filter(child => {
      if (key !== 'contact') return true;
      const value = String(child.value || child.id || child.label || child.title || '').trim().toLowerCase();
      return value === 'info' || value === 'contact-info' || value === '联系方式';
    }); if (!children.length) return;
    const dropdown = group.querySelector('.nav-dropdown'); dropdown.replaceChildren();
    children.forEach(child => {
      const link = el('a', 'nav-sublink', child.label || child.title || child.name || '未命名'); link.href = pageUrl(child);
      if (child.action === 'course-category') { link.href = `/courses.html?category=${encodeURIComponent(child.value || child.label)}`; link.dataset.libraryPage = 'true'; }
      if (child.action === 'news-group') { link.dataset.newsCategory = child.value === 'industry' ? '行业洞察' : child.value === 'group' ? '集团动态' : child.value || child.label; link.href = '#news'; }
      if (key === 'contact' || child.action === 'contact-topic') link.href = '#contact';
      if (child.id === 'team' || child.key === 'team' || child.value === 'team' || link.hash === '#team') { link.href = '/team.html'; link.dataset.libraryPage = 'true'; }
      const inPage = link.getAttribute('href').startsWith('#');
      const managedPage = key !== 'contact' && !inPage && (child.action === 'business' || child.action === 'venture' || /^\/content-page\.html\?type=(business|venture)/i.test(link.getAttribute('href')));
      if (managedPage) link.dataset.managedPage = 'true';
      if (key !== 'contact' && !inPage && (managedPage || link.dataset.libraryPage || child.target === 'blank' || child.target === '_blank' || child.external || /^https?:/.test(link.getAttribute('href')))) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      dropdown.append(link);
    });
  });
}
async function init() {
  try {
    const response = await fetch('/api/content'); if (!response.ok) throw Error();
    const data = await response.json(); const site = data.site || {};
    document.title = `${site.name || '课后邦'}｜${site.tagline || '素质教育 · 课后服务'}`;
    $('.brand b').textContent = site.name || '课后邦'; $('#headline').textContent = site.headline || ''; $('#intro').textContent = site.intro || '';
    $('#copyright').textContent = `© ${new Date().getFullYear()} ${site.name || '课后邦'} 版权所有`; $('#filing').textContent = site.filing || '';
    window.renderHomeBusiness(data); applyNavigationData(data);
    renderNews(data);
    const contact = $('#contact-info'); contact.append(el('div', 'contact-info-label', '期待与您携手，共建优质教育服务'));
    if (site.phone) { const phone = el('a', 'contact-line', site.phone); phone.href = 'tel:' + site.phone.replace(/[^+\d-]/g, ''); contact.append(phone); }
    if (site.email) { const email = el('a', 'contact-line', site.email); email.href = 'mailto:' + site.email; contact.append(email); }
    if (site.address) contact.append(el('p', '', site.address));
    if (!site.phone && !site.email) contact.append(el('p', 'contact-placeholder', '合作联系方式即将公布，感谢您的关注。'));
  } catch { $('#error').textContent = '网站内容暂时无法加载，请刷新页面重试。'; $('#error').hidden = false; }
}
init();
