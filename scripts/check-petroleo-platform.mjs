import assert from 'node:assert/strict';
import { createPlatform } from '../public/jogos/petroleo/modules/platform.js';
import { createGame, createProgress } from '../public/jogos/petroleo/modules/simulation.js';
import { encodeSave, decodeSave } from '../public/jogos/petroleo/modules/persistence.js';
import { composeMusic, MUSIC } from '../public/jogos/petroleo/modules/music.js';
import { setLanguage, t, number } from '../public/jogos/petroleo/modules/i18n.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture() {
  const calls = [], callbacks = {}, gate = deferred(); let failLoad = false;
  const sdk = {
    IN_PLAYABLES_ENV: true,
    game: { loadData: async () => { calls.push('load'); if (failLoad) throw Error('offline'); return gate.promise; }, saveData: async raw => { calls.push(['save', JSON.parse(raw)]); }, firstFrameReady: () => calls.push('first'), gameReady: () => calls.push('ready') },
    system: { isAudioEnabled: () => false, getLanguage: async () => 'en-US', onAudioEnabledChange: cb => { callbacks.audio = cb; }, onPause: cb => { callbacks.pause = cb; }, onResume: cb => { callbacks.resume = cb; } },
    engagement: { sendScore: async value => calls.push(['score', value]) }, health: { logWarning: () => calls.push('warning') },
  };
  const forbidden = () => { throw Error('Local browser API accessed inside Playables'); };
  const platform = createPlatform({ sdk, storage: forbidden, doc: { addEventListener: forbidden }, win: { addEventListener: forbidden } });
  return { platform, sdk, calls, callbacks, gate, fail: () => failLoad = true };
}
let tests = 0;
async function test(name, fn) { await fn(); tests++; console.log(`PASS ${name}`); }
const g = createGame({ seed: 10 }), p = createProgress(), settings = { sound: false };

await test('readiness occurs once in order and is blocked during host suspension', () => {
  const f = fixture(); f.platform.gameReady(); assert.deepEqual(f.calls, []);
  f.callbacks.pause(); f.platform.firstFrameReady(); assert.deepEqual(f.calls, []);
  f.callbacks.resume(); f.platform.firstFrameReady(); f.platform.firstFrameReady(); f.platform.gameReady(); f.platform.gameReady();
  assert.deepEqual(f.calls, ['first', 'ready']);
});
await test('load must finish successfully before any write; hosted APIs never access local storage or visibility', async () => {
  const f = fixture(); const load = f.platform.load();
  assert.equal(await f.platform.save(g, p, settings), false);
  f.gate.resolve(encodeSave(g, p, settings)); const loaded = await load;
  assert.ok(loaded.game.paused); assert.equal(await f.platform.save(g, p, settings), true);
  assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === 'save').length, 1);
  assert.equal(await f.platform.language(), 'en-US');
});
await test('failed cloud load protects old progress; no silent local fallback', async () => {
  const f = fixture(); f.fail(); assert.ok((await f.platform.load()).loadFailed);
  assert.equal(await f.platform.save(g, p, settings), false); assert.equal(f.platform.storageAvailable, false);
});
await test('serialized saves coalesce to newest snapshot and cannot finish out of order', async () => {
  const f = fixture(); f.gate.resolve(''); await f.platform.load();
  const first = deferred(); let calls = 0;
  f.sdk.game.saveData = async raw => { f.calls.push(['raw', JSON.parse(raw).progress.credits]); if (++calls === 1) await first.promise; };
  const a = f.platform.save(g, p, settings), b = f.platform.save(g, { ...p, credits: 1 }, settings), c = f.platform.save(g, { ...p, credits: 2 }, settings);
  assert.equal(calls, 1); first.resolve(); assert.deepEqual(await Promise.all([a, b, c]), [true, true, true]);
  assert.deepEqual(f.calls.filter(c => Array.isArray(c) && c[0] === 'raw').map(c => c[1]), [0, 2]);
});
await test('host pause locks resume and ordinary writes, permits final flush, preserves user pause', async () => {
  const f = fixture(); f.gate.resolve(''); await f.platform.load(); const game = createGame();
  f.platform.onSuspend(() => f.platform.pause(game)); f.platform.onResume(() => {});
  f.callbacks.pause(); assert.ok(game.paused); f.platform.resume(game); assert.ok(game.paused);
  const pending = f.platform.save(game, p, settings); assert.equal(f.calls.filter(Array.isArray).length, 0);
  assert.equal(await f.platform.save(game, p, settings, { flush: true }), true); assert.equal(await pending, true);
  f.callbacks.resume(); assert.ok(game.paused); f.platform.resume(game); assert.equal(game.paused, false);
});
await test('score matches displayed saved best, is integer, and is deferred during host pause', async () => {
  const f = fixture(); f.callbacks.pause(); f.platform.reportBest(2432.92);
  assert.equal(f.calls.filter(Array.isArray).length, 0); f.callbacks.resume(); await Promise.resolve();
  assert.deepEqual(f.calls.find(Array.isArray), ['score', { value: 2432 }]);
  f.platform.reportBest(2432.92); assert.equal(f.calls.filter(Array.isArray).length, 1);
});
await test('host mute always overrides user preference and a paused game cannot emit effects', async () => {
  let created = 0, emitted = 0, callback;
  class Audio {
    state = 'suspended'; currentTime = 1;
    constructor() { created++; }
    async resume() { this.state = 'running'; } async suspend() { this.state = 'suspended'; }
    createOscillator() { emitted++; return { frequency: {}, connect() {}, start() {}, stop() {}, disconnect() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const f = fixture(); f.sdk.system.onAudioEnabledChange = cb => callback = cb;
  const adapter = createPlatform({ sdk: f.sdk, win: { AudioContext: Audio } }); const game = createGame();
  adapter.resume(game); await adapter.setAudio(true); adapter.sound('sale'); assert.equal(created, 0);
  callback(true); await adapter.setAudio(true); adapter.sound('sale'); assert.equal(emitted, 1);
  callback(false); adapter.sound('sale'); assert.equal(emitted, 1);
  adapter.pause(game); callback(true); await Promise.resolve(); adapter.sound('sale'); assert.equal(emitted, 1);
});
await test('Portuguese and English presentation keep simulation/save values unchanged', () => {
  const before = encodeSave(g, p, settings);
  setLanguage('en-US'); assert.equal(t('Explorar'), 'Explore'); assert.equal(t('Reserva · 180 barris'), 'Reserve · 180 barrels');
  assert.equal(t('Foram extraídos 10 de 180 barris desta reserva.'), '10 of 180 barrels extracted from this reserve.');
  assert.equal(number(1500), '1,500'); assert.equal(encodeSave(g, p, settings), before);
  setLanguage('pt-BR'); assert.equal(t('Explorar'), 'Explorar'); assert.equal(number(1500), '1.500');
});
await test('cloud payload remains below 64 KiB exit limit and failures surface without throwing', async () => {
  const f = fixture(); f.gate.resolve(''); await f.platform.load();
  const huge = { ...g, scans: Array(4000).fill({ x: 180, y: 200 }) };
  assert.equal(await f.platform.save(huge, p, settings), false);
  f.sdk.game.saveData = async () => { throw Error('unavailable'); };
  assert.equal(await f.platform.save(g, p, settings), false);
});
await test('music is independent of effects, creates one loop and obeys host mute/pause', async () => {
  const contexts = []; let starts = 0;
  class Audio {
    state = 'suspended'; currentTime = 0; destination = {};
    constructor() { contexts.push(this); }
    async resume() { this.state = 'running'; } async suspend() { this.state = 'suspended'; }
    createBuffer() { return { copyToChannel() {} }; }
    createBufferSource() { return { connect() {}, start() { starts++; } }; }
    createGain() { return { connect() {}, gain: { value: 0, cancelScheduledValues() {}, setTargetAtTime() {} } }; }
  }
  const f = fixture();
  const adapter = createPlatform({ sdk: f.sdk, win: { AudioContext: Audio } });
  const game = createGame(); adapter.resume(game); await adapter.setMusic(true);
  assert.equal(contexts.length, 0, 'Muted host cannot initialize music');
  f.callbacks.audio(true); await Promise.resolve();
  assert.equal(contexts.length, 1); assert.equal(contexts[0].state, 'running'); assert.equal(starts, 1);
  f.callbacks.pause(); assert.equal(contexts[0].state, 'suspended');
  await adapter.setMusic(true); adapter.resume(game); assert.equal(contexts[0].state, 'suspended');
  f.callbacks.resume(); await Promise.resolve(); assert.equal(contexts[0].state, 'running');
  f.callbacks.audio(false); assert.equal(contexts[0].state, 'suspended');
  f.callbacks.audio(true); await adapter.setMusic(false); assert.equal(contexts[0].state, 'suspended');
  await adapter.setAudio(true); assert.equal(contexts[0].state, 'running', 'Effects remain available with music off');
  adapter.pause(game); assert.equal(contexts[0].state, 'suspended');
  await adapter.setMusic(true); assert.equal(contexts[0].state, 'suspended');
  adapter.resume(game); assert.equal(contexts[0].state, 'running'); assert.equal(starts, 1, 'Resume must not layer multiple loops');
});
await test('original music has bounded output and old saves migrate without losing mute choices', () => {
  const samples = composeMusic(); let peak = 0, energy = 0;
  for (const sample of samples) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  assert.equal(samples.length / MUSIC.sampleRate, 32);
  assert.ok(peak <= .801 && Math.sqrt(energy / samples.length) > .03, 'Audible output without clipping');
  assert.ok(Math.abs(samples[0] - samples.at(-1)) < .04, 'No large waveform jump at loop boundary');
  const legacy = JSON.parse(encodeSave(g, p, { sound: false })); delete legacy.settings.music;
  const migrated = decodeSave(JSON.stringify(legacy)); assert.equal(migrated.settings.music, true); assert.equal(migrated.settings.sound, false); assert.equal(migrated.invalid, false);
  const muted = decodeSave(encodeSave(g, p, { sound: true, music: false })); assert.equal(muted.settings.music, false); assert.equal(muted.settings.sound, true);
});
console.log(`\n${tests} integration suites passed (SDK contract doubles, not official certification).`);
