import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tunnelEnvironment } from '../scripts/start-tunnel.mjs';

const runFile = promisify(execFile);

test('tunnel setup accepts HTTPS site and admin addresses without changing existing runtime data settings', () => {
  const existing = Object.freeze({ HOST: '0.0.0.0', PUBLIC_ORIGIN: 'https://previous.example.test', TRUST_PROXY: '', PORT: '3301', DATA_DIR: 'existing-data', NODE_ENV: 'production', ADMIN_TOKEN: 'test-only-env-token' });
  for (const address of ['https://TUNNEL.example.test', 'https://tunnel.example.test/', 'https://tunnel.example.test/admin', 'https://tunnel.example.test/admin/']) {
    const result = tunnelEnvironment(address, existing);
    assert.deepEqual(result, { ...existing, HOST: '127.0.0.1', PUBLIC_ORIGIN: 'https://tunnel.example.test', TRUST_PROXY: 'loopback' });
    assert.notEqual(result, existing);
  }
  assert.equal(existing.HOST, '0.0.0.0');
  assert.equal(existing.PUBLIC_ORIGIN, 'https://previous.example.test');
  assert.equal(tunnelEnvironment('https://tunnel.example.test:8443/admin', {}).PUBLIC_ORIGIN, 'https://tunnel.example.test:8443');
});

test('tunnel setup rejects insecure URLs, embedded credentials and unrelated paths', () => {
  for (const address of [undefined, '', 'tunnel.example.test', 'http://tunnel.example.test', 'ftp://tunnel.example.test', 'https://user:password@tunnel.example.test', 'https://user@tunnel.example.test', 'https://tunnel.example.test?mode=admin', 'https://tunnel.example.test/#admin', 'https://tunnel.example.test/admin?mode=edit', 'https://tunnel.example.test/admin.html', 'https://tunnel.example.test/api/admin', 'https://tunnel.example.test/other']) {
    assert.throws(() => tunnelEnvironment(address, {}), Error, String(address));
  }
});

test('invalid tunnel command arguments fail before starting the server or creating runtime data', async t => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'khb-tunnel-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()));
    assert.ok(path.basename(temporary).startsWith('khb-tunnel-test-'));
    await rm(temporary, { recursive: true, force: true });
  });
  const script = fileURLToPath(new URL('../scripts/start-tunnel.mjs', import.meta.url));
  for (const args of [[], ['https://tunnel.example.test', 'unexpected'], ['http://tunnel.example.test']]) {
    await assert.rejects(runFile(process.execPath, [script, ...args], {
      env: { ...process.env, DATA_DIR: path.join(temporary, 'must-not-be-created'), PORT: '0', ADMIN_TOKEN: '', PUBLIC_ORIGIN: '', TRUST_PROXY: '' },
      timeout: 5000,
      windowsHide: true
    }), error => {
      assert.equal(error.code, 1);
      assert.equal(error.killed, false);
      assert.equal(error.stdout, '');
      assert.match(error.stderr, /用法|HTTPS/);
      return true;
    });
    assert.deepEqual(await readdir(temporary), []);
  }
});
