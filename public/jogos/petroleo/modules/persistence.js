import { CONFIG, RESEARCH } from './config.js';
import { generateTerrain } from './terrain.js';
import { createProgress } from './simulation.js';

export const SAVE_VERSION = 2;
const finite = (value, min = 0, max = 1e8) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value, min, max) => finite(value, min, max) && Number.isInteger(value);
const bool = value => typeof value === 'boolean';
const point = p => p && finite(p.x, 0, CONFIG.world.width) && finite(p.y, 0, CONFIG.world.height);
const near = (a, b) => Math.abs(a - b) < 0.001;
const researchValid = r => r && Object.keys(RESEARCH).every(key => integer(r[key], 0, RESEARCH[key].max));

export function validateProgress(p) {
  return !!p && integer(p.credits, 0, 1e6) && integer(p.unlocked, 0, 2) && finite(p.best) && researchValid(p.research) && Array.isArray(p.completed) && p.completed.length === 3 && p.completed.every(bool);
}

export function validateGame(g) {
  if (!g || !integer(g.seed, 0, 4294967295) || !integer(g.profile, 0, 2) || !Object.hasOwn(CONFIG.durations, g.mode) || g.duration !== CONFIG.durations[g.mode] || !researchValid(g.research)) return false;
  if (!finite(g.time, 0, g.duration) || !['cash', 'expenses', 'revenue', 'storage', 'extracted', 'sold', 'capacity', 'fullSeconds'].every(k => finite(g[k])) || !integer(g.tankLevel, 0, 1000)) return false;
  if (!['paused', 'ended', 'rewarded', 'bit', 'nearFull', 'warnedEnd'].every(k => bool(g[k])) || !integer(g.tutorial, -1, 4) || !['west', 'east', 'hold'].includes(g.target)) return false;
  if ((g.ended !== (g.time === 0)) || (g.rewarded && !g.ended) || g.storage > g.capacity + 0.001 || !near(g.cash, CONFIG.initialCash + g.revenue - g.expenses)) return false;
  if (g.capacity !== CONFIG.tank.initial + g.research.tank * 40 + g.tankLevel * CONFIG.tank.increment || g.fullSeconds > g.duration + 0.001) return false;
  const terrain = generateTerrain(g.seed, g.profile);
  if (!Array.isArray(g.pockets) || g.pockets.length !== terrain.pockets.length || g.total !== terrain.total) return false;
  if (!g.pockets.every((p, index) => p && ['id', 'x', 'y', 'rx', 'ry', 'initial'].every(k => p[k] === terrain.pockets[index][k]) && finite(p.amount, 0, p.initial) && bool(p.revealed))) return false;
  if (JSON.stringify(g.rocks) !== JSON.stringify(terrain.rocks)) return false;
  if (!Array.isArray(g.scans) || g.scans.length > 5000 || !g.scans.every(point)) return false;
  if (!Array.isArray(g.wells) || g.wells.length > g.pockets.length) return false;
  const connected = new Set();
  for (let index = 0; index < g.wells.length; index++) {
    const w = g.wells[index];
    if (!w || w.id !== index || !integer(w.pocketId, 0, g.pockets.length - 1) || !finite(w.progress, 0, 1) || !finite(w.distance, 1, 600) || !point(w.from) || connected.has(w.pocketId)) return false;
    if (w.parentId !== null && (!integer(w.parentId, 0, index - 1) || g.wells[w.parentId].progress < 1)) return false;
    const p = g.pockets[w.pocketId], parent = w.parentId === null ? null : g.pockets[g.wells[w.parentId].pocketId];
    if (!p.revealed || !near(w.from.x, parent ? parent.x : p.x) || !near(w.from.y, parent ? parent.y : CONFIG.world.surface) || !near(w.distance, Math.hypot(p.x - w.from.x, p.y - w.from.y))) return false;
    connected.add(w.pocketId);
  }
  if (!Array.isArray(g.trucks) || !g.trucks.length || g.trucks.length > CONFIG.truck.max) return false;
  for (let index = 0; index < g.trucks.length; index++) {
    const t = g.trucks[index];
    if (!t || t.id !== index || !['idle', 'loading', 'outbound', 'unloading', 'returning'].includes(t.phase) || t.capacity !== CONFIG.truck.capacity + g.research.cargo * 4 || !finite(t.cargo, 0, t.capacity) || !finite(t.timer, 0, 1000)) return false;
    if (t.phase === 'idle' ? t.destination !== null || t.cargo !== 0 : !['west', 'east'].includes(t.destination)) return false;
    if (['unloading', 'returning'].includes(t.phase) && t.cargo !== 0) return false;
  }
  if (!g.prices || !['west', 'east'].every(k => finite(g.prices[k], 0, 20)) || !finite(g.marketClock, 0, 1) || !Array.isArray(g.history) || !g.history.length || g.history.length > 30 || !g.history.every(h => h && ['west', 'east'].every(k => finite(h[k], 0, 20)))) return false;
  const remaining = g.pockets.reduce((sum, p) => sum + p.amount, 0), transit = g.trucks.reduce((sum, t) => sum + t.cargo, 0);
  return near(g.total, remaining + g.extracted) && near(g.extracted, g.sold + g.storage + transit);
}

export function encodeSave(game, progress, settings) {
  return JSON.stringify({ version: SAVE_VERSION, game: game ? { ...game, events: [] } : null, progress, settings: { sound: !!settings.sound, music: settings.music !== false } });
}
export function decodeSave(raw) {
  const fallback = { game: null, progress: createProgress(), settings: { sound: false, music: true }, invalid: false };
  if (!raw) return fallback;
  try {
    if (typeof raw !== 'string' || raw.length > 1e6) return { ...fallback, invalid: true };
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION || !validateProgress(data.progress) || !data.settings || !bool(data.settings.sound)) return { ...fallback, invalid: true };
    if (data.settings.music !== undefined && !bool(data.settings.music)) return { ...fallback, invalid: true };
    data.settings.music ??= true;
    if (data.game !== null && (!validateGame(data.game) || data.game.profile > data.progress.unlocked)) return { ...fallback, progress: data.progress, settings: data.settings, invalid: true };
    if (data.game) { data.game.paused = true; data.game.events = []; }
    return { game: data.game, progress: data.progress, settings: data.settings, invalid: false };
  } catch { return { ...fallback, invalid: true }; }
}
