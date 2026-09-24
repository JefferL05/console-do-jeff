import { encodeSave, decodeSave } from './persistence.js';
import { createMusic } from './music.js';

// Contract checked against the public v1 SDK reference (2026-06-04) and
// integration requirements (2026-06-16). Never create or overwrite ytgame.
export function createPlatform({ sdk = Reflect.get(globalThis, 'ytgame'), storage = () => globalThis.localStorage, doc = globalThis.document, win = globalThis.window } = {}) {
  const hosted = !!sdk?.IN_PLAYABLES_ENV;
  let loaded = !hosted, suspended = false, available = true;
  let audio = null, preferred = false, hostAudio = hosted ? sdk.system.isAudioEnabled() : true, userPaused = true, lastTone = 0;
  let musicPreferred = false, music = null, activated = false;
  let firstFrame = false, ready = false, writing = false, pending = null, pendingScore = 0, lastScore = 0;
  const suspendListeners = new Set(), resumeListeners = new Set();
  const warn = () => { if (hosted && !suspended) { try { sdk.health.logWarning(); } catch { /* Best effort. */ } } };
  async function syncAudio() {
    try {
      if (!audio && activated && hostAudio && !suspended && (preferred || musicPreferred) && win?.AudioContext) audio = new win.AudioContext();
      if (!audio) return;
      const playable = hostAudio && !suspended && !userPaused;
      if (musicPreferred && playable && !music) music = createMusic(audio);
      music?.setEnabled(musicPreferred && playable);
      if ((preferred || musicPreferred) && playable) await audio.resume();
      else await audio.suspend();
    } catch { /* Browser gesture policies may leave audio suspended. */ }
  }
  async function flushScore() {
    if (!hosted || suspended || !pendingScore) return;
    const value = pendingScore; pendingScore = 0;
    try { await sdk.engagement.sendScore({ value }); lastScore = Math.max(lastScore, value); }
    catch { pendingScore = Math.max(pendingScore, value); warn(); }
  }
  async function pump() {
    if (writing || !pending || (suspended && !pending.flush)) return;
    writing = true;
    const batch = pending; pending = null;
    let ok = false;
    try {
      if (hosted) await sdk.game.saveData(batch.raw);
      else storage().setItem('ouro-subsolo-save-v2', batch.raw);
      available = true; ok = true;
    } catch { available = false; warn(); }
    for (const resolve of batch.waiters) resolve(ok);
    writing = false;
    if (pending) void pump();
  }
  if (hosted) {
    sdk.system.onAudioEnabledChange(value => { hostAudio = value; void syncAudio(); });
    sdk.system.onPause(() => {
      if (suspended) return;
      suspended = true; void syncAudio();
      for (const callback of suspendListeners) callback();
    });
    sdk.system.onResume(() => {
      if (!suspended) return;
      suspended = false;
      for (const callback of resumeListeners) callback();
      void syncAudio(); void pump(); void flushScore();
    });
  } else {
    doc?.addEventListener('visibilitychange', () => { if (doc.hidden) for (const callback of suspendListeners) callback(); });
    win?.addEventListener('pagehide', () => { for (const callback of suspendListeners) callback(); });
  }
  return {
    hosted,
    get suspended() { return suspended; },
    get storageAvailable() { return available; },
    async load() {
      try {
        const raw = hosted ? await sdk.game.loadData() : storage().getItem('ouro-subsolo-save-v2');
        loaded = true; available = true;
        return decodeSave(raw);
      } catch {
        available = false; warn();
        // A failed cloud load must never be followed by a write of empty progress.
        return { ...decodeSave(null), loadFailed: hosted };
      }
    },
    async language() {
      if (!hosted) return 'pt-BR';
      try { return await sdk.system.getLanguage(); }
      catch { warn(); return 'en'; }
    },
    save(game, progress, settings, { flush = false } = {}) {
      if (!loaded) return Promise.resolve(false);
      const raw = encodeSave(game, progress, settings);
      // Stay below the 64 KiB best-effort exit payload, including UTF-16 size.
      if (raw.length * 2 >= 64 * 1024) { available = false; warn(); return Promise.resolve(false); }
      return new Promise(resolve => {
        const waiters = pending?.waiters || [];
        waiters.push(resolve);
        pending = { raw, waiters, flush: flush || !!pending?.flush };
        void pump();
      });
    },
    firstFrameReady() {
      if (firstFrame || suspended) return;
      if (hosted) sdk.game.firstFrameReady();
      firstFrame = true;
    },
    gameReady() {
      if (ready || !firstFrame || suspended) return;
      if (hosted) sdk.game.gameReady();
      ready = true;
    },
    async setAudio(value) {
      preferred = value; activated = true;
      // Called after a player's gesture; YouTube mute always takes precedence.
      await syncAudio();
    },
    async setMusic(value) {
      musicPreferred = value; activated = true;
      await syncAudio();
    },
    sound(kind) {
      if (!preferred || !hostAudio || suspended || userPaused || !audio || audio.state !== 'running' || audio.currentTime - lastTone < .12) return;
      lastTone = audio.currentTime;
      try {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = ({ scan: 480, drill: 180, sale: 740, upgrade: 580, warning: 240 })[kind] || 420;
        gain.gain.setValueAtTime(.0001, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.045, audio.currentTime + .015); gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .18);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .2);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      } catch { /* Optional feedback must not interrupt simulation. */ }
    },
    onSuspend(callback) { suspendListeners.add(callback); return () => suspendListeners.delete(callback); },
    onResume(callback) { resumeListeners.add(callback); return () => resumeListeners.delete(callback); },
    pause(game) { userPaused = true; if (game && !game.ended) game.paused = true; void syncAudio(); },
    resume(game) {
      if (suspended) return;
      userPaused = false; if (game && !game.ended) game.paused = false; void syncAudio();
    },
    reportBest(best) {
      const value = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(best)));
      if (hosted && value > lastScore) { pendingScore = Math.max(pendingScore, value); void flushScore(); }
    },
  };
}
