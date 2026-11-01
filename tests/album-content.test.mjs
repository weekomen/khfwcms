import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent } from '../validation.mjs';
import { preparePublicContent } from '../scripts/backup-content.mjs';
import { validatePublicData } from '../scripts/create-handoff.mjs';

const seed = JSON.parse(await readFile(new URL('../data/seed.json', import.meta.url), 'utf8'));
const photo = (suffix = 'one') => ({ id: `photo-${suffix}`, src: `/assets/album-${suffix}.jpg`, filename: '公司年夜饭合影.jpg', tag: '公司年夜饭', width: 1800, height: 1200 });
const fixture = () => {
  const content = structuredClone(seed);
  content.venturePages[0].photos = [photo()];
  return content;
};

test('venture albums accept bounded local photographs without changing older page records', () => {
  assert.doesNotThrow(() => validateContent(seed));
  const content = fixture();
  assert.doesNotThrow(() => validateContent(content));
  content.venturePages[0].photos = Array.from({ length: 500 }, (_, index) => photo(String(index)));
  assert.doesNotThrow(() => validateContent(content));
  content.venturePages[0].photos.push(photo('overflow'));
  assert.throws(() => validateContent(content), /相册照片/);
});

test('album validation rejects external or executable sources, duplicate records and unsafe metadata', () => {
  const rejects = [
    { src: 'https://example.com/photo.jpg' }, { src: '//example.com/photo.jpg' },
    { src: '/assets/../secret.jpg' }, { src: '/assets/photo.svg' }, { src: '/assets/photo.jpg?other=1' },
    { id: 'Photo_UPPER' }, { width: 0 }, { height: 2.5 }, { width: 100001 },
    { filename: 'x'.repeat(201) }, { tag: 'x'.repeat(101) }, { privateNote: 'must never persist' }
  ];
  for (const change of rejects) {
    const content = fixture(); Object.assign(content.venturePages[0].photos[0], change);
    assert.throws(() => validateContent(content), undefined, JSON.stringify(change));
  }
  for (const duplicate of [photo(), { ...photo('two'), src: photo().src }]) {
    const content = fixture(); content.venturePages[0].photos.push(duplicate);
    assert.throws(() => validateContent(content), /唯一|重复/);
  }
  const unrelated = structuredClone(seed); unrelated.businessPages[0].photos = [photo()];
  assert.throws(() => validateContent(unrelated), /未声明字段/);
});

test('public snapshots omit draft activities and album uploads not referenced by public team records', () => {
  const source = fixture();
  const teamName = `upload-${'a'.repeat(32)}.jpg`, albumName = `upload-${'b'.repeat(32)}.png`;
  source.team[0].image = `/assets/${teamName}`;
  source.venturePages[0].photos = [
    photo(), { ...photo('team'), src: `/assets/${teamName}` }, { ...photo('private'), src: `/assets/${albumName}` }
  ];
  source.venturePages.push({ id: 'private-dinner', title: '尚未发布', summary: '', body: '', published: false, photos: [photo('draft')] });
  const original = structuredClone(source);
  const { content, uploadNames } = preparePublicContent(source);
  assert.deepEqual(source, original, 'Snapshot generation must not mutate the maintained content');
  assert.deepEqual(content.venturePages[0].photos.map(item => item.id), ['photo-one', 'photo-team']);
  assert.equal(content.venturePages.some(page => page.id === 'private-dinner'), false);
  assert.deepEqual([...uploadNames], [teamName]);
  assert.doesNotThrow(() => validateContent(content));
  assert.doesNotThrow(() => validatePublicData(content, 'Fixture snapshot'));
});

test('handoff rejects unapproved album uploads and draft activity pages', () => {
  const content = fixture(); content.venturePages[0].photos[0].src = `/assets/upload-${'c'.repeat(32)}.webp`;
  assert.throws(() => validatePublicData(content, 'Fixture snapshot'), /相册上传照片/);
  content.venturePages[0].photos = [photo()]; content.venturePages[0].published = false;
  assert.throws(() => validatePublicData(content, 'Fixture snapshot'), /未发布活动页面/);
});
