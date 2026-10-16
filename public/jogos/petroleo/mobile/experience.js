import { GameAudio, readSettings } from './audio.js';
import { isAndroid, nativeCall, flushNativeStorage } from './native.js';

export function installExperience({ getGame = () => null, pause = () => {}, back = () => false, quality = () => {} } = {}) {
  if (window.ouroExperience) return window.ouroExperience;
  const settings = readSettings(), audio = new GameAudio(settings);
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./style.css', import.meta.url).href; document.head.append(css);
  const dialog = document.createElement('dialog'); dialog.id = 'mobile-settings'; dialog.setAttribute('aria-labelledby', 'mobile-settings-title');
  dialog.innerHTML = `<h2 id="mobile-settings-title">Som e controles</h2><label>Música <input id="mobile-music" type="range" min="0" max="100" step="5" /></label><label>Efeitos sonoros <input id="mobile-effects" type="range" min="0" max="100" step="5" /></label><label class="mobile-check"><input id="mobile-mute" type="checkbox" /> Silenciar tudo</label><label class="mobile-check"><input id="mobile-haptic" type="checkbox" /> Vibração nas confirmações</label><label class="mobile-check"><input id="mobile-precision" type="checkbox" /> Mira acima do dedo ao tocar no campo</label><label>Qualidade gráfica<select id="mobile-quality"><option value="auto">Automática</option><option value="low">Econômica · 30 fps</option><option value="high">Alta · até 60 fps</option></select></label><p>Arraste para mover o campo e use dois dedos para ampliar. A mira deslocada ajuda a enxergar o destino. Mudanças de som respeitam o volume do aparelho.</p><p id="mobile-settings-status" role="status"></p><button id="mobile-settings-close" class="primary wide">Voltar ao jogo</button>`;
  document.body.append(dialog);
  const button = document.createElement('button'); button.id = 'mobile-settings-button'; button.textContent = 'Som e controles';
  const parent = document.querySelector('.header-actions') || document.getElementById('menu') || document.querySelector('.topbar') || document.body; parent.append(button);
  const $ = id => document.getElementById(id);
  const setQuality = () => {
    const low = settings.quality === 'low' || settings.quality === 'auto' && ((navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4);
    quality({ dpr: low ? 1 : 2, effects: !low, fps: low ? 30 : 60 });
  };
  function controls() {
    $('mobile-music').value = settings.music * 100; $('mobile-effects').value = settings.effects * 100;
    $('mobile-mute').checked = settings.mute; $('mobile-haptic').checked = settings.vibration; $('mobile-precision').checked = settings.precision; $('mobile-quality').value = settings.quality;
  }
  button.addEventListener('click', () => { pause(); controls(); dialog.showModal(); });
  $('mobile-settings-close').addEventListener('click', () => dialog.close());
  for (const id of ['mobile-music', 'mobile-effects', 'mobile-mute', 'mobile-haptic', 'mobile-precision', 'mobile-quality']) $(id).addEventListener('input', () => {
    settings.music = Number($('mobile-music').value) / 100; settings.effects = Number($('mobile-effects').value) / 100;
    settings.mute = $('mobile-mute').checked; settings.vibration = $('mobile-haptic').checked; settings.precision = $('mobile-precision').checked; settings.quality = $('mobile-quality').value;
    try { localStorage.setItem('ouro-mobile-settings-v1', JSON.stringify(settings)); $('mobile-settings-status').textContent = 'Preferências salvas.'; } catch { $('mobile-settings-status').textContent = 'Preferências válidas apenas nesta sessão.'; }
    setQuality(); void audio.unlock().then(() => { audio.sync(); audio.effect('confirm', true); });
  });
  const exit = document.createElement('dialog'); exit.id = 'mobile-exit'; exit.innerHTML = '<h2>Sair do jogo?</h2><p>A partida será mantida pausada para você continuar depois.</p><button id="mobile-stay" class="wide">Continuar aqui</button><button id="mobile-exit-confirm" class="primary wide">Salvar e sair</button>'; document.body.append(exit);
  $('mobile-stay').addEventListener('click', () => exit.close());
  $('mobile-exit-confirm').addEventListener('click', async () => { pause(); if (await flushNativeStorage() === false) { exit.querySelector('p').textContent = 'A gravação Android falhou. Tente novamente antes de sair.'; return; } audio.setBackground(true); if (isAndroid()) await nativeCall('exit'); });
  document.addEventListener('pointerdown', () => { void audio.unlock(); }, { passive: true });
  document.addEventListener('keydown', () => { void audio.unlock(); });
  let lastHaptic = 0;
  document.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target || target.disabled) return;
    audio.effect(/cancel|undo|keep|stay/.test(target.id) ? 'cancel' : 'confirm');
    if (isAndroid() && settings.vibration && performance.now() - lastHaptic > 160 && /confirm|launch|buy|bid|start|resume/.test(target.id)) { lastHaptic = performance.now(); void nativeCall('haptic').catch(() => {}); }
  });
  const suspend = () => { pause(); audio.setBackground(true); void flushNativeStorage(); };
  window.addEventListener('ouro:native-pause', suspend);
  window.addEventListener('ouro:native-resume', () => { audio.setBackground(false); audio.setRunning(false); });
  window.addEventListener('ouro:audio-focus', event => { audio.setFocus(event.available ?? event.detail?.available ?? false); if (!audio.focus) pause(); });
  window.addEventListener('ouro:native-back', () => {
    const opened = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (opened && ['home', 'result'].includes(opened.id)) { pause(); exit.showModal(); return; }
    if (opened) { if (opened.dispatchEvent(new Event('cancel', { cancelable: true }))) opened.close(); return; }
    if (back()) return;
    pause(); exit.showModal();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else { audio.setBackground(false); audio.setRunning(false); } });
  window.addEventListener('pagehide', () => { audio.destroy(); void flushNativeStorage(); });
  window.addEventListener('ouro:storage', event => {
    const node = $('save-state') || $('save-status'); if (!node) return;
    if (event.detail.state === 'saved') node.textContent = `Salvo no Android às ${new Date().toLocaleTimeString('pt-BR')}.`;
    else if (event.detail.state === 'error') node.textContent = event.detail.error;
    else node.textContent = 'Gravando progresso no Android…';
  });
  // SAF replaces the WebView file input while reusing the game's validated import flow.
  const input = $('import-save');
  if (input && isAndroid()) input.addEventListener('click', async event => {
    event.preventDefault(); pause();
    try {
      const result = await nativeCall('importSave'); if (result.cancelled) return;
      const transfer = new DataTransfer(); transfer.items.add(new File([result.raw], 'ouro-importado.json', { type: 'application/json' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) { const node = $('slot-message'); if (node) node.textContent = error.message; }
  });
  let last = null, lastGame = null;
  const api = {
    audio, settings,
    update(game = getGame()) {
      const running = !!game && !game.paused && !game.ended && !document.hidden;
      audio.setRunning(running);
      const current = game ? { sold: game.sold, found: game.pockets.filter(p => p.revealed).length, pipes: (game.edges || game.wells || []).length, spilled: game.spilled || 0, time: game.time, cash: game.cash } : null;
      if (game === lastGame && current && last && running) {
        if (current.found > last.found) audio.effect('discover');
        if (current.sold > last.sold) audio.effect('sale');
        if (current.pipes > last.pipes) audio.effect('drill');
        if (current.spilled > last.spilled) audio.effect('spill');
        if (current.time <= 30 && last.time > 30) audio.effect('end');
        if (game.rigs?.some(r => r.storage >= r.capacity * .95) || game.storage >= game.capacity * .95) audio.effect('warning');
      }
      audio.machinery(running ? (game.edges || game.wells || []).filter(p => p.progress < 1 || (p.flow ?? 1) > 0).length : 0);
      last = current; lastGame = game;
    },
  };
  window.ouroExperience = api; controls(); setQuality(); return api;
}
