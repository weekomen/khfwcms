const root = document.getElementById('article-main');
const id = new URLSearchParams(location.search).get('id') || '';
const paragraphs = text => String(text || '').split(/\n+/).map(value => value.trim()).filter(Boolean).map(value => { const node = document.createElement('p'); node.textContent = value; return node; });
const showError = () => { root.replaceChildren(Object.assign(document.createElement('h1'), { textContent: '文章不存在' }), Object.assign(document.createElement('p'), { textContent: '文章可能已下线，请返回新闻资讯。' })); };
fetch('/api/content').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(data => {
  const article = (data.news || []).find(item => item.id === id && item.published); if (!article) return showError(); document.title = `课后邦｜${article.title}`; root.replaceChildren();
  const card = document.createElement('article'); card.className = 'content-page-card article-card'; const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = article.group === 'industry' ? 'INDUSTRY INSIGHTS / 行业洞察' : 'GROUP NEWS / 集团动态';
  const title = document.createElement('h1'); title.textContent = article.title; const time = document.createElement('time'); time.className = 'article-date'; time.textContent = article.date || ''; const summary = document.createElement('p'); summary.className = 'content-page-summary'; summary.textContent = article.summary || ''; const body = document.createElement('div'); body.className = 'content-page-body-copy'; body.append(...paragraphs(article.body)); card.append(eyebrow, title, time, summary, body);
  if (article.source) { const source = document.createElement('a'); source.className = 'text-link'; source.href = article.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = '查看原文 ↗'; card.append(source); }
  root.append(card);
}).catch(showError);
