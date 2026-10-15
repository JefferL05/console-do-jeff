import { RULES, pay } from './config.js';
import { blocked } from './exploration.js';

export function gasQuote(operation, pocketId, side) {
  const pocket = operation.pockets[pocketId];
  const invalid = message => ({ ok: false, message, cost: 0 });
  if (operation.ended || !operation.tech.gas) return invalid('Desbloqueie válvulas de gás na oficina da cidade.');
  if (!pocket?.revealed || pocket.kind !== 'gas' || pocket.amount <= 0 || !['west', 'east'].includes(side)) return invalid('Selecione uma bolsa de gás revelada e um comprador.');
  if (operation.gasLines.some(l => l.pocketId === pocketId)) return invalid('Esta bolsa já possui uma linha. Use sua válvula.');
  const endpoint = { x: side === 'west' ? 20 : 940, y: RULES.surface };
  const rock = blocked(operation, pocket, endpoint);
  if (rock) return invalid('A linha atravessa um obstáculo. Desbloqueie a broca adequada na cidade.');
  const length = Math.hypot(endpoint.x - pocket.x, endpoint.y - pocket.y), cost = Math.ceil(RULES.gasCost + length * .6);
  return { ok: operation.cash >= cost, cost, length, pocketId, side, message: operation.cash >= cost ? 'Linha exclusiva de gás. Abra a válvula quando suas cargas estiverem a caminho.' : 'Capital insuficiente.' };
}
export function connectGas(operation, pocketId, side) {
  const quote = gasQuote(operation, pocketId, side);
  if (!quote.ok || !pay(operation, quote.cost)) return { ...quote, ok: false };
  operation.gasLines.push({ id: operation.gasLines.length, pocketId, side, length: quote.length, progress: 0, open: false });
  return { ok: true, message: 'Linha em construção, válvula fechada. Abra-a no painel de gás.' };
}
export function toggleGas(operation, id) {
  const line = operation.gasLines[id];
  if (!line || operation.ended || line.progress < 1) return false;
  line.open = !line.open; return true;
}
export function stepGas(operation, dt) {
  const flow = { west: 0, east: 0 };
  for (const line of operation.gasLines) {
    line.progress = Math.min(1, line.progress + dt * RULES.pipeSpeed * (1 + operation.tech.drill * .25) / line.length);
    if (!line.open || line.progress < 1) continue;
    const pocket = operation.pockets[line.pocketId], amount = Math.min(pocket.amount, dt);
    pocket.amount -= amount; operation.gasUsed += amount; flow[line.side] += amount;
    if (pocket.amount <= 0) line.open = false;
  }
  for (const side of ['west', 'east']) operation.gasBoost[side] = Math.max(0, Math.min(4, operation.gasBoost[side] + (flow[side] > 0 ? .8 * flow[side] : -.5 * dt)));
}
