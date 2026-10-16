import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindFieldGestures } from '../public/jogos/petroleo/mobile/gestures.js';
import { readSettings } from '../public/jogos/petroleo/mobile/audio.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), web = join(root, 'mobile/www');
let tests = 0;
function test(name, run) { run(); tests++; console.log(`PASS ${name}`); }
class Canvas extends EventTarget {
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0 }; }
}
function camera() {
  return { zoom: 1, pan: { x: 0, y: 0 }, x: 0, y: 0, scale: 1, world(x, y) { return { x: (x - this.x) / this.scale, y: (y - this.y) / this.scale }; }, setZoom(value) { this.zoom = Math.max(1, Math.min(3, value)); this.camera(); }, camera() { this.scale = this.zoom; this.x = this.pan.x; this.y = this.pan.y; } };
}
function pointer(canvas, type, id, x, y, pointerType = 'touch') { const event = new Event(type); Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0, pointerType }); canvas.dispatchEvent(event); }
test('tap selects once; drag and cancellation never select', () => {
  const canvas = new Canvas(), cam = camera(), selected = [];
  bindFieldGestures(canvas, cam, { select: p => selected.push(p) });
  pointer(canvas, 'pointerdown', 1, 100, 200); pointer(canvas, 'pointerup', 1, 100, 200); assert.deepEqual(selected, [{ x: 100, y: 200 }]);
  pointer(canvas, 'pointerdown', 2, 100, 200); pointer(canvas, 'pointermove', 2, 140, 240); pointer(canvas, 'pointerup', 2, 140, 240); assert.equal(selected.length, 1);
  pointer(canvas, 'pointerdown', 3, 100, 200); pointer(canvas, 'pointercancel', 3, 100, 200); pointer(canvas, 'pointerup', 3, 100, 200); assert.equal(selected.length, 1);
});
test('pinch stays anchored between fingers and never becomes a tap on release', () => {
  const canvas = new Canvas(), cam = camera(), selected = []; bindFieldGestures(canvas, cam, { select: p => selected.push(p) });
  pointer(canvas, 'pointerdown', 1, 100, 200); pointer(canvas, 'pointerdown', 2, 200, 200);
  const anchor = cam.world(150, 200);
  pointer(canvas, 'pointermove', 1, 50, 200); pointer(canvas, 'pointermove', 2, 250, 200);
  assert.equal(cam.zoom, 2); assert.deepEqual(cam.world(150, 200), anchor);
  pointer(canvas, 'pointerup', 1, 50, 200); pointer(canvas, 'pointermove', 2, 300, 200); pointer(canvas, 'pointerup', 2, 300, 200); assert.equal(selected.length, 0);
});
test('precision aim offsets touch but preserves mouse coordinates', () => {
  const canvas = new Canvas(), cam = camera(), selected = []; bindFieldGestures(canvas, cam, { select: p => selected.push(p), precision: () => true });
  pointer(canvas, 'pointerdown', 1, 100, 200); pointer(canvas, 'pointerup', 1, 100, 200);
  pointer(canvas, 'pointerdown', 2, 100, 200, 'mouse'); pointer(canvas, 'pointerup', 2, 100, 200, 'mouse'); assert.deepEqual(selected, [{ x: 100, y: 158 }, { x: 100, y: 200 }]);
});
test('audio preferences validate volume, malformed data and quality', () => {
  const settings = readSettings({ getItem: () => '{"music":9,"effects":-2,"quality":"bad","mute":true}' }); assert.equal(settings.music, 1); assert.equal(settings.effects, 0); assert.equal(settings.quality, 'auto'); assert.equal(settings.mute, true);
  assert.doesNotThrow(() => readSettings({ getItem: () => '{invalid' }));
});
const files = [];
async function collect(path, prefix = '') { for (const entry of await readdir(path, { withFileTypes: true })) if (entry.isDirectory()) await collect(join(path, entry.name), prefix + entry.name + '/'); else files.push(prefix + entry.name); }
await collect(web);
for (const file of files.filter(f => f.endsWith('.html'))) {
  const html = await readFile(join(web, file), 'utf8');
  assert.ok(!html.includes('youtube.com/game_api')); assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/.test(html));
  for (const [, url] of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) {
    assert.ok(!url.endsWith('/'), `${file}: native navigation must use explicit index.html`);
    assert.ok((await stat(join(web, url.slice(1)))).isFile(), `${file}: missing ${url}`);
  }
}
for (const file of files.filter(f => f.endsWith('.js'))) {
  const source = await readFile(join(web, file), 'utf8');
  for (const [, path] of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) assert.ok((await stat(resolve(web, dirname(file), path))).isFile(), `${file}: missing module ${path}`);
}
console.log(`PASS offline package: ${files.length} local assets, explicit HTML navigation and resolved ES modules`);
console.log(`${tests + 1} Android preparation checks passed.`);
