// Public defaults for the seven business entries and their six detail pages.
// These fill old runtime objects in memory; the server never replaces a live
// content.json file with the seed when a website version is upgraded.
export const CORE_BUSINESSES = [
  { id: 'supply-chain', title: '课后邦课后服务进校供应链', summary: '连接课程、师资、技术系统与运营服务，为学校开展课后服务提供整体支持。', body: '围绕学校课后服务的实际需求，整合课程资源、师资组织、技术系统与运营协同，让课程选择、教学安排和服务反馈形成连续的工作流程。\n\n从学校需求出发，制定适合校园场景的课程与交付方案，并在实施过程中持续收集反馈、完善服务。' },
  { id: 'ai-school-supply', title: '课后邦人工智能进校供应链', summary: '围绕 AI 伴学、校园多端协同与进校模式，探索人工智能与教育场景的结合。', body: '人工智能进校服务以学校教学与学生成长场景为基础，连接 AI 伴学工具、校园管理流程和家校协同需求。\n\n通过系统介绍、多端功能说明和进校方案沟通，帮助学校与合作伙伴了解适用场景、实施条件与推进方式。' },
  { id: 'online-ai-study', title: '线上AI伴学', summary: '连接学习资源、互动工具和学习陪伴，为课后自主学习提供支持。', body: '线上 AI 伴学围绕学生课后的学习任务与兴趣探索，结合数字内容、互动练习和学习反馈，构建可持续的线上学习陪伴场景。\n\n具体课程、工具与服务方式可根据年龄阶段和合作需求进行配置。' },
  { id: 'online-education', title: '线上素质教育', summary: '以线上课程、数字工具和学习陪伴，延伸学生的成长场景。', body: '围绕美育、益智、科技与综合实践等方向，连接线上课程内容与学习活动，让学生在课后保持探索与创造。' },
  { id: 'education-street', title: '教育一条街', summary: '把课程体验、文化活动和社区服务汇聚到身边的教育空间。', body: '面向家庭、学校与社区，连接课程体验、主题活动和教育伙伴，构建开放共享的成长场景。' },
  { id: 'youth-center', title: '青少年成长中心', summary: '围绕青少年兴趣、能力与品格成长，提供连续的成长支持。', body: '融合兴趣课程、实践活动与成长陪伴，帮助青少年发现兴趣、建立自信，在合作和创造中拓展视野。' },
  { id: 'ai-museum', title: '人工智能科技馆', summary: '用可参与的展陈、实验和项目学习，打开人工智能的探索之门。', body: '围绕人工智能、机器人、编程和科学实验，组织可参与的科普体验与项目学习，让学生在动手实践中理解技术与应用场景。' }
];

const DETAILS = [
  { id: 'supply-system', title: '技术系统介绍', summary: '连接课后服务的课程组织、教学安排与运营协同。', body: '技术系统围绕课后服务的日常工作流程，梳理学校、教师与服务团队之间的信息协同。\n\n可结合学校需求介绍课程管理、教学安排、服务记录和运营反馈等应用场景，具体功能与实施范围以项目方案为准。', image: '/assets/business-1.svg' },
  { id: 'supply-courses', title: '课程介绍', summary: '从课程资源到课堂实施，了解多元课后课程的组织方式。', body: '围绕学生年龄特点与兴趣发展，整合美育、益智、科技和手工等课程资源。\n\n课程沟通可从课程目标、适用年级、教学内容、课时安排、材料配置与师资要求等方面展开，结合学校情况形成课程组合。', image: '/assets/business-1.svg' },
  { id: 'supply-school-plan', title: '一校一案', summary: '结合学校场景与学生需求，规划课后服务实施方案。', body: '一校一案从学校现状、学生兴趣和课程需求出发，梳理课程结构、实施条件、师资组织与服务流程。\n\n通过需求沟通、方案设计、落地准备与阶段反馈，推动适合校园实际情况的课后服务安排。', image: '/assets/business-1.svg' },
  { id: 'ai-study-system', title: 'AI伴学系统介绍', summary: '了解 AI 伴学的学习场景、互动方式与服务流程。', body: 'AI 伴学系统以学习任务与成长需要为起点，连接学习内容、互动练习和过程反馈。\n\n系统介绍可围绕适用年龄、内容范围、学习路径、反馈方式和使用条件展开，帮助学校与家庭了解服务的具体边界。', image: '/assets/business-2.svg' },
  { id: 'ai-portals', title: '学生端、学校端、老师端与家长端功能介绍', summary: '从四类使用角色出发，了解各端功能与协同场景。', body: '## 学生端\n围绕学习任务、内容体验与学习反馈，介绍学生的使用流程。\n\n## 学校端\n围绕校园应用、组织管理与项目反馈，说明学校的协同方式。\n\n## 老师端\n围绕教学安排、学习指导与过程沟通，介绍教师参与场景。\n\n## 家长端\n围绕学习进展、成长陪伴与家校沟通，介绍家庭参与方式。\n\n具体功能清单与各端使用权限以项目方案为准。', image: '/assets/business-2.svg' },
  { id: 'ai-school-model', title: '进校模式', summary: '结合校园条件，了解人工智能教育服务的实施路径。', body: '进校模式需要结合学校需求、学生年龄、设备环境和服务资源共同设计。\n\n可从场景调研、方案沟通、应用准备、试点实施与阶段反馈逐步推进，并明确学校与服务团队的分工和支持方式。', image: '/assets/business-2.svg' }
];

export const DEFAULT_BUSINESS_PAGES = [
  ...CORE_BUSINESSES.map((page, index) => ({ ...page, image: `/assets/business-${index + 1}.svg`, longImage: '', order: index + 1, published: true })),
  ...DETAILS.map((page, index) => ({ ...page, longImage: '', order: index + 8, published: true }))
];

const aliases = {
  'business-supply': 'supply-chain', 'business-supply-chain': 'supply-chain',
  'business-online': 'online-education', 'business-online-education': 'online-education',
  'business-street': 'education-street', 'business-education-street': 'education-street',
  'business-youth': 'youth-center', 'business-youth-center': 'youth-center',
  'business-ai': 'ai-museum', 'business-ai-museum': 'ai-museum'
};
const coreIds = new Set(CORE_BUSINESSES.map(page => page.id));
const canonicalId = value => aliases[value] || value;
function childId(child) {
  const raw = child.value || child.id || '';
  if (coreIds.has(canonicalId(raw))) return canonicalId(raw);
  try { return canonicalId(new URL(child.href, 'https://kehoubang.cn').searchParams.get('id') || raw); } catch { return canonicalId(raw); }
}
function navigationRoot(content, values, index) {
  return content.navigation.find(item => [item.id, item.label].some(value => values.includes(String(value || '').toLowerCase()))) || (content.navigation.length === 7 ? content.navigation[index] : undefined);
}
function defaultBusinessChild(page) {
  const anchor = page.id === 'supply-chain' ? '#after-school-supply' : page.id === 'ai-school-supply' ? '#ai-school-supply' : '';
  return { id: page.id, label: page.title, href: anchor || `/content-page.html?type=business&id=${page.id}`, target: anchor ? '' : 'blank', action: 'business', value: page.id };
}

export function applyBusinessDefaults(content) {
  if (content.businessPages === undefined) content.businessPages = [];
  if (!Array.isArray(content.businessPages)) return content;
  // Old releases used business-* IDs for the same pages. Reuse the edited
  // record before adding defaults, so a new empty page cannot shadow it.
  // When both IDs already exist, keep both records rather than merging away
  // either administrator's text or image references.
  for (const page of content.businessPages) {
    const canonical = canonicalId(page.id);
    if (canonical !== page.id && !content.businessPages.some(other => other !== page && other.id === canonical)) page.id = canonical;
  }
  for (const page of DEFAULT_BUSINESS_PAGES) {
    const current = content.businessPages.find(item => item.id === page.id);
    if (!current) { content.businessPages.push(structuredClone(page)); continue; }
    for (const key of ['title', 'summary', 'body', 'image', 'longImage']) if (current[key] === undefined) current[key] = page[key];
    if (page.id === 'supply-chain' && current.title === '课后邦供应链') current.title = page.title;
    // The former logo was a placeholder, rather than an uploaded business image.
    if (coreIds.has(page.id) && (!current.image || current.image === '/assets/logo.png')) current.image = page.image;
  }
  const defaults = new Set(DEFAULT_BUSINESS_PAGES.map(page => page.id));
  content.businessPages = [...DEFAULT_BUSINESS_PAGES.map(page => content.businessPages.find(item => item.id === page.id)), ...content.businessPages.filter(page => !defaults.has(page.id))];
  if (!Array.isArray(content.navigation)) return content;
  const business = navigationRoot(content, ['business', 'core-business', 'group-business', 'product-service', '集团核心业务', '产品与服务'], 2);
  if (business) {
    const children = Array.isArray(business.children) ? business.children : [];
    const present = new Set(children.map(childId));
    // A seven-entry menu is already on the new layout; subsequent CMS edits win.
    if (!CORE_BUSINESSES.every(page => present.has(page.id))) {
      business.children = CORE_BUSINESSES.map(page => {
        const old = children.find(child => childId(child) === page.id);
        const child = { ...old, ...defaultBusinessChild(page) };
        if (old?.label && old.label !== '课后邦供应链') child.label = old.label;
        return child;
      });
      if (['#services', '#business', '#products', ''].includes(business.href || '')) business.href = '#business-showcase';
    }
  }
  const courses = navigationRoot(content, ['courses', 'course-library', 'resource-library', '课程资源库', '课程手册'], 3);
  if (courses) {
    if (/^#(?:courses|course-catalog|services)$/.test(courses.href || '')) { courses.href = '/courses.html'; courses.target = 'blank'; }
    for (const child of courses.children || []) {
      if (/^#(?:courses|course-catalog|services)$/.test(child.href || '')) {
        child.href = `/courses.html?category=${encodeURIComponent(child.value || child.label || '')}`;
        child.target = 'blank';
      }
    }
  }
  for (const root of content.navigation) for (const child of root.children || []) {
    if (child.href === '#team') { child.href = '/team.html'; child.target = 'blank'; }
  }
  return content;
}
