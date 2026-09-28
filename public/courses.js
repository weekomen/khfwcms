window.renderCourses = (courses, showDetail) => {
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
  const footer = make('div', 'course-footer');
  footer.append(make('p', 'muted', '点击课程详情，即可了解课程介绍与学习内容。'));
  function render() {
    const matches = courses.filter(c => c.category === selected);
    filters.querySelectorAll('button').forEach(b => { b.classList.toggle('selected', b.dataset.category === selected); b.setAttribute('aria-pressed', String(b.dataset.category === selected)); });
    banner.replaceChildren();
    if (images[selected]) { const img = make('img', 'course-banner-image'); img.src = `/assets/course-${images[selected]}.webp`; img.alt = `${selected}课程配图`; img.loading = 'lazy'; banner.append(img); }
    const text = make('div', 'course-banner-copy'); text.append(make('div', 'eyebrow', 'COURSE COLLECTION / 课程资源'), make('h3', '', selected), make('p', '', descriptions[selected] || '探索多样化课程，发现更多兴趣与可能。')); banner.append(text);
    grid.replaceChildren();
    matches.slice(0, expanded ? matches.length : 6).forEach(course => {
      const card = make('article', 'course-card'); card.append(make('h4', '', course.title), make('p', '', course.summary));
      const button = make('button', 'text-link course-detail-button', '查看课程详情 →'); button.type = 'button'; button.setAttribute('aria-label', `查看${course.title}课程详情`);
      button.onclick = () => {
        const title = make('h2', '', course.title); title.id = 'course-dialog-title';
        const nodes = [make('div', 'eyebrow', course.category + ' / 课程介绍'), title, make('p', 'course-description', course.description || course.summary)];
        const outline = (course.outline || '').split('\n').filter(line => line.trim());
        if (outline.length) { const list = make('ul', 'course-outline'); outline.forEach(line => list.append(make('li', '', line))); nodes.push(make('h3', 'course-detail-heading', '学习内容'), list); }
        showDetail(nodes);
      };
      card.append(button);
      grid.append(card);
    });
    count.textContent = `${selected} · 共 ${matches.length} 门课程`;
    toggle.hidden = matches.length <= 6; toggle.textContent = expanded ? '收起课程 ↑' : `展开全部 ${matches.length} 门课程 ↓`; toggle.setAttribute('aria-expanded', String(expanded));
  }
  categories.forEach(category => { const b = make('button', '', category); b.type = 'button'; b.dataset.category = category; b.onclick = () => { selected = category; expanded = false; render(); }; filters.append(b); });
  toggle.onclick = () => { expanded = !expanded; render(); };
  root.replaceChildren(filters, banner, count, grid, toggle, footer); render();
};
