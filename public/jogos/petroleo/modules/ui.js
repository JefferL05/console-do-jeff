import { CONFIG, PROFILES, RESEARCH, money } from './config.js';
import { inTransit, metrics, transportRate, upgradeQuote, wellRate } from './simulation.js';
import { t, number } from './i18n.js';

export const $ = id => document.getElementById(id);
const barrels = value => number(Math.max(0, value), 1, 0);
export const text = (id, value) => { const node = $(id), translated = t(value); if (node.textContent !== translated) node.textContent = translated; };
export function message(value) { text('toast', value); }

export function updateHUD(game, view) {
  text('cash', money(game.cash));
  const seconds = Math.ceil(game.time);
  text('time', `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  text('storage', `${Math.floor(game.storage)}/${game.capacity}`);
  text('transit', `${Math.floor(inTransit(game))} b em trânsito`);
  $('stock-bar').max = game.capacity; $('stock-bar').value = game.storage;
  text('concession', `${String(game.profile + 1).padStart(2, '0')} · ${PROFILES[game.profile].name.toUpperCase()}`);
  text('field-name', PROFILES[game.profile].name.toUpperCase()); text('seed-label', `#${game.seed}`);
  const old = game.history[Math.max(0, game.history.length - 8)] || game.prices;
  for (const target of ['west', 'east']) {
    text(`${target}-price`, '$ ' + number(game.prices[target], 2));
    const delta = game.prices[target] - old[target];
    text(`${target}-trend`, delta > .15 ? '↗ Subindo' : delta < -.15 ? '↘ Caindo' : '• Estável');
    $(target).classList.toggle('best', game.prices[target] >= game.prices[target === 'west' ? 'east' : 'west']);
  }
  for (const target of ['west', 'hold', 'east']) $(target).setAttribute('aria-pressed', String(game.target === target));
  for (const tool of ['scan', 'drill']) $(tool).setAttribute('aria-pressed', String(view.tool === tool));
  const rate = wellRate(game), transport = transportRate(game);
  text('flow', `Extração ${number(rate, 1)} b/s · Frota ≈${number(transport, 1)} b/s`);
  text('bottleneck', game.ended ? 'Terreno revelado' : game.target === 'hold' ? '▤ Armazenando' : game.storage >= game.capacity * .9 ? '⚠ Tanque cheio' : rate > transport ? '⇢ Reforce a frota' : game.wells.length ? `${game.trucks.length} veículo(s)` : '◎ Comece explorando');
  const tutorial = ['1/4 · Toque no círculo para explorar', '2/4 · Perfure a reserva descoberta', '3/4 · Sua perfuração está avançando', '4/4 · Acompanhe a primeira entrega', '✓ Primeira venda! Melhorias liberadas.'];
  text('field-badge', game.ended ? 'Concessão encerrada · todas as reservas reveladas' : game.paused ? 'Ⅱ Operação pausada' : game.tutorial >= 0 ? tutorial[game.tutorial] : view.tool === 'scan' ? '◎ Selecione uma área para sondar' : view.parentId !== null ? '↳ Agora selecione a reserva de destino' : '↧ Selecione uma reserva ou conexão');
  $('skip-tutorial').hidden = game.tutorial < 0 || game.tutorial >= 4 || game.ended;
  const preview = view.preview;
  $('confirm').hidden = !preview || game.ended;
  $('cancel').hidden = (!preview && view.parentId === null && view.selectedPocket === null) || game.ended;
  if (preview) {
    text('selection-title', preview.type === 'scan' ? `Sondagem · ${money(preview.cost)}` : `${preview.parentId === null ? 'Novo poço' : 'Ramificação'} · ${money(preview.cost)}`);
    text('selection-detail', preview.reason || (preview.type === 'scan' ? 'A área marcada será revelada.' : 'Custo total. Confirme para iniciar a perfuração.'));
    $('confirm').disabled = !preview.valid; text('confirm', 'Confirmar');
  } else if (view.selectedPocket !== null) {
    const p = game.pockets[view.selectedPocket], well = game.wells.find(w => w.pocketId === p.id);
    text('selection-title', `Reserva · ${Math.ceil(p.amount)} barris`);
    text('selection-detail', game.ended ? `Foram extraídos ${Math.floor(p.initial - p.amount)} de ${p.initial} barris desta reserva.` : view.parentId !== null ? 'Origem selecionada. Toque em outro bolsão para ramificar.' : well?.progress < 1 ? `Perfurando: ${Math.floor(well.progress * 100)}%. Aguarde para ramificar.` : p.amount <= 0 ? 'Reserva esgotada.' : 'Selecione Perfurar para conectar esta reserva.');
  } else {
    text('selection-title', game.ended ? 'O que ficou para a próxima história?' : 'Planeje antes de investir.');
    text('selection-detail', game.ended ? 'Abra o menu para rever o resultado.' : view.tool === 'scan' ? 'Toque no subsolo. Confira a área e confirme.' : 'Toque no petróleo. Confira o custo e confirme.');
  }
}

export function renderHome(progress, selected, mode, saved) {
  $('continue').hidden = !saved || saved.ended;
  $('profiles').replaceChildren(...PROFILES.map((profile, index) => {
    const button = document.createElement('button'); button.dataset.profile = String(index);
    button.setAttribute('aria-pressed', String(selected === index)); button.disabled = index > progress.unlocked;
    const number = document.createElement('b'); number.textContent = index > progress.unlocked ? '⌑' : progress.completed[index] ? '✓' : `0${index + 1}`;
    button.append(number, document.createTextNode(t(profile.name))); return button;
  }));
  text('profile-info', `${PROFILES[selected].novelty} Meta: ${money(PROFILES[selected].goal)} de lucro.`);
  $('tutorial').disabled = selected !== 0;
  for (const value of ['quick', 'classic']) $(value).setAttribute('aria-pressed', String(mode === value));
  text('credits', `${progress.credits} fichas`);
  $('research').replaceChildren(...Object.entries(RESEARCH).map(([type, item]) => {
    const button = document.createElement('button'); button.dataset.research = type;
    button.disabled = progress.credits < item.cost || progress.research[type] >= item.max;
    const label = document.createElement('span'); label.textContent = t(item.name);
    const detail = document.createElement('small'); detail.textContent = t(`${progress.research[type]}/${item.max} · ${progress.research[type] >= item.max ? 'Máximo' : `${item.cost} fichas`}`);
    button.append(label, detail); return button;
  }));
  text('record', `Melhor capital final: ${money(progress.best)}`);
}

export function renderUpgrades(game) {
  text('upgrade-summary', `Capital: ${money(game.cash)} · Tanque: ${game.capacity} b · Frota: ${game.trucks.length}/${CONFIG.truck.max}`);
  for (const type of ['tank', 'truck', 'bit']) {
    const quote = upgradeQuote(game, type);
    $(type).disabled = !quote.valid;
    text(`${type}-cost`, `${money(quote.cost)} · ${quote.reason || (type === 'tank' ? 'Mais espaço para esperar preços melhores.' : type === 'truck' ? `Carga de ${game.trucks[0].capacity} barris por viagem.` : 'Permite atravessar a camada de rocha.')}`);
  }
}

export function renderResult(game) {
  const result = metrics(game);
  text('result-title', result.profit >= 0 ? 'Uma marca de ouro.' : 'Cada terreno ensina.');
  text('result-medals', `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)} · ${PROFILES[game.profile].name}`);
  const entries = [
    ['Capital final', money(game.cash)], ['Lucro líquido', money(result.profit)], ['Receita de entregas', money(game.revenue)], ['Despesas', money(game.expenses)],
    ['Extraído / vendido', `${barrels(game.extracted)} / ${barrels(game.sold)} b`], ['Tanque / em trânsito', `${barrels(game.storage)} / ${barrels(inTransit(game))} b`],
    ['Aproveitamento', `${Math.round(result.recovery * 100)}%`], ['No subsolo', `${barrels(game.total - game.extracted)} b`],
  ];
  $('result-stats').replaceChildren(...entries.map(([label, value]) => {
    const block = document.createElement('div'), caption = document.createElement('span'), strong = document.createElement('strong'); caption.textContent = t(label); strong.textContent = value; block.append(caption, strong); return block;
  }));
  text('result-tip', result.tip);
  text('result-reward', `+${1 + result.stars} fichas para a oficina. Meta de lucro: ${money(PROFILES[game.profile].goal)} · Venda: 85% · Extração: 40%.`);
}
