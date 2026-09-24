import { CONFIG } from './modules/config.js';
import { createGame, scanQuote, drillQuote, commit, step, buyUpgrade, settle, buyResearch } from './modules/simulation.js';
import { Renderer } from './modules/renderer.js';
import { bindInput } from './modules/input.js';
import { $, text, message, updateHUD, renderHome, renderUpgrades, renderResult } from './modules/ui.js';
import { t } from './modules/i18n.js';

export function startApp(platform, saved) {
const progress = saved.progress, settings = saved.settings;
let game = saved.game, selected = progress.unlocked, mode = game?.mode || 'quick';
const view = { tool: 'scan', preview: null, selectedPocket: null, parentId: null, keyboardCursor: null, effects: [] };
const renderer = new Renderer($('game'));
const backdropGame = createGame({ seed: 2026 });
const dialogs = ['home', 'menu', 'help-dialog', 'upgrade-dialog', 'result'];
let helpReturn = null, previous = performance.now(), accumulator = 0, uiClock = 0, saveClock = 0;
let diagnosticTime = previous, diagnosticFrames = 0, renderTotal = 0;
let frameId = 0, runningBeforeHostPause = false, saveSequence = 0;
const diagnostics = { fps: 0, averageRenderMs: 0, measuredSeconds: 0, viewport: '', dpr: 1 };
// Read-only snapshot for local performance verification, not analytics.
Object.defineProperty(window, 'ouroDiagnostics', { get: () => ({ ...diagnostics }) });

async function save(flush = false) {
  const sequence = ++saveSequence;
  const best = progress.best;
  const ok = await platform.save(game, progress, settings, { flush });
  if (ok) platform.reportBest(best);
  if (!platform.suspended && sequence === saveSequence) text('save-status', ok ? platform.hosted ? 'Progresso salvo no YouTube.' : 'Progresso salvo neste navegador.' : 'Armazenamento indisponível. A partida funciona, mas poderá ser perdida ao fechar.');
  return ok;
}
function clearSelection() { view.preview = null; view.selectedPocket = null; view.parentId = null; update(); }
function update() { if (game) updateHUD(game, view); }
function closeDialogs() { for (const id of dialogs) if ($(id).open) $(id).close(); }
function showDialog(id) {
  platform.pause(game); accumulator = 0; closeDialogs(); $(id).showModal(); update();
}
function resume() {
  if (platform.suspended) return;
  closeDialogs(); platform.resume(game); previous = performance.now(); accumulator = 0; update(); save();
}
function openHome() { selected = progress.unlocked; renderHome(progress, selected, mode, game); showDialog('home'); save(); }
function openMenu() {
  if (!game) return;
  clearSelection();
  if (game.ended) { renderResult(game); showDialog('result'); }
  else showDialog('menu');
  save();
}
function start({ seed = crypto.getRandomValues(new Uint32Array(1))[0], profile = selected, roundMode = mode, tutorial = $('tutorial').checked && profile === 0 } = {}) {
  game = createGame({ seed, profile, mode: roundMode, tutorial, research: progress.research });
  view.effects = [];
  view.tool = 'scan'; clearSelection(); closeDialogs();
  platform.resume(game);
  platform.setAudio(settings.sound); platform.setMusic(settings.music); previous = performance.now(); accumulator = 0;
  message(tutorial ? 'Toque no círculo dourado e confirme sua primeira sondagem.' : 'Uma nova concessão. Explore o subsolo antes de perfurar.');
  update(); save();
}
function select(point) {
  if (!game || game.paused || dialogs.some(id => $(id).open)) return;
  if (point.x < 0 || point.x > CONFIG.world.width || point.y < CONFIG.world.surface + 10 || point.y > CONFIG.world.height) {
    message('Selecione uma área dentro do campo, abaixo da superfície.'); return;
  }
  if (game.ended) {
    const pocket = renderer.pick({ ...game, pockets: game.pockets.map(p => ({ ...p, revealed: true })) }, point);
    view.selectedPocket = pocket?.id ?? null; update(); return;
  }
  if (view.tool === 'scan') {
    view.preview = scanQuote(game, point.x, point.y); view.selectedPocket = null;
  } else {
    const pocket = renderer.pick(game, point);
    if (!pocket) { message('Toque em um bolsão revelado. Explore primeiro se necessário.'); return; }
    view.selectedPocket = pocket.id;
    const connection = game.wells.find(w => w.pocketId === pocket.id);
    if (connection) {
      view.preview = null; view.parentId = connection.progress >= 1 ? connection.id : null;
      message(connection.progress >= 1 ? 'Origem selecionada. Toque em outra reserva para ramificar.' : 'A perfuração deve terminar antes de criar uma ramificação.');
    } else view.preview = drillQuote(game, pocket.id, view.parentId);
  }
  update();
}
function drainEvents() {
  const events = game.events.splice(0);
  for (const event of events) {
    platform.sound(event.kind);
    if (event.kind === 'scan' || event.kind === 'sale') {
      view.effects.push({ ...event, age: 0 });
      if (view.effects.length > 12) view.effects.shift();
    }
    // Delivery sound is frequent; keep strategic messages readable.
    if (event.kind !== 'sale') message(event.text);
  }
}
function finished() {
  settle(game, progress); renderResult(game); clearSelection(); showDialog('result'); save();
}

for (const tool of ['scan', 'drill']) $(tool).addEventListener('click', () => { view.tool = tool; clearSelection(); });
for (const target of ['west', 'hold', 'east']) $(target).addEventListener('click', () => {
  if (!game || game.ended || game.paused) return;
  game.target = target; message(target === 'hold' ? 'Novas cargas suspensas. As que já saíram serão entregues.' : 'Destino das próximas cargas alterado. Preço aplicado na entrega.'); update(); save();
});
$('confirm').addEventListener('click', () => {
  if (!game) return;
  const result = commit(game, view.preview);
  if (result.ok) { clearSelection(); drainEvents(); save(); }
  else { message(result.reason); refreshPreview(); }
  update();
});
$('cancel').addEventListener('click', () => { clearSelection(); message('Seleção cancelada. Nenhum custo cobrado.'); });
function refreshPreview() {
  if (view.preview) view.preview = view.preview.type === 'scan' ? scanQuote(game, view.preview.x, view.preview.y) : drillQuote(game, view.preview.pocketId, view.preview.parentId);
}
$('pause').addEventListener('click', openMenu);
$('resume').addEventListener('click', () => { platform.setAudio(settings.sound); platform.setMusic(settings.music); resume(); });
$('sound').addEventListener('click', () => {
  settings.sound = !settings.sound; platform.setAudio(settings.sound); text('sound', `Efeitos sonoros: ${settings.sound ? 'ligados' : 'desligados'}`); $('sound').setAttribute('aria-pressed', String(settings.sound)); save();
});
$('music').addEventListener('click', () => {
  settings.music = !settings.music; platform.setMusic(settings.music);
  text('music', `Música: ${settings.music ? 'ligada' : 'desligada'}`); $('music').setAttribute('aria-pressed', String(settings.music)); save();
});
function help(returnTo) { helpReturn = returnTo; showDialog('help-dialog'); }
$('help').addEventListener('click', () => help(null));
$('menu-help').addEventListener('click', () => help('menu'));
$('close-help').addEventListener('click', () => { if (helpReturn) showDialog(helpReturn); else resume(); });
$('upgrades').addEventListener('click', () => { if (game && !game.ended) { renderUpgrades(game); showDialog('upgrade-dialog'); } });
for (const type of ['tank', 'truck', 'bit']) $(type).addEventListener('click', () => {
  if (buyUpgrade(game, type)) { drainEvents(); renderUpgrades(game); update(); save(); }
});
$('close-upgrades').addEventListener('click', resume);
$('home-button').addEventListener('click', openHome);
$('restart').addEventListener('click', () => start({ seed: game.seed, profile: game.profile, roundMode: game.mode, tutorial: false }));
$('skip-tutorial').addEventListener('click', () => { game.tutorial = -1; message('Guia encerrado. A ajuda está disponível no botão ?.'); update(); save(); });
$('profiles').addEventListener('click', event => {
  const button = event.target.closest('[data-profile]');
  if (!button || button.disabled) return;
  selected = Number(button.dataset.profile); renderHome(progress, selected, mode, game);
});
for (const value of ['quick', 'classic']) $(value).addEventListener('click', () => { mode = value; renderHome(progress, selected, mode, game); });
$('research').addEventListener('click', event => {
  const button = event.target.closest('[data-research]');
  if (button && buyResearch(progress, button.dataset.research)) { platform.sound('upgrade'); renderHome(progress, selected, mode, game); save(); }
});
$('start').addEventListener('click', () => start());
$('continue').addEventListener('click', () => { if (game && !game.ended) { platform.setAudio(settings.sound); platform.setMusic(settings.music); resume(); message('Expedição retomada. Suas cargas e reservas foram preservadas.'); } });
$('retry').addEventListener('click', () => start({ seed: game.seed, profile: game.profile, roundMode: game.mode, tutorial: false }));
$('next').addEventListener('click', openHome);
$('inspect').addEventListener('click', () => { closeDialogs(); game.paused = false; message('Toque nas reservas para inspecionar. Abra Ⅱ para rever o resultado.'); update(); });
for (const id of dialogs) $(id).addEventListener('cancel', event => {
  event.preventDefault();
  if (id === 'menu' || id === 'upgrade-dialog') resume();
  if (id === 'help-dialog') { if (helpReturn) showDialog(helpReturn); else resume(); }
});
bindInput($('game'), renderer, { select, cancel: clearSelection, pause: openMenu, cursor: value => { view.keyboardCursor = value; } });
platform.onSuspend(() => {
  if (platform.hosted) {
    runningBeforeHostPause = !!game && !game.paused && !game.ended;
    cancelAnimationFrame(frameId); renderer.suspended = true; document.body.inert = true;
  }
  platform.pause(game); accumulator = 0;
  if (!platform.hosted && game && !game.ended && !dialogs.some(id => $(id).open)) showDialog('menu');
  void save(true);
});
platform.onResume(() => {
  document.body.inert = false; renderer.suspended = false; renderer.resize();
  if (runningBeforeHostPause) platform.resume(game);
  previous = performance.now(); accumulator = 0;
  frameId = requestAnimationFrame(frame);
});
function frame(now) {
  if (platform.suspended) return;
  const elapsed = Math.min(.25, Math.max(0, (now - previous) / 1000)); previous = now;
  if (game && !game.paused && !game.ended) {
    accumulator += elapsed;
    while (accumulator >= CONFIG.step && !game.ended) { step(game); accumulator -= CONFIG.step; }
    drainEvents();
    if (game.ended) finished();
  } else accumulator = 0;
  uiClock += elapsed; saveClock += elapsed;
  if (uiClock >= CONFIG.uiInterval) { uiClock = 0; refreshPreview(); update(); }
  if (saveClock >= CONFIG.saveInterval) { saveClock = 0; if (game && !game.paused && !game.ended) save(); }
  const renderStart = performance.now(); renderer.draw(game || backdropGame, view); renderTotal += performance.now() - renderStart; diagnosticFrames++;
  if (!game?.paused) view.effects = view.effects.map(effect => ({ ...effect, age: effect.age + elapsed })).filter(effect => effect.age < 1.5);
  if (now - diagnosticTime >= 3000) {
    diagnostics.fps = Math.round(diagnosticFrames * 1000 / (now - diagnosticTime)); diagnostics.averageRenderMs = Number((renderTotal / diagnosticFrames).toFixed(2)); diagnostics.measuredSeconds = Math.round((now - diagnosticTime) / 1000); diagnostics.viewport = `${innerWidth}×${innerHeight}`; diagnostics.dpr = renderer.dpr;
    diagnosticTime = now; diagnosticFrames = 0; renderTotal = 0;
  }
  frameId = requestAnimationFrame(frame);
}
text('sound', `Efeitos sonoros: ${settings.sound ? 'ligados' : 'desligados'}`); $('sound').setAttribute('aria-pressed', String(settings.sound));
text('music', `Música: ${settings.music ? 'ligada' : 'desligada'}`); $('music').setAttribute('aria-pressed', String(settings.music));
renderHome(progress, selected, mode, game); showDialog('home');
text('save-status', saved.invalid ? 'Um salvamento inválido ou antigo foi ignorado. O progresso válido foi preservado quando possível.' : !platform.storageAvailable ? 'Armazenamento indisponível neste navegador.' : platform.hosted ? 'Progresso sincronizado com o YouTube.' : 'Progresso salvo automaticamente neste navegador.');
text('save-description', platform.hosted ? 'O tempo está parado. Sua expedição é salva na nuvem do YouTube.' : 'O tempo está parado. Sua expedição é salva automaticamente quando o armazenamento está disponível.');
document.title = t('Ouro do Subsolo — Console do Jeff');
frameId = requestAnimationFrame(frame);
}
