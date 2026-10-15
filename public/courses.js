window.renderCourses = (courses, showDetail, categoryData = []) => {
  const root = document.getElementById('course-catalog');
  if (!courses.length) { root.hidden = true; return; }
  const make = (tag, cls, text) => { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const normalize = category => category === '劳动类' ? '手工类' : category;
  const configured = Array.isArray(categoryData) ? categoryData : [];
  const byTitle = new Map(configured.map(item => [item.title, item]));
  const categories = [...new Set([...configured.map(item => item.title), ...courses.map(course => normalize(course.category))])];
  const fallback = {
    '美育类': { description: '在表达、阅读与艺术创作中，发现兴趣，感受美。', image: '/assets/course-aesthetic.webp' },
    '益智类': { description: '在游戏、推理与对弈中，练习观察，探索思考的方法。', image: '/assets/course-puzzle.webp' },
    '科技类': { description: '从科学实验到人工智能，在动手探索中认识科技。', image: '/assets/course-technology.webp' },
    '手工类': { description: '在生活实践、手工创作与非遗体验中，感受劳动的价值。', image: '/assets/course-labor.webp' }
  };
  let selected = categories[0], expanded = false;
  const mobile = window.matchMedia('(max-width: 600px)');
  const filters = make('div', 'filters course-filters'); filters.setAttribute('aria-label', '课程分类');
  const banner = make('div', 'course-banner');
  const grid = make('div', 'course-grid'); grid.id = 'course-grid';
  const toggle = make('button', 'team-toggle'); toggle.type = 'button'; toggle.setAttribute('aria-controls', 'course-grid');
  const count = make('p', 'course-count'); count.setAttribute('role', 'status');
  const footer = make('div', 'course-footer'); footer.append(make('p', 'muted', '点击课程详情，即可了解课程介绍与学习内容。'));
  function render() {
    const matches = courses.filter(course => normalize(course.category) === selected);
    const previewCount = mobile.matches ? 3 : 6;
    filters.querySelectorAll('button').forEach(button => { const active = button.dataset.category === selected; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
    banner.replaceChildren();
    const category = byTitle.get(selected) || fallback[selected] || {};
    if (category.image) { const image = make('img', 'course-banner-image'); image.src = category.image; image.alt = `${selected}课程长图`; image.loading = 'lazy'; banner.append(image); }
    const copy = make('div', 'course-banner-copy'); copy.append(make('div', 'eyebrow', 'COURSE COLLECTION / 课程资源'), make('h3', '', selected), make('p', '', category.description || '探索多样化课程，发现更多兴趣与可能。')); banner.append(copy);
    grid.replaceChildren();
    matches.slice(0, expanded ? matches.length : previewCount).forEach(course => {
      const card = make('article', 'course-card'); card.append(make('h4', '', course.title), make('p', '', course.summary));
      const button = make('button', 'text-link course-detail-button', '查看课程详情 →'); button.type = 'button'; button.setAttribute('aria-label', `查看${course.title}课程详情`);
      button.onclick = () => {
        const title = make('h2', '', course.title); title.id = 'course-dialog-title';
        const nodes = [make('div', 'eyebrow', `${normalize(course.category)} / 课程介绍`), title, make('p', 'course-description', course.description || course.summary)];
        const outline = (course.outline || '').split('\n').filter(line => line.trim());
        if (outline.length) { const list = make('ul', 'course-outline'); outline.forEach(line => list.append(make('li', '', line))); nodes.push(make('h3', 'course-detail-heading', '学习内容'), list); }
        showDetail(nodes);
      };
      card.append(button); grid.append(card);
    });
    count.textContent = `${selected} · 共 ${matches.length} 门课程`;
    toggle.hidden = matches.length <= previewCount; toggle.textContent = expanded ? '收起课程 ↑' : `展开全部 ${matches.length} 门课程 ↓`; toggle.setAttribute('aria-expanded', String(expanded));
  }
  categories.forEach(category => { const button = make('button', '', category); button.type = 'button'; button.dataset.category = category; button.onclick = () => { selected = category; expanded = false; render(); }; filters.append(button); });
  toggle.onclick = () => { expanded = !expanded; render(); };
  mobile.addEventListener('change', render);
  window.selectCourseCategory = value => { const target = categories.find(category => category === value || category.includes(value)) || categories[0]; selected = target; expanded = false; render(); root.scrollIntoView({ behavior: 'smooth' }); };
  root.hidden = false; root.replaceChildren(filters, banner, count, grid, toggle, footer); render();
};
