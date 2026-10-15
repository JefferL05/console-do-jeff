import { RULES, REGIONS, TECHNOLOGIES, money, clamp } from './config.js';
import { explore, scanCost } from './exploration.js';
import { buildRig, pipeQuote, buildPipe, routeQuote, buildRoute, upgradePipe, togglePipe } from './pipes.js';
import { buyTruck, buildTank, upgradeStorage, assignTruck, storedOil, transitOil } from './logistics.js';
import { acceptContract } from './market.js';
import { gasQuote, connectGas, toggleGas } from './gas.js';
import { stepOperation, operationReport } from './simulation.js';
import { createCampaign, researchCost, buyTechnology, bank, startAuction, bid, finishAuction, leaseSafe, launchOperation, finishSeason, standings } from './campaign.js';
import { encode, decode } from './persistence.js';
import { SLOTS, ACTIVE_SLOT, slotKey, writeSlot, restoreSlot, importSlot, slotSummary } from './storage.js';
import { tutorialStep, contractTerms, productiveReserves } from './progression.js';
import { networkDiagnostics, deliveryEstimate, debrief } from './diagnostics.js';
import { rivalComment } from './rivals.js';
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
let view = { tool: 'scan', panel: 'explore', source: null, preview: null, route: [], cursor: { x: 180, y: 210 } };
let activeSlot = 0, pendingImport = null;
try { const slot = Number(localStorage.getItem(ACTIVE_SLOT)); if (Number.isInteger(slot) && slot >= 0 && slot < SLOTS.length) activeSlot = slot; } catch { /* Main load reports unavailable storage. */ }
let reportShown = false;
const renderer = new EnterpriseRenderer($('enterprise-canvas'));
function freshCampaign() {
  let legacy = null;
  try { const raw = localStorage.getItem('ouro-subsolo-save-v2'), old = decodeSave(raw); if (raw && !old.invalid) legacy = old.progress.research; } catch { /* Optional import; no legacy data is modified. */ }
  return createCampaign(crypto.getRandomValues(new Uint32Array(1))[0], legacy);
}
function load() {
  operation = null; reportShown = false; locked = false; storageBlocked = false;
  view.preview = null; view.source = null; view.route = [];
  try {
    const raw = localStorage.getItem(slotKey(activeSlot));
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
  try { writeSlot(localStorage, activeSlot, encode(campaign, operation)); text('save-state', `Espaço ${activeSlot + 1} salvo às ${new Date().toLocaleTimeString('pt-BR')} · cópia anterior preservada`); return true; }
  catch { text('save-state', 'Não foi possível salvar. Mantenha esta aba aberta para preservar a sessão.'); return false; }
}
function tell(message) { if (operation) text('operation-notice', message); else { townMessage = message; text('town-message', message); } }
function pause() { if (operation && !operation.ended) operation.paused = true; accumulator = 0; save(); updateHUD(); }
function showDialog(id) { pause(); $(id).showModal(); }
function focusField(point) {
  view.cursor = { x: point.x, y: point.y };
  renderer.focusPoint(point.x, point.y, Math.max(renderer.zoom, innerWidth < 760 ? 2.5 : 1.5));
  text('zoom-level', `${renderer.zoom}×`);
  $('enterprise-canvas').scrollIntoView({ block: 'center', behavior: 'auto' });
  $('enterprise-canvas').focus({ preventScroll: true });
}
function renderSlots() {
  try {
    $('save-slots').innerHTML = SLOTS.map((_, slot) => {
      const s = slotSummary(localStorage, slot);
      const detail = s.empty ? 'Espaço livre' : s.valid ? `Temporada ${Math.min(10, s.season + 1)} · ${money(s.wealth)}${s.backup ? ' · cópia disponível' : ''}` : `Save inválido${s.backup ? ' · cópia disponível para recuperação' : ''}`;
      return `<button data-slot="${slot}" aria-pressed="${slot === activeSlot}"><b>Campanha ${slot + 1}${slot === activeSlot ? ' · atual' : ''}</b><small>${escape(detail)}</small></button>`;
    }).join('');
    $('restore-backup').disabled = !slotSummary(localStorage, activeSlot).backup;
  } catch { text('slot-message', 'Armazenamento indisponível. Exporte a sessão atual para guardá-la.'); $('restore-backup').disabled = true; }
  $('export-save').disabled = locked;
}
function openSaves() { if (!locked) pause(); if ($('recovery').open) $('recovery').close(); renderSlots(); $('saves-dialog').showModal(); }
function restoreBackup() {
  try {
    restoreSlot(localStorage, activeSlot);
    for (const dialog of document.querySelectorAll('dialog')) dialog.close();
    load(); showScreen(); text('save-state', `Espaço ${activeSlot + 1}: cópia anterior recuperada. A operação foi pausada.`);
  } catch (error) { text($('saves-dialog').open ? 'slot-message' : 'save-state', error.message); }
}
function renderTown() {
  const c = campaign, frozen = c.finished || !!c.auction || c.leased !== null;
  text('season-label', c.finished ? 'CAMPANHA ENCERRADA' : `TEMPORADA ${String(c.season + 1).padStart(2, '0')} / ${RULES.seasons} · ${REGIONS[c.region].name.toUpperCase()}`);
  text('region-tip', REGIONS[c.region].tip); text('wealth', money(c.cash)); text('debt', money(c.debt)); text('shares', `${c.shares}%`); text('town-message', townMessage);
  document.body.dataset.region = String(c.region);
  text('town-growth', `Cidade ${c.season < 3 ? 'pioneira' : c.season < 7 ? 'em expansão' : 'industrial'} · ${c.season} temporada(s) concluída(s)`);
  $('town-skyline').innerHTML = Array.from({ length: 4 + c.season }, (_, i) => {
    const x = i * 39 + 5, height = 25 + (i * 19 + c.season * 3) % 65;
    return `<rect x="${x}" y="${115 - height}" width="30" height="${height}" rx="2" fill="#a7b98b"/><path d="M${x - 3} ${115 - height}L${x + 15} ${103 - height}L${x + 33} ${115 - height}Z" fill="#d4b579"/><rect x="${x + 5}" y="${122 - height}" width="5" height="7" fill="#f9d990"/><rect x="${x + 20}" y="${122 - height}" width="5" height="7" fill="#f9d990"/>`;
  }).join('');
  $('guide-enabled').checked = c.guide ?? false; $('guide-enabled').disabled = frozen;
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
  $('rivals').innerHTML = standings(c).map((r, i) => {
    const rival = c.rivals.find(other => other.name === r.name);
    if (!rival) return item(`${i + 1}. ${r.name}`, `${r.shares}% da cidade · patrimônio líquido ${money(r.wealth)}`);
    const colors = { careful: ['#526d5c', '#c89d73', '#4b3428'], expansion: ['#956248', '#dfb18a', '#4d4835'], speculator: ['#6b6685', '#b98561', '#242e33'] }[rival.style];
    const portrait = `<svg class="rival-portrait" viewBox="0 0 60 70" aria-hidden="true"><rect width="60" height="70" rx="12" fill="${colors[0]}"/><path d="M9 70Q9 45 30 45Q51 45 51 70" fill="${colors[2]}"/><ellipse cx="30" cy="30" rx="14" ry="18" fill="${colors[1]}"/><path d="M15 25Q14 5 30 8Q47 5 46 25L39 17L21 20Z" fill="${colors[2]}"/><circle cx="25" cy="30" r="1.5" fill="#24352b"/><circle cx="36" cy="30" r="1.5" fill="#24352b"/><path d="M25 40Q30 44 36 39" fill="none" stroke="#653f2c" stroke-width="2"/>${rival.style === 'expansion' ? '<path d="M9 20H51M17 19V9H42V19" stroke="#eacb83" fill="#c19857" stroke-width="4"/>' : rival.style === 'speculator' ? '<circle cx="36" cy="30" r="5" stroke="#ebd297" fill="none"/>' : ''}</svg>`;
    return `<div class="item rival-card">${portrait}<div><h3>${escape(`${i + 1}. ${r.name}`)}</h3><p>${r.shares}% · patrimônio ${money(r.wealth)} · resultado anterior ${money(rival.lastProfit)}</p><p class="rival-quote">“${escape(rivalComment(rival))}”</p></div></div>`;
  }).join('');
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
  view.tool = tool; view.preview = null; view.route = [];
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
    if (node && !view.route.length) { view.source = node.id; view.preview = null; renderPanels(true); tell(`Junção ${node.id + 1} selecionada. Toque no destino.`); updatePreview(); return; }
    if ($('route-mode').checked) {
      const points = [...view.route, point], q = routeQuote(o, view.source, points);
      if (!q.ok) { tell(q.message); return; }
      view.route = q.segments.map(s => ({ x: s.x, y: s.y }));
      view.preview = { ...view.route.at(-1), ...q, tool, source: view.source, route: true };
    } else { const q = pipeQuote(o, view.source, x, y); view.preview = { ...point, ...q, tool, source: view.source }; }
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
  $('undo-route').hidden = !view.route.length;
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
  else if (p.tool === 'pipe') result = p.route ? buildRoute(o, p.source, view.route) : buildPipe(o, p.source, p.x, p.y);
  else if (p.tool === 'tank') { const ok = buildTank(o, p.x); result = { ok, message: ok ? 'Tanque instalado. Designe veículos para Guardar.' : 'Capital insuficiente, limite atingido ou espaço ocupado.' }; }
  else result = connectGas(o, p.pocketId, p.side);
  if (result.nodeId !== undefined) view.source = result.nodeId;
  if (result.ok) {
    view.preview = null; view.route = [];
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
  const diagnostics = networkDiagnostics(o), full = o.rigs.filter(r => r.storage >= r.capacity * .9);
  text('network-alert', full.length ? `⚠ Torre(s) ${full.map(r => r.id + 1).join(', ')} perto de encher. Reforce a frota ou feche válvulas.` : diagnostics.limited.length ? `⚠ Tubo(s) ${diagnostics.limited.map(id => id + 1).join(', ')} limitam a rede. Compare demanda e capacidade em Rede.` : 'Fluxo, capacidade e tempo estimado de entrega estão nos painéis Rede e Frota.');
  const guide = tutorialStep(o);
  $('tutorial-card').hidden = !guide;
  document.querySelectorAll('.guide-target').forEach(node => node.classList.remove('guide-target'));
  if (guide) {
    text('tutorial-title', guide.title); text('tutorial-detail', guide.detail);
    document.querySelector(guide.target)?.classList.add('guide-target');
    text('tutorial-action', guide.index === 6 ? 'Acompanhar metas' : 'Mostrar próximo passo');
  }
}
function renderPanels(force = false) {
  const o = operation; if (!o) return;
  const panel = $(`panel-${view.panel}`);
  if (!force && panel.contains(document.activeElement)) return;
  if (view.panel === 'explore') {
    $('discoveries').innerHTML = o.pockets.filter(p => p.revealed).map(p => item(`${p.kind === 'oil' ? 'Reserva' : p.kind === 'gas' ? 'Gás' : 'Amostra'} ${p.id + 1}`, p.kind === 'relic' ? 'Coletada: +$ 350 no balanço.' : `${Math.ceil(p.amount)} ${p.kind === 'gas' ? 'unidades' : 'barris'} · profundidade ${Math.round(p.y - RULES.surface)}`, p.kind === 'relic' ? '' : action('Selecionar no campo', 'aim', p.id, o.ended))).join('') || '<p>Nenhuma reserva descoberta. Comece perto da bandeira.</p>';
  } else if (view.panel === 'network') {
    const diagnostics = networkDiagnostics(o);
    $('pipe-source').innerHTML = '<option value="">Selecione uma origem</option>' + o.nodes.map(n => `<option value="${n.id}"${view.source === n.id ? ' selected' : ''}>${n.y === RULES.surface ? 'Torre' : 'Junção'} ${n.id + 1} · ${Math.round(n.x)}, ${Math.round(n.y)}</option>`).join('');
    $('network-list').innerHTML = [...o.rigs.map(r => item(`Torre ${r.id + 1} · ${Math.floor(r.storage)}/${r.capacity} b`, `Bomba: ${RULES.rigRate + r.level * 2} b/s · demanda ${diagnostics.rigDemand[r.id].toFixed(1)} b/s · ${r.fullTime > 0 ? 'Atenção: reservatório cheio' : diagnostics.rigDemand[r.id] > RULES.rigRate + r.level * 2 ? 'Bomba limita produção' : 'reservatório operacional'}`, action(`Ampliar bomba e reservatório · ${money(180 * (r.level + 1))}`, 'rig-upgrade', r.id, o.ended || r.level >= 3 || o.cash < 180 * (r.level + 1)))), ...o.tanks.map(t => item(`Tanque ${t.id + 1} · ${Math.floor(t.storage)}/${t.capacity} b`, `Ampliação ${t.level}/3`, action(`+120 b · ${money(180 * (t.level + 1))}`, 'tank-upgrade', t.id, o.ended || t.level >= 3 || o.cash < 180 * (t.level + 1)))), ...o.edges.map(e => item(`${diagnostics.edges[e.id].bottleneck ? '⚠ Gargalo · ' : ''}Tubo ${e.id + 1} · junção ${e.from + 1} → ${e.to + 1}`, `${Math.floor(e.progress * 100)}% construído · vazão recente ${(e.flow ?? 0).toFixed(1)} / ${RULES.pipeCapacity * (e.level + 1)} b/s · demanda ${diagnostics.edges[e.id].demand.toFixed(1)} b/s · válvula ${e.open ? 'aberta' : 'fechada'}`, `<div class="button-row">${action(e.open ? 'Fechar' : 'Abrir', 'pipe-toggle', e.id, o.ended)}${action(e.level >= 2 ? 'Diâmetro máximo' : `Ampliar · ${money(100 * (e.level + 1))}`, 'pipe-upgrade', e.id, o.ended || e.level >= 2 || o.cash < 100 * (e.level + 1))}</div>`))].join('') || '<p>Instale sua primeira torre na superfície.</p>';
  } else if (view.panel === 'fleet') {
    const cost = RULES.truckCost + o.trucks.length * 50;
    text('buy-truck', `Comprar veículo ${o.trucks.length}/${RULES.maxTrucks} · ${money(cost)}`); $('buy-truck').disabled = o.ended || o.trucks.length >= RULES.maxTrucks || o.cash < cost;
    $('fleet-list').innerHTML = o.trucks.map(t => {
      const eta = deliveryEstimate(o, t);
      const estimate = eta === null ? t.phase === 'idle' ? ' · aguardando tarefa ou petróleo disponível' : '' : eta === Infinity ? ' · aguardando espaço no tanque' : ` · entrega ≈${eta} s${eta > o.time ? ' (após o prazo!)' : ''}`;
      return item(`Veículo ${t.id + 1} · ${phases[t.phase]}`, `${t.cargo.toFixed(1)}/${t.capacity} b${t.destination ? ` · destino: ${t.destination.kind === 'buyer' ? sides[t.destination.id] : 'tanque ' + (t.destination.id + 1)}` : ''}${estimate}`, `<label>Próxima tarefa<select data-truck="${t.id}"${disabled(o.ended)}>${Object.entries(sides).map(([key, name]) => `<option value="${key}"${t.task === key ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`);
    }).join('');
  } else if (view.panel === 'market') {
    $('market-list').innerHTML = ['west', 'east'].map(side => {
      const recent = o.history[Math.max(0, o.history.length - 8)]?.[side] ?? o.prices[side], delta = o.prices[side] - recent;
      const spark = o.history.slice(-22).map(p => '▁▂▃▄▅▆▇█'[clamp(Math.floor((p[side] - 3) / 2), 0, 7)]).join('');
      return item(`${sides[side]} · $ ${o.prices[side].toFixed(2)}/b`, `${delta > .15 ? '↗ Subindo' : delta < -.15 ? '↘ Caindo' : 'Estável'} · gás +$ ${o.gasBoost[side].toFixed(2)}/b`, `<div class="sparkline" aria-label="Histórico recente de preços">${spark}</div>`);
    }).join('');
    const terms = contractTerms(o.region, o.rules);
    $('contract-list').innerHTML = o.contracts.map(c => item(`${sides[c.side]} · ${c.volume} b · bônus ${money(c.bonus)}`, `${({ offered: 'Disponível', active: 'Ativo', completed: 'Cumprido', expired: 'Expirado' })[c.status]} · ${Math.floor(c.delivered)} b entregues · prazo: ${Math.max(0, Math.ceil(c.deadline - o.elapsed))} s${terms.wells ? ` · reservas produtivas: ${productiveReserves(o)}/${terms.wells} (mín. 1 b extraído em cada)` : ''}`, action('Aceitar contrato', 'contract', c.id, o.ended || c.status !== 'offered' || o.elapsed >= c.deadline - 20 || o.contracts.some(contract => contract.status === 'active')))).join('');
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
  $('report-advice').innerHTML = debrief(o).map(advice => `<li>${escape(advice)}</li>`).join('');
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
  if (name === 'aim') { const p = o.pockets[Number(id)]; if (p?.revealed) { setPanel(p.kind === 'gas' ? 'gas' : 'network'); selectTool(p.kind === 'gas' ? 'gas' : 'pipe'); selectPoint({ x: p.x, y: p.y }); focusField(p); } return; }
  if (name === 'pipe-upgrade') ok = upgradePipe(o, Number(id));
  if (name === 'pipe-toggle') ok = togglePipe(o, Number(id));
  if (name === 'rig-upgrade' || name === 'tank-upgrade') ok = upgradeStorage(o, name.split('-')[0], Number(id));
  if (name === 'gas-toggle') ok = toggleGas(o, Number(id));
  if (name === 'contract') ok = acceptContract(o, Number(id));
  tell(ok ? 'Operação atualizada.' : 'Ação indisponível. Confira capital, construção e limites.'); save(); updateHUD(); renderPanels(true);
});
$('difficulty').addEventListener('change', () => { if (!operation && campaign.leased === null && !campaign.auction) { campaign.difficulty = $('difficulty').value; save(); } });
$('guide-enabled').addEventListener('change', () => { if (!operation && campaign.leased === null && !campaign.auction) { campaign.guide = $('guide-enabled').checked; save(); } });
$('tutorial-action').addEventListener('click', () => {
  const step = operation && tutorialStep(operation); if (!step) return;
  setPanel(step.panel);
  if (step.tool) selectTool(step.tool);
  if (step.index === 3 && view.source === null) view.source = operation.nodes.find(n => n.y === RULES.surface)?.id ?? null;
  if (step.point) focusField(step.point);
  else document.querySelector(step.target)?.focus();
  updateHUD(); renderPanels(true);
});
$('skip-guide').addEventListener('click', () => { if (operation) { operation.guideDismissed = true; save(); updateHUD(); } });
for (const [id, callback] of Object.entries({
  bid: () => bid(campaign), 'finish-auction': () => finishAuction(campaign), 'shares-auction': () => startAuction(campaign, 'shares'), borrow: () => bank(campaign, 'borrow'), repay: () => bank(campaign, 'repay'),
})) $(id).addEventListener('click', () => { if (operation || locked) return; const ok = callback(); townMessage = ok ? 'Patrimônio e decisões atualizados.' : 'Ação indisponível. Preserve capital para operar.'; save(); renderTown(); });
$('launch').addEventListener('click', () => {
  if (operation || locked) return;
  operation = launchOperation(campaign); if (!operation) return;
  view = { tool: 'scan', panel: 'explore', source: null, preview: null, route: [], cursor: { x: 180, y: 210 } }; reportShown = false;
  renderer.setZoom(1); renderer.pan = { x: 0, y: 0 }; previous = performance.now(); accumulator = 0; setPanel('explore'); selectTool('scan'); showScreen(); save();
});
$('confirm-action').addEventListener('click', confirmAction);
$('cancel-action').addEventListener('click', () => { view.preview = null; view.route = []; updatePreview(); tell('Prévia cancelada. Nenhum custo cobrado.'); });
$('route-mode').addEventListener('change', () => selectTool('pipe'));
$('undo-route').addEventListener('click', () => {
  view.route.pop();
  if (!view.route.length) view.preview = null;
  else { const q = routeQuote(operation, view.source, view.route); view.preview = { ...view.route.at(-1), ...q, tool: 'pipe', source: view.source, route: true }; }
  updatePreview();
});
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
$('saves-button').addEventListener('click', openSaves);
$('recovery-slots').addEventListener('click', openSaves);
$('close-saves').addEventListener('click', () => { $('saves-dialog').close(); if (locked) $('recovery').showModal(); });
$('saves-dialog').addEventListener('cancel', () => { if (locked) queueMicrotask(() => $('recovery').showModal()); });
$('save-slots').addEventListener('click', event => {
  const button = event.target.closest('[data-slot]'); if (!button) return;
  const slot = Number(button.dataset.slot); if (slot === activeSlot) return;
  if (!locked && !save()) { text('slot-message', 'Não foi possível salvar a sessão atual. Exporte-a antes de trocar de espaço.'); return; }
  try {
    localStorage.setItem(ACTIVE_SLOT, String(slot)); activeSlot = slot;
    $('saves-dialog').close(); load(); showScreen();
    if (!locked && !storageBlocked) save();
  } catch { text('slot-message', 'Não foi possível trocar de espaço.'); }
});
$('export-save').addEventListener('click', () => {
  if (locked) return;
  const raw = encode(campaign, operation);
  if (!decode(raw)) { text('slot-message', 'O estado atual não passou na validação para exportação.'); return; }
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })), link = document.createElement('a');
  link.href = url; link.download = `ouro-campanha-${activeSlot + 1}-temporada-${campaign.season + 1}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); text('slot-message', 'Exportação preparada. Guarde o JSON para importar em outro navegador.');
});
$('restore-backup').addEventListener('click', restoreBackup);
$('recover-backup').addEventListener('click', restoreBackup);
$('import-save').addEventListener('change', async event => {
  const file = event.target.files?.[0], slot = activeSlot; event.target.value = '';
  if (!file) return;
  if (file.size > 1e6) { text('slot-message', 'Arquivo muito grande. O limite é 1 MB.'); return; }
  try {
    const raw = await file.text(), state = decode(raw);
    if (!state) throw new Error('Arquivo inválido ou incompatível. Nenhum save foi alterado.');
    pendingImport = { slot, raw };
    text('import-detail', `Importar temporada ${Math.min(10, state.campaign.season + 1)}, patrimônio ${money(state.campaign.cash)}, para o espaço ${slot + 1}? A campanha válida anterior será guardada como cópia de recuperação.`);
    $('import-confirm').showModal();
  } catch (error) { text('slot-message', error.message); }
});
$('cancel-import').addEventListener('click', () => { pendingImport = null; $('import-confirm').close(); });
$('import-confirm').addEventListener('cancel', () => { pendingImport = null; });
$('confirm-import').addEventListener('click', () => {
  if (!pendingImport) return;
  try {
    importSlot(localStorage, pendingImport.slot, pendingImport.raw);
    activeSlot = pendingImport.slot;
    try { localStorage.setItem(ACTIVE_SLOT, String(activeSlot)); } catch { /* The validated import is already durable; still load it in this session. */ }
    pendingImport = null;
    for (const dialog of document.querySelectorAll('dialog')) dialog.close();
    load(); showScreen(); text('save-state', `Campanha importada para o espaço ${activeSlot + 1}. Operação pausada.`);
  } catch (error) { $('import-confirm').close(); text('slot-message', error.message); }
});
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
  if (event.key === 'Escape') { view.preview = null; view.route = []; updatePreview(); return; }
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
