import { RULES, REGIONS, TECHNOLOGIES, money, clamp } from './config.js';
import { explore, scanCost } from './exploration.js';
import { buildRig, pipeQuote, buildPipe, upgradePipe, togglePipe } from './pipes.js';
import { buyTruck, buildTank, upgradeStorage, assignTruck, storedOil, transitOil } from './logistics.js';
import { acceptContract } from './market.js';
import { gasQuote, connectGas, toggleGas } from './gas.js';
import { stepOperation, operationReport } from './simulation.js';
import { createCampaign, researchCost, buyTechnology, bank, startAuction, bid, finishAuction, leaseSafe, launchOperation, finishSeason, standings } from './campaign.js';
import { KEY, encode, decode } from './persistence.js';
import { decodeSave } from '../modules/persistence.js';
import { EnterpriseRenderer } from './renderer.js';

const $ = id => document.getElementById(id);
const text = (id, value) => { if ($(id).textContent !== String(value)) $(id).textContent = value; };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const disabled = value => value ? ' disabled' : '';
const item = (title, detail, actions = '') => `<div class="item"><h3>${escape(title)}</h3><p>${escape(detail)}</p>${actions}</div>`;
const action = (label, name, id, isDisabled = false) => `<button data-action="${name}" data-id="${escape(id)}"${disabled(isDisabled)}>${escape(label)}</button>`;
const sides = { west: 'Oeste', east: 'Leste', store: 'Guardar', idle: 'Parado' };
const phases = { idle: 'disponível', pickup: 'buscando', loading: 'carregando', delivery: 'em viagem', unloading: 'entregando', returning: 'retornando' };
let campaign, operation = null, locked = false, storageBlocked = false, lastSave = 0, lastUI = 0, lastPanels = 0, previous = performance.now(), accumulator = 0;
let townMessage = 'Reserve capital: cada expedição recebe $ 2.400 do patrimônio. Melhorias da oficina valem para novas operações.';
let view = { tool: 'scan', panel: 'explore', source: null, preview: null, cursor: { x: 180, y: 210 } };
let reportShown = false;
const renderer = new EnterpriseRenderer($('enterprise-canvas'));
function freshCampaign() {
  let legacy = null;
  try { const raw = localStorage.getItem('ouro-subsolo-save-v2'), old = decodeSave(raw); if (raw && !old.invalid) legacy = old.progress.research; } catch { /* Optional import; no legacy data is modified. */ }
  return createCampaign(crypto.getRandomValues(new Uint32Array(1))[0], legacy);
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const state = decode(raw);
      if (!state) { locked = true; campaign = freshCampaign(); $('recovery').showModal(); text('save-state', 'Salvamento inválido preservado. Nenhum dado foi substituído.'); return; }
      campaign = state.campaign; operation = state.operation;
      // Settled snapshots are accepted for recovery but always resume in town.
      if (operation?.settled) operation = null;
      text('save-state', 'Campanha retomada. A operação está pausada até você continuar.');
    } else { campaign = freshCampaign(); text('save-state', campaign.legacyImported ? 'Nova campanha. Melhorias compatíveis da oficina foram importadas.' : 'Nova campanha pronta.'); }
  } catch { storageBlocked = true; campaign = freshCampaign(); text('save-state', 'Armazenamento indisponível: esta campanha funciona apenas nesta sessão.'); }
}
function save() {
  if (locked || storageBlocked) return false;
  try { localStorage.setItem(KEY, encode(campaign, operation)); text('save-state', 'Campanha salva neste navegador · pausa automática ao sair da aba'); return true; }
  catch { text('save-state', 'Não foi possível salvar. Mantenha esta aba aberta para preservar a sessão.'); return false; }
}
function tell(message) { if (operation) text('operation-notice', message); else { townMessage = message; text('town-message', message); } }
function pause() { if (operation && !operation.ended) operation.paused = true; accumulator = 0; save(); updateHUD(); }
function showDialog(id) { pause(); $(id).showModal(); }
function renderTown() {
  const c = campaign, frozen = c.finished || !!c.auction || c.leased !== null;
  text('season-label', c.finished ? 'CAMPANHA ENCERRADA' : `TEMPORADA ${String(c.season + 1).padStart(2, '0')} / ${RULES.seasons} · ${REGIONS[c.region].name.toUpperCase()}`);
  text('region-tip', REGIONS[c.region].tip); text('wealth', money(c.cash)); text('debt', money(c.debt)); text('shares', `${c.shares}%`); text('town-message', townMessage);
  $('final-campaign').hidden = !c.finished;
  if (c.finished) { const winner = standings(c)[0]; text('winner', winner.player ? 'A cidade escolheu você!' : `${winner.name.split(' — ')[0]} conquistou a cidade.`); }
  $('plots').innerHTML = c.plots.map(p => `<button data-action="${p.id === 3 ? 'safe' : 'plot'}" data-id="${p.id}"${disabled(frozen || p.owner !== null)}><b>${p.id === 3 ? 'Lote municipal · $ 300' : `Concessão ${p.id + 1} · leilão`}</b><small>Indícios: ${'◆'.repeat(p.rating)}${'◇'.repeat(3 - p.rating)} · ${p.owner === null ? 'disponível' : p.owner === 'player' ? 'seu terreno' : escape(c.rivals[p.owner].name.split(' — ')[0])}</small></button>`).join('');
  $('difficulty').value = c.difficulty; $('difficulty').disabled = frozen;
  $('launch').disabled = c.finished || c.leased === null || !!c.auction || c.cash < RULES.operationBudget;
  text('launch', c.leased === null ? 'Arrende um terreno para começar' : `Iniciar operação · investir ${money(RULES.operationBudget)}`);
  $('auction').hidden = !c.auction;
  if (c.auction) {
    const a = c.auction, leader = a.leader === null ? 'Sem lances' : a.leader === 'player' ? 'Você lidera' : `${c.rivals[a.leader].name} lidera`;
    text('auction-title', a.type === 'shares' ? 'Leilão de 5% da cidade' : `Concessão ${a.plotId + 1}`);
    text('auction-detail', `${leader} · ${money(a.bid)}. Encerrar confirma a compra para quem lidera.`);
    text('bid', `Oferecer ${money(a.bid + (a.leader === null ? 0 : 100))}`);
    $('bid').disabled = c.cash < a.bid + (a.leader === null ? 0 : 100) + RULES.operationBudget + (a.type === 'shares' ? 300 : 0);
  }
  $('technologies').innerHTML = Object.entries(TECHNOLOGIES).map(([key, tech]) => item(`${tech.name} · ${c.tech[key]}/${tech.max}`, tech.description, action(c.tech[key] >= tech.max ? 'Máximo' : `Pesquisar · ${money(researchCost(c, key))}`, 'research', key, frozen || c.tech[key] >= tech.max || c.cash < researchCost(c, key)))).join('');
  $('shares-auction').disabled = frozen || c.shareAuctionDone;
  $('borrow').disabled = frozen || c.debt > 4000; $('repay').disabled = frozen || c.debt <= 0 || c.cash <= 0;
  $('rivals').innerHTML = standings(c).map((r, i) => item(`${i + 1}. ${r.name}`, `${r.shares}% da cidade · patrimônio líquido ${money(r.wealth)}`)).join('');
  $('season-history').innerHTML = c.history.length ? [...c.history].reverse().map(h => item(`Temporada ${h.season + 1} · ${REGIONS[h.region].name}`, `Resultado após terreno: ${money(h.profit)} · ${h.medals} medalha(s) · bônus ${money(h.bonus)} · ${h.sold.toFixed(0)} b vendidos`)).join('') : '<p>Seu primeiro resultado aparecerá aqui.</p>';
}
function showScreen() {
  $('town').hidden = !!operation; $('operation').hidden = !operation;
  if (operation) { renderer.resize(); updateHUD(); renderPanels(true); if (operation.ended && !reportShown) renderReport(); }
  else renderTown();
}
function setPanel(panel) {
  view.panel = panel;
  for (const button of document.querySelectorAll('[data-panel]')) button.setAttribute('aria-pressed', String(button.dataset.panel === panel));
  for (const key of ['explore', 'network', 'fleet', 'market', 'gas', 'goals']) $(`panel-${key}`).hidden = key !== panel;
  renderPanels(true);
}
function selectTool(tool) {
  view.tool = tool; view.preview = null;
  for (const button of document.querySelectorAll('[data-tool]')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  updatePreview();
  tell({ scan: 'Toque no subsolo para pré-visualizar a sondagem.', prospector: 'Toque na coluna onde deseja pesquisar. O prospector trabalha na superfície.', probe: 'Toque no início do trajeto da sonda.', rig: 'Toque em um espaço livre na superfície para instalar a torre.', pipe: 'Selecione uma origem e toque no destino do próximo segmento.', tank: 'Toque em um espaço livre na superfície para construir o tanque.', gas: 'Toque em uma bolsa de gás descoberta. Escolha o comprador no painel.' }[tool]);
}
function selectPoint(point) {
  const o = operation;
  if (!o || o.ended) return;
  const { x, y } = point, tool = view.tool;
  if (x < 0 || x > 960 || y < 0 || y > 600) return;
  view.cursor = point;
  if (tool === 'pipe') {
    const node = o.nodes.map(n => ({ n, distance: Math.hypot(n.x - x, n.y - y) })).filter(entry => entry.distance <= Math.min(25, 18 / renderer.scale)).sort((a, b) => a.distance - b.distance)[0]?.n;
    if (node) { view.source = node.id; view.preview = null; renderPanels(true); tell(`Junção ${node.id + 1} selecionada. Toque no destino.`); updatePreview(); return; }
    const q = pipeQuote(o, view.source, x, y); view.preview = { ...point, ...q, tool, source: view.source };
  } else if (tool === 'gas') {
    const pocket = o.pockets.filter(p => p.revealed && p.kind === 'gas' && Math.hypot(p.x - x, p.y - y) <= p.rx + 15).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    const side = $('gas-side').value, q = gasQuote(o, pocket?.id, side); view.preview = { ...point, ...q, tool, side };
  } else {
    const radius = Number($('scan-radius').value), cost = tool === 'scan' ? scanCost(radius) : tool === 'prospector' ? RULES.prospectorCost : tool === 'probe' ? RULES.probeCost : tool === 'rig' ? RULES.rigCost : RULES.tankCost;
    const surface = ['rig', 'tank'].includes(tool), within = surface ? x >= 70 && x <= 890 && y < 155 : x >= 20 && x <= 940 && (tool === 'prospector' || y >= 120 && y <= 580);
    view.preview = { tool, x, y: tool === 'prospector' ? Math.max(120, Math.min(580, y)) : y, radius, cost, ok: within && o.cash >= cost, message: !within ? surface ? 'Escolha a superfície, longe dos compradores.' : 'Escolha uma área dentro do subsolo.' : o.cash < cost ? 'Capital insuficiente.' : surface ? 'Posição e espaço livre serão conferidos na confirmação.' : tool === 'scan' ? 'O scanner só revela o conteúdo após confirmar a compra.' : 'A pesquisa leva tempo. A descoberta não é garantida neste ponto.' };
  }
  updatePreview();
}
function updatePreview() {
  const p = view.preview;
  $('confirm-action').hidden = !p; $('cancel-action').hidden = !p;
  if (!p) { text('preview-title', operation?.ended ? 'Concessão encerrada. Inspecione o que restou.' : 'Planeje a próxima ação.'); text('preview-detail', operation?.ended ? 'O botão de balanço permite receber o resultado e voltar à cidade.' : `Ferramenta: ${({ scan: 'scanner', prospector: 'prospector', probe: 'sonda', rig: 'torre', pipe: 'tubulação', tank: 'tanque', gas: 'gás' })[view.tool]}. Use os painéis para administrar sua operação.`); return; }
  text('preview-title', `${money(p.cost || 0)} · ${({ scan: 'Sondagem', prospector: 'Prospector', probe: 'Sonda', rig: 'Torre', pipe: 'Segmento de tubo', tank: 'Tanque', gas: 'Linha de gás' })[p.tool]}`);
  text('preview-detail', p.message); $('confirm-action').disabled = !p.ok || operation.ended;
}
function confirmAction() {
  const p = view.preview, o = operation;
  if (!p || !p.ok || !o || o.ended) return;
  let result;
  if (['scan', 'prospector', 'probe'].includes(p.tool)) result = explore(o, p.tool, p.x, p.y, p.radius);
  else if (p.tool === 'rig') result = buildRig(o, p.x);
  else if (p.tool === 'pipe') result = buildPipe(o, p.source, p.x, p.y);
  else if (p.tool === 'tank') { const ok = buildTank(o, p.x); result = { ok, message: ok ? 'Tanque instalado. Designe veículos para Guardar.' : 'Capital insuficiente, limite atingido ou espaço ocupado.' }; }
  else result = connectGas(o, p.pocketId, p.side);
  if (result.nodeId !== undefined) view.source = result.nodeId;
  if (result.ok) {
    view.preview = null;
    if (p.tool === 'rig') { selectTool('pipe'); setPanel('network'); }
    save(); renderPanels(true);
  }
  tell(result.message || 'Ação indisponível.'); updatePreview(); updateHUD();
}
function updateHUD() {
  const o = operation; if (!o) return;
  text('operation-region', `${REGIONS[o.region].name.toUpperCase()} · TEMPORADA ${o.season + 1} · ${o.difficulty === 'enterprise' ? 'EMPRESARIAL' : 'TRANQUILA'}`);
  text('operation-cash', money(o.cash)); const time = Math.ceil(o.time); text('operation-time', `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`);
  text('operation-oil', `${Math.floor(o.sold)} / ${Math.floor(o.extracted)} b`); text('operation-loss', `${o.spilled.toFixed(1)} b`);
  text('pause-operation', o.ended ? 'Ver balanço' : o.paused ? '▶ Continuar' : 'Ⅱ Pausar');
  $('end-operation').disabled = o.ended; $('paused-label').hidden = !o.paused || o.ended;
  if (o.notices.length) { tell(o.notices.at(-1)); o.notices = []; }
  text('scan-price', `${$('scan-radius').value} unidades · ${money(scanCost(Number($('scan-radius').value)))}`);
}
function renderPanels(force = false) {
  const o = operation; if (!o) return;
  const panel = $(`panel-${view.panel}`);
  if (!force && panel.contains(document.activeElement)) return;
  if (view.panel === 'explore') {
    $('discoveries').innerHTML = o.pockets.filter(p => p.revealed).map(p => item(`${p.kind === 'oil' ? 'Reserva' : p.kind === 'gas' ? 'Gás' : 'Amostra'} ${p.id + 1}`, p.kind === 'relic' ? 'Coletada: +$ 350 no balanço.' : `${Math.ceil(p.amount)} ${p.kind === 'gas' ? 'unidades' : 'barris'} · profundidade ${Math.round(p.y - RULES.surface)}`, p.kind === 'relic' ? '' : action('Selecionar no campo', 'aim', p.id, o.ended))).join('') || '<p>Nenhuma reserva descoberta. Comece perto da bandeira.</p>';
  } else if (view.panel === 'network') {
    $('pipe-source').innerHTML = '<option value="">Selecione uma origem</option>' + o.nodes.map(n => `<option value="${n.id}"${view.source === n.id ? ' selected' : ''}>${n.y === RULES.surface ? 'Torre' : 'Junção'} ${n.id + 1} · ${Math.round(n.x)}, ${Math.round(n.y)}</option>`).join('');
    $('network-list').innerHTML = [...o.rigs.map(r => item(`Torre ${r.id + 1} · ${Math.floor(r.storage)}/${r.capacity} b`, `Bomba: ${RULES.rigRate + r.level * 2} b/s · ${r.fullTime > 0 ? 'Atenção: reservatório cheio' : 'reservatório operacional'}`, action(`Ampliar bomba e reservatório · ${money(180 * (r.level + 1))}`, 'rig-upgrade', r.id, o.ended || r.level >= 3 || o.cash < 180 * (r.level + 1)))), ...o.tanks.map(t => item(`Tanque ${t.id + 1} · ${Math.floor(t.storage)}/${t.capacity} b`, `Ampliação ${t.level}/3`, action(`+120 b · ${money(180 * (t.level + 1))}`, 'tank-upgrade', t.id, o.ended || t.level >= 3 || o.cash < 180 * (t.level + 1)))), ...o.edges.map(e => item(`Tubo ${e.id + 1} · junção ${e.from + 1} → ${e.to + 1}`, `${Math.floor(e.progress * 100)}% construído · ${RULES.pipeCapacity * (e.level + 1)} b/s · válvula ${e.open ? 'aberta' : 'fechada'}`, `<div class="button-row">${action(e.open ? 'Fechar' : 'Abrir', 'pipe-toggle', e.id, o.ended)}${action(`Ampliar · ${money(100 * (e.level + 1))}`, 'pipe-upgrade', e.id, o.ended || e.level >= 2 || o.cash < 100 * (e.level + 1))}</div>`))].join('') || '<p>Instale sua primeira torre na superfície.</p>';
  } else if (view.panel === 'fleet') {
    const cost = RULES.truckCost + o.trucks.length * 50;
    text('buy-truck', `Comprar veículo ${o.trucks.length}/${RULES.maxTrucks} · ${money(cost)}`); $('buy-truck').disabled = o.ended || o.trucks.length >= RULES.maxTrucks || o.cash < cost;
    $('fleet-list').innerHTML = o.trucks.map(t => item(`Veículo ${t.id + 1} · ${phases[t.phase]}`, `${t.cargo.toFixed(1)}/${t.capacity} b${t.destination ? ` · entrega atual: ${t.destination.kind === 'buyer' ? sides[t.destination.id] : 'tanque ' + (t.destination.id + 1)}` : ''}`, `<label>Próxima tarefa<select data-truck="${t.id}"${disabled(o.ended)}>${Object.entries(sides).map(([key, name]) => `<option value="${key}"${t.task === key ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`)).join('');
  } else if (view.panel === 'market') {
    $('market-list').innerHTML = ['west', 'east'].map(side => {
      const recent = o.history[Math.max(0, o.history.length - 8)]?.[side] ?? o.prices[side], delta = o.prices[side] - recent;
      const spark = o.history.slice(-22).map(p => '▁▂▃▄▅▆▇█'[clamp(Math.floor((p[side] - 3) / 2), 0, 7)]).join('');
      return item(`${sides[side]} · $ ${o.prices[side].toFixed(2)}/b`, `${delta > .15 ? '↗ Subindo' : delta < -.15 ? '↘ Caindo' : 'Estável'} · gás +$ ${o.gasBoost[side].toFixed(2)}/b`, `<div class="sparkline" aria-label="Histórico recente de preços">${spark}</div>`);
    }).join('');
    $('contract-list').innerHTML = o.contracts.map(c => item(`${sides[c.side]} · ${c.volume} b · bônus ${money(c.bonus)}`, `${({ offered: 'Disponível', active: 'Ativo', completed: 'Cumprido', expired: 'Expirado' })[c.status]} · ${Math.floor(c.delivered)} b entregues · prazo: ${Math.max(0, Math.ceil(c.deadline - o.elapsed))} s`, action('Aceitar contrato', 'contract', c.id, o.ended || c.status !== 'offered' || o.elapsed >= c.deadline - 20 || o.contracts.some(contract => contract.status === 'active')))).join('');
  } else if (view.panel === 'gas') {
    $('gas-list').innerHTML = !o.tech.gas ? '<p>Pesquise Válvulas de gás na cidade para usar este sistema. Bolsas aparecem nas duas últimas regiões.</p>' : o.gasLines.map(l => item(`Linha ${l.id + 1} → ${sides[l.side]}`, `${Math.floor(l.progress * 100)}% construída · ${Math.ceil(o.pockets[l.pocketId].amount)} unidades restantes · ${l.open ? 'aberta' : 'fechada'}`, action(l.open ? 'Fechar válvula' : 'Abrir válvula', 'gas-toggle', l.id, o.ended || l.progress < 1 || o.pockets[l.pocketId].amount <= 0))).join('') || '<p>Descubra uma bolsa de gás e conecte-a a um comprador.</p>';
  } else {
    const r = operationReport(o), goals = [ ['Lucro da operação', r.profit, r.goal, money], ['Venda eficiente', o.sold, Math.max(50, o.extracted * .85), value => `${Math.ceil(value)} b`], ['Extração do terreno', o.extracted, o.totalOil * .4, value => `${Math.ceil(value)} b`] ];
    $('goals-list').innerHTML = goals.map(([label, current, target, format], i) => item(`${r.medals[i] ? '★' : '☆'} ${label}`, `${format(current)} / ${format(target)}`, `<progress aria-label="${label}" max="${target}" value="${Math.max(0, current)}"></progress>`)).join('') + item('Logística e perdas', `Armazenado: ${storedOil(o).toFixed(1)} b · em trânsito: ${transitOil(o).toFixed(1)} b · multas: ${money(o.fines)} · contratos: ${money(o.bonuses)}`);
  }
}
function renderReport() {
  if (!operation?.ended) return;
  reportShown = true; const o = operation, r = operationReport(o);
  text('report-title', `${'★'.repeat(r.medals.filter(Boolean).length)}${'☆'.repeat(3 - r.medals.filter(Boolean).length)} · ${r.profit >= 0 ? 'Seu trabalho rendeu.' : 'Um terreno para aprender.'}`);
  const rows = [['Capital devolvido', money(o.cash)], ['Lucro da operação', money(r.profit)], ['Vendas', money(o.revenue)], ['Construções e pesquisas', money(o.expenses)], ['Contratos', money(o.bonuses)], ['Multas', money(o.fines)], ['Vendido / extraído', `${Math.floor(o.sold)} / ${Math.floor(o.extracted)} b`], ['Derramado', `${o.spilled.toFixed(1)} b`], ['Estoque / trânsito', `${Math.floor(r.stored)} / ${Math.floor(r.transit)} b`], ['Medalhas e amostras', money(r.reward)]];
  $('report-stats').innerHTML = rows.map(([label, value]) => `<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
  text('report-summary', `O terreno foi revelado. Estoque e cargas não entregues não rendem receita. Ao voltar: ${money(o.cash + r.reward)} entram no patrimônio; a dívida recebe 5% de juros. O arrendamento já foi pago na cidade.`);
  if (!$('report').open) $('report').showModal(); save();
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || button.disabled || locked && !['retry-save', 'reset-invalid', 'confirm-new', 'cancel-new'].includes(button.id)) return;
  if (button.dataset.panel) { setPanel(button.dataset.panel); return; }
  if (button.dataset.tool) { selectTool(button.dataset.tool); return; }
  const name = button.dataset.action, id = button.dataset.id;
  if (!name) return;
  if (!operation) {
    let ok = false;
    if (name === 'plot') ok = startAuction(campaign, 'plot', Number(id));
    if (name === 'safe') ok = leaseSafe(campaign);
    if (name === 'research') ok = buyTechnology(campaign, id);
    townMessage = ok ? name === 'research' ? 'Tecnologia adquirida. Ela estará disponível nas próximas operações.' : name === 'safe' ? 'Concessão municipal arrendada. Prepare-se para iniciar.' : 'Leilão aberto. Os rivais respondem a cada lance.' : 'Ação indisponível. Confira o capital e o estado do leilão.';
    save(); renderTown(); return;
  }
  const o = operation; if (o.ended) return;
  let ok = false;
  if (name === 'aim') { const p = o.pockets[Number(id)]; if (p?.revealed) { setPanel(p.kind === 'gas' ? 'gas' : 'network'); selectTool(p.kind === 'gas' ? 'gas' : 'pipe'); selectPoint({ x: p.x, y: p.y }); } return; }
  if (name === 'pipe-upgrade') ok = upgradePipe(o, Number(id));
  if (name === 'pipe-toggle') ok = togglePipe(o, Number(id));
  if (name === 'rig-upgrade' || name === 'tank-upgrade') ok = upgradeStorage(o, name.split('-')[0], Number(id));
  if (name === 'gas-toggle') ok = toggleGas(o, Number(id));
  if (name === 'contract') ok = acceptContract(o, Number(id));
  tell(ok ? 'Operação atualizada.' : 'Ação indisponível. Confira capital, construção e limites.'); save(); updateHUD(); renderPanels(true);
});
$('difficulty').addEventListener('change', () => { if (!operation && campaign.leased === null && !campaign.auction) { campaign.difficulty = $('difficulty').value; save(); } });
for (const [id, callback] of Object.entries({
  bid: () => bid(campaign), 'finish-auction': () => finishAuction(campaign), 'shares-auction': () => startAuction(campaign, 'shares'), borrow: () => bank(campaign, 'borrow'), repay: () => bank(campaign, 'repay'),
})) $(id).addEventListener('click', () => { if (operation || locked) return; const ok = callback(); townMessage = ok ? 'Patrimônio e decisões atualizados.' : 'Ação indisponível. Preserve capital para operar.'; save(); renderTown(); });
$('launch').addEventListener('click', () => {
  if (operation || locked) return;
  operation = launchOperation(campaign); if (!operation) return;
  view = { tool: 'scan', panel: 'explore', source: null, preview: null, cursor: { x: 180, y: 210 } }; reportShown = false;
  renderer.setZoom(1); renderer.pan = { x: 0, y: 0 }; previous = performance.now(); accumulator = 0; setPanel('explore'); selectTool('scan'); showScreen(); save();
});
$('confirm-action').addEventListener('click', confirmAction);
$('cancel-action').addEventListener('click', () => { view.preview = null; updatePreview(); tell('Prévia cancelada. Nenhum custo cobrado.'); });
$('pipe-source').addEventListener('change', () => { view.source = $('pipe-source').value === '' ? null : Number($('pipe-source').value); selectTool('pipe'); });
$('scan-radius').addEventListener('input', () => { if (view.preview?.tool === 'scan') selectPoint(view.preview); updateHUD(); });
$('gas-side').addEventListener('change', () => { if (view.preview?.tool === 'gas') selectPoint(view.preview); });
$('fleet-list').addEventListener('change', event => { if (event.target.matches('[data-truck]')) { assignTruck(operation, Number(event.target.dataset.truck), event.target.value); save(); renderPanels(true); } });
$('buy-truck').addEventListener('click', () => { tell(buyTruck(operation) ? 'Veículo contratado. Escolha sua tarefa.' : 'Não foi possível contratar.'); save(); updateHUD(); renderPanels(true); });
$('pause-operation').addEventListener('click', () => { if (!operation) return; if (operation.ended) { renderReport(); return; } operation.paused = !operation.paused; accumulator = 0; previous = performance.now(); updateHUD(); save(); });
$('end-operation').addEventListener('click', () => showDialog('confirm-end'));
$('keep-operation').addEventListener('click', () => $('confirm-end').close());
$('finish-now').addEventListener('click', () => { $('confirm-end').close(); operation.time = 0; operation.elapsed = operation.duration; operation.ended = true; operation.paused = true; view.preview = null; updatePreview(); updateHUD(); renderPanels(true); renderReport(); });
$('inspect-operation').addEventListener('click', () => $('report').close());
$('return-town').addEventListener('click', () => {
  if (!finishSeason(campaign, operation)) { tell('Esta operação já foi contabilizada.'); return; }
  operation = null; $('report').close(); townMessage = 'Resultado recebido. Rivais atualizaram seus investimentos e a próxima concessão está disponível.'; save(); showScreen();
});
$('manual-button').addEventListener('click', () => { if (!locked) showDialog('manual'); });
$('close-manual').addEventListener('click', () => $('manual').close());
$('new-button').addEventListener('click', () => { if (!locked) showDialog('new-campaign'); });
$('cancel-new').addEventListener('click', () => { $('new-campaign').close(); if (locked && !$('recovery').open) $('recovery').showModal(); });
$('confirm-new').addEventListener('click', () => {
  for (const dialog of document.querySelectorAll('dialog')) dialog.close();
  campaign = freshCampaign(); operation = null; locked = false; reportShown = false; townMessage = 'Uma nova história começa. Escolha seus investimentos e sua primeira concessão.'; save(); showScreen();
});
$('retry-save').addEventListener('click', () => { $('recovery').close(); locked = false; load(); if (!locked) showScreen(); });
$('reset-invalid').addEventListener('click', () => { $('recovery').close(); $('new-campaign').showModal(); });
$('recovery').addEventListener('cancel', event => event.preventDefault());
$('new-campaign').addEventListener('cancel', event => { if (locked) { event.preventDefault(); $('cancel-new').click(); } });
for (const [id, delta] of [['zoom-in', .5], ['zoom-out', -.5]]) $(id).addEventListener('click', () => { renderer.setZoom(renderer.zoom + delta); text('zoom-level', `${renderer.zoom}×`); });
let pointer = null;
$('enterprise-canvas').addEventListener('pointerdown', event => {
  if (pointer || event.button !== 0) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false };
  event.currentTarget.setPointerCapture(event.pointerId);
});
$('enterprise-canvas').addEventListener('pointermove', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 8) pointer.dragged = true;
  if (pointer.dragged) { renderer.pan.x += event.clientX - pointer.x; renderer.pan.y += event.clientY - pointer.y; renderer.camera(); }
  pointer.x = event.clientX; pointer.y = event.clientY;
});
$('enterprise-canvas').addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (!pointer.dragged) selectPoint(renderer.world(event.clientX, event.clientY)); pointer = null;
});
for (const name of ['pointercancel', 'lostpointercapture']) $('enterprise-canvas').addEventListener(name, () => { pointer = null; });
$('enterprise-canvas').addEventListener('keydown', event => {
  if (event.key === 'Escape') { view.preview = null; updatePreview(); return; }
  const direction = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
  if (direction) { event.preventDefault(); view.cursor = { x: clamp(view.cursor.x + direction[0], 15, 945), y: clamp(view.cursor.y + direction[1], 20, 580) }; }
  if (event.key === 'Enter') { event.preventDefault(); selectPoint(view.cursor); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); previous = performance.now(); accumulator = 0; });
window.addEventListener('pagehide', save);
window.addEventListener('error', () => { if (operation) operation.paused = true; text('save-state', 'A operação foi pausada após um erro. Recarregue para retomar o último salvamento.'); });
function frame(now) {
  const elapsed = Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now;
  if (operation && !locked && !document.hidden) {
    if (!operation.paused && !operation.ended) {
      accumulator += elapsed;
      while (accumulator >= RULES.step) { stepOperation(operation); accumulator -= RULES.step; }
    } else accumulator = 0;
    renderer.draw(operation, view);
    if (now - lastUI > 150) { updateHUD(); lastUI = now; }
    if (now - lastPanels > 900) { renderPanels(); lastPanels = now; }
    if (now - lastSave > 5000) { save(); lastSave = now; }
    if (operation.ended && !reportShown) { view.preview = null; updatePreview(); renderReport(); }
  }
  requestAnimationFrame(frame);
}
load(); showScreen(); requestAnimationFrame(frame);
