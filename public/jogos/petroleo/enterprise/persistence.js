import { RULES, TECHNOLOGIES } from './config.js';
import { generateField, blocked } from './exploration.js';
import { seasonPlots } from './campaign.js';
import { storedOil, transitOil } from './logistics.js';

export const KEY = 'ouro-subsolo-enterprise-v3';
export const VERSION = 3;
const finite = (n, min = 0, max = 1e9) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const integer = (n, min, max) => Number.isInteger(n) && finite(n, min, max);
const bool = value => typeof value === 'boolean';
const near = (a, b) => Math.abs(a - b) < .002;
const list = (value, max) => Array.isArray(value) && value.length <= max;
const point = p => p && finite(p.x, 0, RULES.width) && finite(p.y, 0, RULES.height);
const techValid = tech => tech && Object.entries(TECHNOLOGIES).every(([k, v]) => integer(tech[k], 0, v.max));
const ownerValid = owner => owner === null || owner === 'player' || integer(owner, 0, 2);

export function validateCampaign(c) {
  if (!c || !integer(c.seed, 0, 4294967295) || !integer(c.season, 0, RULES.seasons) || c.region !== Math.min(4, Math.floor(c.season / 2)) || !finite(c.cash, -1e7) || !finite(c.debt, 0, 1e7) || !integer(c.shares, 0, 50) || c.shares % 5 || !techValid(c.tech)) return false;
  if (!bool(c.finished) || c.finished !== (c.season === RULES.seasons) || !bool(c.shareAuctionDone) || !bool(c.legacyImported) || !['relaxed', 'enterprise'].includes(c.difficulty) || !(c.leased === null || integer(c.leased, 0, 3))) return false;
  if (!list(c.rivals, 3) || c.rivals.length !== 3 || !c.rivals.every(r => r && typeof r.name === 'string' && r.name.length < 80 && ['careful', 'expansion', 'speculator'].includes(r.style) && finite(r.cash) && finite(r.equipment) && finite(r.lastProfit, -1e7) && integer(r.shares, 0, 50) && r.shares % 5 === 0)) return false;
  if (c.shares + c.rivals.reduce((n, r) => n + r.shares, 0) > (c.season + Number(c.shareAuctionDone)) * 5) return false;
  const plots = seasonPlots(c.seed, c.season);
  if (!list(c.plots, 4) || c.plots.length !== 4 || !c.plots.every((p, i) => p && ['id', 'seed', 'rating'].every(k => p[k] === plots[i][k]) && ownerValid(p.owner) && finite(p.paid) && bool(p.launched) && (!p.launched || p.owner === 'player'))) return false;
  if (c.leased !== null && c.plots[c.leased].owner !== 'player') return false;
  if (c.plots.filter(p => p.owner === 'player').length !== Number(c.leased !== null)) return false;
  if (c.auction !== null) {
    const a = c.auction;
    if (!a || c.leased !== null || !['plot', 'shares'].includes(a.type) || !integer(a.bid, 300, 1e8) || !ownerValid(a.leader) || !integer(a.rounds, 0, 1e6)) return false;
    if (a.type === 'plot' ? !integer(a.plotId, 0, 2) || c.plots[a.plotId].owner !== null : a.plotId !== null || c.shareAuctionDone) return false;
  }
  return list(c.history, RULES.seasons) && c.history.length === c.season && c.history.every((h, i) => h && h.season === i && h.region === Math.floor(i / 2) && integer(h.seed, 0, 4294967295) && finite(h.profit, -1e8) && integer(h.medals, 0, 3) && ['spilled', 'sold', 'bonus'].every(k => finite(h[k])));
}
export function validateOperation(o) {
  if (!o || !integer(o.seed, 0, 4294967295) || !integer(o.region, 0, 4) || !integer(o.season, 0, RULES.seasons - 1) || !techValid(o.tech) || !['relaxed', 'enterprise'].includes(o.difficulty)) return false;
  if (o.duration !== RULES.duration || o.initialCash !== RULES.operationBudget || !finite(o.time, 0, o.duration) || !finite(o.elapsed, 0, o.duration) || !near(o.time + o.elapsed, o.duration) || !['paused', 'ended', 'settled'].every(k => bool(o[k])) || o.ended !== (o.time === 0) || (o.settled && !o.ended)) return false;
  if (!['expenses', 'revenue', 'bonuses', 'fines', 'extracted', 'sold', 'spilled', 'gasUsed'].every(k => finite(o[k])) || !finite(o.cash, -1e8) || !near(o.cash, o.initialCash + o.revenue + o.bonuses - o.expenses - o.fines) || !near(o.fines, o.spilled * RULES.finePerBarrel)) return false;
  const field = generateField(o.seed, o.region);
  if (!list(o.pockets, 20) || o.pockets.length !== field.pockets.length || o.totalOil !== field.totalOil || JSON.stringify(o.obstacles) !== JSON.stringify(field.obstacles)) return false;
  if (!o.pockets.every((p, i) => p && ['id', 'kind', 'x', 'y', 'rx', 'ry', 'initial'].every(k => p[k] === field.pockets[i][k]) && finite(p.amount, 0, p.initial) && bool(p.revealed) && bool(p.collected) && (!p.collected || p.kind === 'relic' && p.revealed))) return false;
  if (!list(o.rigs, 8) || !o.rigs.every((r, i) => r && r.id === i && finite(r.x, 70, 890) && integer(r.level, 0, 3) && r.capacity === RULES.rigCapacity + r.level * 20 && finite(r.storage, 0, r.capacity) && finite(r.fullTime, 0, o.duration + 1))) return false;
  if (!list(o.tanks, 6) || !o.tanks.every((t, i) => t && t.id === i && finite(t.x, 70, 890) && integer(t.level, 0, 3) && t.capacity === RULES.tankCapacity + o.tech.tank * 40 + t.level * 120 && finite(t.storage, 0, t.capacity))) return false;
  if (!list(o.nodes, 108) || !list(o.edges, 100) || o.nodes.length !== o.edges.length + o.rigs.length) return false;
  if (!o.nodes.every((n, i) => point(n) && n.id === i && integer(n.rigId, 0, o.rigs.length - 1) && (n.pocketId === null || integer(n.pocketId, 0, o.pockets.length - 1) && o.pockets[n.pocketId].kind === 'oil' && o.pockets[n.pocketId].revealed && n.x === o.pockets[n.pocketId].x && n.y === o.pockets[n.pocketId].y))) return false;
  if (!o.edges.every((e, i) => e && e.id === i && integer(e.from, 0, o.nodes.length - 1) && integer(e.to, e.from + 1, o.nodes.length - 1) && o.nodes[e.from].rigId === o.nodes[e.to].rigId && finite(e.length, 12, 700) && near(e.length, Math.hypot(o.nodes[e.from].x - o.nodes[e.to].x, o.nodes[e.from].y - o.nodes[e.to].y)) && finite(e.progress, 0, 1) && integer(e.level, 0, 2) && bool(e.open) && !blocked(o, o.nodes[e.from], o.nodes[e.to]))) return false;
  const connected = new Set(), roots = new Set();
  for (const node of o.nodes) {
    const parents = o.edges.filter(e => e.to === node.id);
    if (parents.length > 1) return false;
    if (!parents.length) { if (node.y !== RULES.surface || node.x !== o.rigs[node.rigId].x || roots.has(node.rigId) || node.pocketId !== null) return false; roots.add(node.rigId); }
    if (node.pocketId !== null) { if (connected.has(node.pocketId)) return false; connected.add(node.pocketId); }
  }
  if (roots.size !== o.rigs.length) return false;
  if (!list(o.trucks, RULES.maxTrucks) || !o.trucks.length) return false;
  const sourceValid = r => r && (r.kind === 'rig' ? integer(r.id, 0, o.rigs.length - 1) : r.kind === 'tank' && integer(r.id, 0, o.tanks.length - 1));
  const destinationValid = r => r && (r.kind === 'buyer' ? ['west', 'east'].includes(r.id) : r.kind === 'tank' && integer(r.id, 0, o.tanks.length - 1));
  for (const t of o.trucks) {
    if (!t || t.id !== o.trucks.indexOf(t) || !finite(t.x, 0, 960) || !['west', 'east', 'store', 'idle'].includes(t.task) || !['idle', 'pickup', 'loading', 'delivery', 'unloading', 'returning'].includes(t.phase) || t.capacity !== RULES.truckCapacity + o.tech.cargo * 5 || !finite(t.cargo, 0, t.capacity) || !finite(t.timer, 0, 1000)) return false;
    if (t.phase === 'idle' ? t.source !== null || t.destination !== null || t.cargo !== 0 : !sourceValid(t.source) || !destinationValid(t.destination)) return false;
    if (['returning', 'pickup'].includes(t.phase) && t.cargo !== 0) return false;
  }
  if (!list(o.gasLines, 2) || !o.gasLines.every((l, i) => l && l.id === i && integer(l.pocketId, 0, o.pockets.length - 1) && o.pockets[l.pocketId].kind === 'gas' && o.pockets[l.pocketId].revealed && ['west', 'east'].includes(l.side) && bool(l.open) && finite(l.progress, 0, 1) && finite(l.length, 1, 1200) && near(l.length, Math.hypot(o.pockets[l.pocketId].x - (l.side === 'west' ? 20 : 940), o.pockets[l.pocketId].y - RULES.surface)))) return false;
  if (new Set(o.gasLines.map(l => l.pocketId)).size !== o.gasLines.length) return false;
  if (o.gasLines.length && !o.tech.gas) return false;
  if (!o.prices || !o.gasBoost || !['west', 'east'].every(k => finite(o.prices[k], 3, 17) && finite(o.gasBoost[k], 0, 4)) || !integer(o.marketSecond, 0, 300) || !list(o.history, 30) || !o.history.every(h => h && ['west', 'east'].every(k => finite(h[k], 3, 17)))) return false;
  if (!list(o.surveys, 250) || !o.surveys.every(s => point(s) && finite(s.radius, 24, 130)) || !list(o.explorers, 24) || !o.explorers.every(e => point(e) && ['probe', 'prospector'].includes(e.tool) && finite(e.startY, 120, 580) && finite(e.age, 0, 12) && finite(e.duration, 1, 12) && finite(e.travelled, 0, 12))) return false;
  if (!list(o.markers, 20) || !o.markers.every(m => m && finite(m.x, 0, 960) && integer(m.pocketId, 0, o.pockets.length - 1) && o.pockets[m.pocketId].kind === 'oil')) return false;
  if (!list(o.contracts, 2) || o.contracts.length !== 2 || !o.contracts.every((c, i) => c && c.id === i && c.side === ['west', 'east'][i] && c.volume === 100 + o.region * 20 && c.bonus === 300 + o.region * 70 && c.deadline === 180 && finite(c.delivered, 0, o.sold + .002) && ['offered', 'active', 'completed', 'expired'].includes(c.status) && (c.status !== 'completed' || c.delivered + 1e-8 >= c.volume))) return false;
  if (!near(o.bonuses, o.contracts.filter(c => c.status === 'completed').reduce((n, c) => n + c.bonus, 0))) return false;
  if (!list(o.notices, 6) || !o.notices.every(s => typeof s === 'string' && s.length <= 500)) return false;
  const oil = o.pockets.filter(p => p.kind === 'oil').reduce((n, p) => n + p.amount, 0);
  const gas = o.pockets.filter(p => p.kind === 'gas').reduce((n, p) => n + p.initial - p.amount, 0);
  return near(o.totalOil, oil + o.extracted) && near(o.extracted, o.sold + o.spilled + storedOil(o) + transitOil(o)) && near(gas, o.gasUsed);
}
export function encode(campaign, operation) { return JSON.stringify({ version: VERSION, campaign, operation }); }
export function decode(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 1e6) return null;
    const data = JSON.parse(raw);
    if (data.version !== VERSION || !validateCampaign(data.campaign) || data.operation !== null && !validateOperation(data.operation)) return null;
    const o = data.operation, c = data.campaign;
    if (o && !o.settled && (c.leased === null || !c.plots[c.leased].launched || o.seed !== c.plots[c.leased].seed || o.season !== c.season || o.region !== c.region || JSON.stringify(o.tech) !== JSON.stringify(c.tech) || o.difficulty !== c.difficulty)) return null;
    if (o?.settled && (!c.history.length || c.history.at(-1).seed !== o.seed || c.season !== o.season + 1)) return null;
    if (!o && c.plots.some(p => p.launched)) return null;
    if (o) o.paused = true;
    return data;
  } catch { return null; }
}
