const root = document.querySelector('#article');
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const params = new URLSearchParams(location.search);
const id = params.get('id');
const assetPattern = /^\/assets\/[a-zA-Z0-9_.-]+$/;
const imageUrl = value => assetPattern.test(String(value || '')) ? String(value) : '';
const imageWidth = (article, url, inlineWidth) => {
  const fromMarkdown = Number(inlineWidth);
  if (Number.isInteger(fromMarkdown) && fromMarkdown >= 20 && fromMarkdown <= 100) return fromMarkdown;
  const block = Array.isArray(article.blocks) && article.blocks.find(item => item && item.type === 'image' && item.value === url);
  return Number.isInteger(block?.width) && block.width >= 20 && block.width <= 100 ? block.width : 100;
};
const appendInline = (text, parent, article) => {
  const token = /!\[([^\]]*)\]\((\/assets\/[a-zA-Z0-9_.-]+)(?:\s+["']([^"']*)["'])?\)(?:\{width=(\d{1,3})\})?|\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*|#[^)\s]*)\)|(\x60([^\x60]+)\x60)|(?:\*\*|__)(.+?)(?:\*\*|__)|(?:\*|_)(.+?)(?:\*|_)/g;
  let cursor = 0;
  let match;
  const appendText = value => { if (value) parent.append(document.createTextNode(value)); };
  while ((match = token.exec(text))) {
    appendText(text.slice(cursor, match.index));
    if (match[2]) {
      const img = el('img', 'article-inline-image');
      img.src = match[2];
      img.alt = match[1] || article.title || '文章图片';
      img.loading = 'lazy';
      img.style.width = `${imageWidth(article, match[2], match[4])}%`;
      parent.append(img);
    } else if (match[6]) {
      const link = el('a', 'article-link', match[5]);
      link.href = match[6];
      link.rel = 'noopener noreferrer';
      parent.append(link);
    } else if (match[8]) {
      parent.append(el('code', 'article-code', match[8]));
    } else if (match[9]) {
      parent.append(el('strong', '', match[9]));
    } else if (match[10]) {
      parent.append(el('em', '', match[10]));
    }
    cursor = match.index + match[0].length;
  }
  appendText(text.slice(cursor));
};
const onlyImage = line => /^\s*!\[([^\]]*)\]\((\/assets\/[a-zA-Z0-9_.-]+)(?:\s+["']([^"']*)["'])?\)(?:\{width=(\d{1,3})\})?\s*$/.exec(line);
const appendFigure = (match, article) => {
  const figure = el('figure', 'article-figure');
  const img = el('img');
  img.src = match[2];
  img.alt = match[1] || article.title || '文章图片';
  img.loading = 'lazy';
  img.style.width = `${imageWidth(article, match[2], match[4])}%`;
  figure.append(img);
  if (match[3]) figure.append(el('figcaption', 'muted', match[3]));
  root.append(figure);
};
const appendParagraph = (value, article) => {
  const paragraph = el('p', 'article-paragraph');
  appendInline(value, paragraph, article);
  if (paragraph.childNodes.length) root.append(paragraph);
};
const renderMarkdown = (source, article) => {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^\s*```/.test(line)) {
      const language = line.replace(/^\s*```/, '').trim();
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      const pre = el('pre', 'article-code-block'); const codeNode = el('code'); codeNode.textContent = code.join('\n'); if (language) codeNode.dataset.language = language; pre.append(codeNode); root.append(pre); continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) { const h = el(`h${heading[1].length}`, 'article-heading'); appendInline(heading[2], h, article); root.append(h); index += 1; continue; }
    if (/^\s*(?:---+|\*\s*\*\s*\*|___+)\s*$/.test(line)) { root.append(el('hr', 'article-rule')); index += 1; continue; }
    const image = onlyImage(line);
    if (image) { appendFigure(image, article); index += 1; continue; }
    if (/^\s*>/.test(line)) {
      const quote = el('blockquote', 'article-quote');
      while (index < lines.length && /^\s*>/.test(lines[index])) { appendInline(lines[index].replace(/^\s*>\s?/, ''), quote, article); quote.append(document.createElement('br')); index += 1; }
      quote.lastChild?.remove(); root.append(quote); continue;
    }
    const listMatch = /^\s*([-+*]|\d+[.)])\s+(.+)$/.exec(line);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]); const list = el(ordered ? 'ol' : 'ul', 'article-list');
      while (index < lines.length) {
        const item = /^\s*([-+*]|\d+[.)])\s+(.+)$/.exec(lines[index]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        const li = el('li'); appendInline(item[2], li, article); list.append(li); index += 1;
      }
      root.append(list); continue;
    }
    const paragraph = [line]; index += 1;
    while (index < lines.length && lines[index].trim()) {
      if (/^\s{0,3}(#{1,6})\s+/.test(lines[index]) || /^\s*(?:```|>|[-+*]\s+|\d+[.)]\s+)/.test(lines[index]) || onlyImage(lines[index])) break;
      paragraph.push(lines[index++]);
    }
    appendParagraph(paragraph.join('\n'), article);
  }
};
const renderLegacyBlocks = article => {
  const blocks = Array.isArray(article.blocks) && article.blocks.length ? article.blocks : [{ type: 'text', value: article.body || '' }];
  for (const block of blocks) {
    if (block.type === 'image' && imageUrl(block.value)) appendFigure(['', block.value, block.caption || '', block.width || ''], article);
    else if (block.type === 'text') renderMarkdown(block.value || '', article);
  }
};
async function load() {
  try {
    if (!id) throw Error();
    let response = await fetch(`/api/news/${encodeURIComponent(id)}`);
    let article;
    if (response.ok) article = await response.json();
    else {
      response = await fetch('/api/content');
      if (!response.ok) throw Error();
      article = (await response.json()).news.find(item => item.id === id);
      if (!article) throw Error();
    }
    document.title = `${article.title}｜课后邦`;
    root.replaceChildren(el('div', 'eyebrow', article.type === 'company' ? 'COMPANY NEWS / 企业动态' : 'NEWS / 公司动态'), el('h1', null, article.title), el('time', 'muted', article.date || ''), el('p', 'article-summary', article.summary || ''));
    if (String(article.body || '').trim()) renderMarkdown(article.body, article);
    else renderLegacyBlocks(article);
    if (!root.querySelector('.article-paragraph, .article-heading, .article-figure, .article-list, .article-quote, .article-code-block')) root.append(el('p', 'muted', '暂无正文内容。'));
  } catch {
    root.replaceChildren(el('h1', null, '文章不存在'), el('p', 'muted', '这篇内容尚未发布或已被移除。'), el('a', 'button primary', '返回官网'));
    root.lastChild.href = '/';
  }
}
load();
