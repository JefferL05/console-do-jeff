import { seededRandom, touchesRock } from '../modules/terrain.js';
import { RULES, REGIONS, clamp, pay, notice } from './config.js';

export function generateField(seed, region) {
  const random = seededRandom(seed), profile = REGIONS[region];
  const pockets = [];
  const add = (kind, x, y, amount) => pockets.push({ id: pockets.length, kind, x, y, rx: kind === 'relic' ? 9 : 25 + random() * 12, ry: kind === 'relic' ? 9 : 16 + random() * 8, initial: amount, amount, revealed: false, collected: false });
  // The survey marker is approximate; the starter reserve is always affordable.
  add('oil', 170 + random() * 40, 205 + random() * 15, 300);
  for (let attempts = 0; pockets.filter(p => p.kind === 'oil').length < profile.count && attempts < 2000; attempts++) {
    const x = 55 + random() * 850, y = 195 + random() * 355;
    if (pockets.some(p => Math.hypot(p.x - x, (p.y - y) * 1.4) < 105)) continue;
    add('oil', x, y, Math.round(220 + random() * 210 + region * 25));
  }
  // Advanced resources use rejection sampling too: no overlap with oil or each other.
  for (const kind of [...(profile.gas ? ['gas', 'gas'] : []), 'relic']) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = 55 + random() * 850, y = 280 + random() * 270;
      if (pockets.some(p => Math.hypot(p.x - x, (p.y - y) * 1.4) < 90)) continue;
      add(kind, x, y, kind === 'gas' ? 70 : 1); break;
    }
  }
  const obstacles = [];
  if (profile.rock) obstacles.push({ x: 500, y: 310, rx: 185, ry: 22, kind: 'rock' });
  if (profile.ice) obstacles.push({ x: 340, y: 420, rx: 150, ry: 20, kind: 'ice' });
  return { pockets, obstacles, totalOil: pockets.filter(p => p.kind === 'oil').reduce((n, p) => n + p.initial, 0) };
}
export function blocked(operation, from, to) {
  return operation.obstacles.find(rock => !operation.tech[rock.kind] && touchesRock(from, to, [rock]));
}
function reveal(operation, x, y, radius) {
  let found = 0;
  for (const p of operation.pockets) {
    if (!p.revealed && Math.hypot(p.x - x, p.y - y) <= radius + p.rx * .4) {
      p.revealed = true; found++;
      if (p.kind === 'relic') { p.collected = true; notice(operation, 'Amostra rara encontrada: bônus de campanha no balanço.'); }
    }
  }
  operation.surveys.push({ x, y, radius });
  // Bound save size; discoveries themselves are permanent.
  if (operation.surveys.length > 250) operation.surveys.shift();
  return found;
}
export function scanCost(radius) { return Math.ceil(35 + Math.PI * radius * radius * .004); }
export function explore(operation, tool, x, y, radius = 70) {
  if (operation.ended || !Number.isFinite(x) || !Number.isFinite(y) || x < 20 || x > 940 || y < RULES.surface || y > 580) return { ok: false, message: 'Selecione uma área dentro do subsolo.' };
  if (!['scan', 'prospector', 'probe'].includes(tool)) return { ok: false, message: 'Ferramenta inválida.' };
  radius = clamp(Number.isFinite(radius) ? radius : 70, 35, 130);
  const cost = tool === 'scan' ? scanCost(radius) : tool === 'prospector' ? RULES.prospectorCost : RULES.probeCost;
  if (operation.explorers.length >= 24 && tool !== 'scan') return { ok: false, message: 'Aguarde uma pesquisa terminar.' };
  if (!pay(operation, cost)) return { ok: false, message: 'Capital insuficiente.' };
  if (tool === 'scan') {
    const found = reveal(operation, x, y, radius);
    return { ok: true, message: found ? `${found} descoberta(s). Selecione uma torre e construa a rede.` : 'Área vazia. Compare os indícios e pesquise outra camada.' };
  }
  operation.explorers.push({ tool, x, y: tool === 'prospector' ? RULES.surface : y, startY: y, age: 0, duration: tool === 'prospector' ? 8 / (1 + operation.tech.survey * .3) : 12, travelled: 0 });
  return { ok: true, message: tool === 'prospector' ? 'Prospector contratado: aguarde a pesquisa na superfície.' : 'Sonda lançada. Seu trajeto revelará pequenos trechos.' };
}
export function stepExploration(operation, dt) {
  for (const e of operation.explorers) {
    e.age += dt;
    if (e.tool === 'probe') {
      const y = clamp(e.startY + e.age * (18 + operation.tech.survey * 6), RULES.surface + 20, 580);
      e.y = y;
      if (e.age - e.travelled >= .6) { reveal(operation, e.x + Math.sin(e.age) * 14, y, 24); e.travelled = e.age; }
    } else if (e.age >= e.duration) {
      const candidates = operation.pockets.filter(p => p.kind === 'oil' && !p.revealed && !operation.markers.some(m => m.pocketId === p.id));
      candidates.sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x));
      if (candidates[0]) {
        const p = candidates[0]; operation.markers.push({ x: Math.round(p.x / 30) * 30, pocketId: p.id });
        notice(operation, 'Prospector marcou uma região promissora. O tamanho e a profundidade ainda são desconhecidos.');
      } else notice(operation, 'O prospector não encontrou novos indícios.');
    }
  }
  operation.explorers = operation.explorers.filter(e => e.age < e.duration);
}
