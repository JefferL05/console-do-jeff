import { RULES } from './config.js';
import { pathToRig } from './pipes.js';
import { storedOil, transitOil, sourceObject } from './logistics.js';

export function networkDiagnostics(operation) {
  const demand = operation.edges.map(() => 0), rigDemand = operation.rigs.map(() => 0);
  for (const node of operation.nodes) {
    if (node.pocketId === null || operation.pockets[node.pocketId].amount <= 0) continue;
    const path = pathToRig(operation, node.id);
    if (!path?.length || path.some(e => !e.open || e.progress < 1)) continue;
    const rate = operation.pockets[node.pocketId].y > 400 ? 4 : 3;
    for (const edge of path) demand[edge.id] += rate;
    rigDemand[node.rigId] += rate;
  }
  const edges = operation.edges.map(e => ({ id: e.id, capacity: RULES.pipeCapacity * (e.level + 1), flow: e.flow ?? 0, demand: demand[e.id], bottleneck: e.open && e.progress >= 1 && demand[e.id] > RULES.pipeCapacity * (e.level + 1) + .01 }));
  return { edges, rigDemand, limited: edges.filter(e => e.bottleneck).map(e => e.id) };
}
export function deliveryEstimate(operation, truck) {
  if (!truck.destination) return null;
  const speed = RULES.truckSpeed * (1 + operation.tech.speed * .15);
  const target = truck.destination.kind === 'buyer' ? truck.destination.id === 'west' ? 20 : 940 : operation.tanks[truck.destination.id].x;
  if (truck.phase === 'returning' || truck.phase === 'idle') return null;
  if (truck.phase === 'unloading') return truck.destination.kind === 'tank' && operation.tanks[truck.destination.id].storage >= operation.tanks[truck.destination.id].capacity ? Infinity : 0;
  let seconds = Math.abs(truck.x - target) / speed;
  if (truck.phase === 'pickup') {
    const source = sourceObject(operation, truck.source);
    seconds = (Math.abs(truck.x - source.x) + Math.abs(source.x - target)) / speed + 2;
  } else if (truck.phase === 'loading') seconds += Math.max(0, Math.min(2 - truck.timer, (truck.capacity - truck.cargo) / RULES.loadRate));
  return Math.ceil(seconds + RULES.step * 2);
}
export function debrief(operation) {
  const advice = [];
  const stranded = storedOil(operation) + transitOil(operation);
  const productive = operation.pockets.filter(p => p.kind === 'oil' && p.amount < p.initial).length;
  if (operation.sold > 0) advice.push(`Preço médio realizado: $ ${(operation.revenue / operation.sold).toFixed(2)}/b. Compare esse valor ao histórico dos compradores.`);
  if (operation.spilled > 1) advice.push(`Você perdeu ${operation.spilled.toFixed(1)} b e $ ${Math.floor(operation.fines)} em multas. Priorize transporte e feche válvulas antes de ampliar a extração.`);
  if (stranded > 10) advice.push(`${Math.floor(stranded)} b ficaram em tanques, torres ou veículos. Comece a venda final antes e acompanhe o tempo estimado das viagens.`);
  if (productive < 2) advice.push('Sua operação dependeu de uma única reserva. Pesquise outra camada e compare o custo de ramificar com instalar outra torre.');
  if (operation.expenses > operation.revenue) advice.push(`Investimentos de $ ${Math.floor(operation.expenses)} superaram as vendas. Expanda cedo e avalie o prazo de retorno antes de comprar no final.`);
  if (operation.contracts.some(c => c.status === 'completed')) advice.push(`Contratos cumpridos acrescentaram $ ${Math.floor(operation.bonuses)}. Use a próxima região para combinar volume e diversidade de reservas.`);
  if (networkDiagnostics(operation).limited.length) advice.push('A rede terminou com tubos abaixo da demanda das reservas. Amplie o tronco compartilhado, não apenas as pontas.');
  return advice.length ? advice : ['A operação terminou sem vendas. Comece pelo marcador inicial, confirme a pesquisa e conecte a reserva a uma torre.'];
}
