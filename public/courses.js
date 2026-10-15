window.renderCourses = (courses, showDetail, options = {}) => {
  const root = document.getElementById('course-catalog');
  const make = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const aliases = { '劳动类': '手工类', '手工': '手工类' };
  const canonical = value => aliases[value] || value;
  const suppliedCategories = Array.isArray(options.categories) ? options.categories.map(item => typeof item === 'string' ? item : item.label || item.name || item.title).filter(Boolean) : [];
  const categoryOrder = ['美育类', '益智类', '科技类', '手工类'];
  const categories = [...new Set([...categoryOrder, ...suppliedCategories.map(canonical), ...courses.map(course => canonical(course.category)).filter(Boolean)])];
  if (!courses.length) { root.hidden = true; window.selectCourseCategory = () => {}; return; }
  const images = { '美育类': 'aesthetic', '益智类': 'puzzle', '科技类': 'technology', '手工类': 'labor', '劳动类': 'labor' };
  const descriptions = { '美育类': '在表达、阅读与艺术创作中，发现兴趣，感受美。', '益智类': '在游戏、推理与对弈中，练习观察，探索思考的方法。', '科技类': '从科学实验到人工智能，在动手探索中认识科技。', '手工类': '在生活实践、手工创作与非遗体验中，感受劳动的价值。' };
  let selected = categories.find(category => courses.some(course => canonical(course.category) === category)) || categories[0];
  let expanded = false;
  const mobile = window.matchMedia('(max-width: 600px)');
  const filters = make('div', 'filters course-filters'); filters.setAttribute('aria-label', '课程分类');
  const banner = make('div', 'course-banner');
  const grid = make('div', 'course-grid'); grid.id = 'course-grid';
  const toggle = make('button', 'team-toggle'); toggle.type = 'button'; toggle.setAttribute('aria-controls', 'course-grid');
  const count = make('p', 'course-count'); count.setAttribute('role', 'status');
  const footer = make('div', 'course-footer'); footer.append(make('p', 'muted', '点击课程详情，即可了解课程介绍与学习内容。'));
  const normalizeImage = value => typeof value === 'string' && value ? value : '';
  function render() {
    const matches = courses.filter(course => canonical(course.category) === selected);
    const previewCount = mobile.matches ? 3 : 6;
    filters.querySelectorAll('button').forEach(button => { const active = button.dataset.category === selected; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
    banner.replaceChildren();
    if (images[selected]) { const image = make('img', 'course-banner-image'); image.src = `/assets/course-${images[selected]}.webp`; image.alt = `${selected}课程配图`; image.loading = 'lazy'; banner.append(image); }
    const copy = make('div', 'course-banner-copy'); copy.append(make('div', 'eyebrow', 'COURSE COLLECTION / 课程资源'), make('h3', '', selected), make('p', '', descriptions[selected] || '探索多样化课程，发现更多兴趣与可能。')); banner.append(copy);
    grid.replaceChildren();
    matches.slice(0, expanded ? matches.length : previewCount).forEach(course => {
      const card = make('article', 'course-card');
      const longImage = normalizeImage(course.longImage || course.image || course.cover);
      if (longImage) { const thumb = make('img', 'course-thumb'); thumb.src = longImage; thumb.alt = course.title || ''; thumb.loading = 'lazy'; card.append(thumb); }
      card.append(make('h4', '', course.title), make('p', '', course.summary || ''));
      const button = make('button', 'text-link course-detail-button', '查看课程详情 →'); button.type = 'button'; button.setAttribute('aria-label', `查看${course.title}课程详情`);
      button.onclick = () => {
        const title = make('h2', '', course.title); title.id = 'course-dialog-title';
        const nodes = [make('div', 'eyebrow', canonical(course.category) + ' / 课程介绍'), title];
        if (longImage) { const image = make('img', 'course-long-image'); image.src = longImage; image.alt = course.title || ''; nodes.push(image); }
        nodes.push(make('p', 'course-description', course.description || course.summary || ''));
        const outline = String(course.outline || '').split('\n').map(line => line.trim()).filter(Boolean);
        if (outline.length) { const list = make('ul', 'course-outline'); outline.forEach(line => list.append(make('li', '', line))); nodes.push(make('h3', 'course-detail-heading', '学习内容'), list); }
        showDetail(nodes);
      };
      card.append(button); grid.append(card);
    });
    count.textContent = `${selected} · 共 ${matches.length} 门课程`;
    toggle.hidden = matches.length <= previewCount; toggle.textContent = expanded ? '收起课程 ↑' : `展开全部 ${matches.length} 门课程 ↓`; toggle.setAttribute('aria-expanded', String(expanded));
  }
  window.selectCourseCategory = category => {
    const target = canonical(category);
    if (!categories.includes(target)) return;
    selected = target; expanded = false; render();
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  categories.forEach(category => { const button = make('button', '', category); button.type = 'button'; button.dataset.category = category; button.onclick = () => window.selectCourseCategory(category); filters.append(button); });
  toggle.onclick = () => { expanded = !expanded; render(); };
  mobile.addEventListener('change', render);
  root.hidden = false; root.replaceChildren(filters, banner, count, grid, toggle, footer); render();
};
