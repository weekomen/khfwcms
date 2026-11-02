import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parsePublicOrigin } from '../scripts/start-cpolar.mjs';

test('tunnel startup accepts an exact HTTPS origin and rejects unsafe or ambiguous values', () => {
  assert.equal(parsePublicOrigin('https://first.cpolar.example'), 'https://first.cpolar.example');
  assert.equal(parsePublicOrigin('https://next.cpolar.example:8443/'), 'https://next.cpolar.example:8443');
  for (const value of ['http://first.cpolar.example', 'https://first.cpolar.example/admin',
    'https://user:password@first.cpolar.example', 'https://first.cpolar.example/?next=admin',
    'https://first.cpolar.example/#admin', 'https://*.cpolar.example', 'https://localhost',
    'https://127.0.0.1', 'https://first.cpolar.example\\@other.example', '', 'https://first.cpolar.example\n']) {
    assert.throws(() => parsePublicOrigin(value), undefined, value);
  }
});

test('missing or invalid tunnel startup input exits without starting or changing a server', () => {
  const script = fileURLToPath(new URL('../scripts/start-cpolar.mjs', import.meta.url));
  assert.match(execFileSync(process.execPath, [script, '--help'], { encoding: 'utf8' }), /start:cpolar/);
  for (const args of [[], ['http://first.cpolar.example'], ['https://first.cpolar.example', 'extra']]) {
    assert.throws(() => execFileSync(process.execPath, [script, ...args], {
      env: { ...process.env, PUBLIC_ORIGIN: 'https://stale.cpolar.example' }, stdio: 'pipe'
    }), error => error.status === 1);
  }
});
