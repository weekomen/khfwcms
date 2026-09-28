window.renderCourses = courses => {
  const root = document.getElementById('course-catalog');
  if (!courses.length) { root.hidden = true; return; }
  const make = (tag, cls, text) => { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const categories = [...new Set(courses.map(c => c.category))];
  const images = { '美育类': 'aesthetic', '益智类': 'puzzle', '科技类': 'technology', '劳动类': 'labor' };
  const descriptions = { '美育类': '在表达、阅读与艺术创作中，发现兴趣，感受美。', '益智类': '在游戏、推理与对弈中，练习观察，探索思考的方法。', '科技类': '从科学实验到人工智能，在动手探索中认识科技。', '劳动类': '在生活实践、手工创作与非遗体验中，感受劳动的价值。' };
  let selected = categories[0], expanded = false;
  const filters = make('div', 'filters course-filters'); filters.setAttribute('aria-label', '课程分类');
  const banner = make('div', 'course-banner');
  const grid = make('div', 'course-grid'); grid.id = 'course-grid';
  const toggle = make('button', 'team-toggle'); toggle.type = 'button'; toggle.setAttribute('aria-controls', 'course-grid');
  const count = make('p', 'course-count'); count.setAttribute('role', 'status');
  const footer = make('div', 'course-footer'); const manual = make('a', 'text-link', '查看完整课程手册 ↗'); manual.href = '/assets/course-manual.pdf'; manual.target = '_blank'; manual.rel = 'noopener noreferrer';
  footer.append(make('p', 'muted', '具体适用年级、课时及开课要求，请参阅课程手册。'), manual);
  function render() {
    const matches = courses.filter(c => c.category === selected);
    filters.querySelectorAll('button').forEach(b => { b.classList.toggle('selected', b.dataset.category === selected); b.setAttribute('aria-pressed', String(b.dataset.category === selected)); });
    banner.replaceChildren();
    if (images[selected]) { const img = make('img', 'course-banner-image'); img.src = `/assets/course-${images[selected]}.webp`; img.alt = `${selected}课程配图`; img.loading = 'lazy'; banner.append(img); }
    const text = make('div', 'course-banner-copy'); text.append(make('div', 'eyebrow', 'COURSE COLLECTION / 课程资源'), make('h3', '', selected), make('p', '', descriptions[selected] || '探索多样化课程，发现更多兴趣与可能。')); banner.append(text);
    grid.replaceChildren();
    matches.slice(0, expanded ? matches.length : 6).forEach(course => {
      const card = make('article', 'course-card'); card.append(make('h4', '', course.title), make('p', '', course.summary));
      if (course.page) { const link = make('a', 'text-link', '查看课程详情 ↗'); link.href = `/assets/course-manual.pdf#page=${course.page}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `${course.title}：查看课程手册第 ${course.page} 页（新标签页）`); card.append(link); }
      grid.append(card);
    });
    count.textContent = `${selected} · 共 ${matches.length} 门课程`;
    toggle.hidden = matches.length <= 6; toggle.textContent = expanded ? '收起课程 ↑' : `展开全部 ${matches.length} 门课程 ↓`; toggle.setAttribute('aria-expanded', String(expanded));
  }
  categories.forEach(category => { const b = make('button', '', category); b.type = 'button'; b.dataset.category = category; b.onclick = () => { selected = category; expanded = false; render(); }; filters.append(b); });
  toggle.onclick = () => { expanded = !expanded; render(); };
  root.replaceChildren(filters, banner, count, grid, toggle, footer); render();
};
