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
    const dpr = Math.min(this.quality?.dpr || CONFIG.maxDpr, window.devicePixelRatio || 1);
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
  polygon(ctx, points, color) { ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  staticBackground(game) {
    const key = `${this.canvas.width}:${this.canvas.height}:${game.profile}`;
    if (key === this.backgroundKey) return;
    this.backgroundKey = key; this.background.width = this.canvas.width; this.background.height = this.canvas.height;
    const ctx = this.background.getContext('2d'), { width, height, scale, x, y } = this.camera;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.rect(ctx, 0, 0, width, height, '#694936');
    const ground = y + CONFIG.world.surface * scale;
    const sky = ctx.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, '#789e9d'); sky.addColorStop(.55, '#e6c494'); sky.addColorStop(1, '#f5dbab');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, ground);
    const sunY = Math.max(24, ground * .3);
    const halo = ctx.createRadialGradient(width * .78, sunY, 5, width * .78, sunY, 65);
    halo.addColorStop(0, '#fff0bf90'); halo.addColorStop(1, '#fff0bf00');
    this.ellipse(ctx, width * .78, sunY, 65, 65, halo);
    this.ellipse(ctx, width * .78, sunY, 16, 16, '#fff0c5');
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath(); ctx.moveTo(0, ground);
      for (let px = 0; px <= width + 15; px += 15) ctx.lineTo(px, ground - 40 + layer * 13 + Math.sin(px / (60 - layer * 12) + layer) * (12 - layer * 2));
      ctx.lineTo(width, ground); ctx.fillStyle = ['#9ca598', '#758d7b', '#526e60'][layer]; ctx.fill();
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    for (let layer = 0; layer < 6; layer++) {
      ctx.beginPath(); ctx.moveTo(-width / scale, 76 + layer * 48);
      for (let px = -width / scale; px < width / scale + 360; px += 10) ctx.lineTo(px, 76 + layer * 48 + (layer ? Math.sin(px / 45 + layer) * 6 : 0));
      ctx.lineTo(width / scale + 360, height / scale + 350); ctx.lineTo(-width / scale, height / scale + 350);
      ctx.fillStyle = [PROFILES[game.profile].color, '#a97650', '#926344', '#79523d', '#614333', '#49372d'][layer]; ctx.fill();
    }
    for (let i = 0; i < 200; i++) this.rect(ctx, (i * 127.13) % 360, 82 + (i * 61.77) % 265, 1.5, 1, '#e7b98135');
    for (let i = 0; i < 24; i++) {
      const px = (i * 97.3) % 360, py = 92 + (i * 47.7) % 245;
      this.line(ctx, [[px, py], [px + 8, py - 1], [px + 14, py + 1]], '#f2c99518', .8);
    }
    for (let i = 1; i < 6; i++) {
      this.line(ctx, [[4, 76 + i * 45], [10, 76 + i * 45]], '#f9dfac65', 1);
    }
    this.rect(ctx, -width / scale, 70, width / scale * 3 + 360, 5, '#6b6855');
    for (let px = 0; px < 360; px += 18) this.rect(ctx, px, 72, 8, .7, '#ead2a16b');
    this.rect(ctx, -width / scale, 74, width / scale * 3 + 360, 3, '#ddc18b');
    for (const px of [58, 83, 278, 307]) {
      this.line(ctx, [[px, 69], [px, 59]], '#4e6251', 2);
      this.ellipse(ctx, px, 58, 6, 8, '#61795b');
      this.ellipse(ctx, px - 3, 59, 4, 5, '#738660');
    }
    for (const [bx, color] of [[20, '#aa6045'], [340, '#4b7567']]) {
      this.ellipse(ctx, bx + 3, 73, 21, 2, '#263e3640');
      this.rect(ctx, bx - 15, 53, 30, 20, color); this.rect(ctx, bx - 18, 49, 36, 5, '#394a3c');
      this.polygon(ctx, [[bx + 15, 53], [bx + 20, 49], [bx + 20, 70], [bx + 15, 73]], '#304b43');
      this.rect(ctx, bx - 12, 41, 3, 8, '#455b50');
      this.rect(ctx, bx - 18, 49, 36, 1, '#dfc08d');
      this.rect(ctx, bx - 10, 58, 6, 7, '#e0d5ae'); this.rect(ctx, bx + 5, 58, 6, 7, '#e0d5ae');
      this.rect(ctx, bx - 2, 62, 5, 11, '#293d35');
      this.line(ctx, [[bx - 7, 58], [bx - 7, 65]], color, 1);
    }
    this.ellipse(ctx, 182, 73, 25, 3, '#273d3640');
    const metal = ctx.createLinearGradient(160, 0, 200, 0);
    metal.addColorStop(0, '#536c61'); metal.addColorStop(.4, '#acb7a0'); metal.addColorStop(1, '#435e54');
    this.rect(ctx, 160, 54, 40, 18, metal); this.ellipse(ctx, 180, 72, 20, 3, '#445e52');
    this.ellipse(ctx, 180, 54, 20, 4, '#d3d3b5');
    this.ellipse(ctx, 180, 54, 16, 2.3, '#a1af96');
    this.rect(ctx, 178, 48, 4, 5, '#455e53');
    for (const py of [59, 67]) this.line(ctx, [[161, py], [199, py]], '#dbe0c56b', 1);
    this.line(ctx, [[203, 72], [203, 52], [199, 52]], '#d8c998', 1);
    for (let py = 55; py < 72; py += 4) this.line(ctx, [[200, py], [203, py]], '#d8c998', 1);
    ctx.restore();
  }
  draw(game, view) {
    this.staticBackground(game);
    const ctx = this.ctx, { scale, x, y } = this.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.background, 0, 0);
    ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * x, this.dpr * y);
    for (const scan of game.scans) this.ellipse(ctx, scan.x, scan.y, scanRadius(game), scanRadius(game), '#ffe2a00c');
    for (const rock of game.rocks) {
      this.ellipse(ctx, rock.x + 2, rock.y + 3, rock.rx + 1, rock.ry, '#302d2960');
      this.ellipse(ctx, rock.x, rock.y, rock.rx, rock.ry, '#505650');
      this.polygon(ctx, [[rock.x - rock.rx * .8, rock.y], [rock.x - rock.rx * .3, rock.y - rock.ry * .8], [rock.x + rock.rx * .6, rock.y - rock.ry * .5], [rock.x, rock.y + 2]], '#687066');
      this.line(ctx, [[rock.x - rock.rx * .8, rock.y], [rock.x - 20, rock.y - 4], [rock.x + 20, rock.y + 4], [rock.x + rock.rx * .8, rock.y - 2]], '#788074', 2);
    }
    for (const p of game.pockets) if (p.revealed || game.ended) {
      this.ellipse(ctx, p.x, p.y, p.rx + 3, p.ry + 3, game.ended && !p.revealed ? '#d3ab7455' : '#dcb27199');
      this.ellipse(ctx, p.x, p.y, p.rx, p.ry, '#574433');
      if (p.amount > 0) {
        const oil = ctx.createLinearGradient(0, p.y - p.ry, 0, p.y + p.ry);
        oil.addColorStop(0, '#35605a'); oil.addColorStop(.5, '#162f2e'); oil.addColorStop(1, '#0b201f');
        this.ellipse(ctx, p.x, p.y, p.rx * .96, Math.max(2, p.ry * p.amount / p.initial), oil);
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
        const active = well.progress < 1 || (pocket.amount > 0 && game.storage < game.capacity);
        const motion = this.reduced.matches || !active ? 0 : Math.sin((game.duration - game.time) * 4 + tx);
        this.ellipse(ctx, tx + 3, 74, 13, 2, '#213a3545');
        this.rect(ctx, tx - 10, 71, 20, 3, '#303f37');
        this.polygon(ctx, [[tx - 8, 71], [tx - 3, 35], [tx + 3, 35], [tx + 8, 71]], '#344d4340');
        this.line(ctx, [[tx - 8, 72], [tx - 3, 35], [tx + 3, 35], [tx + 8, 72]], '#263e36', 2.5);
        for (let py = 43; py < 70; py += 9) {
          const span = 3 + (py - 35) / 7;
          this.line(ctx, [[tx - span, py + 8], [tx + span - 1, py], [tx - span + 1, py]], '#bdac79', 1.2);
        }
        this.line(ctx, [[tx, 38], [tx, 66 + motion * 3]], '#e7d3a0', 1);
        this.rect(ctx, tx - 2, 59 + motion * 3, 4, 7, '#d6a54f');
        this.rect(ctx, tx - 6, 33, 12, 4, '#d5aa5b');
        this.rect(ctx, tx + 6, 65, 6, 6, '#536d5b');
        this.ellipse(ctx, tx + 9, 68, 2, 2, '#deb966');
        this.line(ctx, [[tx + 9, 68], [tx + 9 + motion * 1.5, 66.5]], '#34473c', 1);
      }
      if (!this.reduced.matches && !game.paused && !game.ended && well.progress >= 1 && pocket.amount > 0 && game.storage < game.capacity) {
        const t = ((game.duration - game.time) * .3) % 1;
        this.ellipse(ctx, pocket.x + (well.from.x - pocket.x) * t, pocket.y + (well.from.y - pocket.y) * t, 1.7, 2.3, '#efc572');
      }
    }
    this.rect(ctx, 176, 58, 8, 13, '#203b34');
    this.rect(ctx, 177, 70 - 11 * game.storage / game.capacity, 6, 11 * game.storage / game.capacity, '#edc16b');
    for (const py of [60, 64, 68]) this.rect(ctx, 183, py, 3, .7, '#f3dfac');
    for (const truck of game.trucks) {
      const destination = truck.destination === 'west' ? 24 : 336;
      const progress = truck.phase === 'outbound' ? clamp(truck.timer / CONFIG.truck.travelTime, 0, 1) : truck.phase === 'returning' ? 1 - clamp(truck.timer / CONFIG.truck.travelTime, 0, 1) : truck.phase === 'unloading' ? 1 : 0;
      // Spread the parked fleet along the road, never vertically above it.
      const parkingSlot = truck.id === 0 ? 0 : Math.ceil(truck.id / 2) * (truck.id % 2 ? -1 : 1);
      const parkingX = 180 + parkingSlot * 20;
      const tx = parkingX + (destination - parkingX) * progress;
      const wheelRadius = 2.3, roadY = CONFIG.world.surface - 2, ty = roadY - wheelRadius;
      const facing = (destination < parkingX ? -1 : 1) * (truck.phase === 'returning' ? -1 : 1);
      const moving = truck.phase === 'outbound' || truck.phase === 'returning';
      if (moving && !this.reduced.matches && !game.paused && !game.ended) {
        for (let i = 0; i < 3; i++) {
          const age = ((game.duration - game.time) * 2 + i / 3) % 1;
          this.ellipse(ctx, tx - facing * (9 + age * 12), roadY - 1 - age * 2, 1 + age * 3, .5 + age, `rgba(237,210,157,${(1 - age) * .25})`);
        }
      }
      this.ellipse(ctx, tx, roadY, 9, .7, '#3b352d45');
      ctx.save(); ctx.translate(tx, ty); ctx.scale(facing, 1);
      this.rect(ctx, -8, -2, 18, 2, '#253c34');
      this.rect(ctx, -7, -6, 11, 4, truck.cargo > 0 ? '#efc268' : '#a7b39b');
      this.ellipse(ctx, -1.5, -6, 5.5, 2, truck.cargo > 0 ? '#f6d58e' : '#c6cfb7');
      for (const band of [-5, 1]) this.rect(ctx, band, -7, 1, 5, '#63755d');
      this.rect(ctx, 4, -8, 5, 7, '#304e43');
      this.rect(ctx, 5, -7, 3, 3, '#c9dfc2');
      this.rect(ctx, 8, -3, 2, 1, '#ffe3a1');
      this.rect(ctx, 4, -3, 2, .7, '#8caa8c');
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
        ctx.font = `750 ${13 / scale}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff0bd';
        ctx.strokeStyle = '#173c33'; ctx.lineWidth = 3 / scale;
        ctx.strokeText(`+$${Math.floor(effect.income)}`, clamp(effect.x, 30 / scale, 360 - 30 / scale), effect.y - (this.reduced.matches ? 0 : effect.age * 8));
        ctx.fillText(`+$${Math.floor(effect.income)}`, clamp(effect.x, 30 / scale, 360 - 30 / scale), effect.y - (this.reduced.matches ? 0 : effect.age * 8));
      }
      ctx.restore();
    }
  }
}
