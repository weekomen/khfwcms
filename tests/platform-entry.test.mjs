import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const script = readFileSync(new URL('../public/platform-entry.js', import.meta.url), 'utf8');
test('old platform bookmarks move to the business origin while website anchors remain', () => {
  for (const hostname of ['kehoubang.cn', 'www.kehoubang.cn', 'localhost']) {
    for (const hash of ['#/index', '#/login?redirect=/index', '#home', '#services', '']) {
      let destination;
      runInNewContext(script, { window: { location: { hostname, hash, search: '?source=bookmark', replace: value => destination = value } } });
      assert.equal(destination, hostname !== 'localhost' && hash.startsWith('#/')
        ? 'https://khb.kehoubang.cn/?source=bookmark' + hash : undefined);
    }
  }
});
