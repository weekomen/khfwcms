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
  if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }
});

const closeNav = () => { $('#nav').classList.remove('open'); $('.menu-toggle').setAttribute('aria-expanded', 'false'); document.querySelectorAll('.nav-menu.open').forEach(menu => menu.classList.remove('open')); };
$('.menu-toggle').onclick = () => { const open = $('#nav').classList.toggle('open'); $('.menu-toggle').setAttribute('aria-expanded', String(open)); };

function safeTarget(item) { return item.target === 'blank' ? '_blank' : ''; }
function addLinkAttributes(link, item) {
  link.href = typeof item.href === 'string' && item.href ? item.href : '#';
  const target = safeTarget(item);
  if (target) { link.target = target; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `${item.label}（新标签页打开）`); }
  if (item.action) link.dataset.action = item.action;
  if (item.value) link.dataset.value = item.value;
  return link;
}
function renderNavigation(navigation) {
  const nav = $('#nav'); nav.replaceChildren();
  (Array.isArray(navigation) ? navigation : []).slice(0, 7).forEach((item, index) => {
    const children = Array.isArray(item.children) ? item.children : [];
    if (!children.length) {
      const link = addLinkAttributes(el('a', index === 0 ? 'active' : '', item.label || '未命名栏目'), item);
      link.dataset.navRoot = item.id || ''; nav.append(link); return;
    }
    const menu = el('div', 'nav-menu'); menu.dataset.menuId = item.id || '';
    const trigger = addLinkAttributes(el('a', 'nav-menu-trigger', item.label || '未命名栏目'), item);
    trigger.dataset.navRoot = item.id || ''; trigger.setAttribute('aria-haspopup', 'true'); trigger.setAttribute('aria-expanded', 'false');
    const menuId = `submenu-${item.id || index}`; trigger.setAttribute('aria-controls', menuId);
    const submenu = el('div', 'nav-submenu'); submenu.id = menuId; submenu.setAttribute('aria-label', `${item.label || ''}下拉菜单`);
    children.forEach(child => { const link = addLinkAttributes(el('a', 'nav-submenu-link', child.label || '未命名项目'), child); submenu.append(link); });
    menu.append(trigger, submenu); nav.append(menu);
  });
  bindNavigationEvents();
}
function bindNavigationEvents() {
  const mobile = () => window.matchMedia('(max-width: 1200px)').matches;
  document.querySelectorAll('#nav .nav-menu-trigger').forEach(trigger => trigger.addEventListener('click', event => {
    if (!mobile()) return;
    event.preventDefault();
    const menu = trigger.closest('.nav-menu'); const open = menu.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(open));
  }));
  document.querySelectorAll('#nav a:not(.nav-menu-trigger)').forEach(link => link.addEventListener('click', event => {
    const action = link.dataset.action;
    if (action === 'course-category') { event.preventDefault(); window.selectCourseCategory?.(link.dataset.value || link.textContent); }
    if (action === 'news-group') { event.preventDefault(); window.selectNewsGroup?.(link.dataset.value || (link.textContent.includes('行业') ? 'industry' : 'group')); }
    if (action === 'contact-topic') { event.preventDefault(); window.selectContactTopic?.(link.dataset.value || link.textContent); }
    closeNav();
  }));
}
const sectionObserver = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) document.querySelectorAll('#nav [data-nav-root]').forEach(link => {
    const active = link.hash === '#' + entry.target.id;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
}, { rootMargin: '-20% 0px -55% 0px' });
document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));

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

function fallbackData(data) {
  const defaults = window.cloneKHBDefaults?.() || {};
  for (const key of ['navigation', 'businessPages', 'courseCategories', 'venturePages', 'contactTopics']) if (data[key] === undefined) data[key] = defaults[key] || [];
  data.services ||= []; data.courses ||= []; data.team ||= []; data.news ||= [];
  return data;
}
function newsGroup(article) {
  if (article.group === 'industry') return 'industry';
  if (article.group === 'group') return 'group';
  return /行业|政策|AI|人工智能|课后服务/.test(`${article.category || ''}${article.title || ''}${article.summary || ''}`) ? 'industry' : 'group';
}
function renderContactTopics(data) {
  const root = $('#contact-topics'); root.replaceChildren();
  (data.contactTopics || []).forEach(topic => {
    const card = el('article', 'contact-topic'); card.id = `contact-${topic.id}`; card.tabIndex = -1;
    card.append(el('h3', '', topic.title), el('p', '', topic.description)); root.append(card);
  });
  window.selectContactTopic = value => {
    const topic = (data.contactTopics || []).find(item => item.id === value || item.title === value || item.title.includes(value));
    document.querySelector('#contact').scrollIntoView({ behavior: 'smooth' });
    if (topic) setTimeout(() => document.getElementById(`contact-${topic.id}`)?.focus({ preventScroll: true }), 350);
  };
}
function renderNews(data) {
  const list = $('#news-list'); let selected = 'all';
  const draw = () => {
    list.replaceChildren();
    const filter = selected === 'all' ? data.news : data.news.filter(article => newsGroup(article) === selected);
    if (!filter.length) { const empty = el('div', 'news-empty'); empty.append(el('span', '', '↗'), el('div', '', selected === 'industry' ? '行业洞察内容正在整理' : '更多集团动态，正在发生')); list.append(empty); return; }
    [...filter].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).forEach(article => {
      const row = el('a', 'news-row'); row.href = `/article.html?id=${encodeURIComponent(article.id)}`; row.target = '_blank'; row.rel = 'noopener noreferrer'; row.setAttribute('aria-label', `${article.title}（在新标签页打开）`);
      const copy = el('div'); copy.append(el('h3', '', article.title), el('p', '', article.summary || ''));
      row.append(el('time', '', article.date || ''), copy, el('span', '', '↗')); list.append(row);
    });
  };
  window.selectNewsGroup = value => { selected = ['group', 'industry'].includes(value) ? value : 'all'; draw(); document.querySelector('#news').scrollIntoView({ behavior: 'smooth' }); };
  draw();
}
async function init() {
  try {
    const response = await fetch('/api/content'); if (!response.ok) throw Error(); const data = fallbackData(await response.json()); const { site } = data;
    renderNavigation(data.navigation);
    document.title = `${site.name}｜${site.tagline}`; $('.brand b').textContent = site.name;
    $('#headline').textContent = site.headline; $('#intro').textContent = site.intro; $('#about-copy').textContent = site.about;
    $('#copyright').textContent = `© ${new Date().getFullYear()} ${site.name} 版权所有`; $('#filing').textContent = site.filing;
    window.renderCourses(data.courses, detail, data.courseCategories);
    data.services.forEach((service, index) => {
      const card = el('article', 'service-card'); const number = el('div', 'service-number', `0${index + 1} / SERVICE`); number.append(el('span', 'service-symbol', ['▦', '◎', '⌘', '↗'][index % 4]));
      const features = el('ul', 'service-features'); features.setAttribute('aria-label', `${service.title}支持内容`); (service.features || []).forEach(feature => features.append(el('li', '', feature)));
      card.append(number, el('h3', '', service.title), el('p', 'service-subtitle', service.subtitle), el('p', 'service-description', service.description), features); $('#service-grid').append(card);
    });
    let teamExpanded = false;
    const teamToggle = el('button', 'team-toggle'); teamToggle.type = 'button'; teamToggle.setAttribute('aria-controls', 'team-grid'); $('#team-grid').after(teamToggle);
    const updateTeamVisibility = () => { const cards = [...$('#team-grid').children]; const columns = Math.max(1, getComputedStyle($('#team-grid')).gridTemplateColumns.split(' ').length); cards.forEach((card, index) => { card.hidden = !teamExpanded && index >= columns; }); teamToggle.hidden = cards.length <= columns; teamToggle.textContent = teamExpanded ? '收起团队 ↑' : `展开更多团队（${Math.max(0, cards.length - columns)}） ↓`; teamToggle.setAttribute('aria-expanded', String(teamExpanded)); };
    teamToggle.onclick = () => { teamExpanded = !teamExpanded; updateTeamVisibility(); }; new ResizeObserver(updateTeamVisibility).observe($('#team-grid'));
    const renderTeam = category => { teamExpanded = false; $('#team-grid').replaceChildren(); data.team.filter(member => category === '全部团队' || member.category === category).forEach(member => { const card = el('button', 'person'); const portrait = el('div', 'portrait'); const image = el('img'); image.src = member.image; image.alt = member.name; image.loading = 'lazy'; portrait.append(image); const title = el('h3', '', member.name); title.append(el('span', '', '↗')); card.append(portrait, title, el('p', '', member.role)); card.onclick = () => { const photo = image.cloneNode(); photo.className = 'detail-photo'; detail([photo, el('h2', '', member.name), el('div', 'eyebrow', member.role), el('p', '', member.bio)]); }; $('#team-grid').append(card); }); document.querySelectorAll('#team-filters button').forEach(button => { const selected = button.textContent === category; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }); updateTeamVisibility(); };
    ['全部团队', ...new Set(data.team.map(member => member.category))].forEach(category => { const button = el('button', '', category); button.onclick = () => renderTeam(category); $('#team-filters').append(button); }); renderTeam('全部团队');
    renderNews(data); renderContactTopics(data);
    const contact = $('#contact-info'); contact.append(el('div', 'contact-info-label', '期待与您携手，共建优质教育服务'));
    if (site.phone) { const phone = el('a', 'contact-line', site.phone); phone.href = 'tel:' + site.phone.replace(/[^+\d-]/g, ''); contact.append(phone); }
    if (site.email) { const email = el('a', 'contact-line', site.email); email.href = 'mailto:' + site.email; contact.append(email); }
    if (site.address) contact.append(el('p', '', site.address));
    if (!site.phone && !site.email) contact.append(el('p', 'contact-placeholder', '合作联系方式即将公布，感谢您的关注。'));
  } catch { $('#error').textContent = '网站内容暂时无法加载，请刷新页面重试。'; $('#error').hidden = false; }
}
init();
