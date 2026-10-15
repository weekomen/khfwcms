const root = document.getElementById('content-page-main');
const params = new URLSearchParams(location.search);
const type = params.get('type') === 'venture' ? 'venturePages' : 'businessPages';
const id = params.get('id') || '';
const paragraphs = text => String(text || '').split(/\n+/).map(value => value.trim()).filter(Boolean).map(value => { const node = document.createElement('p'); node.textContent = value; return node; });
const render = item => {
  if (!item) { root.replaceChildren(Object.assign(document.createElement('h1'), { textContent: '页面不存在' }), Object.assign(document.createElement('p'), { textContent: '请返回官网重新选择内容。' })); return; }
  document.title = `课后邦｜${item.title}`; root.replaceChildren();
  const article = document.createElement('article'); article.className = 'content-page-card';
  if (item.image) { const image = document.createElement('img'); image.className = 'content-page-image'; image.src = item.image; image.alt = item.title; article.append(image); }
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = type === 'venturePages' ? 'ZHILIN VENTURE / 智邻创投' : 'CORE BUSINESS / 集团核心业务';
  const heading = document.createElement('h1'); heading.textContent = item.title; const summary = document.createElement('p'); summary.className = 'content-page-summary'; summary.textContent = item.summary || '';
  const body = document.createElement('div'); body.className = 'content-page-body-copy'; body.append(...paragraphs(item.body));
  const back = document.createElement('a'); back.className = 'button primary'; back.href = '/'; back.textContent = '返回官网';
  article.append(eyebrow, heading, summary, body, back); root.append(article);
};
fetch('/api/content').then(response => { if (!response.ok) throw Error(); return response.json(); }).then(data => { const list = data[type] || window.KHB_DEFAULTS?.[type] || []; render(list.find(item => item.id === id)); }).catch(() => render(null));
