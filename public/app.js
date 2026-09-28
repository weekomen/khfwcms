const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const dialog = $('#detail');
function detail(nodes) { $('#detail-content').replaceChildren(...nodes); const heading = $('#detail-content').querySelector('h2'); if (heading) { heading.id = 'detail-title'; dialog.setAttribute('aria-labelledby', 'detail-title'); } dialog.showModal(); dialog.scrollTop = 0; document.body.classList.add('modal-open'); }
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
$('.dialog-close').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
$('.menu-toggle').onclick = () => { const open = $('#nav').classList.toggle('open'); $('.menu-toggle').setAttribute('aria-expanded', String(open)); };
document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => { $('#nav').classList.remove('open'); $('.menu-toggle').setAttribute('aria-expanded', 'false'); }));
const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) document.querySelectorAll('nav a').forEach(a => { const active = a.hash === '#' + entry.target.id; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }); }, { rootMargin: '-20% 0px -55% 0px' });
document.querySelectorAll('main section[id]').forEach(s => observer.observe(s));
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
  const img = el('img', 'platform-qr'); img.src = platform.image; img.alt = `${platform.name}二维码`; img.loading = 'lazy';
  button.append(img, el('strong', '', platform.name), el('span', '', platform.note), el('small', '', '点击放大扫码'));
  button.onclick = () => { const large = el('img', 'qr-large'); large.src = platform.image; large.alt = `${platform.name}二维码原图`; detail([el('h2', '', platform.name), el('p', '', platform.note), large]); };
  $('#platform-grid').append(button);
});
async function init() {
  try {
    const response = await fetch('/api/content'); if (!response.ok) throw Error(); const data = await response.json(); const { site } = data;
    document.title = `${site.name}｜${site.tagline}`; $('.brand b').textContent = site.name;
    $('#headline').textContent = site.headline; $('#intro').textContent = site.intro; $('#about-copy').textContent = site.about;
    $('#copyright').textContent = `© ${new Date().getFullYear()} ${site.name} 版权所有`; $('#filing').textContent = site.filing;
    window.renderCourses(data.courses || [], detail);
    data.services.forEach((s, i) => {
      const card = el('article', 'service-card'); const number = el('div', 'service-number', '0' + (i + 1) + ' / SERVICE'); number.append(el('span', 'service-symbol', ['▦', '◎', '⌘', '↗'][i % 4]));
      const button = el('button', '', '了解更多'); button.append(el('span', '', '↗')); button.setAttribute('aria-label', `了解${s.title}`);
      button.onclick = () => { const ul = el('ul'); s.features.forEach(f => ul.append(el('li', '', f))); detail([el('div', 'eyebrow', s.category), el('h2', '', s.title), el('p', '', s.description), ul]); };
      card.append(number, el('h3', '', s.title), el('p', '', s.subtitle), button); $('#service-grid').append(card);
    });
    let teamExpanded = false;
    const teamToggle = el('button', 'team-toggle'); teamToggle.type = 'button';
    teamToggle.setAttribute('aria-controls', 'team-grid');
    $('#team-grid').after(teamToggle);
    const updateTeamVisibility = () => {
      const cards = [...$('#team-grid').children];
      const columns = getComputedStyle($('#team-grid')).gridTemplateColumns.split(' ').length;
      cards.forEach((card, i) => { card.hidden = !teamExpanded && i >= columns; });
      teamToggle.hidden = cards.length <= columns;
      teamToggle.textContent = teamExpanded ? '收起团队 ↑' : `展开更多团队（${cards.length - columns}） ↓`;
      teamToggle.setAttribute('aria-expanded', String(teamExpanded));
    };
    teamToggle.onclick = () => { teamExpanded = !teamExpanded; updateTeamVisibility(); };
    new ResizeObserver(updateTeamVisibility).observe($('#team-grid'));
    const renderTeam = category => {
      teamExpanded = false;
      $('#team-grid').replaceChildren();
      data.team.filter(t => category === '全部团队' || t.category === category).forEach(t => {
        const card = el('button', 'person'); const portrait = el('div', 'portrait'); const img = el('img'); img.src = t.image; img.alt = t.name; img.loading = 'lazy'; portrait.append(img);
        const title = el('h3', '', t.name); title.append(el('span', '', '↗')); card.append(portrait, title, el('p', '', t.role));
        card.onclick = () => { const photo = img.cloneNode(); photo.className = 'detail-photo'; detail([photo, el('h2', '', t.name), el('div', 'eyebrow', t.role), el('p', '', t.bio)]); }; $('#team-grid').append(card);
      });
      document.querySelectorAll('.filters button').forEach(b => { b.classList.toggle('selected', b.textContent === category); b.setAttribute('aria-pressed', String(b.textContent === category)); });
      updateTeamVisibility();
    };
    ['全部团队', ...new Set(data.team.map(t => t.category))].forEach(c => { const b = el('button', '', c); b.onclick = () => renderTeam(c); $('#team-filters').append(b); }); renderTeam('全部团队');
    if (!data.news.length) {
      const empty = el('div', 'news-empty'); const copy = el('div'); copy.append(el('h3', '', '更多故事，正在发生'), el('p', '', '公司动态与项目资讯将在这里持续更新。')); empty.append(el('span', '', '↗'), copy); $('#news-list').append(empty);
    }
    data.news.sort((a, b) => b.date.localeCompare(a.date)).forEach(n => {
      let source; try { const url = new URL(n.source); if (url.protocol === 'https:') source = url.href; } catch { }
      const row = el(source ? 'a' : 'article', 'news-row');
      if (source) { row.href = source; row.target = '_blank'; row.rel = 'noopener noreferrer'; row.setAttribute('aria-label', `${n.title}（在新标签页打开）`); }
      const copy = el('div'); copy.append(el('h3', '', n.title), el('p', '', n.summary));
      if (!source) copy.append(el('small', 'muted', '文章链接待补充'));
      row.append(el('time', '', n.date), copy, el('span', '', source ? '↗' : '')); $('#news-list').append(row);
    });
    const contact = $('#contact-info'); contact.append(el('div', 'contact-info-label', '期待与您携手，共建优质教育服务'));
    if (site.phone) { const phone = el('a', 'contact-line', site.phone); phone.href = 'tel:' + site.phone.replace(/[^+\d-]/g, ''); contact.append(phone); }
    if (site.email) { const email = el('a', 'contact-line', site.email); email.href = 'mailto:' + site.email; contact.append(email); }
    if (site.address) contact.append(el('p', '', site.address));
    if (!site.phone && !site.email) contact.append(el('p', 'contact-placeholder', '合作联系方式即将公布，感谢您的关注。'));
  } catch { $('#error').textContent = '网站内容暂时无法加载，请刷新页面重试。'; $('#error').hidden = false; }
}
init();
