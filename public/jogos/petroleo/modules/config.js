import { number } from './i18n.js';

export const CONFIG = Object.freeze({
  world: { width: 360, height: 350, surface: 76 },
  step: 1 / 30, maxDpr: 2, uiInterval: 0.15, saveInterval: 5,
  initialCash: 1500, durations: { quick: 180, classic: 300 },
  scan: { cost: 80, radius: 54 },
  drill: { base: 200, perUnit: 1.8, speed: 32, rate: 2.8, branchBase: 90 },
  tank: { initial: 120, increment: 120, cost: 250, step: 150 },
  truck: { capacity: 16, loadRate: 10, travelTime: 5, unloadTime: 0.8, cost: 300, step: 180, max: 8 },
  bitCost: 220,
});

export const PROFILES = [
  { name: 'Vale Dourado', subtitle: 'Aprenda a encontrar sua fortuna', color: '#bc8653', count: 7, goal: 500, novelty: 'Petróleo raso e extração acessível.' },
  { name: 'Bacia do Cedro', subtitle: 'Conecte novas oportunidades', color: '#a46d4c', count: 9, goal: 1000, novelty: 'Reservas menores e dispersas. Ramifique os tubos para economizar.' },
  { name: 'Serra de Cobre', subtitle: 'Vá além da primeira camada', color: '#916954', count: 8, goal: 1500, novelty: 'Petróleo profundo e uma camada rochosa. Compre a broca reforçada para atravessá-la.' },
];

export const RESEARCH = {
  tank: { name: 'Tanque inicial +40 b', cost: 2, max: 3 },
  cargo: { name: 'Carga por veículo +4 b', cost: 2, max: 3 },
  scan: { name: 'Raio da sondagem +5', cost: 2, max: 3 },
};

export const money = value => '$ ' + number(Math.floor(value));
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
