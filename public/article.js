const root = document.getElementById('article-main');
const articleId = new URLSearchParams(location.search).get('id') || '';
const paragraphs = text => String(text || '').split(/\n\s*\n|\n/).map(value => value.trim()).filter(Boolean).map(value => {
  const node = document.createElement('p'); node.textContent = value; return node;
});
const showError = () => {
  const title = document.createElement('h1'); title.textContent = '文章不存在';
  const message = document.createElement('p'); message.textContent = '文章可能已下线，请返回新闻资讯。';
  root.replaceChildren(title, message);
};
fetch('/api/content').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(data => {
  const article = (data.news || []).find(item => item.id === articleId && item.published);
  if (!article) return showError();
  document.title = `课后邦｜${article.title}`;
  const card = document.createElement('article'); card.className = 'content-page-card article-card';
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = article.group === 'industry' ? 'INDUSTRY INSIGHTS / 行业洞察' : 'GROUP NEWS / 集团动态';
  const title = document.createElement('h1'); title.textContent = article.title;
  const time = document.createElement('time'); time.className = 'article-date'; time.textContent = article.date || '';
  const summary = document.createElement('p'); summary.className = 'content-page-summary'; summary.textContent = article.summary || '';
  card.append(eyebrow, title, time, summary);
  const image = article.image || article.longImage;
  if (image) { const figure = document.createElement('figure'); figure.className = 'content-page-figure'; const imageNode = document.createElement('img'); imageNode.className = 'content-page-image'; imageNode.src = image; imageNode.alt = article.title; imageNode.loading = 'lazy'; figure.append(imageNode); card.append(figure); }
  const body = document.createElement('div'); body.className = 'content-page-body-copy'; body.append(...paragraphs(article.body)); card.append(body);
  if (article.source) { const source = document.createElement('a'); source.className = 'text-link'; source.href = article.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = '查看原文 ↗'; card.append(source); }
  root.replaceChildren(card);
}).catch(showError);
