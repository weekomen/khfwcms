/*
 * Content validation is deliberately kept at the API boundary. The public
 * site treats content.json as data, so accepting an arbitrary object here
 * would make it easy to persist private notes, credentials or javascript:
 * URLs by mistake. New collections are optional at the top level to keep
 * content files created by older releases readable; present collections are
 * checked strictly.
 */

const TOP_LEVEL_KEYS = new Set([
  'site', 'services', 'team', 'news', 'courses', 'navigation',
  'aboutPages', 'businessPages', 'courseCategories', 'newsCategories',
  'venturePages', 'contactTopics', 'alliancePages'
]);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label}格式错误`);
  return value;
}

function keys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw Error(`${label}包含未声明字段：${key}`);
}

function text(value, max = 10000, label = '字段') {
  if (typeof value !== 'string' || value.length > max) throw Error(`${label}格式错误或文字过长`);
}

function optionalText(value, max = 10000, label = '字段') {
  if (value !== undefined) text(value, max, label);
}

function list(value, max, label = '列表') {
  if (!Array.isArray(value) || value.length > max) throw Error(`${label}格式错误或项目过多`);
}

function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) throw Error(`${label}格式错误`);
}

function optionalInteger(value, min, max, label) {
  if (value !== undefined) integer(value, min, max, label);
}

function asset(value, label = '图片') {
  text(value, 150, label);
  if (!/^\/assets\/[a-zA-Z0-9_.-]+$/.test(value)) throw Error(`${label}须为 /assets/ 下的本地素材`);
}

function optionalAsset(value, label = '图片') {
  if (value !== undefined && value !== '') asset(value, label);
}

function id(value, label = '编号') {
  text(value, 80, label);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) throw Error(`${label}只能使用小写字母、数字和连字符`);
}

function href(value, label = '链接') {
  text(value, 300, label);
  // Local paths, hash anchors and HTTPS URLs are allowed. Protocol-relative
  // links and javascript/data URLs are intentionally rejected.
  if (!value || /^(?:#|\/(?!\/))/.test(value)) return;
  if (value.startsWith('https://')) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return;
    } catch { /* fall through to the shared error */ }
  }
  throw Error(`${label}须使用站内路径、锚点或 HTTPS`);
}

function target(value, label = '打开方式') {
  text(value, 20, label);
  if (value && value !== 'blank') throw Error(`${label}无效`);
}

function validateSite(site) {
  object(site, '网站配置');
  keys(site, new Set(['name', 'tagline', 'headline', 'intro', 'about', 'phone', 'email', 'address', 'filing']), '网站配置');
  for (const key of ['name', 'tagline', 'headline', 'intro', 'about', 'phone', 'email', 'address', 'filing']) text(site[key], 10000, `site.${key}`);
  if (!site.name.trim() || !site.headline.trim()) throw Error('品牌名和首页标题不能为空');
  if (site.email && !/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(site.email)) throw Error('请输入有效邮箱');
}

function validateServices(services) {
  list(services, 24, '服务列表');
  const allowed = new Set(['title', 'subtitle', 'description', 'category', 'features']);
  for (const service of services) {
    object(service, '服务项目'); keys(service, allowed, '服务项目');
    for (const key of ['title', 'subtitle', 'description', 'category']) text(service[key], 10000, `services.${key}`);
    list(service.features, 12, '服务要点');
    service.features.forEach(feature => text(feature, 10000, '服务要点'));
  }
}

function validateTeam(team) {
  list(team, 100, '团队列表');
  const allowed = new Set(['name', 'role', 'bio', 'category', 'image']);
  for (const member of team) {
    object(member, '团队成员'); keys(member, allowed, '团队成员');
    for (const key of ['name', 'role', 'bio', 'category']) text(member[key], 10000, `team.${key}`);
    asset(member.image, '团队图片');
  }
}

function validateCourses(courses) {
  list(courses, 200, '课程列表');
  const allowed = new Set(['title', 'category', 'summary', 'description', 'grades', 'outline', 'page', 'cover', 'longImage']);
  for (const course of courses) {
    object(course, '课程项目'); keys(course, allowed, '课程项目');
    for (const key of ['title', 'category', 'summary']) text(course[key], 10000, `courses.${key}`);
    for (const key of ['description', 'outline']) if (course[key] !== undefined) text(course[key], 10000, `courses.${key}`);
    optionalText(course.grades, 200, '课程适用年级');
    optionalAsset(course.cover, '课程封面');
    optionalAsset(course.longImage, '课程长图');
    if (!course.title.trim() || !course.category.trim()) throw Error('课程名称和分类不能为空');
    integer(course.page, 0, 32, '课程手册页码须为 1–32，填 0 表示不关联手册');
  }
}

function validateNavigation(navigation) {
  list(navigation, 7, '一级导航');
  const itemAllowed = new Set(['id', 'label', 'href', 'children', 'target', 'action', 'value']);
  const childAllowed = new Set(['id', 'label', 'href', 'target', 'action', 'value']);
  const ids = new Set();
  for (const item of navigation) {
    object(item, '一级导航项'); keys(item, itemAllowed, '一级导航项'); id(item.id, '导航编号');
    if (ids.has(item.id)) throw Error('一级导航编号须唯一'); ids.add(item.id);
    text(item.label, 100, '导航名称'); href(item.href, '导航地址');
    if (item.target !== undefined) target(item.target);
    if (item.action !== undefined) {
      text(item.action, 40, '导航行为');
      if (item.action && !['course-category', 'news-group', 'contact-topic', 'business', 'venture'].includes(item.action)) throw Error('导航行为无效');
    }
    if (item.value !== undefined) text(item.value, 200, '导航行为值');
    list(item.children === undefined ? [] : item.children, 8, '二级导航');
    const childIds = new Set();
    for (const child of item.children || []) {
      object(child, '二级导航项'); keys(child, childAllowed, '二级导航项'); id(child.id, '二级导航编号');
      if (childIds.has(child.id)) throw Error('二级导航编号须唯一'); childIds.add(child.id);
      text(child.label, 100, '二级导航名称'); href(child.href, '二级导航地址');
      target(child.target === undefined ? '' : child.target);
      if (child.action !== undefined) {
        text(child.action, 40, '导航行为');
        if (child.action && !['course-category', 'news-group', 'contact-topic', 'business', 'venture'].includes(child.action)) throw Error('导航行为无效');
      }
      if (child.value !== undefined) text(child.value, 200, '导航行为值');
    }
  }
}

function pageRecords(value, max, fields, options = {}) {
  const { image = false, longImage = false, photos = false, idLabel = '页面编号' } = options;
  list(value, max, options.listLabel || '页面列表');
  const allowed = new Set(['id', ...fields, ...(image ? ['image'] : []), ...(longImage ? ['longImage'] : []), ...(photos ? ['photos'] : []), 'order', 'published']);
  const ids = new Set();
  for (const item of value) {
    object(item, options.itemLabel || '页面项目'); keys(item, allowed, options.itemLabel || '页面项目');
    id(item.id, idLabel); if (ids.has(item.id)) throw Error(`${idLabel}须唯一`); ids.add(item.id);
    for (const field of fields) text(item[field], field === 'body' ? 50000 : 10000, `${idLabel}.${field}`);
    if (image) optionalAsset(item.image, '页面图片');
    if (longImage) optionalAsset(item.longImage, '页面长图');
    if (photos && item.photos !== undefined) validatePhotos(item.photos);
    optionalInteger(item.order, 0, 999, `${idLabel}排序`);
    if (item.published !== undefined && typeof item.published !== 'boolean') throw Error(`${idLabel}发布状态无效`);
  }
}

function validatePhotos(photos) {
  list(photos, 500, '相册照片');
  const allowed = new Set(['id', 'src', 'filename', 'tag', 'width', 'height']);
  const ids = new Set(), sources = new Set();
  for (const photo of photos) {
    object(photo, '相册照片'); keys(photo, allowed, '相册照片');
    id(photo.id, '照片编号');
    if (ids.has(photo.id)) throw Error('照片编号须唯一');
    ids.add(photo.id);
    asset(photo.src, '相册照片');
    if (!/\.(?:jpg|png|webp)$/i.test(photo.src)) throw Error('相册照片仅支持 JPG、PNG 或 WebP');
    if (sources.has(photo.src)) throw Error('同一相册不能重复添加相同照片');
    sources.add(photo.src);
    text(photo.filename, 200, '照片名称'); text(photo.tag, 100, '照片标签');
    integer(photo.width, 1, 100000, '照片宽度'); integer(photo.height, 1, 100000, '照片高度');
  }
}

function validateAboutPages(value) {
  list(value, 12, '关于页面');
  const allowed = new Set(['id', 'title', 'summary', 'body', 'link', 'target', 'order', 'published', 'image', 'longImage']);
  const ids = new Set();
  for (const item of value) {
    object(item, '关于页面'); keys(item, allowed, '关于页面'); id(item.id, '关于页面编号');
    if (ids.has(item.id)) throw Error('关于页面编号须唯一'); ids.add(item.id);
    for (const field of ['title', 'summary', 'body']) text(item[field], field === 'body' ? 50000 : 10000, `aboutPages.${field}`);
    href(item.link, '关于页面链接'); target(item.target === undefined ? '' : item.target); integer(item.order, 0, 999, '关于页面排序');
    if (typeof item.published !== 'boolean') throw Error('关于页面发布状态无效');
    optionalAsset(item.image, '关于页面图片'); optionalAsset(item.longImage, '关于页面长图');
  }
}

function validateNewsCategories(value) {
  list(value, 12, '资讯分类');
  const allowed = new Set(['id', 'title', 'description', 'order', 'published']);
  const ids = new Set();
  for (const item of value) {
    object(item, '资讯分类'); keys(item, allowed, '资讯分类'); id(item.id, '资讯分类编号');
    if (ids.has(item.id)) throw Error('资讯分类编号须唯一'); ids.add(item.id);
    text(item.title, 10000, '资讯分类标题'); text(item.description, 10000, '资讯分类说明'); integer(item.order, 0, 999, '资讯分类排序');
    if (typeof item.published !== 'boolean') throw Error('资讯分类发布状态无效');
  }
}

function validateNews(news) {
  list(news, 100, '文章列表');
  const allowed = new Set(['id', 'title', 'category', 'date', 'summary', 'body', 'source', 'published', 'group', 'image', 'longImage']);
  const ids = new Set();
  for (const article of news) {
    object(article, '文章'); keys(article, allowed, '文章');
    for (const key of ['id', 'title', 'category', 'date', 'summary', 'body', 'source']) text(article[key], key === 'body' ? 50000 : 10000, `news.${key}`);
    if (article.group !== undefined) { text(article.group, 30, '资讯分组'); if (article.group && !['group', 'industry'].includes(article.group)) throw Error('资讯分组无效'); }
    optionalAsset(article.image, '文章图片'); optionalAsset(article.longImage, '文章长图');
    if (!article.id || ids.has(article.id)) throw Error('文章编号须唯一且非空'); ids.add(article.id);
    if (typeof article.published !== 'boolean') throw Error('发布状态无效');
    if (article.date && !/^\d{4}-\d{2}-\d{2}$/.test(article.date)) throw Error('日期格式应为 YYYY-MM-DD');
    if (article.source) { let url; try { url = new URL(article.source); } catch { throw Error('原文链接无效'); } if (url.protocol !== 'https:') throw Error('原文链接须使用 HTTPS'); }
  }
}

export function validateContent(content) {
  const c = object(content, '内容');
  for (const key of Object.keys(c)) if (!TOP_LEVEL_KEYS.has(key)) throw Error(`内容包含未声明字段：${key}`);
  if (!Object.hasOwn(c, 'site')) throw Error('缺少网站配置');
  for (const required of ['services', 'team', 'news']) if (!Object.hasOwn(c, required)) throw Error(`缺少${required}列表`);
  validateSite(c.site);
  validateServices(c.services);
  validateTeam(c.team);
  validateNews(c.news);
  if (c.courses !== undefined) validateCourses(c.courses);
  if (c.navigation !== undefined) validateNavigation(c.navigation);
  if (c.aboutPages !== undefined) validateAboutPages(c.aboutPages);
  if (c.businessPages !== undefined) pageRecords(c.businessPages, 20, ['title', 'summary', 'body'], { image: true, longImage: true, listLabel: '业务页面', itemLabel: '业务页面' });
  if (c.courseCategories !== undefined) pageRecords(c.courseCategories, 12, ['title', 'description'], { image: true, longImage: true, listLabel: '课程分类', itemLabel: '课程分类' });
  if (c.newsCategories !== undefined) validateNewsCategories(c.newsCategories);
  if (c.venturePages !== undefined) pageRecords(c.venturePages, 12, ['title', 'summary', 'body'], { image: true, longImage: true, photos: true, listLabel: '创投页面', itemLabel: '创投页面' });
  if (c.alliancePages !== undefined) pageRecords(c.alliancePages, 12, ['title', 'summary', 'body'], { image: true, longImage: true, listLabel: '联盟页面', itemLabel: '联盟页面' });
  if (c.contactTopics !== undefined) pageRecords(c.contactTopics, 12, ['title', 'description'], { image: false, longImage: false, listLabel: '联系主题', itemLabel: '联系主题' });
}
