import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, unlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { buildHandoffPlan, isAllowedPath, requiredFiles } from '../scripts/create-handoff.mjs';
import { verifyHandoff } from '../scripts/verify-handoff.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const minimalContent = {
  site: { name: 'Fixture', tagline: '', headline: 'Fixture headline', intro: '', about: '', phone: '', email: '', address: '', filing: '' },
  services: [], courses: [], team: [], news: []
};
function fixture() {
  const blobs = new Map(requiredFiles.map(file => [file, Buffer.from('Public source fixture\n')]));
  for (const file of ['data/seed.json', 'backups/published-content.json']) blobs.set(file, Buffer.from(JSON.stringify(minimalContent)));
  blobs.set('deploy/khfwcms.env.example', Buffer.from('NODE_ENV=production\nHOST=127.0.0.1\nPUBLIC_ORIGIN=https://example.com\n'));
  const entries = () => [...blobs.keys()].map(file => ({ path: file, mode: '100644', type: 'blob' }));
  const read = file => { if (!blobs.has(file)) throw Error(`Missing fixture ${file}`); return blobs.get(file); };
  return { blobs, entries, read };
}
async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'khb-handoff-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('khb-handoff-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('handoff allowlist excludes credentials, work files and unused uploads while retaining the safe environment example', () => {
  const data = fixture();
  const upload = `upload-${'a'.repeat(32)}.png`;
  const stale = `upload-${'b'.repeat(32)}.jpg`;
  const snapshot = structuredClone(minimalContent);
  snapshot.team.push({ name: 'Public member', role: '', bio: '', category: '', image: '/assets/' + upload });
  data.blobs.set('backups/published-content.json', Buffer.from(JSON.stringify(snapshot)));
  data.blobs.set('backups/uploads/' + upload, Buffer.from('public image fixture'));
  const forbidden = [
    'data/content.json', 'data/admin-token', 'data/admin-auth.json', '.env', 'deploy/production.env',
    'deploy/khfwcms.env', 'deploy/private.key', 'docs/source.pptx', 'docs/clipboard.txt',
    'scripts/debug.log', 'tests/screenshot.png', 'public/assets/screenshot.png', 'public/assets/raw.pptx',
    'backups/uploads/' + stale, '.git/config', '../outside.txt'
  ];
  forbidden.forEach(file => data.blobs.set(file, Buffer.from('private fixture')));
  const plan = buildHandoffPlan(data.entries(), data.read);
  const included = new Set(plan.files.map(file => file.path));
  assert.ok(included.has('deploy/khfwcms.env.example'));
  assert.ok(included.has('backups/uploads/' + upload));
  for (const file of forbidden) assert.equal(included.has(file), false, file);
  for (const file of ['/absolute.txt', 'C:\\secret', 'docs/../README.md', 'docs//README.md', 'docs/file\nname.md']) assert.equal(isAllowedPath(file), false);
});

test('handoff fails closed on symlinks, drafts, unknown content fields and secret configuration', () => {
  const data = fixture();
  const symbolic = data.entries(); symbolic.find(entry => entry.path === 'README.md').mode = '120000';
  assert.throws(() => buildHandoffPlan(symbolic, data.read), /符号链接/);
  const draft = { id: 'draft', title: 'Private fixture', category: '', date: '', summary: '', body: '', source: '', published: false };
  for (const name of ['data/seed.json', 'backups/published-content.json']) {
    const original = data.blobs.get(name);
    data.blobs.set(name, Buffer.from(JSON.stringify({ ...minimalContent, news: [draft] })));
    assert.throws(() => buildHandoffPlan(data.entries(), data.read), /未发布文章/);
    data.blobs.set(name, original);
  }
  data.blobs.set('backups/published-content.json', Buffer.from(JSON.stringify({ ...minimalContent, internalNotes: 'Not public' })));
  assert.throws(() => buildHandoffPlan(data.entries(), data.read), /未声明字段/);
  data.blobs.set('backups/published-content.json', Buffer.from(JSON.stringify(minimalContent)));
  const example = data.blobs.get('deploy/khfwcms.env.example');
  data.blobs.set('deploy/khfwcms.env.example', Buffer.from('ADMIN_TOKEN=private-fixture\n'));
  assert.throws(() => buildHandoffPlan(data.entries(), data.read), /凭据赋值/);
  data.blobs.set('deploy/khfwcms.env.example', Buffer.from('# ADMIN_TOKEN=private-fixture\n'));
  assert.throws(() => buildHandoffPlan(data.entries(), data.read), /凭据赋值/);
  data.blobs.set('deploy/khfwcms.env.example', example);
  data.blobs.set('README.md', Buffer.from('-----BEGIN ' + 'PRIVATE KEY-----'));
  assert.throws(() => buildHandoffPlan(data.entries(), data.read), /疑似私钥/);
});

test('unpacked handoff verifies every file and rejects corruption and unlisted files', async t => {
  const directory = await temporaryDirectory(t);
  const data = fixture();
  const { files } = buildHandoffPlan(data.entries(), data.read);
  for (const [file, bytes] of data.blobs) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), bytes);
  }
  await writeFile(path.join(directory, 'HANDOVER-MANIFEST.json'), JSON.stringify({ version: 1, archivePrefix: 'khfwcms/', sourceCommit: 'a'.repeat(40), files }));
  assert.equal((await verifyHandoff(directory)).files, files.length);
  await writeFile(path.join(directory, 'README.md'), 'Modified');
  await assert.rejects(verifyHandoff(directory), /校验失败/);
  await writeFile(path.join(directory, 'README.md'), data.read('README.md'));
  await writeFile(path.join(directory, '.env'), 'PRIVATE=fixture');
  await assert.rejects(verifyHandoff(directory), /清单以外/);
  await unlink(path.join(directory, '.env'));
  const missing = path.join(directory, 'public', 'index.html');
  await unlink(missing);
  await assert.rejects(verifyHandoff(directory), /缺少文件/);
});

// Inspect only the small ZIP generated by Git in the following test; no extractor dependency.
function gitArchiveEntries(bytes) {
  let end = bytes.length - 22;
  while (end >= 0 && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'ZIP end record');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const entries = new Map();
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const method = bytes.readUInt16LE(offset + 10), size = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32);
    const name = bytes.toString('utf8', offset + 46, offset + 46 + nameLength), local = bytes.readUInt32LE(offset + 42);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const compressed = bytes.subarray(start, start + size);
    entries.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
test('installed Git puts the manifest inside the prefix and creates byte-identical archives', async t => {
  if (!existsSync(path.join(root, '.git'))) { t.skip('Archive reproduction requires a Git checkout; other checks run in source-only packages.'); return; }
  const directory = await temporaryDirectory(t), manifestPath = path.join(directory, 'HANDOVER-MANIFEST.json');
  const manifest = Buffer.from('{"fixture":true}\n');
  await writeFile(manifestPath, manifest);
  const runGit = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  const commit = runGit('rev-parse', 'HEAD').toString().trim();
  const first = path.join(directory, 'first.zip'), second = path.join(directory, 'second.zip');
  const archive = output => runGit('-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'archive', '--format=zip', '--prefix=khfwcms/', '--mtime=2020-01-02T03:04:05Z', `--add-file=${manifestPath}`, `--output=${output}`, commit, '--', 'README.md');
  archive(first);
  await utimes(manifestPath, new Date('2025-01-01'), new Date('2025-01-01'));
  archive(second);
  const firstBytes = await readFile(first);
  assert.ok(firstBytes.equals(await readFile(second)), 'Repeated archives must be byte-identical');
  const entries = gitArchiveEntries(firstBytes);
  assert.deepEqual(entries.get('khfwcms/HANDOVER-MANIFEST.json'), manifest);
  assert.ok(entries.get('khfwcms/README.md').equals(runGit('show', `${commit}:README.md`)), 'Archived README must exactly match its Git blob');
  assert.equal(entries.has('HANDOVER-MANIFEST.json'), false);
});
