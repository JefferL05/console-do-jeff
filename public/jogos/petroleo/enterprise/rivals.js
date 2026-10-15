import { seededRandom } from '../modules/terrain.js';

export function createRivals() {
  return [
    { name: 'Clara — conservadora', style: 'careful', cash: 10000, shares: 0, equipment: 0, lastProfit: 0 },
    { name: 'Bento — expansionista', style: 'expansion', cash: 10000, shares: 0, equipment: 0, lastProfit: 0 },
    { name: 'Iara — especuladora', style: 'speculator', cash: 10000, shares: 0, equipment: 0, lastProfit: 0 },
  ];
}
export function rivalLimit(campaign, index, type, plot = null) {
  const rival = campaign.rivals[index];
  const random = seededRandom(campaign.seed + campaign.season * 101 + index * 17 + (type === 'shares' ? 9001 : plot.id));
  const reserve = rival.style === 'careful' ? 5000 : 3000;
  const competition = campaign.rules >= 2
    ? 1600 + campaign.season * 550 + random() * 700 + (rival.style === 'speculator' ? 900 : 0) + Math.max(0, campaign.shares - rival.shares) * 35
    : 700 + campaign.season * 170 + (rival.style === 'speculator' ? 700 : 0);
  const valuation = type === 'shares' ? competition : 500 + plot.rating * 180 + random() * 350;
  return Math.max(0, Math.min(rival.cash - reserve, Math.floor(valuation / 100) * 100));
}
export function rivalComment(rival) {
  if (rival.shares >= 20) return 'Minha participação já pesa na prefeitura. Cada novo lote vale mais.';
  if (rival.cash < 5000) return 'Vou recompor meu caixa antes de entrar em outra disputa cara.';
  return { careful: 'Preservo uma reserva de caixa. Terreno caro precisa justificar o investimento.', expansion: 'Invisto em equipamentos para aumentar o retorno das próximas temporadas.', speculator: 'Fico de olho na bolsa da cidade. Participações decidem a campanha.' }[rival.style];
}
export function advanceRivals(campaign) {
  campaign.rivals.forEach((rival, i) => {
    const random = seededRandom(campaign.seed + campaign.season * 331 + i * 77);
    const investment = Math.min(Math.max(0, rival.cash - 3000), rival.style === 'expansion' ? 850 : 400);
    rival.cash -= investment; rival.equipment += investment / 800;
    const land = campaign.plots.filter(p => p.owner === i).reduce((sum, p) => sum + p.rating * 120, 0);
    const income = Math.round(700 + random() * 1600 + rival.equipment * 120 + campaign.region * 100 + land);
    rival.cash += income; rival.lastProfit = income - investment;
  });
}
