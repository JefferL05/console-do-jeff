import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCampaign, leaseSafe, launchOperation, finishSeason, buyTechnology } from '../public/jogos/petroleo/enterprise/campaign.js';
import { explore } from '../public/jogos/petroleo/enterprise/exploration.js';
import { connectGas } from '../public/jogos/petroleo/enterprise/gas.js';
import { stepOperation } from '../public/jogos/petroleo/enterprise/simulation.js';
import { encode, KEY, decode } from '../public/jogos/petroleo/enterprise/persistence.js';
import { createProgress } from '../public/jogos/petroleo/modules/simulation.js';
import { encodeSave } from '../public/jogos/petroleo/modules/persistence.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const base = process.env.CAMPAIGN_URL || 'http://127.0.0.1:4324/jogos/petroleo/campanha/';
const output = resolve(process.env.OURO_SCREENSHOTS || '.ouro-campaign-screenshots'); await mkdir(output, { recursive: true });
const errors = [];
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
async function layout(page, label) {
  const state = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('button')].filter(b => !b.hidden && b.getBoundingClientRect().width > 0).map(b => ({ id: b.id || b.textContent.slice(0, 20), height: b.getBoundingClientRect().height })) }));
  assert.ok(state.scroll <= state.width + 1, `${label}: horizontal overflow`);
  for (const b of state.buttons) assert.ok(b.height >= 47.9, `${label}: ${b.id} has undersized target`);
}
async function field(page, x, y) {
  await page.locator('#enterprise-canvas').scrollIntoViewIfNeeded();
  const r = await page.locator('#enterprise-canvas').boundingBox(), scale = Math.min(r.width / 960, r.height / 600);
  await page.touchscreen.tap(r.x + (r.width - 960 * scale) / 2 + x * scale, r.y + (r.height - 600 * scale) / 2 + y * scale);
}
try {
  for (const [width, height] of [[360, 640], [390, 844], [1280, 850]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: width === 1280 ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.clock.install(); await page.goto(base); await page.locator('[data-action="safe"]').waitFor();
    await layout(page, `${width} town`); await page.screenshot({ path: resolve(output, `campaign-town-${width}.png`), fullPage: true });
    await page.locator('[data-action="safe"]').click(); await page.locator('#launch').click();
    assert.equal(await page.locator('#operation').isVisible(), true);
    let state = await saved(page); const pocket = state.operation.pockets[0];
    await layout(page, `${width} operation`);
    const cash = state.operation.cash; await field(page, pocket.x, pocket.y);
    assert.equal((await saved(page)).operation.cash, cash); await page.locator('#cancel-action').click();
    assert.equal((await saved(page)).operation.cash, cash);
    await field(page, pocket.x, pocket.y); await page.locator('#confirm-action').click();
    assert.equal((await saved(page)).operation.pockets[0].revealed, true);
    await page.locator('[data-panel="network"]').click(); await page.locator('[data-tool="rig"]').click();
    await field(page, pocket.x, 110); await page.locator('#confirm-action').click();
    assert.equal((await saved(page)).operation.rigs.length, 1);
    await field(page, pocket.x, pocket.y); await page.locator('#confirm-action').click();
    assert.equal((await saved(page)).operation.edges.length, 1);
    await page.clock.runFor(30000); await page.locator('#pause-operation').click();
    state = await saved(page); assert.ok(state.operation.sold > 0, 'A real built network produces deliveries'); assert.ok(decode(JSON.stringify(state)));
    await page.screenshot({ path: resolve(output, `campaign-field-${width}.png`), fullPage: true });
    await page.reload(); await page.locator('#pause-operation').waitFor();
    assert.equal((await saved(page)).operation.cash, state.operation.cash); assert.match(await page.locator('#pause-operation').textContent(), /Continuar/);
    await page.locator('[data-panel="fleet"]').click(); await page.locator('#buy-truck').click();
    await page.locator('[data-truck="1"]').selectOption('store');
    assert.equal((await saved(page)).operation.trucks[1].task, 'store');
    for (const panel of ['market', 'gas', 'goals', 'network', 'explore']) { await page.locator(`[data-panel="${panel}"]`).click(); await layout(page, `${width} ${panel}`); }
    await page.locator('#zoom-in').click(); assert.equal(await page.locator('#zoom-level').textContent(), '1.5×');
    await page.locator('#zoom-out').click();
    await page.locator('#manual-button').click(); assert.equal(await page.locator('#manual').evaluate(d => d.open), true); await page.locator('#close-manual').click();
    await page.locator('#end-operation').click(); await page.locator('#finish-now').click(); assert.equal(await page.locator('#report').evaluate(d => d.open), true);
    assert.ok(decode(JSON.stringify(await saved(page))), 'Early-ended operation can resume');
    await page.locator('#inspect-operation').click(); await page.locator('#pause-operation').click();
    await page.locator('#return-town').click(); state = await saved(page); assert.equal(state.campaign.season, 1); assert.equal(state.operation, null);
    const wealth = state.campaign.cash; await page.reload(); assert.equal((await saved(page)).campaign.cash, wealth); assert.equal(state.campaign.history.length, 1);
    if (width === 360) {
      await page.setViewportSize({ width: 640, height: 360 }); await layout(page, 'landscape town');
      await page.locator('[data-action="safe"]').click(); await page.locator('#launch').click(); await layout(page, 'landscape operation');
    }
    await context.close(); console.log(`PASS campaign ${width}: city, construction, delivery, reload, fleet, goals, end and settlement`);
  }
  // Save migration imports only validated legacy workshop upgrades, once.
  {
    const context = await browser.newContext(); const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    const progress = createProgress(); progress.research.cargo = 2;
    const legacy = encodeSave(null, progress, { sound: false });
    await page.addInitScript(({ legacy }) => { if (!localStorage.getItem('ouro-subsolo-save-v2')) localStorage.setItem('ouro-subsolo-save-v2', legacy); }, { legacy });
    await page.goto(base); await page.locator('[data-action="safe"]').click();
    assert.equal((await saved(page)).campaign.tech.cargo, 2); assert.equal(await page.evaluate(() => localStorage.getItem('ouro-subsolo-save-v2')), legacy);
    await context.close(); console.log('PASS legacy workshop migration preserves the original save');
  }
  // Recovery must not silently replace unreadable or corrupt saves.
  for (const blocked of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ blocked, key }) => {
      if (blocked) { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; }
      else localStorage.setItem(key, '{invalid');
    }, { blocked, key: KEY });
    await page.goto(base);
    if (blocked) { await page.locator('[data-action="safe"]').click(); await page.locator('#launch').click(); assert.equal(await page.locator('#operation').isVisible(), true); }
    else { await page.locator('#recovery').waitFor({ state: 'visible' }); assert.equal(await page.evaluate(key => localStorage.getItem(key), KEY), '{invalid'); }
    await context.close();
  }
  // A late-region fixture exercises technology, gas controls and contracts in the real UI.
  {
    const c = createCampaign(52);
    for (let season = 0; season < 6; season++) {
      leaseSafe(c); const old = launchOperation(c); old.time = 0; old.elapsed = old.duration; old.ended = true; old.paused = true; finishSeason(c, old);
    }
    assert.ok(buyTechnology(c, 'rock')); assert.ok(buyTechnology(c, 'gas')); leaseSafe(c);
    const o = launchOperation(c), p = o.pockets.find(pocket => pocket.kind === 'gas');
    explore(o, 'scan', p.x, p.y, 35); assert.ok(connectGas(o, p.id, 'east').ok);
    for (let i = 0; i < 750; i++) stepOperation(o); o.paused = true;
    assert.ok(decode(encode(c, o)));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw); }, { key: KEY, raw: encode(c, o) });
    await page.clock.install(); await page.goto(base);
    await page.locator('[data-panel="gas"]').click(); await page.locator('[data-action="gas-toggle"]').click();
    await page.locator('#pause-operation').click(); await page.clock.runFor(10000); await page.locator('#pause-operation').click();
    assert.ok((await saved(page)).operation.gasUsed > 0); assert.ok((await saved(page)).operation.gasBoost.east > 0);
    await page.locator('[data-panel="market"]').click(); await page.locator('[data-action="contract"][data-id="1"]').click();
    assert.equal((await saved(page)).operation.contracts[1].status, 'active');
    await page.screenshot({ path: resolve(output, 'campaign-gas-contract.png'), fullPage: true });
    await context.close(); console.log('PASS late-region gas valve, finite consumption, price bonus and contract controls');
  }
  // Keyboard selection uses the same input path as pointing.
  {
    const c = createCampaign(51); leaseSafe(c); const o = launchOperation(c); o.paused = true;
    const context = await browser.newContext(); const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ raw, key }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw); }, { raw: encode(c, o), key: KEY });
    await page.goto(base); await page.locator('#enterprise-canvas').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#confirm-action').isVisible(), true); await page.keyboard.press('Escape'); assert.equal(await page.locator('#confirm-action').isVisible(), false);
    await context.close();
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log(`PASS campaign browser checks. Screenshots: ${output}`);
} finally { await browser.close(); }
