import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const content = JSON.parse(await readFile(path.join(dataDir, 'content.json'), 'utf8'));
content.news = content.news.filter(article => article.published);
await mkdir(path.join(root, 'backups/uploads'), { recursive: true });
for (const member of content.team) {
  const name = path.basename(member.image);
  if (/^upload-[a-f0-9]{32}\.(png|jpg|webp)$/.test(name)) await copyFile(path.join(dataDir, 'uploads', name), path.join(root, 'backups/uploads', name));
}
await writeFile(path.join(root, 'backups/published-content.json'), JSON.stringify(content, null, 2));
console.log('Public content snapshot updated. Admin credentials and unpublished articles excluded.');
