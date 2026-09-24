import { CONFIG, PROFILES } from './config.js';

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = value;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function generateTerrain(seed, profile = 0) {
  const random = seededRandom(seed);
  const pockets = [];
  const add = (x, y, rx, ry, amount) => pockets.push({
    id: pockets.length, x, y, rx, ry, initial: amount, amount, revealed: false,
  });
  // Every concession has an affordable entry point. Tutorial highlights this deposit.
  add(82 + random() * 28, 126 + random() * 6, 23, 13, 180);
  for (let attempts = 0; pockets.length < PROFILES[profile].count && attempts < 1000; attempts++) {
    const x = 33 + random() * 294;
    const y = (profile === 2 ? 208 : 132) + random() * (profile === 2 ? 113 : 187);
    const rx = 17 + random() * (profile === 1 ? 8 : 14);
    const ry = 10 + random() * 7;
    if (pockets.some(p => Math.hypot((p.x - x) / 1.3, p.y - y) < 45)) continue;
    add(x, y, rx, ry, Math.round((profile === 1 ? 115 : 180) + random() * 100));
  }
  const rocks = profile === 2 ? [{ x: 180, y: 185, rx: 140, ry: 12 }] : [];
  return { pockets, rocks, total: pockets.reduce((sum, p) => sum + p.initial, 0) };
}

export function touchesRock(from, to, rocks) {
  // Closest point on a segment after mapping an ellipse to a unit circle.
  return rocks.some(rock => {
    const ax = (from.x - rock.x) / rock.rx, ay = (from.y - rock.y) / rock.ry;
    const dx = (to.x - from.x) / rock.rx, dy = (to.y - from.y) / rock.ry;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
    return (ax + t * dx) ** 2 + (ay + t * dy) ** 2 <= 1;
  });
}

export function validateTerrain(terrain) {
  const { width, height, surface } = CONFIG.world;
  return terrain.pockets.length >= 6 && terrain.pockets.every(p =>
    p.x - p.rx > 0 && p.x + p.rx < width && p.y - p.ry > surface && p.y + p.ry < height && p.initial > 0,
  ) && CONFIG.scan.cost + CONFIG.drill.base + (terrain.pockets[0].y - surface) * CONFIG.drill.perUnit < CONFIG.initialCash;
}
