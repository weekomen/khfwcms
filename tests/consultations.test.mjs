import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import net from 'node:net';
import http from 'node:http';
import { isAllowedPath } from '../scripts/create-handoff.mjs';

const initialPassword = 'consultation-test-initial-token';
const password = 'Consultation test password across 82 rivers!';
const submission = (index, extra = {}) => ({ name: `咨询测试${index}`, phone: `1380000000${index}`, consent: true, website: '', page: '/content-page.html?type=business&id=supply-chain', ...extra });
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'khb-consultation-test-'));
  await writeFile(path.join(dir, 'admin-token'), initialPassword);
  const reservation = net.createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } };
  const start = async () => {
    let output = '';
    child = spawn(process.execPath, ['server.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DATA_DIR: dir, ADMIN_TOKEN: '', PUBLIC_ORIGIN: '', TRUST_PROXY: '', HOST: '127.0.0.1', PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Test server exited: ${output}`);
      try { if ((await fetch(origin + '/api/content')).ok) return; } catch {}
      await delay(100);
    }
    throw new Error('Test server startup timed out');
  };
  t.after(async () => {
    await stop();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith('khb-consultation-test-'));
    await rm(dir, { recursive: true, force: true });
  });
  await start();
  const api = (route, options) => fetch(origin + route, options);
  const submit = body => api('/api/consultations', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const login = async value => {
    const response = await api('/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }) });
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json();
    return { ...body, cookie: response.headers.get('set-cookie').split(';')[0] };
  };
  const headers = session => ({ Origin: origin, 'Content-Type': 'application/json', Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken });
  return { dir, origin, port, api, submit, login, headers, stop, start };
}

test('consultations validate, persist privately across concurrent writes and restart, and require admin session/CSRF', async t => {
  const { dir, origin, api, submit, login, headers, stop, start } = await fixture(t);
  assert.equal((await api('/api/consultations')).status, 405);
  assert.equal((await api('/api/admin/consultations')).status, 401);
  for (const requestHeaders of [
    { Origin: 'https://other.example' }, {}, { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }
  ]) assert.equal((await api('/api/consultations', { method: 'POST', headers: { 'Content-Type': 'application/json', ...requestHeaders }, body: JSON.stringify(submission(1)) })).status, 403);
  for (const invalid of [{ name: '' }, { name: '姓名\n换行' }, { phone: '123' }, { consent: false }, { page: '//other.example' }]) {
    assert.equal((await submit(submission(1, invalid))).status, 400);
  }
  assert.equal((await api('/api/consultations', { method: 'POST', headers: { Origin: origin }, body: '{}' })).status, 415);
  assert.equal((await api('/api/consultations', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: 'x'.repeat(4097) })).status, 413);
  assert.equal((await api('/api/consultations', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await submit(submission(1, { phone: '+86 138-0000-0001' }))).status, 201);
  const concurrent = await Promise.all([2, 3, 4].map(index => submit(submission(index))));
  concurrent.forEach(response => assert.equal(response.status, 201));
  assert.equal((await submit(submission(1))).status, 201);
  assert.equal((await submit(submission(5, { website: 'bot-filled-field' }))).status, 201);
  const saved = JSON.parse(await readFile(path.join(dir, 'consultations.json'), 'utf8'));
  assert.equal(saved.items.length, 4);
  assert.equal(new Set(saved.items.map(item => item.phone)).size, 4);
  assert.equal(saved.items[0].phone, '13800000001');
  assert.ok(saved.items.every(item => item.status === 'new'));
  assert.equal((await api('/consultations.json')).status, 404);
  assert.equal((await api('/data/consultations.json')).status, 404);
  assert.equal((await api('/api/content')).status, 200);
  assert.equal((await (await api('/api/content')).text()).includes('咨询测试'), false);
  assert.equal((await readFile(path.join(dir, 'content.json'), 'utf8')).includes('咨询测试'), false);
  assert.equal(isAllowedPath('data/consultations.json'), false);
  assert.equal(isAllowedPath('consultations.mjs'), true);

  const initial = await login(initialPassword);
  assert.equal((await api('/api/admin/consultations', { headers: headers(initial) })).status, 403);
  const changed = await api('/api/admin/password', { method: 'PUT', headers: headers(initial), body: JSON.stringify({ currentPassword: initialPassword, newPassword: password }) });
  assert.equal(changed.status, 200);
  let session = await login(password);
  const list = await (await api('/api/admin/consultations', { headers: headers(session) })).json();
  assert.equal(list.items.length, 4);
  const id = list.items[0].id;
  assert.equal((await api(`/api/admin/consultations/${id}`, { method: 'PATCH', headers: { Origin: origin, Cookie: session.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'contacted' }) })).status, 403);
  assert.equal((await api(`/api/admin/consultations/${id}`, { method: 'PATCH', headers: headers(session), body: JSON.stringify({ status: 'invalid' }) })).status, 400);
  const updated = await api(`/api/admin/consultations/${id}`, { method: 'PATCH', headers: headers(session), body: JSON.stringify({ status: 'contacted' }) });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).item.status, 'contacted');
  await stop(); await start();
  session = await login(password);
  const afterRestart = await (await api('/api/admin/consultations', { headers: headers(session) })).json();
  assert.equal(afterRestart.items.length, 4);
  assert.equal(afterRestart.items.find(item => item.id === id).status, 'contacted');
  assert.equal((await api(`/api/admin/consultations/${id}`, { method: 'DELETE', headers: headers(session) })).status, 200);
  assert.equal((await (await api('/api/admin/consultations', { headers: headers(session) })).json()).items.length, 3);
});

test('public consultation accepts matching HTTPS tunnel origin and bounds repeated attempts despite forged XFF', async t => {
  const { port, origin, api } = await fixture(t);
  const tunnelResult = await new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: '/api/consultations', method: 'POST', headers: {
      Host: 'example.cpolar.top', Origin: 'https://example.cpolar.top', 'Content-Type': 'application/json'
    } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', reject); request.end(JSON.stringify(submission(1)));
  });
  assert.equal(tunnelResult, 201);
  for (let index = 0; index < 19; index++) {
    const response = await api('/api/consultations', { method: 'POST', headers: {
      Origin: origin, 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${index + 1}`, 'X-Real-IP': `203.0.113.${index + 1}`
    }, body: JSON.stringify(submission(1)) });
    assert.equal(response.status, 201);
  }
  const limited = await api('/api/consultations', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.254' }, body: JSON.stringify(submission(2)) });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
