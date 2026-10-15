import assert from 'node:assert/strict';
import { RULES, TECHNOLOGIES } from '../public/jogos/petroleo/enterprise/config.js';
import { generateField, explore, scanCost } from '../public/jogos/petroleo/enterprise/exploration.js';
import { buildRig, pipeQuote, buildPipe, upgradePipe, togglePipe } from '../public/jogos/petroleo/enterprise/pipes.js';
import { buyTruck, buildTank, upgradeStorage, assignTruck, storedOil, transitOil } from '../public/jogos/petroleo/enterprise/logistics.js';
import { acceptContract, deliver } from '../public/jogos/petroleo/enterprise/market.js';
import { connectGas, toggleGas } from '../public/jogos/petroleo/enterprise/gas.js';
import { createOperation, stepOperation, operationReport } from '../public/jogos/petroleo/enterprise/simulation.js';
import { createCampaign, leaseSafe, launchOperation, finishSeason, startAuction, bid, finishAuction, buyTechnology, bank, standings } from '../public/jogos/petroleo/enterprise/campaign.js';
import { encode, decode, validateCampaign, validateOperation } from '../public/jogos/petroleo/enterprise/persistence.js';

let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
const tech = () => Object.fromEntries(Object.keys(TECHNOLOGIES).map(k => [k, 0]));
function game(options = {}) { return createOperation({ seed: 42, region: 0, tech: tech(), ...options }); }
function advance(o, seconds) { for (let i = 0; i < Math.ceil(seconds / RULES.step); i++) stepOperation(o); }
function conservation(o) {
  const oil = o.pockets.filter(p => p.kind === 'oil').reduce((n, p) => n + p.amount, 0);
  assert.ok(Math.abs(o.totalOil - oil - o.extracted) < 1e-5, 'Underground oil is conserved');
  assert.ok(Math.abs(o.extracted - o.sold - o.spilled - storedOil(o) - transitOil(o)) < 1e-5, 'Extracted oil is conserved');
  assert.ok(Math.abs(o.cash - o.initialCash - o.revenue - o.bonuses + o.expenses + o.fines) < 1e-5, 'Money ledger balances');
  assert.ok(validateOperation(o), 'Operation validates');
}
function connected(options = {}) {
  const o = game(options), p = o.pockets[0];
  assert.ok(explore(o, 'scan', p.x, p.y, 35).ok);
  const rig = buildRig(o, p.x); assert.ok(rig.ok); assert.ok(buildPipe(o, rig.nodeId, p.x, p.y).ok);
  return o;
}
function buffer(o, amount) { const p = o.pockets[0]; p.amount -= amount; o.extracted += amount; o.rigs[0].storage += amount; }
function end(o) { o.time = 0; o.elapsed = o.duration; o.ended = true; o.paused = true; }

test('500 deterministic terrains across all five regions have affordable starts and separated resources', () => {
  for (let seed = 0; seed < 100; seed++) for (let region = 0; region < 5; region++) {
    const field = generateField(seed, region); assert.deepEqual(field, generateField(seed, region));
    assert.ok(field.pockets.length >= 7);
    for (const p of field.pockets) { assert.ok(p.x - p.rx > 0 && p.x + p.rx < 960 && p.y - p.ry > 120 && p.y + p.ry < 600); }
    for (let i = 0; i < field.pockets.length; i++) for (let j = i + 1; j < field.pockets.length; j++) {
      const a = field.pockets[i], b = field.pockets[j]; assert.ok(Math.hypot((a.x - b.x) / (a.rx + b.rx), (a.y - b.y) / (a.ry + b.ry)) > 1);
    }
    const o = connected({ seed, region }); conservation(o);
    assert.ok(o.cash > 1200, 'Starter leaves capital for logistics');
  }
});
test('scanner pricing scales by area, preview is free and invalid tools cannot charge', () => {
  const o = game(), before = JSON.stringify(o);
  assert.ok(scanCost(130) > scanCost(35) * 3); assert.equal(JSON.stringify(o), before);
  assert.equal(explore(o, 'fake', 180, 200).ok, false); assert.equal(explore(o, 'scan', NaN, 200).ok, false); assert.equal(JSON.stringify(o), before);
  assert.ok(explore(o, 'scan', o.pockets[0].x, o.pockets[0].y, 35).ok); assert.equal(o.cash, RULES.operationBudget - scanCost(35)); assert.ok(o.pockets[0].revealed); conservation(o);
});
test('prospectors give approximate markers after time, probes reveal their actual path', () => {
  const o = game(); assert.ok(explore(o, 'prospector', 700, 200).ok);
  advance(o, 7); assert.equal(o.markers.length, 1); advance(o, 2); assert.equal(o.markers.length, 2);
  assert.equal(o.pockets.filter(p => p.revealed).length, 0);
  const p = o.pockets[0]; assert.ok(explore(o, 'probe', p.x, p.y - 10).ok); advance(o, 2); assert.ok(p.revealed); conservation(o);
});
test('segmented pipes support bends, reject duplicates and gate rock and ice technology', () => {
  const o = game(), p = o.pockets[0]; explore(o, 'scan', p.x, p.y, 35);
  const rig = buildRig(o, p.x - 40), bend = buildPipe(o, rig.nodeId, p.x - 40, 165); assert.ok(bend.ok);
  assert.equal(buildPipe(o, bend.nodeId, p.x, p.y).ok, false, 'Unfinished parent cannot branch');
  advance(o, 2); assert.ok(buildPipe(o, bend.nodeId, p.x, p.y).ok);
  assert.equal(buildPipe(o, rig.nodeId, p.x, p.y).ok, false); conservation(o);
  const hard = game({ region: 4 }); const root = buildRig(hard, 500);
  assert.equal(pipeQuote(hard, root.nodeId, 500, 360).ok, false);
  hard.tech.rock = 1; assert.equal(pipeQuote(hard, root.nodeId, 500, 360).ok, true);
  assert.equal(pipeQuote(hard, root.nodeId, 340, 500).ok, false);
  hard.tech.ice = 1; assert.equal(pipeQuote(hard, root.nodeId, 340, 500).ok, true);
});
test('siblings share trunk capacity and closed valves block descendants', () => {
  const o = game(), p = o.pockets[0], second = o.pockets.find(p => p.id > 0 && p.kind === 'oil');
  for (const pocket of [p, second]) explore(o, 'scan', pocket.x, pocket.y, 35);
  const root = buildRig(o, p.x), junction = buildPipe(o, root.nodeId, p.x, 150); advance(o, 1);
  assert.ok(buildPipe(o, junction.nodeId, p.x, p.y).ok); assert.ok(buildPipe(o, junction.nodeId, second.x, second.y).ok);
  o.edges.forEach(e => { e.progress = 1; }); o.trucks[0].task = 'idle';
  const before = o.extracted; advance(o, 1); assert.ok(o.extracted - before <= 3.001);
  assert.ok(upgradePipe(o, 0)); assert.ok(upgradeStorage(o, 'rig', 0));
  const expanded = o.extracted; advance(o, 1); assert.ok(o.extracted - expanded > 3.1);
  togglePipe(o, 0); const stopped = o.extracted; advance(o, 1); assert.equal(o.extracted, stopped); conservation(o);
});
test('relaxed mode stops on full towers; enterprise mode warns then spills with matching fines', () => {
  for (const difficulty of ['relaxed', 'enterprise']) {
    const o = connected({ difficulty }); o.trucks[0].task = 'idle'; advance(o, 30);
    assert.equal(o.spilled > 0, difficulty === 'enterprise'); assert.ok(Math.abs(o.fines - o.spilled * 3) < 1e-6);
    assert.ok(o.rigs[0].storage <= o.rigs[0].capacity); conservation(o);
  }
});
test('storage requires real transport; reassigning loaded trucks preserves the destination', () => {
  const o = connected(); assert.ok(buildTank(o, 400)); assignTruck(o, 0, 'store');
  advance(o, 30); assert.ok(o.tanks[0].storage > 0); assert.equal(o.sold, 0);
  assignTruck(o, 0, 'west');
  for (let i = 0; i < 2000 && !(o.trucks[0].phase === 'delivery' && o.trucks[0].destination.kind === 'buyer'); i++) stepOperation(o);
  const truck = o.trucks[0]; assert.equal(truck.destination.id, 'west'); assignTruck(o, 0, 'east'); assert.equal(truck.destination.id, 'west');
  advance(o, 10); assert.ok(o.sold > 0); conservation(o);
});
test('full tanks preserve waiting cargo and a buyer order recovers it', () => {
  const o = game(); buildRig(o, 180); buildTank(o, 400); buffer(o, 20);
  // Use conserved reserve oil to fill the tank before a previously scheduled load arrives.
  o.pockets[0].amount -= 160; o.extracted += 160; o.tanks[0].storage = 160;
  const t = o.trucks[0]; o.rigs[0].storage -= 10; t.cargo = 10; t.x = 400; t.phase = 'unloading'; t.source = { kind: 'rig', id: 0 }; t.destination = { kind: 'tank', id: 0 }; t.task = 'store';
  advance(o, 1); assert.equal(t.cargo, 10); assert.equal(o.spilled, 0);
  assignTruck(o, 0, 'east'); advance(o, 8); assert.ok(o.sold >= 10); conservation(o);
});
test('delivery pays the arrival price once, and contracts exclude sales before acceptance', () => {
  const o = game(); buildRig(o, 180); buffer(o, 25);
  // Direct delivery is a unit-level transaction: remove its oil from the buffer first.
  o.rigs[0].storage -= 5; deliver(o, 'west', 5); assert.ok(acceptContract(o, 0)); assert.equal(o.contracts[0].delivered, 0);
  const before = o.cash; o.rigs[0].storage -= 20; deliver(o, 'west', 20);
  assert.ok(Math.abs(o.cash - before - 20 * o.prices.west) < 1e-8); assert.equal(o.contracts[0].delivered, 20);
  buffer(o, 80); o.rigs[0].storage -= 80; deliver(o, 'west', 80); assert.equal(o.contracts[0].status, 'completed'); assert.equal(o.bonuses, 300);
  const bonus = o.bonuses; advance(o, 1); assert.equal(o.bonuses, bonus); conservation(o);
});
test('contracts expire without a second reward, late loads stay accounted for', () => {
  const o = connected(); assert.ok(acceptContract(o, 1)); o.trucks[0].task = 'idle'; advance(o, 181);
  assert.equal(o.contracts[1].status, 'expired'); assert.equal(o.bonuses, 0);
  o.time = .1; o.elapsed = o.duration - .1; assignTruck(o, 0, 'west'); advance(o, 1);
  assert.equal(o.trucks[0].phase, 'idle'); assert.equal(o.ended, true); conservation(o);
});
test('gas is finite, gated, separately metered, capped and decays after valve closure', () => {
  const o = game({ region: 3, tech: { ...tech(), rock: 1, gas: 1 } }); const p = o.pockets.find(p => p.kind === 'gas');
  explore(o, 'scan', p.x, p.y, 35); assert.ok(connectGas(o, p.id, 'east').ok); assert.equal(connectGas(o, p.id, 'west').ok, false);
  advance(o, 25); assert.equal(o.gasUsed, 0); assert.ok(toggleGas(o, 0)); advance(o, 15);
  assert.ok(o.gasBoost.east <= 4 && o.gasBoost.east > 3); assert.ok(o.gasUsed > 0);
  toggleGas(o, 0); const consumed = o.gasUsed; advance(o, 10); assert.equal(o.gasBoost.east, 0); assert.equal(o.gasUsed, consumed); conservation(o);
});
test('pause freezes every system; active constructions and cargo survive validated resume', () => {
  const c = createCampaign(10); leaseSafe(c); const o = launchOperation(c), p = o.pockets[0];
  explore(o, 'scan', p.x, p.y, 35); const rig = buildRig(o, p.x); buildPipe(o, rig.nodeId, p.x, p.y); advance(o, 4);
  o.paused = true; const before = JSON.stringify(o); advance(o, 20); assert.equal(JSON.stringify(o), before);
  const restored = decode(encode(c, o)); assert.ok(restored); assert.deepEqual(restored.operation, o);
  restored.operation.paused = false; o.paused = false; advance(o, 20); advance(restored.operation, 20); assert.deepEqual(restored.operation, o); conservation(o);
});
test('town investments, safe leases, loans and launch cannot be charged twice', () => {
  const c = createCampaign(77, { scan: 2, tank: 1, cargo: 3 }); assert.equal(c.tech.survey, 2); assert.equal(c.tech.cargo, 3);
  assert.ok(bank(c, 'borrow')); assert.equal(c.debt, 1000); assert.ok(bank(c, 'repay')); assert.equal(c.debt, 0);
  assert.ok(buyTechnology(c, 'rock')); assert.ok(leaseSafe(c)); const before = c.cash;
  assert.equal(leaseSafe(c), false); assert.equal(buyTechnology(c, 'gas'), false); assert.equal(c.cash, before);
  assert.ok(launchOperation(c)); const cash = c.cash; assert.equal(launchOperation(c), null); assert.equal(c.cash, cash); assert.ok(validateCampaign(c));
});
test('land and share auctions debit the actual winner and preserve operating capital', () => {
  const c = createCampaign(88); assert.ok(startAuction(c, 'plot', 0));
  for (let i = 0; i < 50 && c.auction.leader !== 'player'; i++) assert.ok(bid(c));
  const amount = c.auction.bid, cash = c.cash; assert.equal(c.auction.leader, 'player'); assert.ok(finishAuction(c));
  assert.equal(c.cash, cash - amount); assert.equal(c.leased, 0); assert.ok(c.cash >= RULES.operationBudget); assert.equal(finishAuction(c), false);
  const other = createCampaign(89); startAuction(other, 'shares'); const sum = other.rivals.reduce((n, r) => n + r.cash, 0); finishAuction(other);
  assert.equal(other.rivals.reduce((n, r) => n + r.shares, 0), 5); assert.ok(other.rivals.reduce((n, r) => n + r.cash, 0) < sum); assert.equal(startAuction(other, 'shares'), false); assert.ok(validateCampaign(other));
});
test('ten seasons traverse all regions, settle once and produce a deterministic final ranking', () => {
  const c = createCampaign(100), twin = createCampaign(100);
  for (const campaign of [c, twin]) for (let i = 0; i < 10; i++) {
    assert.equal(campaign.region, Math.floor(i / 2)); assert.ok(leaseSafe(campaign));
    const o = launchOperation(campaign); end(o); const before = campaign.cash;
    assert.ok(finishSeason(campaign, o)); assert.equal(campaign.cash, before + o.cash + operationReport(o).reward); assert.equal(finishSeason(campaign, o), false); assert.ok(validateCampaign(campaign));
  }
  assert.deepEqual(c, twin); assert.equal(c.finished, true); assert.equal(c.history.length, 10); assert.equal(leaseSafe(c), false); assert.equal(standings(c).length, 4); assert.ok(decode(encode(c, null)));
});
test('corrupt saves reject broken ledgers, topology, cargo, auction, tech and cross-season state', () => {
  const c = createCampaign(11); leaseSafe(c); const o = launchOperation(c), p = o.pockets[0]; explore(o, 'scan', p.x, p.y, 35); const r = buildRig(o, p.x); buildPipe(o, r.nodeId, p.x, p.y);
  const raw = encode(c, o); assert.ok(decode(raw));
  for (const mutate of [s => s.operation.cash++, s => s.operation.edges[0].to = 0, s => s.operation.trucks[0].cargo = 999, s => s.campaign.tech.cargo = 99, s => s.campaign.season++, s => s.operation.pockets[0].x++, s => s.operation.gasBoost.west = 999, s => s.campaign.auction = { type: 'shares', bid: -1 }, s => s.operation.nodes[1].rigId = 99, s => s.operation.contracts[0].bonus = 99999, s => s.version = 99]) {
    const state = JSON.parse(raw); mutate(state); assert.equal(decode(JSON.stringify(state)), null);
  }
  assert.equal(decode('{broken'), null); assert.equal(decode('null'), null);
});
test('30 full seeded operations conserve oil and cash through expansion, storage and sales', () => {
  for (let seed = 0; seed < 30; seed++) {
    const o = connected({ seed, region: seed % 5, difficulty: seed % 2 ? 'enterprise' : 'relaxed' });
    assert.ok(buyTruck(o)); assert.ok(buildTank(o, 430)); assignTruck(o, 1, 'store');
    for (let n = 0; n < RULES.duration * 30 + 1; n++) {
      if (n === 1800) assignTruck(o, 1, 'east');
      if (n === 3600) { upgradePipe(o, 0); upgradeStorage(o, 'rig', 0); }
      stepOperation(o); if (n % 900 === 0) conservation(o);
    }
    assert.ok(o.ended); assert.ok(o.sold > 0); conservation(o);
  }
});
test('a conservative player can fund all ten seasons and compete for city shares', () => {
  const results = [];
  for (let seed = 1; seed <= 10; seed++) {
    const c = createCampaign(seed);
    for (let season = 0; season < 10; season++) {
      if (c.region >= 2 && !c.tech.rock && c.cash > 6800) buyTechnology(c, 'rock');
      if (c.region >= 3 && !c.tech.gas && c.cash > 6900) buyTechnology(c, 'gas');
      if (c.region >= 4 && !c.tech.ice && c.cash > 7100) buyTechnology(c, 'ice');
      startAuction(c, 'shares');
      for (let n = 0; n < 50 && c.auction.leader !== 'player'; n++) if (!bid(c)) break;
      finishAuction(c);
      assert.ok(leaseSafe(c), `seed ${seed}, season ${season}: operating capital remains available`);
      const o = launchOperation(c), p = o.pockets[0]; explore(o, 'scan', p.x, p.y, 35); const r = buildRig(o, p.x); buildPipe(o, r.nodeId, p.x, p.y);
      acceptContract(o, 0); advance(o, o.duration + 1); conservation(o); finishSeason(c, o);
      assert.ok(validateCampaign(c));
    }
    assert.ok(c.finished); assert.ok(c.shares > 0); assert.equal(c.debt, 0);
    results.push({ seed, wealth: Math.round(c.cash), shares: c.shares, winner: standings(c)[0].player });
  }
  console.table(results);
});
console.log(`\n${passed} campaign suites passed.`);
