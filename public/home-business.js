(() => {
  const entries = [
    { id: 'supply-chain', title: '课后邦课后服务进校供应链', summary: '连接课程资源、技术系统与实施方案，支持学校课后服务落地。' },
    { id: 'ai-school-supply', title: '课后邦人工智能进校供应链', summary: '围绕 AI 伴学、多端协同与进校模式，连接人工智能教育应用。' },
    { id: 'online-ai-study', title: '线上AI伴学', summary: '探索 AI 工具与学习陪伴结合，延伸日常学习支持。' },
    { id: 'online-education', title: '线上素质教育', summary: '通过线上课程与数字内容，拓展多样化成长场景。' },
    { id: 'education-street', title: '教育一条街', summary: '连接课程体验、教育服务与社区生活。' },
    { id: 'youth-center', title: '青少年成长中心', summary: '汇聚兴趣课程、实践活动与成长陪伴。' },
    { id: 'ai-museum', title: '人工智能科技馆', summary: '在互动体验与动手探索中认识人工智能。' }
  ];
  const sections = {
    'supply-chain': '#after-school-supply',
    'ai-school-supply': '#ai-school-supply'
  };
  const resourceLinks = {
    'supply-courses': '/courses.html',
    'supply-school-plan': 'https://kehoubang.cn/profile/upload/pdf/2/index.html'
  };
  const destination = id => sections[id] || resourceLinks[id] || `/content-page.html?type=business&id=${encodeURIComponent(id)}`;
  window.homeBusinessDestination = destination;
  const make = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const setImage = (image, source, fallback) => {
    image.onerror = () => { image.onerror = null; image.src = fallback; };
    image.src = source || fallback;
  };
  window.renderHomeBusiness = data => {
    const tabs = document.getElementById('business-tabs');
    if (!tabs) return;
    const pages = new Map((data.businessPages || []).map(page => [page.id, page]));
    const businesses = entries.map((entry, index) => ({ ...entry, image: `/assets/business-${index + 1}.svg`, ...pages.get(entry.id), title: pages.get(entry.id)?.title || entry.title }));
    const feature = document.getElementById('business-feature');
    const image = document.getElementById('business-feature-image');
    const panel = document.getElementById('business-feature-panel');
    const buttons = [];
    const select = (index, focus = false) => {
      const page = businesses[index];
      buttons.forEach((button, position) => { const active = position === index; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; button.classList.toggle('selected', active); });
      const fallback = `/assets/business-${index + 1}.svg`;
      setImage(image, page.image, fallback); image.alt = `${page.title}展示图`;
      const number = String(index + 1).padStart(2, '0');
      document.getElementById('business-feature-index').textContent = `${number} / CORE BUSINESS`;
      document.getElementById('business-feature-title').textContent = page.title;
      document.getElementById('business-feature-summary').textContent = page.summary ?? entries[index].summary;
      document.getElementById('business-feature-counter').textContent = `${number} / 07`;
      feature.href = destination(page.id);
      const local = !!sections[page.id];
      if (local) { feature.removeAttribute('target'); feature.removeAttribute('rel'); }
      else { feature.target = '_blank'; feature.rel = 'noopener noreferrer'; }
      feature.setAttribute('aria-label', `${page.title}，${local ? '查看首页介绍' : '在新标签页查看介绍'}`);
      document.getElementById('business-feature-action').textContent = local ? '了解业务 ↓' : '了解业务 ↗';
      panel.setAttribute('aria-labelledby', buttons[index].id);
      if (focus) { buttons[index].focus(); buttons[index].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    };
    tabs.replaceChildren();
    businesses.forEach((page, index) => {
      const button = make('button', 'business-tab'); button.type = 'button'; button.id = `business-tab-${page.id}`;
      button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
      button.append(make('span', 'business-tab-index', String(index + 1).padStart(2, '0')), make('span', 'business-tab-title', page.title));
      button.onclick = () => select(index);
      button.onkeydown = event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % businesses.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + businesses.length) % businesses.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = businesses.length - 1;
        if (next !== undefined) { event.preventDefault(); select(next, true); }
      };
      buttons.push(button); tabs.append(button);
    });
    window.selectHomeBusiness = id => { const index = businesses.findIndex(page => page.id === id); if (index >= 0) select(index); };
    select(0);
    for (const page of businesses.slice(0, 2)) {
      document.querySelector(`[data-business-heading="${page.id}"]`).textContent = page.title;
      document.querySelector(`[data-business-summary="${page.id}"]`).textContent = page.summary ?? entries.find(entry => entry.id === page.id).summary;
      const overviewImage = document.querySelector(`[data-business-image="${page.id}"]`);
      setImage(overviewImage, page.image, `/assets/business-${businesses.indexOf(page) + 1}.svg`);
      overviewImage.alt = `${page.title}整体介绍配图`;
    }
    const groups = [
      { root: 'after-school-cards', image: businesses[0].image || '/assets/business-1.svg', ids: ['supply-system', 'supply-courses', 'supply-school-plan'], titles: ['技术系统介绍', '课程介绍', '一校一案'] },
      { root: 'ai-school-cards', image: businesses[1].image || '/assets/business-2.svg', ids: ['ai-study-system', 'ai-portals', 'ai-school-model'], titles: ['AI伴学系统介绍', '学生端、学校端、老师端、家长端功能介绍', '进校模式'] }
    ];
    groups.forEach(group => {
      const root = document.getElementById(group.root); root.replaceChildren();
      group.ids.forEach((id, index) => {
        const page = pages.get(id) || {};
        const title = page.title || group.titles[index];
        const card = make('article', 'course-card business-detail-card');
        const thumb = make('img', 'course-thumb'); setImage(thumb, page.image || group.image, group.root === 'after-school-cards' ? '/assets/business-1.svg' : '/assets/business-2.svg'); thumb.alt = title; thumb.loading = 'lazy'; thumb.decoding = 'async';
        const link = make('a', 'text-link', '查看详细介绍 ↗'); link.href = destination(id); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `查看${title}（新标签页打开）`);
        card.append(thumb, make('h4', '', title), make('p', '', page.summary ?? '了解具体内容与服务方案。'), link); root.append(card);
      });
    });
  };
})();
