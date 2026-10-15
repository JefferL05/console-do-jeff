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
  const valuation = type === 'shares' ? 700 + campaign.season * 170 + (rival.style === 'speculator' ? 700 : 0) : 500 + plot.rating * 180 + random() * 350;
  return Math.max(0, Math.min(rival.cash - reserve, Math.floor(valuation / 100) * 100));
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
