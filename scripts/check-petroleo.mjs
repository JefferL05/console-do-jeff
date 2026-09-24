import assert from 'node:assert/strict';
import { CONFIG } from '../public/jogos/petroleo/modules/config.js';
import { generateTerrain, validateTerrain } from '../public/jogos/petroleo/modules/terrain.js';
import { createGame, createProgress, scanQuote, drillQuote, commit, step, inTransit, buyUpgrade, settle, buyResearch } from '../public/jogos/petroleo/modules/simulation.js';
import { encodeSave, decodeSave, validateGame } from '../public/jogos/petroleo/modules/persistence.js';
import { createCamera, toWorld, toScreen } from '../public/jogos/petroleo/modules/renderer.js';

let count = 0;
function test(name, callback) { callback(); count++; console.log(`PASS ${name}`); }
function advance(game, seconds) { for (let i = 0; i < Math.ceil(seconds / CONFIG.step); i++) step(game); }
function connectedGame(options = {}) {
  const g = createGame({ seed: 42, ...options });
  const p = g.pockets[0]; assert.ok(commit(g, scanQuote(g, p.x, p.y)).ok); assert.ok(commit(g, drillQuote(g, p.id)).ok); return g;
}
function conserved(game) {
  const remaining = game.pockets.reduce((sum, p) => sum + p.amount, 0);
  assert.ok(Math.abs(game.total - remaining - game.extracted) < 1e-5, 'Oil must be conserved underground');
  assert.ok(Math.abs(game.extracted - game.storage - inTransit(game) - game.sold) < 1e-5, 'Oil must be conserved through delivery');
  assert.ok(Math.abs(game.cash - (CONFIG.initialCash - game.expenses + game.revenue)) < 1e-5, 'Ledger must balance');
  assert.ok([game.cash, game.storage, game.extracted, ...game.pockets.map(p => p.amount), ...game.trucks.map(t => t.cargo)].every(n => Number.isFinite(n) && n >= 0));
}

test('3,000 seeded terrains: deterministic, bounded, separated, affordable starting deposit', () => {
  for (let seed = 0; seed < 1000; seed++) for (let profile = 0; profile < 3; profile++) {
    const t = generateTerrain(seed, profile);
    assert.ok(validateTerrain(t), `${seed}/${profile}`);
    assert.deepEqual(t, generateTerrain(seed, profile));
    for (let i = 0; i < t.pockets.length; i++) for (let j = i + 1; j < t.pockets.length; j++) {
      const a = t.pockets[i], b = t.pockets[j]; assert.ok(Math.hypot((a.x-b.x)/1.3, a.y-b.y) >= 45);
    }
  }
});
test('preview and cancellation are free; confirmation charges once; repeated scan rejected', () => {
  const g = createGame(), p = g.pockets[0]; const q = scanQuote(g, p.x, p.y);
  assert.equal(g.cash, 1500); assert.equal(g.scans.length, 0);
  assert.ok(commit(g, q).ok); assert.equal(g.cash, 1420); assert.ok(g.pockets[0].revealed);
  assert.equal(commit(g, q).ok, false); assert.equal(g.cash, 1420);
});
test('duplicate well, insufficient funds and paused purchases cannot mutate state', () => {
  const g = connectedGame(); const balance = g.cash;
  assert.equal(commit(g, drillQuote(g, 0)).ok, false); assert.equal(g.cash, balance);
  g.cash = 0; assert.equal(commit(g, scanQuote(g, 200, 250)).ok, false);
  assert.equal(buyUpgrade(g, 'tank'), false);
  g.cash = 1000; g.paused = true; assert.equal(commit(g, scanQuote(g, 200, 250)).ok, false); assert.equal(g.cash, 1000);
});
test('tutorial first delivery within one minute; all four steps advance', () => {
  for (let seed = 0; seed < 50; seed++) {
    const g = connectedGame({ tutorial: true, seed }); assert.equal(g.tutorial, 2);
    assert.equal(buyUpgrade(g, 'tank'), false);
    advance(g, 20); assert.equal(g.tutorial, 4); assert.ok(g.sold > 0); conserved(g);
  }
});
test('truck locks destination at loading; revenue uses price at delivery exactly once', () => {
  const g = connectedGame();
  while (g.trucks[0].phase !== 'outbound') step(g);
  const truck = g.trucks[0], cargo = truck.cargo;
  assert.equal(truck.destination, 'west'); assert.equal(g.revenue, 0);
  g.target = 'east';
  while (truck.phase === 'outbound') step(g);
  assert.equal(truck.destination, 'west'); assert.ok(Math.abs(g.revenue - cargo * g.prices.west) < 1e-8);
  const revenue = g.revenue; advance(g, .5); assert.equal(g.revenue, revenue);
  while (truck.phase !== 'loading') step(g);
  assert.equal(truck.destination, 'east'); conserved(g);
});
test('hold suspends new loads while existing deliveries complete; full tank stops extraction', () => {
  const g = connectedGame(); while (g.trucks[0].phase !== 'outbound') step(g);
  g.target = 'hold'; advance(g, 55);
  assert.equal(g.trucks[0].phase, 'idle'); assert.ok(g.sold > 0);
  assert.ok(g.storage >= g.capacity - 0.001);
  const extracted = g.extracted; advance(g, 3); assert.equal(g.extracted, extracted); conserved(g);
});
test('tank and fleet upgrades have real effects and prevent overspending', () => {
  const g = connectedGame(); advance(g, 15);
  const cash = g.cash; assert.ok(buyUpgrade(g, 'tank')); assert.equal(g.capacity, 240); assert.equal(g.cash, cash - 250);
  assert.ok(buyUpgrade(g, 'truck')); assert.equal(g.trucks.length, 2); conserved(g);
});
test('branches require a finished parent; save preserves acyclic topology', () => {
  const g = connectedGame({ profile: 1 }); const p = g.pockets[1];
  commit(g, scanQuote(g, p.x, p.y)); assert.equal(drillQuote(g, p.id, 0).valid, false);
  advance(g, 4); const q = drillQuote(g, p.id, 0); assert.ok(q.valid); assert.ok(commit(g, q).ok);
  assert.equal(g.wells[1].parentId, 0); assert.ok(validateGame(g)); conserved(g);
});
test('Serra rock blocks drilling until reinforced bit is purchased', () => {
  const g = createGame({ profile: 2, seed: 19 });
  const p = g.pockets.slice(1).find(p => p.x > 60 && p.x < 300);
  commit(g, scanQuote(g, p.x, p.y)); assert.match(drillQuote(g, p.id).reason, /Rocha/);
  assert.ok(buyUpgrade(g, 'bit')); assert.ok(drillQuote(g, p.id).valid); assert.ok(commit(g, drillQuote(g, p.id)).ok);
});
test('pause freezes all state; resume preserves deliveries', () => {
  const g = connectedGame(); advance(g, 5); g.paused = true;
  const snapshot = JSON.stringify(g); advance(g, 10); assert.equal(JSON.stringify(g), snapshot);
  g.paused = false; advance(g, 5); assert.ok(g.sold > 0); conserved(g);
});
test('versioned save/load roundtrip with moving fleet and corruption rejection', () => {
  const g = connectedGame(); advance(g, 5); const progress = createProgress();
  assert.ok(validateGame(g));
  const raw = encodeSave(g, progress, { sound: true }), loaded = decodeSave(raw);
  assert.equal(loaded.invalid, false); assert.ok(loaded.game.paused); assert.deepEqual(loaded.game.trucks, g.trucks);
  loaded.game.paused = false; advance(loaded.game, 10); advance(g, 10);
  assert.equal(loaded.game.cash, g.cash); assert.equal(loaded.game.storage, g.storage);
  for (const mutate of [s => s.game.cash = -1, s => s.game.trucks[0].cargo = 999, s => s.game.pockets[0].amount = 'x', s => s.version = 99, s => s.game.wells[0].parentId = 0, s => s.game.storage += 10]) {
    const invalid = JSON.parse(raw); mutate(invalid); assert.ok(decodeSave(JSON.stringify(invalid)).invalid);
  }
  assert.ok(decodeSave('{broken').invalid); assert.ok(decodeSave('null').invalid); assert.equal(decodeSave(null).invalid, false);
});
test('full seeded matches conserve resources across switching, branching and upgrades', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const g = connectedGame({ seed, profile: seed % 3, mode: seed % 2 ? 'quick' : 'classic' });
    for (let n = 0; n < g.duration * 30 + 1; n++) {
      if (n % 300 === 0) g.target = ['west', 'hold', 'east'][(n / 300) % 3];
      if (n % 600 === 0 && n > 0) {
        if (g.profile === 2 && !g.bit) buyUpgrade(g, 'bit');
        const p = g.pockets.find(p => !g.wells.some(w => w.pocketId === p.id));
        if (p) { commit(g, scanQuote(g, p.x, p.y)); commit(g, drillQuote(g, p.id)); }
        buyUpgrade(g, 'truck');
      }
      step(g);
      if (n % 300 === 0) { conserved(g); assert.ok(validateGame(g), `seed ${seed} tick ${n}`); }
    }
    assert.ok(g.ended); assert.equal(g.time, 0); conserved(g);
    const snapshot = JSON.stringify(g); advance(g, 5); assert.equal(JSON.stringify(g), snapshot);
  }
});
test('end rewards once, unlocks next profile, and research affects only new operations', () => {
  const g = connectedGame(); advance(g, g.duration); const progress = createProgress();
  const reward = settle(g, progress); assert.ok(reward >= 1); assert.equal(progress.unlocked, 1);
  assert.equal(settle(g, progress), 0); assert.equal(progress.credits, reward);
  progress.credits = 6; assert.ok(buyResearch(progress, 'tank')); assert.ok(buyResearch(progress, 'cargo')); assert.ok(buyResearch(progress, 'scan'));
  const next = createGame({ research: progress.research }); assert.equal(next.capacity, 160); assert.equal(next.trucks[0].capacity, 20);
  assert.equal(g.capacity, 120); assert.equal(g.trucks[0].capacity, 16); assert.ok(validateGame(next));
  assert.equal(buyResearch(progress, 'tank'), false);
});
test('isotropic camera and selection transform round-trip at mobile and landscape sizes', () => {
  for (const [width, height] of [[338, 265], [368, 470], [390, 540], [510, 250], [950, 450]]) {
    const camera = createCamera(width, height);
    for (const p of [{ x: 0, y: 0 }, { x: 91, y: 126 }, { x: 350, y: 340 }]) {
      const screen = toScreen(camera, p.x, p.y), restored = toWorld(camera, screen.x, screen.y);
      assert.ok(Math.abs(restored.x-p.x) < 1e-8); assert.ok(Math.abs(restored.y-p.y) < 1e-8);
    }
  }
});
console.log(`\n${count} suites passed.`);
