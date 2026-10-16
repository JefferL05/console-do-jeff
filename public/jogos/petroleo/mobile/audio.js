import { composeMusic, MUSIC } from '../modules/music.js';
import { isAndroid, nativeCall } from './native.js';

export const DEFAULT_SETTINGS = Object.freeze({ music: .35, effects: .65, mute: false, vibration: true, quality: 'auto', precision: false });
export function readSettings(storage = globalThis.localStorage) {
  let data = {};
  try { data = JSON.parse(storage.getItem('ouro-mobile-settings-v1') || '{}'); } catch { /* Invalid preferences use safe defaults. */ }
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(['music', 'effects'].map(key => [key, Number.isFinite(data?.[key]) ? Math.max(0, Math.min(1, data[key])) : DEFAULT_SETTINGS[key]])), mute: data?.mute === true, vibration: data?.vibration !== false, precision: data?.precision === true, quality: ['auto', 'low', 'high'].includes(data?.quality) ? data.quality : 'auto' };
}
export class GameAudio {
  constructor(settings) { this.settings = settings; this.context = null; this.running = false; this.focus = true; this.background = false; this.voices = new Set(); this.lastEffects = new Map(); this.createdLoops = 0; this.destroyed = false; this.timer = 0; }
  async unlock() {
    if (this.destroyed || this.background || this.settings.mute) return;
    try {
      if (isAndroid()) this.focus = (await nativeCall('requestAudioFocus')).available;
      if (!this.focus) return;
      if (!this.context) this.initialize();
      if (this.context.state !== 'running') await this.context.resume();
      this.sync();
    } catch { /* Muted or gesture-blocked audio must never stop gameplay. */ }
  }
  initialize() {
    const Audio = window.AudioContext || Reflect.get(window, 'webkitAudioContext'); if (!Audio) return;
    const ctx = this.context = new Audio({ latencyHint: 'interactive' });
    this.master = ctx.createGain(); this.master.gain.value = .65; this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master);
    this.effectsGain = ctx.createGain(); this.effectsGain.gain.value = this.settings.effects; this.effectsGain.connect(this.master);
    this.machineGain = ctx.createGain(); this.machineGain.gain.value = 0; this.machineGain.connect(this.effectsGain);
    const samples = composeMusic(), buffer = ctx.createBuffer(1, samples.length, MUSIC.sampleRate); buffer.copyToChannel(samples, 0);
    this.music = ctx.createBufferSource(); this.music.buffer = buffer; this.music.loop = true; this.music.connect(this.musicGain); this.music.start(); this.createdLoops++;
    this.machine = ctx.createOscillator(); this.machine.type = 'triangle'; this.machine.frequency.value = 52; this.machine.connect(this.machineGain); this.machine.start();
  }
  ramp(param, value, duration = .04) { if (!this.context) return; param.cancelScheduledValues(this.context.currentTime); param.setTargetAtTime(value, this.context.currentTime, duration); }
  setRunning(running) { if (this.running !== running) { this.running = running; this.sync(); } }
  setFocus(value) { this.focus = value; this.sync(); }
  setBackground(value) { this.background = value; this.sync(); }
  sync() {
    if (!this.context) return;
    const enabled = !this.settings.mute && this.focus && !this.background;
    this.ramp(this.musicGain.gain, enabled && this.running ? this.settings.music : 0, .08);
    this.ramp(this.effectsGain.gain, enabled ? this.settings.effects : 0);
    if (!enabled || !this.running) this.ramp(this.machineGain.gain, 0);
    clearTimeout(this.timer);
    if (!enabled || !this.running) this.timer = setTimeout(() => {
      if ((!this.running || this.background || !this.focus || this.settings.mute) && this.context.state === 'running') void this.context.suspend();
    }, enabled ? 300 : 0);
    else if (this.context.state !== 'running') void this.context.resume().catch(() => {});
  }
  machinery(amount) {
    if (!this.context || !this.running || this.settings.mute || !this.focus || this.background) return;
    if (this.context.currentTime < (this.duckUntil || 0)) return;
    this.ramp(this.machineGain.gain, Math.min(.035, Math.max(0, amount) * .004));
  }
  effect(kind, force = false) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.background || !this.focus || this.settings.mute || !this.settings.effects) return;
    const now = ctx.currentTime, cooldown = kind === 'warning' || kind === 'spill' ? 2 : .12;
    if (!force && now - (this.lastEffects.get(kind) ?? -99) < cooldown || this.voices.size >= 6) return;
    this.lastEffects.set(kind, now);
    const notes = { confirm: [520, 780], cancel: [340, 230], invalid: [160, 125], scan: [380, 950], discover: [540, 810, 1080], drill: [130, 190], sale: [650, 980], upgrade: [440, 660, 880], warning: [660, 330, 660], spill: [170, 120, 170], end: [392, 330, 262] }[kind] || [420, 600];
    if (['warning', 'spill', 'end'].includes(kind)) { this.duckUntil = now + 1; this.ramp(this.machineGain.gain, .001); }
    const gain = ctx.createGain(), oscillator = ctx.createOscillator(), duration = notes.length * .08 + .12;
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.11, now + .008); gain.gain.setValueAtTime(.09, now + duration - .08); gain.gain.linearRampToValueAtTime(0, now + duration);
    oscillator.type = kind === 'drill' || kind === 'spill' ? 'triangle' : 'sine'; notes.forEach((note, i) => oscillator.frequency.setValueAtTime(note, now + i * .08));
    oscillator.connect(gain); gain.connect(this.effectsGain); this.voices.add(oscillator); oscillator.start(now); oscillator.stop(now + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
  }
  diagnostics() { return { state: this.context?.state || 'not-created', running: this.running, voices: this.voices.size, loops: this.createdLoops, focus: this.focus, muted: this.settings.mute }; }
  destroy() { this.destroyed = true; clearTimeout(this.timer); for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } } this.music?.stop(); this.machine?.stop(); void this.context?.close(); }
}
