import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const content = JSON.parse(await readFile(path.join(dataDir, 'content.json'), 'utf8'));
content.news = content.news.filter(article => article.published);
await mkdir(path.join(root, 'backups/uploads'), { recursive: true });
const inlineAssetRefs = value => [...String(value || '').matchAll(/\/assets\/([a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|svg|gif|ico))/gi)].map(match => `/assets/${match[1]}`);
const publicImageRefs = [
  ...content.team.map(member => member.image),
  ...content.news.flatMap(article => [article.coverImage, ...(article.blocks || []).filter(block => block.type === 'image').map(block => block.value)]),
  ...(content.servicePages || []).flatMap(page => [page.coverImage, ...inlineAssetRefs(page.body)])
];
for (const image of publicImageRefs) {
  const member = { image };
  const name = path.basename(member.image || '');
  if (/^upload-[a-f0-9]{32}\.(png|jpg|webp)$/.test(name)) await copyFile(path.join(dataDir, 'uploads', name), path.join(root, 'backups/uploads', name));
}
await writeFile(path.join(root, 'backups/published-content.json'), JSON.stringify(content, null, 2));
console.log('Public content snapshot updated. Admin credentials and unpublished articles excluded.');
