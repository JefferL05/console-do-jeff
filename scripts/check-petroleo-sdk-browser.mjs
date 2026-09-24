import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = resolve('artifacts/ouro-playables');
// Official test-suite CSP, as published on 2025-08-20.
const csp = "default-src 'none'; script-src 'report-sample' 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.youtube.com/game_api/v0 https://www.youtube.com/game_api/v0/ https://www.youtube.com/game_api/v1 https://www.youtube.com/game_api/v1/; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' blob: data:; sandbox allow-pointer-lock allow-same-origin allow-scripts; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:";
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const errors = [];
const mockSource = `
  window.__host = { calls: [], saves: [], scores: [], audio: false, paused: false, draws: 0, violations: [] };
  const host = window.__host, hooks = {};
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function(...args) { host.draws++; return draw.apply(this, args); };
  document.addEventListener('securitypolicyviolation', e => host.violations.push(e.violatedDirective));
  const listen = document.addEventListener.bind(document);
  document.addEventListener = (type, ...args) => { if (type === 'visibilitychange') throw Error('Forbidden visibility API in hosted game'); return listen(type, ...args); };
  Storage.prototype.getItem = Storage.prototype.setItem = () => { throw Error('Forbidden browser storage in hosted game'); };
  Object.defineProperty(navigator, 'language', { get() { throw Error('Forbidden web locale API'); } });
  host.pause = () => { host.paused = true; hooks.pause(); };
  host.resume = () => { host.paused = false; hooks.resume(); };
  host.mute = value => { host.audio = !value; hooks.audio(!value); };
  window.ytgame = {
    IN_PLAYABLES_ENV: true,
    game: {
      firstFrameReady() { host.calls.push('first'); },
      gameReady() { host.calls.push('ready'); },
      async loadData() { host.calls.push('load'); const data = await window.cloudLoad(); host.calls.push('loaded'); return data; },
      async saveData(raw) { if (!host.calls.includes('loaded')) throw Error('Write before load'); await window.cloudSave(raw); host.saves.push(JSON.parse(raw)); }
    },
    system: { isAudioEnabled: () => host.audio, getLanguage: async () => 'en-US', onAudioEnabledChange: cb => hooks.audio = cb, onPause: cb => hooks.pause = cb, onResume: cb => hooks.resume = cb },
    engagement: { sendScore: async score => host.scores.push(score.value) },
    health: { logWarning() { host.calls.push('warning'); } }
  };
`;
try {
  for (const failFirstLoad of [false, true]) {
    let cloud = '', loads = 0;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await context.exposeBinding('cloudLoad', () => { if (++loads === 1 && failFirstLoad) throw Error('Temporary cloud outage'); return cloud; });
    await context.exposeBinding('cloudSave', (_, raw) => { cloud = raw; });
    await context.route('https://www.youtube.com/game_api/v1', route => route.fulfill({ contentType: 'text/javascript', body: mockSource }));
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.clock.install(); await page.goto(url);
    if (failFirstLoad) {
      await page.locator('#retry-load').waitFor({ state: 'visible' });
      assert.equal(cloud, ''); assert.equal(await page.evaluate(() => window.__host.calls.includes('ready')), false);
      await page.locator('#retry-load').tap();
    }
    await page.waitForFunction(() => window.__host.calls.includes('ready'));
    assert.deepEqual(await page.evaluate(() => window.__host.calls.filter(x => ['first', 'ready'].includes(x))), ['first', 'ready']);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.match(await page.locator('#home-title').textContent(), /Your next fortune/);
    assert.equal(await page.locator('#scan').textContent(), '◎ Explore');
    if (failFirstLoad) { console.log('PASS failed cloud load blocks overwrite; retry succeeds; readiness notified only once'); await context.close(); continue; }
    await page.locator('#start').tap();
    await page.waitForFunction(() => window.__host.saves.length > 0);
    const pocket = JSON.parse(cloud).game.pockets[0];
    const point = await page.evaluate(p => {
      const r = document.getElementById('game').getBoundingClientRect(), scale = Math.min(r.width / 360, r.height / 350);
      return { x: r.x + (r.width - scale * 360) / 2 + p.x * scale, y: r.y + (r.height - scale * 350) / 2 + p.y * scale };
    }, pocket);
    await page.touchscreen.tap(point.x, point.y); await page.locator('#confirm').tap();
    await page.locator('#drill').tap(); await page.touchscreen.tap(point.x, point.y); await page.locator('#confirm').tap();
    await page.clock.runFor(12000);
    await page.evaluate(() => window.__host.pause());
    await page.waitForFunction(() => window.__host.saves.at(-1)?.game.paused);
    const frozen = await page.evaluate(() => ({ draws: window.__host.draws, time: document.getElementById('time').textContent }));
    await page.clock.runFor(5000);
    assert.deepEqual(await page.evaluate(() => ({ draws: window.__host.draws, time: document.getElementById('time').textContent })), frozen);
    assert.equal(await page.locator('body').evaluate(e => e.inert), true);
    await page.evaluate(() => window.__host.resume()); await page.clock.runFor(2000);
    assert.ok(await page.evaluate(draws => window.__host.draws > draws, frozen.draws));
    assert.notEqual(await page.locator('#time').textContent(), frozen.time);
    await page.locator('#pause').tap(); const menuTime = await page.locator('#time').textContent();
    await page.evaluate(() => { window.__host.pause(); window.__host.resume(); });
    await page.clock.runFor(2000); assert.equal(await page.locator('#time').textContent(), menuTime);
    await page.locator('#sound').tap(); await page.evaluate(() => { window.__host.mute(false); window.__host.mute(true); });
    await page.locator('#resume').tap(); await page.clock.runFor(185000);
    await page.waitForFunction(() => window.__host.scores.length > 0);
    const final = JSON.parse(cloud);
    assert.ok(final.game.ended); assert.equal(await page.evaluate(() => window.__host.scores.at(-1)), Math.floor(final.progress.best));
    assert.match(await page.locator('#result-stats').textContent(), /Net profit/);
    assert.deepEqual(await page.evaluate(() => window.__host.violations), []);
    const directory = process.env.OURO_SCREENSHOTS || 'artifacts/screenshots'; await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, 'ouro-english-result.png') });
    await page.reload(); await page.waitForFunction(() => window.__host.calls.includes('ready'));
    assert.equal(await page.locator('[data-profile="1"]').isDisabled(), false);
    assert.match(await page.locator('#record').textContent(), /Best final capital/);
    console.log('PASS packaged English game, official CSP, cloud save/reload, host pause stops rendering and input, user pause preserved, integer best score');
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('SDK integration browser checks passed using a contract double. Official suite/YouTube device validation is separate.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
