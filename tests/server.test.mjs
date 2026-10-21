import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createSiteServer } from '../scripts/server.mjs';

let server, base;
before(async () => {
  server = createSiteServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('serves the standalone letter service and local assets', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /id="studio-view"/);
  assert.match(html, /id="receiver-view"/);
  for (const [, path] of html.matchAll(/(?:src|href)="((?:scripts|styles|assets)\/[^"#]+)"/g)) {
    const asset = await fetch(`${base}/${path}`);
    assert.equal(asset.status, 200, path);
  }
  const font = await fetch(base + '/assets/fonts/charm/files/charm-vietnamese-400-normal.woff2');
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
});

test('supports font ranges and rejects invalid byte ranges', async () => {
  const url = base + '/assets/fonts/charm/files/charm-vietnamese-400-normal.woff2';
  const response = await fetch(url, { headers: { Range: 'bytes=0-99' } });
  assert.equal(response.status, 206);
  assert.equal((await response.arrayBuffer()).byteLength, 100);
  assert.equal((await fetch(url, { headers: { Range: 'bytes=99-4' } })).status, 416);
});

test('does not expose private files or the old project', async () => {
  for (const path of ['/.git/config', '/package.json', '/.firebaserc', '/scripts/server.mjs', '/original.html', '/assets/missing.png']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});
