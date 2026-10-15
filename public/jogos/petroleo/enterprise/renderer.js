import { RULES, REGIONS, clamp } from './config.js';
import { pathToRig } from './pipes.js';
import { networkDiagnostics } from './diagnostics.js';

const ellipse = (ctx, x, y, rx, ry, color) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
const line = (ctx, points, color, width = 2) => { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); };
const rect = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
export class EnterpriseRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.zoom = 1; this.pan = { x: 0, y: 0 };
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.background = document.createElement('canvas'); this.background.width = 1920; this.background.height = 1200; this.region = -1;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas); this.resize();
  }
  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, box.width); this.height = Math.max(1, box.height); this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr); this.camera();
  }
  camera() {
    this.scale = Math.min(this.width / RULES.width, this.height / RULES.height) * this.zoom;
    const overflowX = Math.max(0, (RULES.width * this.scale - this.width) / 2), overflowY = Math.max(0, (RULES.height * this.scale - this.height) / 2);
    this.pan.x = clamp(this.pan.x, -overflowX, overflowX); this.pan.y = clamp(this.pan.y, -overflowY, overflowY);
    this.x = (this.width - RULES.width * this.scale) / 2 + this.pan.x; this.y = (this.height - RULES.height * this.scale) / 2 + this.pan.y;
  }
  setZoom(zoom) { this.zoom = clamp(zoom, 1, 3); this.camera(); }
  focusPoint(x, y, zoom = 2) {
    this.setZoom(zoom);
    this.pan.x = (RULES.width / 2 - x) * this.scale;
    this.pan.y = (RULES.height / 2 - y) * this.scale;
    this.camera();
  }
  world(clientX, clientY) { const r = this.canvas.getBoundingClientRect(); return { x: (clientX - r.left - this.x) / this.scale, y: (clientY - r.top - this.y) / this.scale }; }
  backdrop(region) {
    if (region === this.region) return;
    this.region = region; const ctx = this.background.getContext('2d'); ctx.setTransform(2, 0, 0, 2, 0, 0);
    const palettes = [
      ['#779f9f', '#f4d39b', '#99a08a', '#7e9078', '#546d5b'],
      ['#719b9b', '#d4d5a5', '#7e9a83', '#607c68', '#3c6354'],
      ['#8e8e9d', '#ecc297', '#a69b91', '#90776b', '#6b544b'],
      ['#a69b96', '#f3d5a2', '#b3a280', '#ad8c66', '#8c6e4c'],
      ['#5d879c', '#e2eddf', '#aec8cf', '#8faab7', '#6f8b9a'],
    ];
    const colors = palettes[region];
    const sky = ctx.createLinearGradient(0, 0, 0, 125); sky.addColorStop(0, colors[0]); sky.addColorStop(1, colors[1]);
    rect(ctx, 0, 0, 960, 600, '#46372f'); rect(ctx, 0, 0, 960, 125, sky); ellipse(ctx, 760, 38, 24, 24, '#ffecbc');
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath(); ctx.moveTo(0, 125);
      for (let x = 0; x <= 960; x += 20) ctx.lineTo(x, 80 + layer * 12 + Math.sin(x / (100 - layer * 15) + layer) * 15);
      ctx.lineTo(960, 125); ctx.fillStyle = colors[layer + 2]; ctx.fill();
    }
    if (region === 1) for (let x = 75; x < 920; x += 85) {
      rect(ctx, x - 2, 87, 4, 30, '#3c5646');
      ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x - 16, 103); ctx.lineTo(x + 16, 103); ctx.closePath(); ctx.fillStyle = '#456653'; ctx.fill();
    }
    if (region === 2 || region === 4) for (let x = 80; x < 960; x += 190) {
      ctx.beginPath(); ctx.moveTo(x - 70, 118); ctx.lineTo(x, 42); ctx.lineTo(x + 85, 118); ctx.closePath(); ctx.fillStyle = colors[3]; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 16, 60); ctx.lineTo(x, 42); ctx.lineTo(x + 20, 60); ctx.lineTo(x + 5, 56); ctx.closePath(); ctx.fillStyle = region === 4 ? '#e9f0e8' : '#c9bba2'; ctx.fill();
    }
    if (region === 3) for (let x = 120; x < 900; x += 230) {
      rect(ctx, x, 75, 65, 42, '#a07c56'); rect(ctx, x - 4, 72, 73, 7, '#c4a374');
      line(ctx, [{ x: x + 90, y: 115 }, { x: x + 90, y: 93 }, { x: x + 86, y: 97 }], '#637057', 3);
    }
    for (let layer = 0; layer < 7; layer++) {
      ctx.beginPath(); ctx.moveTo(0, 120 + layer * 70);
      for (let x = 0; x <= 960; x += 20) ctx.lineTo(x, 120 + layer * 70 + (layer ? Math.sin(x / 90 + layer) * 8 : 0));
      ctx.lineTo(960, 600); ctx.lineTo(0, 600); ctx.fillStyle = [REGIONS[region].color, '#a17752', '#8f674a', '#7d5841', '#6b4e3b', '#594233', '#46372e'][layer]; ctx.fill();
    }
    for (let i = 0; i < 500; i++) rect(ctx, i * 97.13 % 960, 125 + i * 67.31 % 475, 2, 1, '#f1ca8d22');
    rect(ctx, 0, 113, 960, 7, '#746c54'); rect(ctx, 0, 120, 960, 3, '#eac993');
    for (let x = 0; x < 960; x += 30) rect(ctx, x, 116, 13, 1, '#ddc79c80');
    if (region === 4) rect(ctx, 0, 120, 960, 3, '#e0ece5');
  }
  draw(operation, view) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); rect(ctx, 0, 0, this.width, this.height, '#102923');
    if (!operation) return;
    this.backdrop(operation.region);
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.x * this.dpr, this.y * this.dpr);
    ctx.drawImage(this.background, 0, 0, 960, 600);
    const label = (text, x, y, color = '#ffedbf', size = 12) => {
      ctx.font = `700 ${size}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#163a30'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
    };
    for (const s of operation.surveys) ellipse(ctx, s.x, s.y, s.radius, s.radius, '#ffe5a70a');
    for (const rock of operation.obstacles) {
      ellipse(ctx, rock.x, rock.y, rock.rx, rock.ry, rock.kind === 'ice' ? '#99c7cb' : '#4d554d');
      line(ctx, [{ x: rock.x - rock.rx * .8, y: rock.y }, { x: rock.x - 10, y: rock.y - 7 }, { x: rock.x + rock.rx * .8, y: rock.y + 4 }], rock.kind === 'ice' ? '#e7f7e9' : '#899180', 3);
    }
    for (const p of operation.pockets) if (p.revealed || operation.ended) {
      ellipse(ctx, p.x, p.y, p.rx + 3, p.ry + 3, '#d3ad6f');
      ellipse(ctx, p.x, p.y, p.rx, p.ry, '#59432f');
      if (p.kind === 'relic') { label(p.collected ? '◆' : '◇', p.x, p.y + 6, '#ffe898', 22); continue; }
      if (p.amount > 0) ellipse(ctx, p.x, p.y, p.rx * .95, Math.max(2, p.ry * p.amount / p.initial), p.kind === 'gas' ? '#abd4aa' : '#163f38');
      label(p.kind === 'gas' ? `G${p.id + 1}` : `R${p.id + 1}`, p.x, p.y - p.ry - 7, '#f7e6bd', 11);
    }
    const flowing = new Set();
    if (!this.reduced.matches && !operation.ended) for (const node of operation.nodes) {
      if (node.pocketId === null || operation.pockets[node.pocketId].amount <= 0 || operation.rigs[node.rigId].storage >= operation.rigs[node.rigId].capacity) continue;
      const path = pathToRig(operation, node.id);
      if (path?.every(e => e.open && e.progress >= 1)) for (const edge of path) flowing.add(edge.id);
    }
    const bottlenecks = new Set(networkDiagnostics(operation).limited);
    for (const edge of operation.edges) {
      const from = operation.nodes[edge.from], to = operation.nodes[edge.to], end = { x: from.x + (to.x - from.x) * edge.progress, y: from.y + (to.y - from.y) * edge.progress };
      line(ctx, [from, end], bottlenecks.has(edge.id) ? '#d87e45' : '#293a31', 6 + edge.level * 3); line(ctx, [from, end], edge.open ? '#d9c79e' : '#8d8070', 2 + edge.level * 2);
      if (bottlenecks.has(edge.id)) label('!', (from.x + end.x) / 2 + 10, (from.y + end.y) / 2, '#ffd09e', 16);
      if (flowing.has(edge.id)) {
        const phase = (operation.elapsed * .55 + edge.id * .17) % 1;
        ellipse(ctx, end.x + (from.x - end.x) * phase, end.y + (from.y - end.y) * phase, 2.5, 2.5, '#ffe6a4');
      }
      if (edge.progress < 1) { ellipse(ctx, end.x, end.y, 5, 5, '#f3c66f'); label(`${Math.floor(edge.progress * 100)}%`, end.x, end.y - 10); }
      if (!edge.open) label('×', (from.x + to.x) / 2, (from.y + to.y) / 2 + 3, '#ffb58a', 18);
    }
    for (const lineGas of operation.gasLines) {
      const p = operation.pockets[lineGas.pocketId], end = { x: lineGas.side === 'west' ? 20 : 940, y: RULES.surface };
      ctx.setLineDash([8, 6]); line(ctx, [p, { x: p.x + (end.x - p.x) * lineGas.progress, y: p.y + (end.y - p.y) * lineGas.progress }], lineGas.open ? '#c7f0a8' : '#799b80', 3); ctx.setLineDash([]);
    }
    for (const node of operation.nodes) {
      ellipse(ctx, node.x, node.y, node.id === view.source ? 8 : 4, node.id === view.source ? 8 : 4, node.id === view.source ? '#fff0b4' : '#354c3e');
    }
    for (const marker of operation.markers) if (!operation.pockets[marker.pocketId].revealed) {
      line(ctx, [{ x: marker.x, y: 120 }, { x: marker.x, y: 96 }], '#3e503c', 2); rect(ctx, marker.x, 96, 18, 10, '#efc870'); label('?', marker.x + 9, 105, '#203d31', 10);
    }
    for (const rig of operation.rigs) {
      const x = rig.x, active = operation.nodes.some(n => n.rigId === rig.id && n.pocketId !== null && operation.pockets[n.pocketId].amount > 0);
      const motion = this.reduced.matches || !active ? 0 : Math.sin(operation.elapsed * 4 + x) * 4;
      line(ctx, [{ x: x - 15, y: 118 }, { x: x - 5, y: 54 }, { x: x + 5, y: 54 }, { x: x + 15, y: 118 }], '#294438', 4);
      for (let y = 65; y < 110; y += 13) line(ctx, [{ x: x - 10, y: y + 12 }, { x: x + 9, y }, { x: x - 9, y }], '#c6af77', 2);
      line(ctx, [{ x, y: 55 }, { x, y: 103 + motion }], '#e7d3a0', 2); rect(ctx, x - 8, 51, 16, 5, '#e1b565');
      rect(ctx, x + 17, 95, 10, 22, '#254536'); rect(ctx, x + 18, 116 - 20 * rig.storage / rig.capacity, 8, 20 * rig.storage / rig.capacity, rig.fullTime > 0 ? '#ef956b' : '#e9c579');
      label(`T${rig.id + 1}`, x, 44, '#ffedbf', 12);
    }
    for (const tank of operation.tanks) {
      rect(ctx, tank.x - 19, 84, 38, 32, '#829885'); ellipse(ctx, tank.x, 84, 19, 5, '#c8cdb0');
      rect(ctx, tank.x - 3, 90, 6, 23, '#284536'); rect(ctx, tank.x - 2, 112 - 20 * tank.storage / tank.capacity, 4, 20 * tank.storage / tank.capacity, '#f2c979'); label(`A${tank.id + 1}`, tank.x, 72);
    }
    for (const side of ['west', 'east']) {
      const x = side === 'west' ? 20 : 940;
      rect(ctx, x - 19, 85, 38, 32, side === 'west' ? '#a9674d' : '#4f7665'); rect(ctx, x - 22, 79, 44, 6, '#2d4d3d');
      rect(ctx, x - 12, 91, 7, 9, '#edd7a1'); rect(ctx, x + 5, 91, 7, 9, '#edd7a1'); label(operation.prices[side].toFixed(2), x + (side === 'west' ? 15 : -15), 65);
    }
    for (const truck of operation.trucks) {
      const x = truck.x, y = 115 - (truck.id % 2) * 2;
      ellipse(ctx, x, y + 3, 14, 2, '#263c3540'); rect(ctx, x - 13, y - 11, 18, 9, truck.cargo ? '#e3b563' : '#a5b39b'); ellipse(ctx, x - 4, y - 11, 9, 3, truck.cargo ? '#f3d28c' : '#c7cead');
      rect(ctx, x + 5, y - 14, 9, 12, '#284d3b'); rect(ctx, x + 7, y - 12, 5, 5, '#d1e1bd');
      for (const wx of [-8, 10]) { ellipse(ctx, x + wx, y, 3, 3, '#213b30'); ellipse(ctx, x + wx, y, 1, 1, '#b7bb95'); }
    }
    for (const e of operation.explorers) {
      if (e.tool === 'prospector') { ellipse(ctx, e.x, 98, 4, 5, '#e3bd81'); rect(ctx, e.x - 4, 103, 8, 13, '#365441'); label('⌕', e.x, 88); }
      else { ellipse(ctx, e.x + Math.sin(e.age) * 14, e.y, 7, 5, '#edd38b'); }
    }
    if (view.preview) {
      const p = view.preview;
      ctx.setLineDash([6 / this.scale, 4 / this.scale]);
      if (p.tool === 'scan') { ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.strokeStyle = '#fff0be'; ctx.lineWidth = 2 / this.scale; ctx.stroke(); }
      else if (p.tool === 'pipe' && operation.nodes[p.source]) {
        const points = [operation.nodes[p.source], ...(p.route ? view.route : [p])];
        line(ctx, points, p.ok ? '#fff0be' : '#ffa88a', 2 / this.scale);
        for (const [i, point] of points.entries()) if (i) { ellipse(ctx, point.x, point.y, 4 / this.scale, 4 / this.scale, '#ffe2a0'); label(String(i), point.x + 9 / this.scale, point.y - 8 / this.scale); }
      }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.strokeStyle = '#fff0be'; ctx.stroke(); }
      ctx.setLineDash([]);
    }
    if (view.cursor) { const p = view.cursor; line(ctx, [{ x: p.x - 8, y: p.y }, { x: p.x + 8, y: p.y }], '#fff5c8', 2 / this.scale); line(ctx, [{ x: p.x, y: p.y - 8 }, { x: p.x, y: p.y + 8 }], '#fff5c8', 2 / this.scale); }
  }
}
