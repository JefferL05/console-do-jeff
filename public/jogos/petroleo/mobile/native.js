export const isAndroid = () => globalThis.Capacitor?.getPlatform?.() === 'android';
export function nativeCall(method, options = {}) {
  if (!isAndroid() || !globalThis.Capacitor?.nativePromise) return Promise.reject(new Error('Recurso Android indisponível.'));
  return globalThis.Capacitor.nativePromise('OuroNative', method, options);
}
let pending = false, writing = null, prepared = false, lastError = null;
function snapshot() {
  const values = {};
  for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith('ouro-')) values[key] = localStorage.getItem(key); }
  return values;
}
function stateEvent(state, error = '') { window.dispatchEvent(new CustomEvent('ouro:storage', { detail: { state, error } })); }
export async function flushNativeStorage() {
  if (!isAndroid() || !prepared) return;
  if (writing) return writing;
  // Defer the worker until after `writing` is assigned, including an idle flush.
  // Otherwise an already-resolved worker can leave a permanently stale promise.
  writing = Promise.resolve().then(async () => {
    try {
      while (pending) {
        pending = false; stateEvent('writing');
        await nativeCall('saveState', { values: snapshot() }); lastError = null;
      }
      stateEvent('saved');
    } catch (error) { lastError = error; pending = true; stateEvent('error', 'A gravação Android falhou. A sessão local foi preservada; tente salvar novamente.'); }
    return !lastError;
  }).finally(() => { writing = null; });
  return writing;
}
export async function prepareNativeStorage() {
  if (!isAndroid() || prepared) return;
  // Never start a blank game after an unreadable native save.
  const state = await nativeCall('loadState');
  const sequenceKey = 'ouro-native-write-sequence';
  let sequence = Math.max(Number(localStorage.getItem(sequenceKey)) || 0, Number(state.values?.[sequenceKey]) || 0, Date.now());
  const localNewer = (Number(localStorage.getItem(sequenceKey)) || 0) > (Number(state.values?.[sequenceKey]) || 0);
  if (state.initialized && !localNewer) {
    const oldKeys = Object.keys(snapshot());
    for (const key of oldKeys) if (!Object.hasOwn(state.values, key)) localStorage.removeItem(key);
    for (const [key, raw] of Object.entries(state.values)) localStorage.setItem(key, raw);
  }
  const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
  const queue = () => { set.call(localStorage, sequenceKey, String(++sequence)); pending = true; queueMicrotask(() => void flushNativeStorage()); };
  Storage.prototype.setItem = function(key, value) { const changed = this.getItem(key) !== String(value); set.call(this, key, value); if (changed && this === localStorage && String(key).startsWith('ouro-')) queue(); };
  Storage.prototype.removeItem = function(key) { remove.call(this, key); if (this === localStorage && String(key).startsWith('ouro-')) queue(); };
  prepared = true;
  if (!state.initialized || localNewer) { set.call(localStorage, sequenceKey, String(++sequence)); pending = true; await flushNativeStorage(); if (lastError) throw lastError; }
  window.addEventListener('ouro:native-pause', () => void flushNativeStorage());
}
export function nativeStorageStatus() { return { pending, writing: !!writing, error: !!lastError }; }
