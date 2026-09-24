import { mkdir, writeFile } from 'node:fs/promises';
import { PROFILES } from '../public/jogos/petroleo/modules/config.js';
import { createGame, scanQuote, drillQuote, commit, step, buyUpgrade, metrics, wellRate, transportRate } from '../public/jogos/petroleo/modules/simulation.js';

const rows = [];
const scanGrid = [130, 230, 315].flatMap(y => [70, 180, 285].map(x => ({ x, y })));
// These policies see only scanned pockets. The sole starting hint is the same
// accessible reserve shown by the tutorial; they do not inspect hidden reserves.
for (const policy of ['starter', 'expand']) for (const mode of ['quick', 'classic']) for (let profile = 0; profile < 3; profile++) {
  const results = [];
  for (let index = 1; index <= 40; index++) {
    const seed = Math.imul(index, 2654435761) >>> 0;
    const game = createGame({ seed, profile, mode }); let cursor = 0, firstSale = null;
    commit(game, scanQuote(game, game.pockets[0].x, game.pockets[0].y)); commit(game, drillQuote(game, 0));
    for (let tick = 0; !game.ended; tick++) {
      if (tick % 90 === 0) {
        game.target = game.prices.west >= game.prices.east ? 'west' : 'east';
        if (game.storage > 25 && wellRate(game) > transportRate(game) && game.time > 40) buyUpgrade(game, 'truck');
        if (policy === 'expand' && game.time > 45 && game.cash > 500 && tick % 180 === 0) {
          const quotes = game.pockets.filter(p => p.revealed && !game.wells.some(w => w.pocketId === p.id)).flatMap(p => [drillQuote(game, p.id), ...game.wells.filter(w => w.progress >= 1).map(w => drillQuote(game, p.id, w.id))]);
          const best = quotes.filter(q => q.valid && game.cash - q.cost >= 200).sort((a, b) => a.cost - b.cost)[0];
          if (best) commit(game, best);
          else if (profile === 2 && !game.bit && quotes.some(q => q.reason.includes('Rocha'))) buyUpgrade(game, 'bit');
          else if (cursor < scanGrid.length) { const point = scanGrid[cursor++]; commit(game, scanQuote(game, point.x, point.y)); }
        }
      }
      step(game); game.events.length = 0;
      if (firstSale === null && game.sold > 0) firstSale = game.duration - game.time;
    }
    results.push({ ...metrics(game), firstSale, seed, cash: game.cash, wells: game.wells.length });
  }
  const profits = results.map(r => r.profit).sort((a, b) => a - b);
  rows.push({ policy, mode, profile: PROFILES[profile].name, rounds: results.length, minProfit: Math.round(profits[0]), medianProfit: Math.round(profits[20]), maxProfit: Math.round(profits.at(-1)), profitable: results.filter(r => r.profit > 0).length, medianStars: results.map(r => r.stars).sort()[20], latestFirstSaleSeconds: Math.ceil(Math.max(...results.map(r => r.firstSale))), averageRecovery: Math.round(results.reduce((s, r) => s + r.recovery, 0) / results.length * 100) });
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/ouro-balance.json', JSON.stringify({ seeds: 'uint32(index × 2654435761), index 1–40', initialResearch: 'none', note: 'Automated heuristic policies, not human playtesting.', rows }, null, 2));
console.table(rows);
if (rows.some(row => row.latestFirstSaleSeconds > 60 || row.profitable < row.rounds * .8)) throw Error('Starting economy needs review. See artifacts/ouro-balance.json.');
console.log('480 matches complete. Report: artifacts/ouro-balance.json');
