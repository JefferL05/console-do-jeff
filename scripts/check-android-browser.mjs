import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { KEY, decode } from '../public/jogos/petroleo/enterprise/persistence.js';

const root = resolve('mobile/www'), output = resolve(process.env.OURO_SCREENSHOTS || '.ouro-android-screenshots'); await mkdir(output, { recursive: true });
const server = http.createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname, file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(file); response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] || 'application/octet-stream'); response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
let nativeState = {}, initialized = false, exported = null, importRaw = null, exits = 0, nativeFailure = false;
const calls = [], errors = [], external = [];
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await context.exposeBinding('ouroTestBridge', async (_, method, options) => {
    calls.push(method);
    if (method === 'loadState') return { initialized, values: structuredClone(nativeState) };
    if (method === 'saveState') { if (nativeFailure) throw new Error('native write failure'); nativeState = structuredClone(options.values); initialized = true; return {}; }
    if (method === 'requestAudioFocus') return { available: true };
    if (method === 'exportSave') { exported = options.raw; return {}; }
    if (method === 'importSave') return { raw: importRaw || exported };
    if (method === 'exit') exits++;
    return {};
  });
  await context.addInitScript(() => { window.Capacitor = { getPlatform: () => 'android', nativePromise: (_, method, options) => window.ouroTestBridge(method, options) }; });
  await context.route('**/*', route => { if (!route.request().url().startsWith(origin)) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}
async function flush(page) { await page.evaluate(async () => { const native = await import('/jogos/petroleo/mobile/native.js'); await native.flushNativeStorage(); }); }
const saved = () => JSON.parse(nativeState[KEY]);
try {
  let { context, page } = await newPage();
  await page.goto(origin); await page.locator('a[href$="campanha/index.html"]').click();
  await page.locator('[data-action="safe"]').click(); await page.locator('#launch').click(); await flush(page);
  assert.ok(decode(nativeState[KEY])); assert.equal(saved().operation.paused, false);
  await page.waitForFunction(() => window.ouroExperience?.audio.diagnostics().state === 'running');
  assert.equal(await page.evaluate(() => window.ouroExperience.audio.diagnostics().loops), 1);
  await page.locator('#enterprise-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#enterprise-canvas').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y }, { x: x + 30, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 70, y }, { x: x + 70, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(await page.locator('#zoom-level').textContent(), '1×'); assert.equal(await page.locator('#confirm-action').isVisible(), false);
  await page.locator('#center-field').click(); assert.equal(await page.locator('#zoom-level').textContent(), '1×');
  async function tapWorld(px, py) {
    await page.locator('#enterprise-canvas').scrollIntoViewIfNeeded();
    const bounds = await page.locator('#enterprise-canvas').boundingBox(), scale = Math.min(bounds.width / 960, bounds.height / 600);
    await page.touchscreen.tap(bounds.x + (bounds.width - 960 * scale) / 2 + px * scale, bounds.y + (bounds.height - 600 * scale) / 2 + py * scale);
  }
  const pocket = saved().operation.pockets[0];
  await tapWorld(pocket.x, pocket.y); await page.locator('#confirm-action').click();
  await page.locator('[data-panel="network"]').click(); await page.locator('[data-tool="rig"]').click();
  await tapWorld(pocket.x, 110); await page.locator('#confirm-action').click();
  await tapWorld(pocket.x, pocket.y); await page.locator('#confirm-action').click(); await flush(page);
  assert.equal(saved().operation.edges.length, 1); assert.ok(saved().operation.cash < 2400);
  await page.locator('#toggle-controls').click(); assert.equal(await page.locator('.operation-controls').isVisible(), false);
  await page.locator('#toggle-controls').click(); assert.equal(await page.locator('.operation-controls').isVisible(), true);
  await page.locator('#mobile-settings-button').click(); await page.locator('#mobile-music').fill('20'); await page.locator('#mobile-effects').fill('40');
  await page.locator('#mobile-quality').selectOption('low'); await page.locator('#mobile-mute').check();
  await page.waitForFunction(() => window.ouroExperience.audio.diagnostics().state === 'suspended');
  await page.locator('#mobile-mute').uncheck(); await page.locator('#mobile-settings-close').click();
  await page.locator('#pause-operation').click();
  await page.waitForFunction(() => window.ouroExperience.audio.diagnostics().state === 'running');
  for (let i = 0; i < 3; i++) { await page.locator('#pause-operation').click(); await page.locator('#pause-operation').click(); }
  assert.equal(await page.evaluate(() => window.ouroExperience.audio.diagnostics().loops), 1);
  const measurement = await page.evaluate(async () => {
    const { EnterpriseRenderer } = await import('/jogos/petroleo/enterprise/renderer.js'), original = EnterpriseRenderer.prototype.draw;
    let frames = 0, renderMs = 0; const start = performance.now();
    EnterpriseRenderer.prototype.draw = function(...args) { const at = performance.now(); const result = original.apply(this, args); frames++; renderMs += performance.now() - at; return result; };
    await new Promise(resolve => setTimeout(resolve, 2000)); EnterpriseRenderer.prototype.draw = original;
    return { fps: Math.round(frames * 1000 / (performance.now() - start)), averageRenderMs: Number((renderMs / Math.max(1, frames)).toFixed(2)), viewport: `${innerWidth}×${innerHeight}`, quality: window.ouroExperience.settings.quality };
  });
  console.log('MEASURE Chromium desktop headless, mobile emulation, native API doubles:', measurement);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ouro:audio-focus', { detail: { available: false } })));
  await flush(page); assert.equal(saved().operation.paused, true); await page.waitForFunction(() => window.ouroExperience.audio.diagnostics().state === 'suspended');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ouro:audio-focus', { detail: { available: true } })));
  assert.equal(await page.evaluate(() => window.ouroExperience.audio.diagnostics().running), false);
  await page.setViewportSize({ width: 844, height: 390 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: join(output, 'android-landscape.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#saves-button').click(); await page.locator('#export-save').click(); assert.ok(decode(exported));
  importRaw = exported; await page.locator('#import-save').click(); await page.locator('#confirm-import').click();
  await page.locator('#saves-button').click(); await page.evaluate(() => window.dispatchEvent(new Event('ouro:native-back'))); assert.equal(await page.locator('#saves-dialog').isVisible(), false);
  await page.evaluate(() => window.dispatchEvent(new Event('ouro:native-pause'))); await flush(page);
  const before = saved().operation.cash;
  await page.screenshot({ path: join(output, 'android-portrait.png'), fullPage: true });
  await context.close();
  ({ context, page } = await newPage()); await page.goto(origin + '/jogos/petroleo/campanha/index.html'); await page.locator('#pause-operation').waitFor();
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).operation.cash, KEY), before);
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).operation.paused, KEY), true);
  assert.equal(await page.evaluate(() => window.ouroExperience.settings.music), .2);
  assert.equal(await page.evaluate(() => window.ouroExperience.settings.effects), .4);
  await page.evaluate(() => window.dispatchEvent(new Event('ouro:native-back')));
  await page.locator('#mobile-exit-confirm').click(); assert.equal(exits, 1);
  // A rejected atomic native write retains local progress and retries on the next flush.
  nativeFailure = true;
  await page.evaluate(() => localStorage.setItem('ouro-native-test', 'preserved'));
  await flush(page); assert.equal(await page.evaluate(() => localStorage.getItem('ouro-native-test')), 'preserved');
  nativeFailure = false; await flush(page); assert.equal(nativeState['ouro-native-test'], 'preserved');
  await context.close();
  ({ context, page } = await newPage()); await page.goto(origin + '/jogos/petroleo/index.html');
  await page.locator('#start').click(); await page.locator('#pause').click(); assert.equal(await page.locator('#mobile-settings-button').isVisible(), true);
  await page.locator('#mobile-settings-button').click(); await page.locator('#mobile-settings-close').click();
  await flush(page); assert.ok(nativeState['ouro-subsolo-save-v2']);
  await context.close();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.ok(calls.includes('importSave') && calls.includes('exportSave') && calls.includes('saveState'));
  console.log('PASS offline multi-page package, native bridge contract doubles, real Web Audio, multitouch pinch, orientation, native back/focus, process-restart save hydration and SAF import/export contracts.');
  console.log('Environment: desktop Chromium with mobile emulation and native API doubles; not an Android device test.');
} finally { await browser.close(); server.close(); }
