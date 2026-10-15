import { RULES, pay } from './config.js';

export function makeTruck(id, tech) {
  return { id, x: 480, task: 'west', phase: 'idle', cargo: 0, capacity: RULES.truckCapacity + tech.cargo * 5, source: null, destination: null, timer: 0 };
}
export function buyTruck(operation) {
  if (operation.trucks.length >= RULES.maxTrucks || !pay(operation, RULES.truckCost + operation.trucks.length * 50)) return false;
  operation.trucks.push(makeTruck(operation.trucks.length, operation.tech)); return true;
}
export function buildTank(operation, x) {
  if (!Number.isFinite(x) || x < 70 || x > 890 || operation.tanks.length >= 6 || operation.rigs.some(r => Math.abs(r.x - x) < 45) || operation.tanks.some(t => Math.abs(t.x - x) < 45) || !pay(operation, RULES.tankCost)) return false;
  operation.tanks.push({ id: operation.tanks.length, x, storage: 0, capacity: RULES.tankCapacity + operation.tech.tank * 40, level: 0 }); return true;
}
export function upgradeStorage(operation, kind, id) {
  const item = (kind === 'rig' ? operation.rigs : kind === 'tank' ? operation.tanks : [])[id];
  if (!item || item.level >= 3 || !pay(operation, 180 * (item.level + 1))) return false;
  item.level++; item.capacity += kind === 'rig' ? 20 : 120; return true;
}
export function assignTruck(operation, id, task) {
  const truck = operation.trucks[id];
  if (!truck || operation.ended || !['west', 'east', 'store', 'idle'].includes(task)) return false;
  truck.task = task; return true;
}
const ref = (kind, item) => ({ kind, id: item.id });
export function sourceObject(operation, reference) {
  return reference?.kind === 'rig' ? operation.rigs[reference.id] : reference?.kind === 'tank' ? operation.tanks[reference.id] : null;
}
function targetX(operation, destination) {
  if (destination.kind === 'buyer') return destination.id === 'west' ? 20 : 940;
  return operation.tanks[destination.id].x;
}
export function storedOil(operation) { return [...operation.rigs, ...operation.tanks].reduce((n, s) => n + s.storage, 0); }
export function transitOil(operation) { return operation.trucks.reduce((n, t) => n + t.cargo, 0); }
export function stepLogistics(operation, dt, deliver) {
  const speed = RULES.truckSpeed * (1 + operation.tech.speed * .15);
  const move = (truck, destination) => {
    const distance = destination - truck.x;
    truck.x += Math.sign(distance) * Math.min(Math.abs(distance), speed * dt);
    return Math.abs(truck.x - destination) < 1e-7;
  };
  for (const truck of operation.trucks) {
    if (truck.phase === 'idle') {
      if (truck.task === 'idle') continue;
      const sources = [ ...operation.rigs.map(item => ({ item, ref: ref('rig', item) })), ...(truck.task === 'store' ? [] : operation.tanks.map(item => ({ item, ref: ref('tank', item) }))) ];
      const reserved = reference => operation.trucks.filter(t => t !== truck && ['pickup', 'loading'].includes(t.phase) && t.source?.kind === reference.kind && t.source.id === reference.id).reduce((n, t) => n + t.capacity - t.cargo, 0);
      sources.sort((a, b) => (b.item.storage / b.item.capacity) - (a.item.storage / a.item.capacity) || Math.abs(a.item.x - truck.x) - Math.abs(b.item.x - truck.x));
      const source = sources.find(s => s.item.storage - reserved(s.ref) >= .5);
      if (!source) continue;
      let destination;
      if (truck.task === 'store') {
        const tank = operation.tanks.find(t => t.capacity - t.storage - operation.trucks.filter(other => other.destination?.kind === 'tank' && other.destination.id === t.id).reduce((n, other) => n + other.capacity, 0) >= .5);
        if (!tank) continue;
        destination = { kind: 'tank', id: tank.id };
      } else destination = { kind: 'buyer', id: truck.task };
      const travel = (Math.abs(truck.x - source.item.x) + Math.abs(source.item.x - targetX(operation, destination))) / speed;
      if (operation.time <= travel + RULES.step * 3) continue;
      truck.source = source.ref; truck.destination = destination; truck.phase = 'pickup'; truck.timer = 0;
    }
    const source = sourceObject(operation, truck.source);
    if (truck.phase === 'pickup') {
      if (move(truck, source.x)) { truck.phase = 'loading'; truck.timer = 0; }
    } else if (truck.phase === 'loading') {
      const amount = Math.max(0, Math.min(source.storage, truck.capacity - truck.cargo, RULES.loadRate * dt));
      source.storage -= amount; truck.cargo += amount; truck.timer += dt;
      const lastDeparture = operation.time <= Math.abs(truck.x - targetX(operation, truck.destination)) / speed + dt * 2;
      if (truck.cargo > 0 && (truck.cargo >= truck.capacity - 1e-8 || truck.timer >= 2 || lastDeparture)) truck.phase = 'delivery';
      else if (truck.cargo === 0 && truck.timer >= 2) { truck.phase = 'idle'; truck.source = null; truck.destination = null; }
    } else if (truck.phase === 'delivery') {
      if (move(truck, targetX(operation, truck.destination))) { truck.phase = 'unloading'; truck.timer = 0; }
    }
    if (truck.phase === 'unloading') {
      if (truck.destination.kind === 'buyer') {
        deliver(operation, truck.destination.id, truck.cargo); truck.cargo = 0;
      } else {
        const tank = operation.tanks[truck.destination.id], amount = Math.min(truck.cargo, tank.capacity - tank.storage);
        tank.storage += amount; truck.cargo -= amount;
        // A full tank waits without deleting cargo; dispatch to a buyer recovers it.
        if (truck.cargo > 1e-8 && ['west', 'east'].includes(truck.task)) { truck.destination = { kind: 'buyer', id: truck.task }; truck.phase = 'delivery'; }
      }
      if (truck.cargo <= 1e-8) { truck.cargo = 0; truck.phase = 'returning'; }
    } else if (truck.phase === 'returning') {
      if (move(truck, source.x)) { truck.phase = 'idle'; truck.source = null; truck.destination = null; }
    }
  }
}
