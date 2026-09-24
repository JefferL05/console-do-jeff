import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGame, createProgress, newTruck } from '../public/jogos/petroleo/modules/simulation.js';
import { encodeSave } from '../public/jogos/petroleo/modules/persistence.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const output = resolve(process.env.OURO_SCREENSHOTS || 'artifacts/screenshots'); await mkdir(output, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const game = createGame({ seed: 42 });
  // Visual fixture with the complete fleet parked, independent of economy tests.
  game.trucks = Array.from({ length: 8 }, (_, id) => newTruck(id, game.research));
  const fixture = encodeSave(game, createProgress(), { sound: false, music: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(raw => {
    if (!sessionStorage.getItem('fleet-fixture')) { localStorage.setItem('ouro-subsolo-save-v2', raw); sessionStorage.setItem('fleet-fixture', '1'); }
    const NativeAudio = window.AudioContext;
    window.audioCheck = { contexts: [], starts: 0 };
    window.AudioContext = class extends NativeAudio {
      constructor(...args) { super(...args); window.audioCheck.contexts.push(this); }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start.bind(source);
        source.start = (...args) => { window.audioCheck.starts++; return start(...args); }; return source;
      }
    };
  }, fixture);
  await page.goto(process.env.OURO_URL || 'http://localhost:4322/jogos/petroleo/');
  await page.waitForFunction(() => document.getElementById('home').open);
  assert.equal(await page.evaluate(() => window.audioCheck.contexts.length), 0, 'No autoplay before gesture');
  await page.locator('#continue').tap();
  await page.waitForFunction(() => window.audioCheck.contexts[0]?.state === 'running');
  assert.equal(await page.evaluate(() => window.audioCheck.starts), 1);
  await page.screenshot({ path: resolve(output, 'ouro-fleet-grounded.png') });
  await page.locator('#pause').tap();
  await page.waitForFunction(() => window.audioCheck.contexts[0].state === 'suspended');
  await page.locator('#music').tap(); assert.equal(await page.locator('#music').getAttribute('aria-pressed'), 'false');
  await page.locator('#resume').tap();
  assert.equal(await page.evaluate(() => window.audioCheck.contexts[0].state), 'suspended');
  await page.reload(); await page.locator('#continue').tap();
  assert.equal(await page.evaluate(() => window.audioCheck.contexts.length), 0, 'Saved music preference is respected after reload');
  await page.locator('#pause').tap(); await page.locator('#music').tap(); await page.locator('#resume').tap();
  await page.waitForFunction(() => window.audioCheck.contexts[0]?.state === 'running');
  await page.locator('#pause').tap(); await page.locator('#resume').tap();
  assert.equal(await page.evaluate(() => window.audioCheck.starts), 1, 'Only one music loop after repeated resumes');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: resolve(output, 'ouro-fleet-landscape.png') });
  assert.deepEqual(errors, []);
  console.log('PASS actual Web Audio activation, pause, independent music preference, save/reload and no duplicate loop. Fleet screenshots captured.');
} finally { await browser.close(); }
