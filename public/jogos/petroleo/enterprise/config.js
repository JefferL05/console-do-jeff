export const RULES = Object.freeze({
  width: 960, height: 600, surface: 120, step: 1 / 30,
  seasons: 10, initialWealth: 10000, operationBudget: 2400, duration: 300,
  rigCost: 220, rigCapacity: 30, rigRate: 4,
  pipeBase: 25, pipePerUnit: 1.1, pipeSpeed: 55, pipeCapacity: 3,
  truckCost: 260, truckCapacity: 20, truckSpeed: 110, loadRate: 14, maxTrucks: 12,
  tankCost: 300, tankCapacity: 160, finePerBarrel: 3,
  prospectorCost: 70, probeCost: 110, gasCost: 350,
});
export const REGIONS = [
  { name: 'Vale Dourado', color: '#b98a58', count: 7, rock: false, gas: false, ice: false, tip: 'Reservas rasas. Aprenda a equilibrar tubos e transporte.' },
  { name: 'Bacia do Cedro', color: '#9a7650', count: 10, rock: false, gas: false, ice: false, tip: 'Bolsões dispersos. Ramificações economizam capital.' },
  { name: 'Serra de Cobre', color: '#97715a', count: 9, rock: true, gas: false, ice: false, tip: 'Contorne as rochas ou use a broca reforçada.' },
  { name: 'Planalto do Gás', color: '#9a8159', count: 9, rock: true, gas: true, ice: false, tip: 'Gás valoriza o comprador. Sincronize suas entregas.' },
  { name: 'Fronteira Gelada', color: '#819696', count: 10, rock: true, gas: true, ice: true, tip: 'Gelo exige broca térmica ou um trajeto alternativo.' },
];
export const TECHNOLOGIES = {
  survey: { name: 'Pesquisa geológica', description: 'Prospector mais rápido e sonda mais longa.', base: 450, max: 3 },
  drill: { name: 'Perfuração rápida', description: '+25% de velocidade por nível.', base: 550, max: 3 },
  cargo: { name: 'Carrocerias ampliadas', description: '+5 barris por veículo por nível.', base: 600, max: 3 },
  speed: { name: 'Motores eficientes', description: '+15% na velocidade dos veículos por nível.', base: 600, max: 3 },
  tank: { name: 'Tanques reforçados', description: '+40 barris em cada tanque por nível.', base: 500, max: 3 },
  rock: { name: 'Broca reforçada', description: 'Permite perfurar rocha.', base: 1100, max: 1 },
  gas: { name: 'Válvulas de gás', description: 'Permite instalar linhas de gás aos compradores.', base: 1200, max: 1 },
  ice: { name: 'Broca térmica', description: 'Permite atravessar gelo.', base: 1400, max: 1 },
};
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const money = n => '$ ' + Math.floor(n).toLocaleString('pt-BR');
export function pay(operation, cost) {
  if (!Number.isFinite(cost) || cost < 0 || operation.cash + 1e-8 < cost || operation.ended) return false;
  operation.cash -= cost; operation.expenses += cost; return true;
}
export function notice(operation, text) {
  operation.notices.push(text);
  if (operation.notices.length > 6) operation.notices.shift();
}
