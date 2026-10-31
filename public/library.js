(() => {
  const $ = selector => document.querySelector(selector);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const list = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
  const view = document.body.dataset.library;
  const dialog = $('#detail');
  let opener;
  function detail(nodes) {
    opener = document.activeElement;
    $('#detail-content').replaceChildren(...nodes);
    const heading = $('#detail-content h2');
    if (heading) { heading.id = 'library-detail-title'; dialog.setAttribute('aria-labelledby', heading.id); }
    dialog.showModal(); dialog.scrollTop = 0; document.body.classList.add('modal-open');
    dialog.querySelector('.dialog-close').focus();
  }
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  function showPerson(person) {
    const nodes = [];
    if (person.image) { const image = make('img', 'team-detail-image'); image.src = person.image; image.alt = person.name || '团队成员'; nodes.push(image); }
    nodes.push(make('h2', '', person.name || '团队成员'), make('div', 'eyebrow', person.role || ''));
    const bio = make('div', 'team-detail-bio');
    String(person.bio || '').split(/\n\s*\n|\n/).map(text => text.trim()).filter(Boolean).forEach(text => bio.append(make('p', '', text)));
    if (bio.children.length) nodes.push(bio);
    detail(nodes);
  }
  function renderTeam(team) {
    const people = list(team), filters = $('#team-filters'), grid = $('#team-grid');
    const categories = ['全部团队', ...new Set(people.map(person => person.category).filter(Boolean))];
    const draw = category => {
      grid.replaceChildren();
      const matching = people.filter(person => category === '全部团队' || person.category === category);
      matching.forEach(person => {
        const card = make('button', 'person'); card.type = 'button'; card.setAttribute('aria-label', `查看${person.name || '成员'}团队介绍`);
        const portrait = make('div', 'portrait'), image = make('img'); image.src = person.image || '/assets/logo.png'; image.alt = person.name || ''; image.loading = 'lazy'; image.decoding = 'async'; portrait.append(image);
        card.append(portrait, make('h3', '', person.name || '团队成员'), make('p', '', person.role || ''));
        card.addEventListener('click', () => showPerson(person)); grid.append(card);
      });
      filters.querySelectorAll('button').forEach(button => { const active = button.textContent === category; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
      $('#team-count').textContent = matching.length ? `${category} · ${matching.length} 位成员` : '该分类暂无成员';
    };
    categories.forEach(category => { const button = make('button', '', category); button.type = 'button'; button.setAttribute('aria-pressed', 'false'); button.addEventListener('click', () => draw(category)); filters.append(button); });
    draw('全部团队');
    return people.length;
  }
  async function init() {
    const response = await fetch('/api/content'); if (!response.ok) throw new Error();
    const data = await response.json(), name = data.site?.name || '课后邦';
    document.title = `${name}｜${view === 'courses' ? '课程资源库' : '核心团队'}`;
    document.querySelector('.brand b').textContent = name;
    document.querySelectorAll('[data-library-brand]').forEach(node => { node.textContent = name; });
    document.querySelectorAll('[data-library-year]').forEach(node => { node.textContent = String(new Date().getFullYear()); });
    if (view === 'courses') {
      const courses = list(data.courses);
      window.renderCourses(courses, detail, { categories: list(data.courseCategories) });
      if (!courses.length) { $('#library-status').textContent = '课程内容正在整理，欢迎稍后查看。'; return; }
      const category = new URLSearchParams(location.search).get('category');
      if (category) window.selectCourseCategory(category);
    } else if (!renderTeam(data.team)) {
      $('#library-status').textContent = '团队资料正在整理，欢迎稍后查看。'; return;
    }
    $('#library-status').hidden = true;
  }
  init().catch(() => { const status = $('#library-status'); status.textContent = '内容暂时无法加载，请刷新页面重试。'; status.classList.add('error'); status.setAttribute('role', 'alert'); status.hidden = false; });
})();
