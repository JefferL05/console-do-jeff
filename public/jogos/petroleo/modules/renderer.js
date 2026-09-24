import { CONFIG, PROFILES, clamp } from './config.js';
import { scanRadius } from './simulation.js';

export function createCamera(width, height) {
  const scale = Math.min(width / CONFIG.world.width, height / CONFIG.world.height);
  return { width, height, scale, x: (width - CONFIG.world.width * scale) / 2, y: (height - CONFIG.world.height * scale) / 2 };
}
export function toWorld(camera, x, y) { return { x: (x - camera.x) / camera.scale, y: (y - camera.y) / camera.scale }; }
export function toScreen(camera, x, y) { return { x: x * camera.scale + camera.x, y: y * camera.scale + camera.y }; }

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.camera = createCamera(360, 350);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.background = document.createElement('canvas'); this.backgroundKey = '';
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.resize();
  }
  resize() {
    if (this.suspended) return;
    const box = this.canvas.getBoundingClientRect();
    const dpr = Math.min(CONFIG.maxDpr, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(box.width * dpr));
    this.canvas.height = Math.max(1, Math.round(box.height * dpr));
    this.camera = createCamera(Math.max(1, box.width), Math.max(1, box.height)); this.backgroundKey = '';
  }
  worldPoint(clientX, clientY) {
    const box = this.canvas.getBoundingClientRect();
    return toWorld(this.camera, clientX - box.left, clientY - box.top);
  }
  pick(game, point, connectedOnly = false) {
    const candidates = game.pockets.filter(p => p.revealed && (!connectedOnly || game.wells.some(w => w.pocketId === p.id && w.progress >= 1)));
    // Minimum 48 CSS-pixel diameter, regardless of camera zoom.
    return candidates.map(p => ({ p, distance: Math.hypot(point.x - p.x, point.y - p.y) }))
      .filter(({ p, distance }) => distance <= Math.max(p.rx, 24 / this.camera.scale))
      .sort((a, b) => a.distance - b.distance)[0]?.p || null;
  }
  rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  ellipse(ctx, x, y, rx, ry, color) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
  line(ctx, points, color, width = 2) { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  staticBackground(game) {
    const key = `${this.canvas.width}:${this.canvas.height}:${game.profile}`;
    if (key === this.backgroundKey) return;
    this.backgroundKey = key; this.background.width = this.canvas.width; this.background.height = this.canvas.height;
    const ctx = this.background.getContext('2d'), { width, height, scale, x, y } = this.camera;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.rect(ctx, 0, 0, width, height, '#694936');
    const ground = y + CONFIG.world.surface * scale;
    const sky = ctx.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, '#afcdbb'); sky.addColorStop(1, '#e6d7a8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, ground);
    this.ellipse(ctx, width * .78, Math.max(30, ground * .3), 17, 17, '#fae6ae');
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath(); ctx.moveTo(0, ground);
      for (let px = 0; px <= width + 15; px += 15) ctx.lineTo(px, ground - 14 - layer * 10 + Math.sin(px / 45 + layer) * 8);
      ctx.lineTo(width, ground); ctx.fillStyle = layer ? '#80967a' : '#9cae8e'; ctx.fill();
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    for (let layer = 0; layer < 6; layer++) {
      ctx.beginPath(); ctx.moveTo(-width / scale, 76 + layer * 48);
      for (let px = -width / scale; px < width / scale + 360; px += 10) ctx.lineTo(px, 76 + layer * 48 + (layer ? Math.sin(px / 45 + layer) * 6 : 0));
      ctx.lineTo(width / scale + 360, height / scale + 350); ctx.lineTo(-width / scale, height / scale + 350);
      ctx.fillStyle = [PROFILES[game.profile].color, '#a16d48', '#916040', '#805138', '#704834', '#624131'][layer]; ctx.fill();
    }
    for (let i = 0; i < 200; i++) this.rect(ctx, (i * 127.13) % 360, 82 + (i * 61.77) % 265, 1.5, 1, '#e7b98135');
    this.rect(ctx, -width / scale, 74, width / scale * 3 + 360, 3, '#ddc18b');
    for (const [bx, color] of [[20, '#aa6045'], [340, '#4b7567']]) {
      this.rect(ctx, bx - 15, 53, 30, 20, color); this.rect(ctx, bx - 18, 49, 36, 5, '#394a3c');
      this.rect(ctx, bx - 10, 58, 6, 7, '#e0d5ae'); this.rect(ctx, bx + 5, 58, 6, 7, '#e0d5ae');
    }
    this.rect(ctx, 160, 54, 40, 20, '#536b5a'); this.ellipse(ctx, 180, 54, 20, 4, '#c0c5a0');
    ctx.restore();
  }
  draw(game, view) {
    this.staticBackground(game);
    const ctx = this.ctx, { scale, x, y } = this.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.background, 0, 0);
    ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * x, this.dpr * y);
    for (const scan of game.scans) this.ellipse(ctx, scan.x, scan.y, scanRadius(game), scanRadius(game), '#ffe2a00c');
    for (const rock of game.rocks) {
      this.ellipse(ctx, rock.x, rock.y, rock.rx, rock.ry, '#434b45');
      this.line(ctx, [[rock.x - rock.rx * .8, rock.y], [rock.x - 20, rock.y - 4], [rock.x + 20, rock.y + 4], [rock.x + rock.rx * .8, rock.y - 2]], '#788074', 2);
    }
    for (const p of game.pockets) if (p.revealed || game.ended) {
      this.ellipse(ctx, p.x, p.y, p.rx + 3, p.ry + 3, game.ended && !p.revealed ? '#d3ab7455' : '#dcb27199');
      this.ellipse(ctx, p.x, p.y, p.rx, p.ry, '#574433');
      if (p.amount > 0) {
        this.ellipse(ctx, p.x, p.y, p.rx * .96, Math.max(2, p.ry * p.amount / p.initial), '#152c2b');
        this.line(ctx, [[p.x - p.rx * .5, p.y - 3], [p.x + p.rx * .3, p.y - 5]], '#7e9581', 1.5);
      }
      if (view.selectedPocket === p.id || view.preview?.pocketId === p.id) {
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx + 7, p.ry + 7, 0, 0, Math.PI * 2); ctx.strokeStyle = '#ffe9a9'; ctx.lineWidth = 2 / scale; ctx.stroke();
      }
    }
    for (const well of game.wells) {
      const pocket = game.pockets[well.pocketId];
      const end = { x: well.from.x + (pocket.x - well.from.x) * well.progress, y: well.from.y + (pocket.y - well.from.y) * well.progress };
      this.line(ctx, [[well.from.x, well.from.y], [end.x, end.y]], '#293b33', 5);
      this.line(ctx, [[well.from.x - .5, well.from.y], [end.x - .5, end.y]], '#c6c2a0', 1.5);
      this.ellipse(ctx, end.x, end.y, 3, 3, '#f3cd79');
      if (well.progress < 1) {
        // Keep the progress indicator readable independently of world scale.
        const barWidth = 30 / scale;
        this.rect(ctx, end.x - barWidth / 2, end.y + 8 / scale, barWidth, 4 / scale, '#1d3830');
        this.rect(ctx, end.x - barWidth / 2, end.y + 8 / scale, barWidth * well.progress, 4 / scale, '#f3cd79');
      }
      if (well.parentId === null) {
        const tx = well.from.x;
        this.line(ctx, [[tx - 8, 74], [tx - 3, 38], [tx + 3, 38], [tx + 8, 74]], '#354539', 2.5);
        this.line(ctx, [[tx - 6, 64], [tx + 5, 52], [tx - 4, 52], [tx + 7, 66]], '#354539', 2);
        this.rect(ctx, tx - 6, 35, 12, 4, '#48563e');
      }
      if (!this.reduced.matches && !game.paused && !game.ended && well.progress >= 1 && pocket.amount > 0 && game.storage < game.capacity) {
        const t = ((game.duration - game.time) * .3) % 1;
        this.ellipse(ctx, pocket.x + (well.from.x - pocket.x) * t, pocket.y + (well.from.y - pocket.y) * t, 1.7, 2.3, '#efc572');
      }
    }
    this.rect(ctx, 163, 72 - 14 * game.storage / game.capacity, 34, 14 * game.storage / game.capacity, '#e1b569');
    for (const truck of game.trucks) {
      const destination = truck.destination === 'west' ? 24 : 336;
      const progress = truck.phase === 'outbound' ? clamp(truck.timer / CONFIG.truck.travelTime, 0, 1) : truck.phase === 'returning' ? 1 - clamp(truck.timer / CONFIG.truck.travelTime, 0, 1) : truck.phase === 'unloading' ? 1 : 0;
      // Spread the parked fleet along the road, never vertically above it.
      const parkingSlot = truck.id === 0 ? 0 : Math.ceil(truck.id / 2) * (truck.id % 2 ? -1 : 1);
      const parkingX = 180 + parkingSlot * 20;
      const tx = parkingX + (destination - parkingX) * progress;
      const wheelRadius = 2.3, roadY = CONFIG.world.surface - 2, ty = roadY - wheelRadius;
      const facing = (destination < parkingX ? -1 : 1) * (truck.phase === 'returning' ? -1 : 1);
      this.ellipse(ctx, tx, roadY, 9, .7, '#3b352d45');
      ctx.save(); ctx.translate(tx, ty); ctx.scale(facing, 1);
      this.rect(ctx, -7, -6, 11, 5, truck.cargo > 0 ? '#efc268' : '#a7b39b'); this.rect(ctx, 4, -8, 5, 7, '#304e43');
      this.rect(ctx, 5, -7, 3, 3, '#c9dfc2');
      for (const wheelX of [-4, 6]) {
        this.ellipse(ctx, wheelX, 0, wheelRadius, wheelRadius, '#23362f');
        this.ellipse(ctx, wheelX, 0, .8, .8, '#b9b69b');
      }
      ctx.restore();
    }
    const preview = view.preview;
    if (preview) {
      ctx.setLineDash([4 / scale, 4 / scale]); ctx.strokeStyle = preview.valid ? '#fff0bc' : '#ffb89d'; ctx.lineWidth = 2 / scale;
      if (preview.type === 'scan') { ctx.beginPath(); ctx.arc(preview.x, preview.y, scanRadius(game), 0, Math.PI * 2); ctx.stroke(); }
      else if (preview.from) this.line(ctx, [[preview.from.x, preview.from.y], [preview.x, preview.y]], preview.valid ? '#fff0bc' : '#ffb89d', 2 / scale);
      ctx.setLineDash([]);
    }
    if (game.tutorial === 0 && !preview && !game.ended) {
      const p = game.pockets[0], pulse = this.reduced.matches ? 0 : Math.sin((game.duration - game.time) * 3) * 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 25 + pulse, 0, Math.PI * 2); ctx.strokeStyle = '#ffe4a1'; ctx.lineWidth = 2 / scale; ctx.stroke();
      this.line(ctx, [[p.x - 6, p.y], [p.x + 6, p.y]], '#ffe4a1', 2 / scale); this.line(ctx, [[p.x, p.y - 6], [p.x, p.y + 6]], '#ffe4a1', 2 / scale);
    }
    if (view.keyboardCursor) {
      const p = view.keyboardCursor; this.line(ctx, [[p.x - 7, p.y], [p.x + 7, p.y]], '#fff1c3', 2 / scale); this.line(ctx, [[p.x, p.y - 7], [p.x, p.y + 7]], '#fff1c3', 2 / scale);
    }
    for (const effect of view.effects || []) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - effect.age / 1.5);
      if (effect.kind === 'scan') {
        ctx.beginPath(); ctx.arc(effect.x, effect.y, scanRadius(game) * (this.reduced.matches ? 1 : Math.min(1, effect.age * 2)), 0, Math.PI * 2); ctx.strokeStyle = '#ffe7a0'; ctx.lineWidth = 2 / scale; ctx.stroke();
      } else {
        ctx.font = `750 ${13 / scale}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#233f30';
        ctx.fillText(`+$${Math.floor(effect.income)}`, clamp(effect.x, 30 / scale, 360 - 30 / scale), effect.y - (this.reduced.matches ? 0 : effect.age * 8));
      }
      ctx.restore();
    }
  }
}
