import { CONFIG, PROFILES, RESEARCH } from './config.js';
import { generateTerrain, touchesRock } from './terrain.js';

export function createProgress() {
  return { credits: 0, unlocked: 0, completed: [false, false, false], research: { tank: 0, cargo: 0, scan: 0 }, best: 0 };
}
export function newTruck(id, research) {
  return { id, phase: 'idle', cargo: 0, timer: 0, destination: null, capacity: CONFIG.truck.capacity + research.cargo * 4 };
}
export function createGame({ seed = 1, profile = 0, mode = 'quick', tutorial = false, research = createProgress().research } = {}) {
  const terrain = generateTerrain(seed, profile);
  const game = {
    seed: seed >>> 0, profile, mode, duration: CONFIG.durations[mode], time: CONFIG.durations[mode],
    cash: CONFIG.initialCash, expenses: 0, revenue: 0, storage: 0, extracted: 0, sold: 0,
    capacity: CONFIG.tank.initial + research.tank * 40, tankLevel: 0, bit: false,
    research: { ...research }, target: 'west', paused: false, ended: false, rewarded: false,
    pockets: terrain.pockets, rocks: terrain.rocks, total: terrain.total, scans: [], wells: [],
    trucks: [newTruck(0, research)], history: [], marketClock: 0, prices: { west: 0, east: 0 },
    tutorial: tutorial ? 0 : -1, events: [], nearFull: false, warnedEnd: false, fullSeconds: 0,
  };
  updatePrices(game);
  game.history.push({ west: game.prices.west, east: game.prices.east });
  return game;
}

export function inTransit(game) { return game.trucks.reduce((sum, truck) => sum + truck.cargo, 0); }
export function scanRadius(game) { return CONFIG.scan.radius + game.research.scan * 5; }
export function wellRate(game) {
  return game.wells.filter(w => w.progress >= 1 && game.pockets[w.pocketId].amount > 0).length * CONFIG.drill.rate;
}
export function transportRate(game) {
  return game.trucks.reduce((sum, t) => sum + t.capacity / (CONFIG.truck.travelTime * 2 + CONFIG.truck.unloadTime + t.capacity / CONFIG.truck.loadRate), 0);
}
function event(game, kind, text, details = {}) { game.events.push({ kind, text, ...details }); if (game.events.length > 20) game.events.shift(); }
function pay(game, cost) {
  if (game.cash + 1e-8 < cost) return false;
  game.cash = Math.max(0, game.cash - cost); game.expenses += cost; return true;
}
export function scanQuote(game, x, y) {
  const valid = x >= 0 && x <= CONFIG.world.width && y > CONFIG.world.surface + 10 && y <= CONFIG.world.height;
  const repeated = game.scans.some(s => Math.hypot(s.x - x, s.y - y) < 10);
  const reason = !valid ? 'Escolha uma área abaixo da superfície.' : repeated ? 'Esta área já foi sondada. Escolha outra.' : game.cash < CONFIG.scan.cost ? 'Falta capital para esta sondagem.' : '';
  return { type: 'scan', x, y, cost: CONFIG.scan.cost, valid: !reason, reason };
}
export function drillQuote(game, pocketId, parentId = null) {
  const pocket = game.pockets[pocketId];
  const parent = parentId === null ? null : game.wells.find(w => w.id === parentId);
  if (!pocket || !pocket.revealed) return { type: 'drill', valid: false, cost: 0, reason: 'Selecione um bolsão revelado.' };
  const from = parent ? { x: game.pockets[parent.pocketId].x, y: game.pockets[parent.pocketId].y } : { x: pocket.x, y: CONFIG.world.surface };
  const distance = Math.hypot(pocket.x - from.x, pocket.y - from.y);
  const cost = Math.ceil((parent ? CONFIG.drill.branchBase : CONFIG.drill.base) + distance * CONFIG.drill.perUnit);
  let reason = '';
  if (parentId !== null && (!parent || parent.progress < 1)) reason = 'Escolha uma conexão já perfurada.';
  else if (game.wells.some(w => w.pocketId === pocketId)) reason = 'Este bolsão já tem uma conexão.';
  else if (pocket.amount <= 0) reason = 'Este bolsão está esgotado.';
  else if (!game.bit && touchesRock(from, pocket, game.rocks)) reason = 'Rocha no caminho. Compre a broca reforçada em Melhorar.';
  else if (game.cash < cost) reason = 'Falta capital. Venda petróleo ou escolha um trajeto menor.';
  return { type: 'drill', pocketId, parentId, from, x: pocket.x, y: pocket.y, distance, cost, valid: !reason, reason };
}
export function commit(game, preview) {
  if (!preview || game.paused || game.ended) return { ok: false, reason: 'Retome a operação para construir.' };
  const quote = preview.type === 'scan' ? scanQuote(game, preview.x, preview.y) : drillQuote(game, preview.pocketId, preview.parentId);
  if (!quote.valid) return { ok: false, reason: quote.reason };
  if (!pay(game, quote.cost)) return { ok: false, reason: 'Capital insuficiente.' };
  if (quote.type === 'scan') {
    game.scans.push({ x: quote.x, y: quote.y });
    let found = 0;
    for (const p of game.pockets) if (!p.revealed && Math.hypot(p.x - quote.x, p.y - quote.y) <= scanRadius(game) + p.rx / 2) { p.revealed = true; found++; }
    event(game, 'scan', found ? `${found} reserva descoberta! Selecione Perfurar.` : 'Área sondada. Procure em outra camada.', { x: quote.x, y: quote.y });
    if (game.tutorial === 0 && game.pockets.some(p => p.revealed)) game.tutorial = 1;
  } else {
    game.wells.push({ id: game.wells.length, pocketId: quote.pocketId, parentId: quote.parentId, from: quote.from, distance: quote.distance, progress: 0 });
    event(game, 'drill', 'Perfuração em andamento. O petróleo irá para o tanque.');
    if (game.tutorial === 1) game.tutorial = 2;
  }
  return { ok: true };
}
export function upgradeQuote(game, type) {
  const cost = type === 'tank' ? CONFIG.tank.cost + game.tankLevel * CONFIG.tank.step : type === 'truck' ? CONFIG.truck.cost + (game.trucks.length - 1) * CONFIG.truck.step : CONFIG.bitCost;
  const reason = !['tank', 'truck', 'bit'].includes(type) ? 'Melhoria inválida.' : type === 'truck' && game.trucks.length >= CONFIG.truck.max ? 'Frota máxima: 8 veículos.' : type === 'bit' && game.bit ? 'Broca já adquirida.' : game.tutorial >= 0 && game.tutorial < 4 ? 'Faça a primeira venda para liberar melhorias.' : game.cash < cost ? 'Capital insuficiente. Aguarde uma entrega.' : '';
  return { cost, valid: !reason, reason };
}
export function buyUpgrade(game, type) {
  const quote = upgradeQuote(game, type);
  if (!quote.valid || game.ended || !pay(game, quote.cost)) return false;
  if (type === 'tank') { game.capacity += CONFIG.tank.increment; game.tankLevel++; }
  if (type === 'truck') game.trucks.push(newTruck(game.trucks.length, game.research));
  if (type === 'bit') game.bit = true;
  event(game, 'upgrade', 'Melhoria instalada na operação.'); return true;
}
export function updatePrices(game) {
  const elapsed = game.duration - game.time, phase = (game.seed % 1000) / 100;
  game.prices.west = 9 + Math.sin(elapsed / 19 + phase) * 3.5 + Math.sin(elapsed / 7) * 0.8;
  game.prices.east = 9 + Math.sin(elapsed / 24 + phase + 2.8) * 3.5 + Math.cos(elapsed / 9) * 0.8;
}
export function step(game, dt = CONFIG.step) {
  if (game.paused || game.ended || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, game.time);
  game.time = Math.max(0, game.time - dt); updatePrices(game);
  game.marketClock += dt;
  if (game.marketClock >= 1) {
    game.marketClock %= 1; game.history.push({ ...game.prices }); if (game.history.length > 30) game.history.shift();
  }
  for (const well of game.wells) {
    if (well.progress < 1) { well.progress = Math.min(1, well.progress + dt * CONFIG.drill.speed / Math.max(well.distance, 1)); continue; }
    const pocket = game.pockets[well.pocketId];
    const amount = Math.max(0, Math.min(dt * CONFIG.drill.rate, pocket.amount, game.capacity - game.storage));
    pocket.amount -= amount; game.storage += amount; game.extracted += amount;
    if (amount > 0 && game.tutorial === 2) { game.tutorial = 3; event(game, 'extract', 'Ouro à vista! Escolha um comprador e acompanhe a entrega.'); }
  }
  for (const truck of game.trucks) {
    if (truck.phase === 'idle') {
      if (game.target === 'hold' || game.storage < 1) continue;
      truck.destination = game.target; truck.phase = 'loading'; truck.timer = 0;
    }
    if (truck.phase === 'loading') {
      const load = Math.max(0, Math.min(game.storage, truck.capacity - truck.cargo, CONFIG.truck.loadRate * dt));
      game.storage -= load; truck.cargo += load; truck.timer += dt;
      if (truck.cargo >= truck.capacity - 1e-8 || (truck.timer >= 2 && truck.cargo > 0)) { truck.phase = 'outbound'; truck.timer = 0; }
    } else if (truck.phase === 'outbound') {
      truck.timer += dt;
      if (truck.timer >= CONFIG.truck.travelTime) {
        const income = truck.cargo * game.prices[truck.destination];
        game.cash += income; game.revenue += income; game.sold += truck.cargo;
        truck.cargo = 0; truck.phase = 'unloading'; truck.timer = 0;
        event(game, 'sale', 'Entrega concluída. Receita recebida pelo preço atual.', { income, x: truck.destination === 'west' ? 24 : 336, y: 44 });
        if (game.tutorial === 3) { game.tutorial = 4; event(game, 'tutorial', 'Primeira venda! Melhorias liberadas. Sua operação está pronta.'); }
      }
    } else if (truck.phase === 'unloading') {
      truck.timer += dt;
      if (truck.timer >= CONFIG.truck.unloadTime) { truck.phase = 'returning'; truck.timer = 0; }
    } else if (truck.phase === 'returning') {
      truck.timer += dt;
      if (truck.timer >= CONFIG.truck.travelTime) { truck.phase = 'idle'; truck.timer = 0; truck.destination = null; }
    }
  }
  if (game.storage >= game.capacity - 0.01) game.fullSeconds += dt;
  const nearFull = game.storage >= game.capacity * 0.9;
  if (nearFull && !game.nearFull) event(game, 'warning', 'Tanque quase cheio. Venda ou amplie a capacidade.');
  if (nearFull) game.nearFull = true;
  else if (game.storage < game.capacity * .75) game.nearFull = false;
  if (!game.warnedEnd && game.time <= 30) {
    game.warnedEnd = true;
    event(game, 'warning', game.storage + inTransit(game) > 0 ? 'Últimos 30 segundos! Entregue o estoque antes do fim.' : 'Últimos 30 segundos da concessão.');
  }
  if (game.time <= 1e-8) { game.time = 0; game.ended = true; event(game, 'end', 'Concessão encerrada. Veja o que ficou no subsolo.'); }
}
export function metrics(game) {
  const profit = game.cash - CONFIG.initialCash;
  const efficiency = game.extracted ? game.sold / game.extracted : 0;
  const recovery = game.extracted / game.total;
  const stars = Number(profit >= PROFILES[game.profile].goal) + Number(efficiency >= 0.85 && game.sold >= 50) + Number(recovery >= 0.4);
  const tip = game.wells.length === 0 ? 'Explore perto da indicação inicial e reserve capital para um poço.' : game.fullSeconds > 10 ? 'Seu tanque ficou cheio. Reforce a frota ou venda mais cedo.' : game.storage + inTransit(game) > 20 ? 'Comece a escoar o estoque mais cedo: a receita só chega na entrega.' : profit < 0 ? 'Reduza gastos iniciais e compare o custo de ramificar com o de um novo poço.' : 'Bom trabalho! Explore mais reservas para aumentar o aproveitamento.';
  return { profit, efficiency, recovery, stars, tip };
}
export function settle(game, progress) {
  if (!game.ended || game.rewarded) return 0;
  const reward = 1 + metrics(game).stars;
  progress.credits += reward; progress.best = Math.max(progress.best, game.cash);
  progress.completed[game.profile] = true;
  progress.unlocked = Math.max(progress.unlocked, Math.min(2, game.profile + 1));
  game.rewarded = true; return reward;
}
export function buyResearch(progress, type) {
  const item = RESEARCH[type];
  if (!item || progress.credits < item.cost || progress.research[type] >= item.max) return false;
  progress.credits -= item.cost; progress.research[type]++; return true;
}
