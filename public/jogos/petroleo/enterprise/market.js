import { notice } from './config.js';

export function updateMarket(operation) {
  const t = operation.elapsed, phase = (operation.seed % 997) / 101;
  for (const side of ['west', 'east']) {
    const east = side === 'east';
    const wave = Math.sin(t / (east ? 24 : 19) + phase + (east ? 2.8 : 0)) * 2.8;
    const demand = Math.sin(t / 8 + (east ? 2 : 0)) * .65;
    operation.prices[side] = Math.max(3, Math.min(17, 8 + wave + demand + operation.gasBoost[side]));
  }
  if (Math.floor(t) > operation.marketSecond) {
    operation.marketSecond = Math.floor(t); operation.history.push({ ...operation.prices });
    if (operation.history.length > 30) operation.history.shift();
  }
  for (const c of operation.contracts) if (c.status === 'active' && t > c.deadline + 1e-8) {
    c.status = 'expired'; notice(operation, 'Contrato expirado. As vendas realizadas continuam no seu caixa.');
  }
}
export function acceptContract(operation, id) {
  const contract = operation.contracts.find(c => c.id === id);
  if (!contract || contract.status !== 'offered' || operation.ended || operation.elapsed >= contract.deadline - 20 || operation.contracts.some(c => c.status === 'active')) return false;
  contract.status = 'active'; notice(operation, 'Contrato aceito: apenas entregas após a assinatura contam.'); return true;
}
export function deliver(operation, side, barrels) {
  if (!(barrels > 0)) return;
  const income = barrels * operation.prices[side];
  operation.sold += barrels; operation.revenue += income; operation.cash += income;
  for (const c of operation.contracts) if (c.status === 'active' && c.side === side && operation.elapsed <= c.deadline + 1e-8) {
    c.delivered += barrels;
    if (c.delivered + 1e-8 >= c.volume) {
      c.status = 'completed'; operation.bonuses += c.bonus; operation.cash += c.bonus;
      notice(operation, `Contrato cumprido: +$ ${c.bonus}.`);
    }
  }
}
