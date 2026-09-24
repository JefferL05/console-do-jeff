import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Optional developer check. Keep Playwright outside production dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const output = resolve(process.env.OURO_SCREENSHOTS || '.ouro-screenshots');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const base = process.env.OURO_URL || 'http://localhost:4321/jogos/petroleo/';
const errors = [];
const saveKey = 'ouro-subsolo-save-v2';
async function saved(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey); }
async function fieldPoint(page, p) {
  return page.evaluate(({ x, y }) => {
    const r = document.getElementById('game').getBoundingClientRect(), s = Math.min(r.width / 360, r.height / 350);
    return { x: r.x + (r.width - 360 * s) / 2 + x * s, y: r.y + (r.height - 350 * s) / 2 + y * s };
  }, p);
}
async function tapField(page, p) { const point = await fieldPoint(page, p); await page.touchscreen.tap(point.x, point.y); }
async function layout(page, label) {
  const state = await page.evaluate(() => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    return {
      height: innerHeight, width: innerWidth, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth,
      field: rect(document.querySelector('.field')), controls: rect(document.querySelector('.controls')),
      buttons: [...document.querySelectorAll('.game-shell button')].filter(b => !b.hidden && b.getBoundingClientRect().width).map(b => ({ id: b.id, ...rect(b) })),
    };
  });
  assert.ok(state.scrollHeight <= state.height + 1, `${label}: vertical overflow ${JSON.stringify(state)}`);
  assert.ok(state.scrollWidth <= state.width + 1, `${label}: horizontal overflow`);
  assert.ok(state.controls.bottom <= state.height + 1, `${label}: controls clipped`);
  assert.ok(state.field.height >= 100, `${label}: field too small`);
  for (const b of state.buttons) { assert.ok(b.width >= 47.9 && b.height >= 47.9, `${label}: target ${b.id} is ${b.width}×${b.height}`); }
  console.log(`PASS layout ${label}: field ${Math.round(state.field.width)}×${Math.round(state.field.height)}, no overflow, 48px targets`);
}

try {
  for (const [width, height] of [[360, 640], [390, 844], [412, 915]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base); await page.locator('#start').tap();
    await page.waitForFunction(() => !document.getElementById('home').open);
    await layout(page, `${width}×${height}`);
    const original = await saved(page), pocket = original.game.pockets[0];
    if (width === 360) {
      const cdp = await context.newCDPSession(page), p = await fieldPoint(page, pocket);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + 35, y: p.y + 10 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.locator('#confirm').isVisible(), false, 'Drag is not a tap');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal(await page.locator('#confirm').isVisible(), false, 'Cancelled pointer is not a tap');
      assert.equal((await saved(page)).game.cash, 1500);
      console.log('PASS real touch drag and pointer cancellation');
      await cdp.detach();
    }
    await tapField(page, pocket); assert.equal(await page.locator('#confirm').isVisible(), true);
    assert.equal((await saved(page)).game.cash, 1500);
    await page.locator('#cancel').tap(); assert.equal(await page.locator('#confirm').isVisible(), false); assert.equal((await saved(page)).game.cash, 1500);
    await tapField(page, pocket); await page.locator('#confirm').tap(); assert.equal((await saved(page)).game.cash, 1420);
    await page.locator('#drill').tap(); await tapField(page, pocket);
    await page.locator('#confirm').tap(); assert.equal((await saved(page)).game.wells.length, 1);
    await page.waitForFunction(() => window.ouroDiagnostics?.fps > 0);
    await page.screenshot({ path: resolve(output, `ouro-${width}x${height}.png`) });
    console.log(`MEASURE ${width}×${height}`, await page.evaluate(() => window.ouroDiagnostics));
    await page.locator('#pause').tap();
    const paused = await saved(page); await page.reload(); await page.locator('#continue').tap();
    const restored = await saved(page); assert.equal(restored.game.cash, paused.game.cash); assert.deepEqual(restored.game.trucks, paused.game.trucks);
    await page.setViewportSize({ width: height, height: width });
    await page.waitForFunction(() => document.getElementById('game').width > 0);
    await layout(page, `${height}×${width}`);
    await page.locator('#drill').tap();
    await tapField(page, pocket); assert.match(await page.locator('#selection-title').textContent(), /Reserva · \d+ barris/);
    await page.screenshot({ path: resolve(output, `ouro-${height}x${width}.png`) });
    await page.locator('#cancel').tap();

    if (width === 390) {
      await page.setViewportSize({ width, height });
      // Install the virtual clock before the new document schedules animation
      // frames; mixing an already pending native rAF with mocked timers is flaky.
      await page.clock.install();
      await page.reload(); await page.locator('#continue').tap();
      await page.clock.runFor(20000);
      const delivered = (await saved(page)).game;
      assert.ok(delivered.sold > 0, `First delivery within one minute: ${JSON.stringify({ time: delivered.time, paused: delivered.paused, trucks: delivered.trucks })}`);
      await page.locator('#upgrades').tap(); assert.equal(await page.locator('#tank').isDisabled(), false);
      await page.locator('#truck').tap(); assert.equal((await saved(page)).game.trucks.length, 2);
      await page.locator('#close-upgrades').tap();
      await page.locator('#hold').tap();
      await page.clock.runFor(10000);
      await page.locator('#east').tap();
      await page.clock.runFor(175000);
      assert.equal(await page.locator('#result').evaluate(e => e.open), true);
      const ended = await saved(page); assert.equal(ended.game.time, 0); assert.ok(ended.game.rewarded); assert.equal(ended.progress.unlocked, 1);
      await page.screenshot({ path: resolve(output, 'ouro-result.png') });
      await page.locator('#inspect').tap(); await tapField(page, ended.game.pockets[2]);
      assert.match(await page.locator('#selection-title').textContent(), /Reserva/);
      await page.locator('#pause').tap(); await page.locator('#next').tap();
      assert.equal(await page.locator('[data-profile="1"]').isDisabled(), false);
      await page.locator('#start').tap(); assert.equal((await saved(page)).game.profile, 1);
      console.log('PASS complete touch-only match, deliveries, upgrade, storage, final result, inspection, progression');
    }
    console.log(`PASS touch preview/cancel/drill/save/resume/rotation ${width}×${height}`);
    await context.close();
  }
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const desktopPage = await desktop.newPage(); desktopPage.on('pageerror', e => errors.push(e.message));
  await desktopPage.goto(base); await desktopPage.locator('#start').click();
  await layout(desktopPage, 'desktop 1280×800, reduced motion');
  await desktopPage.locator('#game').focus();
  await desktopPage.keyboard.press('ArrowRight'); await desktopPage.keyboard.press('Enter');
  assert.equal(await desktopPage.locator('#confirm').isVisible(), true);
  await desktopPage.keyboard.press('Escape'); assert.equal(await desktopPage.locator('#confirm').isVisible(), false);
  await desktopPage.keyboard.press('Space'); assert.equal(await desktopPage.locator('#menu').evaluate(e => e.open), true);
  await desktopPage.locator('#resume').click();
  await desktopPage.screenshot({ path: resolve(output, 'ouro-desktop.png') });
  await desktop.close();
  console.log('PASS desktop mouse, keyboard preview/cancel/pause, reduced-motion preference');
  // Storage denial and invalid data are real browser failure paths.
  for (const blocked of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ blocked, key }) => {
      if (blocked) {
        Storage.prototype.getItem = () => { throw new Error('blocked'); };
        Storage.prototype.setItem = () => { throw new Error('blocked'); };
      } else localStorage.setItem(key, '{invalid');
    }, { blocked, key: saveKey });
    await page.goto(base); await page.locator('#start').tap(); await layout(page, blocked ? 'storage blocked' : 'corrupt save');
    await context.close();
  }
  assert.deepEqual(errors, [], 'No unhandled browser errors');
  console.log(`PASS browser checks. Screenshots: ${output}`);
} finally { await browser.close(); }
