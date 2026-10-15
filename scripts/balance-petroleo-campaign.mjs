import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createCampaign, leaseSafe, launchOperation, finishSeason, buyTechnology, startAuction, bid, finishAuction, standings } from '../public/jogos/petroleo/enterprise/campaign.js';
import { explore } from '../public/jogos/petroleo/enterprise/exploration.js';
import { buildRig, buildPipe, pipeQuote } from '../public/jogos/petroleo/enterprise/pipes.js';
import { buyTruck } from '../public/jogos/petroleo/enterprise/logistics.js';
import { acceptContract } from '../public/jogos/petroleo/enterprise/market.js';
import { stepOperation } from '../public/jogos/petroleo/enterprise/simulation.js';
import { validateOperation, validateCampaign } from '../public/jogos/petroleo/enterprise/persistence.js';

const count = Number(process.env.CAMPAIGN_SEEDS || 20), results = [];
const surveyGrid = [220, 350, 480].flatMap(y => [120, 260, 400, 540, 680, 820].map(x => ({ x, y })));
for (const policy of ['starter', 'expand']) for (let index = 0; index < count; index++) {
  const seed = Math.imul(index + 1, 2654435761) >>> 0, campaign = createCampaign(seed);
  let oil = 0;
  for (let season = 0; season < 10; season++) {
    for (const [key, region, cost] of [['rock', 2, 1100], ['gas', 3, 1200], ['ice', 4, 1400]]) if (campaign.region >= region && !campaign.tech[key] && campaign.cash > cost + 5700) buyTechnology(campaign, key);
    startAuction(campaign, 'shares');
    for (let n = 0; n < 100 && campaign.auction.leader !== 'player'; n++) if (!bid(campaign)) break;
    finishAuction(campaign); assert.ok(leaseSafe(campaign));
    const o = launchOperation(campaign), p = o.pockets[0]; explore(o, 'scan', p.x, p.y, 35); const rig = buildRig(o, p.x); buildPipe(o, rig.nodeId, p.x, p.y); acceptContract(o, 0);
    let survey = 0;
    for (let tick = 0; !o.ended && tick < 9100; tick++) {
      if (policy === 'expand' && tick % 150 === 0 && o.elapsed < 180) {
        const available = o.pockets.filter(p => p.revealed && p.kind === 'oil' && !o.nodes.some(n => n.pocketId === p.id));
        let built = false;
        for (const pocket of available) {
          for (const offset of [0, 50, -50, 100, -100]) {
            const x = Math.max(70, Math.min(890, pocket.x + offset)), draft = structuredClone(o), candidate = buildRig(draft, x);
            if (!candidate.ok || !pipeQuote(draft, candidate.nodeId, pocket.x, pocket.y).ok) continue;
            const source = buildRig(o, x); buildPipe(o, source.nodeId, pocket.x, pocket.y); built = true; break;
          }
          if (built) break;
        }
        if (o.trucks.length < o.rigs.length + 1 && o.cash > 650) buyTruck(o);
        if (!built && o.elapsed < 130 && o.cash > 700 && survey < surveyGrid.length) { const point = surveyGrid[survey++]; explore(o, 'scan', point.x, point.y, 90); }
      }
      stepOperation(o);
    }
    assert.ok(o.ended); assert.ok(validateOperation(o)); oil += o.sold;
    finishSeason(campaign, o); assert.ok(validateCampaign(campaign));
  }
  results.push({ policy, seed, shares: campaign.shares, wealth: Math.round(campaign.cash), won: standings(campaign)[0].player, oil: Math.round(oil) });
}
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const summary = ['starter', 'expand'].map(policy => {
  const subset = results.filter(r => r.policy === policy);
  return { policy, campaigns: subset.length, wins: subset.filter(r => r.won).length, medianShares: median(subset.map(r => r.shares)), medianWealth: median(subset.map(r => r.wealth)), medianOil: median(subset.map(r => r.oil)) };
});
console.table(summary);
assert.ok(summary[0].medianShares < 50, 'One reserve must not routinely buy every share');
assert.ok(summary[1].medianOil > summary[0].medianOil * 1.5, 'Expansion must materially increase output');
assert.ok(summary[1].wins > summary[0].wins, 'Expansion should improve the chance of winning');
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/ouro-campaign-balance.json', JSON.stringify({ summary, results }, null, 2));
console.log(`${count * 20} seasons simulated. Report: artifacts/ouro-campaign-balance.json`);
