import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBusinessDefaults } from '../business-content.mjs';
import { applyAllianceDefaults } from '../alliance-content.mjs';
const root = path.resolve(import.meta.dirname, '..');
const uploadName = /^upload-[a-f0-9]{32}\.(png|jpg|webp)$/;

export function preparePublicContent(source) {
  const content = applyAllianceDefaults(applyBusinessDefaults(structuredClone(source)));
  content.news = content.news.filter(article => article.published);
  content.alliancePages = content.alliancePages.filter(page => page.published !== false);
  content.venturePages = (content.venturePages || []).filter(page => page.published !== false);
  const imageCollections = [
    ['team', ['image']], ['news', ['image', 'longImage']], ['aboutPages', ['image', 'longImage']],
    ['businessPages', ['image', 'longImage']], ['courseCategories', ['image', 'longImage']],
    ['courses', ['cover', 'longImage']], ['venturePages', ['image', 'longImage']], ['alliancePages', ['image', 'longImage']]
  ];
  const uploadNames = new Set();
  for (const [collection, fields] of imageCollections) for (const item of content[collection] || []) for (const field of fields) {
    if (typeof item[field] !== 'string') continue;
    const name = path.basename(item[field]);
    if (!uploadName.test(name)) continue;
    if (collection === 'team') uploadNames.add(name);
    else item[field] = '';
  }
  // Only uploads already referenced by public team records may enter Git.
  // Other album uploads remain in the live data directory and private backups.
  for (const page of content.venturePages) if (Array.isArray(page.photos)) {
    page.photos = page.photos.filter(photo => !uploadName.test(path.basename(photo.src || '')) || uploadNames.has(path.basename(photo.src)));
  }
  return { content, uploadNames };
}

export async function backupContent(dataDir = process.env.DATA_DIR || path.join(root, 'data')) {
  const { content, uploadNames } = preparePublicContent(JSON.parse(await readFile(path.join(dataDir, 'content.json'), 'utf8')));
  await mkdir(path.join(root, 'backups/uploads'), { recursive: true });
  for (const name of uploadNames) await copyFile(path.join(dataDir, 'uploads', name), path.join(root, 'backups/uploads', name));
  await writeFile(path.join(root, 'backups/published-content.json'), JSON.stringify(content, null, 2));
  console.log('Public content snapshot updated. Admin credentials and unpublished content excluded.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  backupContent().catch(error => { console.error(error.message); process.exitCode = 1; });
}
