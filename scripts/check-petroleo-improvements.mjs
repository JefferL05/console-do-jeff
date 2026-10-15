import assert from 'node:assert/strict';
import { RULES } from '../public/jogos/petroleo/enterprise/config.js';
import { createCampaign, leaseSafe, launchOperation } from '../public/jogos/petroleo/enterprise/campaign.js';
import { explore } from '../public/jogos/petroleo/enterprise/exploration.js';
import { buildRig, buildPipe, routeQuote, buildRoute, upgradePipe } from '../public/jogos/petroleo/enterprise/pipes.js';
import { stepOperation } from '../public/jogos/petroleo/enterprise/simulation.js';
import { networkDiagnostics, deliveryEstimate, debrief } from '../public/jogos/petroleo/enterprise/diagnostics.js';
import { tutorialStep, contractTerms } from '../public/jogos/petroleo/enterprise/progression.js';
import { deliver, acceptContract } from '../public/jogos/petroleo/enterprise/market.js';
import { KEY, encode, decode, validateOperation } from '../public/jogos/petroleo/enterprise/persistence.js';
import { slotKey, writeSlot, restoreSlot, importSlot, slotSummary } from '../public/jogos/petroleo/enterprise/storage.js';

let count = 0;
function test(name, callback) { callback(); count++; console.log(`PASS ${name}`); }
function setup() { const c = createCampaign(42); leaseSafe(c); return { c, o: launchOperation(c) }; }
function advance(o, seconds) { for (let i = 0; i < seconds * 30; i++) stepOperation(o); }
function memory() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; }

test('multi-segment preview, undo and rejection never charge; confirmation is atomic', () => {
  const { c, o } = setup(), p = o.pockets[0]; explore(o, 'scan', p.x, p.y, 35); const rig = buildRig(o, p.x - 30);
  const points = [{ x: p.x - 30, y: 155 }, { x: p.x, y: p.y }];
  const before = JSON.stringify(o), q = routeQuote(o, rig.nodeId, points);
  assert.ok(q.ok); assert.equal(JSON.stringify(o), before);
  assert.ok(routeQuote(o, rig.nodeId, points.slice(0, -1)).cost < q.cost); assert.equal(JSON.stringify(o), before);
  const invalid = [...points, { x: -1, y: 400 }]; assert.equal(buildRoute(o, rig.nodeId, invalid).ok, false); assert.equal(JSON.stringify(o), before);
  assert.ok(buildRoute(o, rig.nodeId, points).ok); assert.equal(o.edges.length, 2); assert.equal(o.cash, JSON.parse(before).cash - q.cost);
  stepOperation(o); assert.ok(o.edges[0].progress > 0); assert.equal(o.edges[1].progress, 0, 'Child waits for parent construction');
  assert.ok(decode(encode(c, o))); advance(o, 6); assert.equal(o.edges[1].progress, 1); assert.ok(validateOperation(o));
  const built = JSON.stringify(o); assert.equal(buildRoute(o, rig.nodeId, points).ok, false); assert.equal(JSON.stringify(o), built);
});
test('shared-pipe flow matches extraction and bottleneck diagnostics respond to upgrades', () => {
  const { o } = setup(), oil = o.pockets.filter(p => p.kind === 'oil').slice(0, 2);
  oil.forEach(p => explore(o, 'scan', p.x, p.y, 35)); const rig = buildRig(o, oil[0].x), branch = buildPipe(o, rig.nodeId, oil[0].x, 150); advance(o, 1);
  oil.forEach(p => assert.ok(buildPipe(o, branch.nodeId, p.x, p.y).ok)); advance(o, 15);
  assert.ok(networkDiagnostics(o).limited.includes(0));
  assert.ok(o.edges[0].flow <= 3.00001);
  assert.ok(Math.abs(o.edges[0].flow - o.edges[1].flow - o.edges[2].flow) < 1e-6);
  assert.ok(upgradePipe(o, 0)); assert.ok(upgradePipe(o, 0)); assert.equal(networkDiagnostics(o).limited.includes(0), false);
});
test('delivery ETA reflects loading, travel and a blocked tank', () => {
  const { o } = setup(); buildRig(o, 200);
  const truck = o.trucks[0]; assert.equal(deliveryEstimate(o, truck), null);
  Object.assign(truck, { phase: 'delivery', x: 200, destination: { kind: 'buyer', id: 'west' }, source: { kind: 'rig', id: 0 }, cargo: 5 });
  assert.equal(deliveryEstimate(o, truck), Math.ceil(180 / RULES.truckSpeed + RULES.step * 2));
  truck.phase = 'loading'; truck.timer = 0; assert.ok(deliveryEstimate(o, truck) >= 3);
  o.tanks.push({ x: 400, storage: 160, capacity: 160 }); truck.destination = { kind: 'tank', id: 0 }; truck.phase = 'unloading'; assert.equal(deliveryEstimate(o, truck), Infinity);
});
test('tutorial follows real actions, survives saves and can be dismissed', () => {
  const { c, o } = setup(), p = o.pockets[0]; assert.equal(tutorialStep(o).index, 1);
  explore(o, 'scan', p.x, p.y, 35); assert.equal(tutorialStep(o).index, 2);
  const rig = buildRig(o, p.x); assert.equal(tutorialStep(o).index, 3);
  buildPipe(o, rig.nodeId, p.x, p.y); assert.equal(tutorialStep(o).index, 4);
  advance(o, 3); assert.equal(tutorialStep(o).index, 5); advance(o, 20); assert.equal(tutorialStep(o).index, 6);
  assert.equal(tutorialStep(decode(encode(c, o)).operation).index, 6);
  o.guideDismissed = true; assert.equal(tutorialStep(decode(encode(c, o)).operation), null);
  assert.ok(debrief(o).some(text => text.includes('Preço médio')));
});
test('expansion contracts require both delivered volume and multiple productive reserves', () => {
  const { o } = setup(); o.region = 1;
  const terms = contractTerms(1, 2); assert.ok(terms.volume > 300); assert.equal(terms.wells, 2);
  o.contracts[0].volume = terms.volume; o.contracts[0].bonus = terms.bonus; acceptContract(o, 0);
  const p = o.pockets.filter(p => p.kind === 'oil').slice(0, 2);
  o.nodes.push({ pocketId: p[0].id }); p[0].amount--;
  deliver(o, 'west', terms.volume); assert.equal(o.contracts[0].status, 'active'); assert.equal(o.bonuses, 0);
  o.nodes.push({ pocketId: p[1].id }); p[1].amount--;
  deliver(o, 'west', 1); assert.equal(o.contracts[0].status, 'completed'); assert.equal(o.bonuses, terms.bonus);
  deliver(o, 'west', 100); assert.equal(o.bonuses, terms.bonus);
});
test('published v3 saves without new optional fields keep their old rules', () => {
  const { c, o } = setup();
  delete c.rules; delete c.guide; delete o.rules; delete o.guide; delete o.guideDismissed;
  const terms = contractTerms(o.region, 1); o.contracts.forEach(contract => Object.assign(contract, { volume: terms.volume, bonus: terms.bonus }));
  const decoded = decode(encode(c, o)); assert.ok(decoded); assert.equal(tutorialStep(decoded.operation), null);
  assert.equal(decoded.operation.contracts[0].volume, terms.volume);
});
test('independent slots, backup rotation, import validation and recovery preserve data', () => {
  const storage = memory(), { c, o } = setup(), first = encode(c, o);
  writeSlot(storage, 0, first); assert.equal(slotKey(0), KEY); assert.equal(slotSummary(storage, 1).empty, true);
  const other = createCampaign(100); writeSlot(storage, 1, encode(other, null));
  explore(o, 'scan', o.pockets[0].x, o.pockets[0].y, 35); const second = encode(c, o); writeSlot(storage, 0, second);
  assert.equal(storage.getItem(`${KEY}:backup`), first);
  writeSlot(storage, 0, second); assert.equal(storage.getItem(`${KEY}:backup`), first, 'Identical autosave does not erase backup');
  assert.throws(() => importSlot(storage, 0, '{invalid')); assert.equal(storage.getItem(KEY), second);
  storage.setItem(KEY, '{corrupt'); assert.ok(restoreSlot(storage, 0)); assert.equal(storage.getItem(KEY), first);
  assert.equal(decode(storage.getItem(slotKey(1))).campaign.seed, 100);
  importSlot(storage, 2, second); assert.equal(decode(storage.getItem(slotKey(2))).operation.cash, o.cash);
  assert.throws(() => slotKey(99)); assert.throws(() => restoreSlot(memory(), 0));
});
test('failed quota writes preserve the previous primary and do not claim success', () => {
  const storage = memory(), { c, o } = setup(), first = encode(c, o); writeSlot(storage, 0, first);
  explore(o, 'scan', o.pockets[0].x, o.pockets[0].y, 35);
  const blocked = { getItem: storage.getItem, setItem: () => { throw new Error('quota'); } };
  assert.throws(() => writeSlot(blocked, 0, encode(c, o)), /quota/); assert.equal(storage.getItem(KEY), first);
});
console.log(`${count} improvement suites passed.`);
