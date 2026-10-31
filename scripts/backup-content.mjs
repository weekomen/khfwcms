import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { applyBusinessDefaults } from '../business-content.mjs';
import { applyAllianceDefaults } from '../alliance-content.mjs';
const root = path.resolve(import.meta.dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const content = applyAllianceDefaults(applyBusinessDefaults(JSON.parse(await readFile(path.join(dataDir, 'content.json'), 'utf8'))));
content.news = content.news.filter(article => article.published);
content.alliancePages = content.alliancePages.filter(page => page.published !== false);
await mkdir(path.join(root, 'backups/uploads'), { recursive: true });
const imageCollections = [
  ['team', ['image']], ['news', ['image', 'longImage']], ['aboutPages', ['image', 'longImage']],
  ['businessPages', ['image', 'longImage']], ['courseCategories', ['image', 'longImage']],
  ['courses', ['cover', 'longImage']], ['venturePages', ['image', 'longImage']], ['alliancePages', ['image', 'longImage']]
];
const uploadNames = new Set();
for (const [collection, fields] of imageCollections) for (const item of content[collection] || []) for (const field of fields) {
  if (typeof item[field] !== 'string') continue;
  const name = path.basename(item[field]);
  if (!/^upload-[a-f0-9]{32}\.(png|jpg|webp)$/.test(name)) continue;
  if (collection === 'team') uploadNames.add(name);
  else item[field] = '';
}
for (const name of uploadNames) {
  await copyFile(path.join(dataDir, 'uploads', name), path.join(root, 'backups/uploads', name));
}
await writeFile(path.join(root, 'backups/published-content.json'), JSON.stringify(content, null, 2));
console.log('Public content snapshot updated. Admin credentials and unpublished articles excluded.');
