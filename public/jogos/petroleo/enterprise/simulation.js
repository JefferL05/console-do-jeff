import { RULES } from './config.js';
import { generateField, stepExploration } from './exploration.js';
import { stepPipes } from './pipes.js';
import { makeTruck, stepLogistics, storedOil, transitOil } from './logistics.js';
import { updateMarket, deliver } from './market.js';
import { stepGas } from './gas.js';
import { contractTerms, profitGoal } from './progression.js';

export function createOperation({ seed, region, tech, difficulty = 'relaxed', season = 0, rules = 1, guide = false }) {
  const field = generateField(seed, region);
  const operation = {
    seed: seed >>> 0, region, season, rules, guide, guideDismissed: false, tech: { ...tech }, difficulty,
    duration: RULES.duration, time: RULES.duration, elapsed: 0, paused: false, ended: false, settled: false,
    initialCash: RULES.operationBudget, cash: RULES.operationBudget, expenses: 0, revenue: 0, bonuses: 0, fines: 0,
    ...field, extracted: 0, sold: 0, spilled: 0, gasUsed: 0,
    rigs: [], nodes: [], edges: [], tanks: [], trucks: [makeTruck(0, tech)],
    surveys: [], explorers: [], markers: [{ x: Math.round(field.pockets[0].x / 30) * 30, pocketId: 0 }],
    gasLines: [], gasBoost: { west: 0, east: 0 }, prices: { west: 8, east: 8 }, history: [], marketSecond: -1,
    contracts: ['west', 'east'].map((side, id) => ({ id, side, volume: contractTerms(region, rules).volume, deadline: 180, bonus: contractTerms(region, rules).bonus, delivered: 0, status: 'offered' })),
    notices: ['O marcador inicial indica petróleo raso. Pesquise, instale uma torre e conecte a reserva.'],
  };
  updateMarket(operation); return operation;
}
export function stepOperation(operation, dt = RULES.step) {
  if (operation.paused || operation.ended || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, .1, operation.time);
  operation.time = Math.max(0, operation.time - dt); operation.elapsed = operation.duration - operation.time;
  stepExploration(operation, dt); stepGas(operation, dt); updateMarket(operation);
  stepPipes(operation, dt); stepLogistics(operation, dt, deliver);
  if (operation.time < 1e-8) { operation.time = 0; operation.elapsed = operation.duration; operation.ended = true; operation.paused = true; }
}
export function operationReport(operation) {
  const profit = operation.cash - operation.initialCash;
  const goal = profitGoal(operation);
  const efficiency = operation.extracted > 0 ? operation.sold / operation.extracted : 0;
  const recovery = operation.extracted / operation.totalOil;
  const medals = [profit >= goal, efficiency >= .85 && operation.sold >= 50, recovery >= .4];
  const relicBonus = operation.pockets.filter(p => p.kind === 'relic' && p.collected).length * 350;
  return { profit, goal, efficiency, recovery, medals, relicBonus, reward: medals.filter(Boolean).length * 100 + relicBonus, stored: storedOil(operation), transit: transitOil(operation) };
}
