export function validateContent(c) {
  const text = (v, max = 10000) => { if (typeof v !== 'string' || v.length > max) throw Error('字段格式错误或文字过长'); };
  const list = (v, max) => { if (!Array.isArray(v) || v.length > max) throw Error('列表格式错误或项目过多'); };
  if (!c || typeof c !== 'object' || !c.site) throw Error('缺少网站配置');
  for (const key of ['name', 'tagline', 'headline', 'intro', 'about', 'phone', 'email', 'address', 'filing']) text(c.site[key]);
  if (!c.site.name.trim() || !c.site.headline.trim()) throw Error('品牌名和首页标题不能为空');
  if (c.site.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.site.email)) throw Error('请输入有效邮箱');
  const asset = v => { text(v, 150); if (!/^\/assets\/[a-zA-Z0-9_.-]+$/.test(v)) throw Error('图片须为 /assets/ 下的本地素材'); };
  list(c.services, 24); for (const s of c.services) { for (const k of ['title', 'subtitle', 'description', 'category']) text(s[k]); list(s.features, 12); s.features.forEach(t => text(t)); }
  if (c.courses !== undefined) {
    list(c.courses, 200);
    for (const course of c.courses) {
      for (const key of ['title', 'category', 'summary']) text(course[key]);
      if (!course.title.trim() || !course.category.trim()) throw Error('课程名称和分类不能为空');
      if (!Number.isInteger(course.page) || course.page < 0 || course.page > 32) throw Error('课程手册页码须为 1–32，填 0 表示不关联手册');
    }
  }
  list(c.team, 100); for (const t of c.team) { for (const k of ['name', 'role', 'bio', 'category']) text(t[k]); asset(t.image); }
  list(c.news, 100); const ids = new Set(); for (const n of c.news) { for (const k of ['id', 'title', 'category', 'date', 'summary', 'body', 'source']) text(n[k], k === 'body' ? 50000 : 10000); if (!n.id || ids.has(n.id)) throw Error('文章编号须唯一且非空'); ids.add(n.id); if (typeof n.published !== 'boolean') throw Error('发布状态无效'); if (n.date && !/^\d{4}-\d{2}-\d{2}$/.test(n.date)) throw Error('日期格式应为 YYYY-MM-DD'); if (n.source) { let url; try { url = new URL(n.source); } catch { throw Error('原文链接无效'); } if (url.protocol !== 'https:') throw Error('原文链接须使用 HTTPS'); } }
}
