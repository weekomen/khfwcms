import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(root, 'public/assets/events');
const pageSize = 100;
const events = [
  { id: 'new-year-dinner-2026', orderId: '202601231723235078', title: '2026年书院世家别墅区年夜饭' },
  { id: 'new-year-dinner', orderId: '202501041904226753', title: '2025年书院世家别墅区年夜饭' }
];

const json = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
};
const form = orderId => new URLSearchParams({ orderId });
const api = 'https://www.yipai360.com';
const photoUrl = photo => `${photo.img.primary}${photo.img.path}${photo.img.s1080}`;
const safeName = (value, fallback) => String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

await mkdir(outputRoot, { recursive: true });
let manifest = {};
try { manifest = JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const event of events) {
  const detail = await json(`${api}/applet/v2/order/detail`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form(event.orderId) });
  const tagsResponse = await json(`${api}/applet/v2/order/get-tag-list`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form(event.orderId) });
  const first = await json(`${api}/api/v1/yipai/order/${event.orderId}/audience/photos?page=1&pageSize=${pageSize}`);
  const totalPage = Number(first.data?.pagination?.totalPage || 1);
  const photos = [...(first.data?.photos || [])];
  for (let page = 2; page <= totalPage; page += 1) {
    const result = await json(`${api}/api/v1/yipai/order/${event.orderId}/audience/photos?page=${page}&pageSize=${pageSize}`);
    photos.push(...(result.data?.photos || []));
  }
  const eventDir = path.join(outputRoot, event.id);
  await mkdir(eventDir, { recursive: true });
  const localPhotos = [];
  let completed = 0;
  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const fileName = `${String(index + 1).padStart(4, '0')}-${photo.photoId}-${safeName(photo.fname, 'photo')}.jpg`;
    const relative = `/assets/events/${event.id}/${fileName}`;
    const file = path.join(eventDir, fileName);
    const response = await fetch(photoUrl(photo));
    if (!response.ok) throw new Error(`${response.status} ${photoUrl(photo)}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    const tag = (tagsResponse.data || []).find(item => String(item.id) === String(photo.tagId));
    localPhotos.push({ id: String(photo.photoId), src: relative, thumb: relative, filename: photo.fname || fileName, tag: tag?.name || '', width: Number(photo.width) || 0, height: Number(photo.height) || 0, createdAt: photo.createDateTime || photo.createTime || '' });
    completed += 1;
    if (completed % 50 === 0 || completed === photos.length) console.log(`${event.title}: ${completed}/${photos.length}`);
  }
  manifest[event.id] = {
    id: event.id,
    orderId: event.orderId,
    title: event.title,
    subtitle: detail.data?.title || '',
    date: detail.data?.endTime || '',
    place: detail.data?.place || '',
    views: Number(detail.data?.pv || 0),
    cover: localPhotos[0]?.src || '',
    tags: (tagsResponse.data || []).sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0)).map(item => ({ id: String(item.id), name: item.name })),
    photos: localPhotos
  };
}
manifest['new-year-dinner-2027'] ||= {
  id: 'new-year-dinner-2027',
  title: '2027年书院世家别墅区年夜饭',
  subtitle: '现场照片将在活动后更新。',
  date: '2027年',
  place: '',
  views: 0,
  cover: '',
  tags: [],
  photos: []
};
await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${Object.values(manifest).reduce((sum, event) => sum + event.photos.length, 0)} local event photos.`);
