import { RULES, pay, notice } from './config.js';
import { blocked } from './exploration.js';

export function buildRig(operation, x) {
  if (!Number.isFinite(x) || x < 70 || x > 890 || operation.rigs.length >= 8 || operation.rigs.some(r => Math.abs(r.x - x) < 45) || operation.tanks.some(t => Math.abs(t.x - x) < 45)) return { ok: false, message: 'Escolha um espaço livre na superfície (máximo 8 torres).' };
  if (!pay(operation, RULES.rigCost)) return { ok: false, message: 'Capital insuficiente.' };
  const rig = { id: operation.rigs.length, x, storage: 0, capacity: RULES.rigCapacity, level: 0, fullTime: 0 };
  const node = { id: operation.nodes.length, x, y: RULES.surface, rigId: rig.id, pocketId: null };
  operation.rigs.push(rig); operation.nodes.push(node);
  return { ok: true, nodeId: node.id, message: 'Torre instalada. Toque no subsolo para traçar o primeiro segmento.' };
}
export function pipeQuote(operation, fromId, x, y) {
  const from = operation.nodes[fromId];
  const invalid = message => ({ ok: false, message, cost: 0 });
  if (operation.ended || !from) return invalid('Selecione uma torre ou junção como origem.');
  const parent = operation.edges.find(e => e.to === fromId);
  if (parent && parent.progress < 1) return invalid('Aguarde o segmento de origem ficar pronto.');
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 15 || x > 945 || y < RULES.surface + 12 || y > 585) return invalid('O destino deve ficar dentro do subsolo.');
  const pocket = operation.pockets.filter(p => p.revealed && p.kind === 'oil' && Math.hypot(p.x - x, p.y - y) <= p.rx + 8).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  if (pocket) { x = pocket.x; y = pocket.y; }
  if (pocket && operation.nodes.some(n => n.pocketId === pocket.id)) return invalid('Esta reserva já está conectada. Ramifique a partir de uma junção.');
  if (operation.nodes.some(n => Math.hypot(n.x - x, n.y - y) < 12)) return invalid('Conexão existente. Selecione essa junção como origem.');
  if (operation.edges.length >= 100) return invalid('Limite de 100 segmentos atingido.');
  const length = Math.hypot(x - from.x, y - from.y);
  if (length < 12 || length > 700) return invalid('O segmento deve medir entre 12 e 700 unidades.');
  const obstacle = blocked(operation, from, { x, y });
  if (obstacle) return invalid(obstacle.kind === 'ice' ? 'Gelo: contorne ou desbloqueie a broca térmica na cidade.' : 'Rocha: contorne ou desbloqueie a broca reforçada na cidade.');
  const cost = Math.ceil(RULES.pipeBase + length * RULES.pipePerUnit);
  return { ok: operation.cash >= cost, message: operation.cash >= cost ? `Trajeto ${Math.ceil(length)} · ${Math.ceil(length / (RULES.pipeSpeed * (1 + operation.tech.drill * .25)))} s · capacidade 3 b/s` : 'Capital insuficiente.', fromId, x, y, pocketId: pocket?.id ?? null, length, cost };
}
export function buildPipe(operation, fromId, x, y) {
  const q = pipeQuote(operation, fromId, x, y);
  if (!q.ok || !pay(operation, q.cost)) return { ...q, ok: false };
  const node = { id: operation.nodes.length, x: q.x, y: q.y, rigId: operation.nodes[fromId].rigId, pocketId: q.pocketId };
  operation.nodes.push(node);
  operation.edges.push({ id: operation.edges.length, from: fromId, to: node.id, length: q.length, progress: 0, level: 0, open: true });
  return { ok: true, nodeId: node.id, message: 'Perfuração iniciada. O fluxo dependerá de todos os trechos até a torre.' };
}
export function upgradePipe(operation, edgeId) {
  const edge = operation.edges[edgeId];
  if (!edge || edge.level >= 2 || !pay(operation, 100 * (edge.level + 1))) return false;
  edge.level++; return true;
}
export function togglePipe(operation, edgeId) {
  const edge = operation.edges[edgeId];
  if (!edge || operation.ended) return false;
  edge.open = !edge.open; return true;
}
export function pathToRig(operation, nodeId) {
  const path = [];
  let node = operation.nodes[nodeId];
  for (let i = 0; node && i <= operation.nodes.length; i++) {
    const edge = operation.edges.find(e => e.to === node.id);
    if (!edge) return node.y === RULES.surface ? path : null;
    path.push(edge); node = operation.nodes[edge.from];
  }
  return null;
}
export function stepPipes(operation, dt) {
  for (const edge of operation.edges) edge.progress = Math.min(1, edge.progress + dt * RULES.pipeSpeed * (1 + operation.tech.drill * .25) / edge.length);
  const available = operation.edges.map(e => e.progress >= 1 && e.open ? RULES.pipeCapacity * (e.level + 1) * dt : 0);
  const rigBudget = operation.rigs.map(r => (RULES.rigRate + r.level * 2) * dt);
  const connected = operation.nodes.filter(n => n.pocketId !== null);
  // Rotate priority to prevent a sibling reserve from permanently starving.
  const offset = connected.length ? Math.floor(operation.elapsed) % connected.length : 0;
  for (let i = 0; i < connected.length; i++) {
    const node = connected[(i + offset) % connected.length], pocket = operation.pockets[node.pocketId], rig = operation.rigs[node.rigId];
    const path = pathToRig(operation, node.id);
    if (!path?.length || pocket.amount <= 0) continue;
    const rate = pocket.y > 400 ? 4 : 3;
    let amount = Math.min(pocket.amount, rate * dt, rigBudget[rig.id], ...path.map(e => available[e.id]));
    const room = Math.max(0, rig.capacity - rig.storage);
    if (operation.difficulty === 'relaxed' || rig.fullTime < 3) amount = Math.min(amount, room);
    if (amount <= 0) continue;
    for (const edge of path) available[edge.id] -= amount;
    rigBudget[rig.id] -= amount;
    pocket.amount -= amount; operation.extracted += amount;
    const stored = Math.min(room, amount), lost = amount - stored;
    rig.storage += stored; operation.spilled += lost;
    if (lost > 0) { const fine = lost * RULES.finePerBarrel; operation.fines += fine; operation.cash -= fine; }
  }
  for (const rig of operation.rigs) {
    if (rig.storage >= rig.capacity * .95) {
      if (rig.fullTime === 0) notice(operation, `Torre ${rig.id + 1} quase cheia! Designe transporte ou feche a válvula.`);
      rig.fullTime += dt;
    } else rig.fullTime = 0;
  }
}
