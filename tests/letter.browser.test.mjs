import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { createSiteServer } from '../scripts/server.mjs';

let server, browser, base;
before(async () => {
  server = createSiteServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  await mkdir('test-results', { recursive: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'}: edit, QR, Unicode share, receiver and replay`, { timeout: 60000 }, async () => {
    const context = await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.screenshot({ path: `test-results/letters-${mobile ? 'mobile' : 'desktop'}-home.png`, fullPage: true });
    assert.equal(await page.locator('.template-card:visible').count(), 4);
    await page.locator('[data-filter="love"]').click();
    assert.equal(await page.locator('.template-card:visible').count(), 1);
    await page.locator('[data-template="love"]').click();
    await page.locator('#recipient').fill('Mẹ yêu ❤️');
    const message = 'Cảm ơn mẹ vì tất cả! 🌸\n\nChúc mẹ luôn bình an, hạnh phúc.\n<script>alert("không chạy")</script>';
    await page.locator('#message').fill(message);
    await page.locator('#sender').fill('Thảo Nguyễn');
    await page.locator('#speed').selectOption('instant');
    await page.locator('#music').uncheck();
    await page.locator('[data-theme="midnight"]').click();
    if (mobile) await page.locator('[data-tab="preview"]').click();
    await page.locator('#test-open').click();
    await page.waitForSelector('#preview-stage .reading-paper');
    assert.equal(await page.locator('#preview-stage .letter-content').textContent(), message);
    await page.screenshot({ path: `test-results/letters-${mobile ? 'mobile' : 'desktop'}-studio.png`, fullPage: true });
    await page.locator('#generate').click();
    await page.waitForSelector('#share-dialog[open]');
    assert.equal(await page.locator('#qr-code svg').count(), 1);
    const link = await page.locator('#share-url').inputValue();
    assert.ok(new URL(link).searchParams.has('letter'));
    const recipient = await context.newPage();
    recipient.on('pageerror', error => errors.push(error.message));
    await recipient.goto(link);
    await recipient.waitForSelector('#receiver-stage .seal-button');
    assert.equal(await recipient.locator('#header').isVisible(), false);
    // Tap the animated seal at its current position, as a person would.
    const seal = await recipient.locator('.seal-button').boundingBox();
    if (mobile) await recipient.touchscreen.tap(seal.x + seal.width / 2, seal.y + seal.height / 2);
    else await recipient.mouse.click(seal.x + seal.width / 2, seal.y + seal.height / 2);
    await recipient.waitForSelector('.reading-paper');
    assert.equal(await recipient.locator('.letter-content').textContent(), message);
    assert.ok((await recipient.locator('.letter-signature').textContent()).includes('Thảo Nguyễn'));
    assert.equal(await recipient.locator('.letter-content script').count(), 0);
    assert.ok(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await recipient.screenshot({ path: `test-results/letters-${mobile ? 'mobile' : 'desktop'}-receiver.png`, fullPage: true });
    await recipient.locator('#replay').click();
    await recipient.waitForSelector('.seal-button');
    await recipient.locator('#create-similar').click();
    assert.equal(await recipient.locator('#recipient').inputValue(), 'Mẹ yêu ❤️');
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test('typewriter completion, music controls, media failure and all template effects', { timeout: 60000 }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  for (const key of ['birthday', 'flowers', 'christmas', 'love']) {
    await page.locator(`[data-template="${key}"]`).click();
    assert.equal(await page.locator('#occasion').inputValue(), key);
    await page.locator('#back-home').click();
  }
  await page.locator('[data-create]').first().click();
  await page.locator('#message').fill('Thương bạn nhiều! ❤️');
  await page.locator('#speed').selectOption('slow');
  await page.locator('#photo').fill('https://media.invalid/anh.png');
  await page.route('https://media.invalid/**', route => route.abort());
  await page.locator('#generate').click();
  await page.waitForSelector('#share-dialog[open]');
  const link = await page.locator('#share-url').inputValue();
  await page.goto(link);
  await page.locator('.seal-button').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.reading-paper');
  await page.waitForFunction(() => document.querySelector('#sound-toggle').getAttribute('aria-pressed') === 'true');
  assert.ok((await page.locator('.letter-content').textContent()).length < 'Thương bạn nhiều! ❤️'.length);
  await page.locator('.skip-typing').click();
  assert.equal(await page.locator('.letter-content').textContent(), 'Thương bạn nhiều! ❤️');
  await page.waitForFunction(() => document.querySelector('.reading-paper .field-hint')?.textContent.includes('không tải được'));
  await page.locator('#sound-toggle').click();
  assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
  await page.locator('#sound-toggle').click();
  assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#replay').click();
  assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(errors, []);
  await context.close();
});

test('compressed long letter, malformed links, draft restoration and reduced motion', { timeout: 60000 }, async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base + '?letter=not-base64');
  await page.waitForSelector('#error-dialog[open]');
  await page.locator('#error-home').click();
  await page.locator('[data-create]').first().click();
  const message = 'Mẹ ơi, con thương mẹ rất nhiều! 🌷\n'.repeat(45);
  await page.locator('#message').fill(message);
  await page.locator('#music').uncheck();
  await page.waitForFunction(() => localStorage.getItem('tamgui-letter-v1')?.includes('Mẹ ơi'));
  await page.reload();
  assert.equal(await page.locator('#message').inputValue(), message);
  await page.locator('#generate').click();
  await page.waitForSelector('#share-dialog[open]');
  const link = await page.locator('#share-url').inputValue();
  assert.ok(new URL(link).searchParams.get('letter').startsWith('gz.'));
  assert.equal(await page.locator('#qr-code svg').count(), 1);
  await page.goto(link);
  await page.locator('.seal-button').click();
  await page.waitForSelector('.reading-paper');
  assert.equal(await page.locator('.letter-content').textContent(), message);
  await context.close();
});
