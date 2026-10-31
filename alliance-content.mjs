// Public placeholders only. Alliance membership and conference facts must be
// supplied by the site editor rather than inferred during an upgrade.
export const DEFAULT_ALLIANCE_PAGES = [
  { id: 'alliance-intro', title: '全国课后服务行业联盟介绍', summary: '全国课后服务行业联盟相关介绍待发布，以正式公告为准。', body: '全国课后服务行业联盟相关介绍待发布。请以正式公告为准。', image: '', longImage: '', order: 1, published: true },
  { id: 'third-members', title: '第三届成员介绍及理事单位招募', summary: '第三届成员介绍及理事单位招募信息待发布，以正式公告为准。', body: '第三届成员介绍及理事单位招募信息待发布。成员名单、招募要求与申请方式以正式公告为准。', image: '', longImage: '', order: 2, published: true },
  { id: 'third-conference-plan', title: '第三届全国课后服务行业大会计划', summary: '第三届全国课后服务行业大会计划待发布，以正式公告为准。', body: '第三届全国课后服务行业大会计划待发布。时间、地点、议程和参与方式等信息以正式公告为准。', image: '', longImage: '', order: 3, published: true }
];

export const ALLIANCE_MENU_CHILDREN = [
  { id: 'alliance-intro', label: '全国课后服务行业联盟介绍', href: '/content-page.html?type=alliance&id=alliance-intro', target: 'blank', action: '' },
  { id: 'third-members', label: '第三届成员介绍及理事单位招募', href: '/content-page.html?type=alliance&id=third-members', target: 'blank', action: '' },
  { id: 'conference-history', label: '历届大会展示', href: 'https://mp.weixin.qq.com/s/Yw8dvTeQqkIkpR571V8kxA', target: 'blank', action: '' },
  { id: 'third-conference-plan', label: '第三届全国课后服务行业大会计划', href: '/content-page.html?type=alliance&id=third-conference-plan', target: 'blank', action: '' }
];

const ROOT_ALIASES = {
  home: ['home', '首页'],
  about: ['about', 'about-us', '关于课后邦'],
  business: ['business', 'core-business', 'group-business', 'product-service', '集团核心业务', '产品与服务'],
  courses: ['courses', 'course-library', 'resource-library', '课程资源库', '课程手册'],
  alliance: ['alliance', 'service-alliance', '课后服务联盟'],
  venture: ['venture', 'zhi-lin', 'zhilin', '智邻创投', '智邻精英汇'],
  news: ['news', 'news-information', 'company-news', '公司动态', '新闻资讯'],
  contact: ['contact', 'contact-us', '联系我们']
};
export const ALLIANCE_NAV_ORDER = ['home', 'about', 'business', 'alliance', 'venture', 'news', 'contact'];

function rootRole(item) {
  const values = [item.id, item.label].map(value => String(value || '').trim().toLowerCase());
  for (const [role, aliases] of Object.entries(ROOT_ALIASES)) if (values.some(value => aliases.includes(value))) return role;
  const children = Array.isArray(item.children) ? item.children : [];
  if (children.some(child => ['alliance-intro', 'third-members', 'third-conference-plan'].includes(child.id) || /[?&]type=alliance(?:&|$)/.test(child.href || ''))) return 'alliance';
  if (item.action === 'course-category' || /^\/courses\.html(?:\?|$)/.test(item.href || '') || children.some(child => child.action === 'course-category')) return 'courses';
  return '';
}

function isCourseLibraryEntry(child) {
  return ['courses', 'course-library', 'resource-library'].includes(child.id) || child.label === '课程资源库' || /^\/courses\.html(?:\?|$)/.test(child.href || '');
}

export function applyAllianceDefaults(content) {
  if (content.alliancePages === undefined) content.alliancePages = [];
  if (!Array.isArray(content.alliancePages)) return content;
  for (const page of DEFAULT_ALLIANCE_PAGES) {
    const current = content.alliancePages.find(item => item.id === page.id);
    if (!current) { content.alliancePages.push(structuredClone(page)); continue; }
    for (const [key, value] of Object.entries(page)) if (current[key] === undefined) current[key] = value;
  }
  if (!Array.isArray(content.navigation)) return content;
  const alliance = content.navigation.find(item => rootRole(item) === 'alliance');
  let courses = content.navigation.find(item => rootRole(item) === 'courses');
  // The alliance root records that this menu has already migrated. Preserve
  // later label, link, submenu and order changes made by an administrator.
  if (alliance && !courses) return content;
  if (!courses && !alliance && content.navigation.length === 7 && !rootRole(content.navigation[3])) courses = content.navigation[3];
  const about = content.navigation.find(item => rootRole(item) === 'about');
  if (about) {
    const children = Array.isArray(about.children) ? about.children : [];
    const existing = children.find(isCourseLibraryEntry);
    const rest = children.filter(child => !isCourseLibraryEntry(child));
    // An existing eight-item custom menu cannot accept a ninth child. Keep
    // its entries intact; the administrator can free a slot in the editor.
    if (rest.length < 8) about.children = [...rest, { ...existing, id: 'course-library', label: '课程资源库', href: '/courses.html', target: 'blank', action: '' }];
  }
  const replacement = alliance || { id: 'alliance', label: '课后服务联盟', href: '/content-page.html?type=alliance&id=alliance-intro', target: 'blank', action: '', children: structuredClone(ALLIANCE_MENU_CHILDREN) };
  const next = content.navigation.filter(item => item !== courses);
  if (!next.includes(replacement)) next.push(replacement);
  const ordered = ALLIANCE_NAV_ORDER.map(role => next.find(item => rootRole(item) === role)).filter(Boolean);
  for (const item of next) if (!ordered.includes(item)) ordered.push(item);
  content.navigation = ordered;
  return content;
}
