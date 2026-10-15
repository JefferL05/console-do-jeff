// Existing campaigns keep their original contracts and targets. New campaigns
// opt into this ruleset without regenerating terrain or rewriting old ledgers.
export function contractTerms(region, rules = 1) {
  return rules >= 2
    ? { volume: [100, 320, 420, 500, 560][region], bonus: [300, 650, 900, 1150, 1400][region], wells: [1, 2, 2, 3, 3][region] }
    : { volume: 100 + region * 20, bonus: 300 + region * 70, wells: 0 };
}
export function profitGoal(operation) {
  return operation.rules >= 2 ? [800, 1800, 2600, 3400, 4200][operation.region] : 600 + operation.region * 350;
}
export function productiveReserves(operation) {
  return operation.nodes.filter(n => n.pocketId !== null && operation.pockets[n.pocketId].initial - operation.pockets[n.pocketId].amount >= 1).length;
}
export function tutorialStep(operation) {
  if (!operation.guide || operation.guideDismissed || operation.ended) return null;
  const first = operation.pockets.find(p => p.kind === 'oil' && p.revealed) || operation.pockets[0];
  if (!operation.pockets.some(p => p.kind === 'oil' && p.revealed)) return { index: 1, panel: 'explore', tool: 'scan', target: '[data-tool="scan"]', title: '1/5 · Encontre o petróleo', detail: 'Pesquise perto da bandeira. Confira o círculo e confirme a sondagem.', point: { x: operation.markers[0].x, y: 210 } };
  if (!operation.rigs.length) return { index: 2, panel: 'network', tool: 'rig', target: '[data-tool="rig"]', title: '2/5 · Instale uma torre', detail: 'Escolha a superfície acima da reserva. Confira o preço antes de confirmar.', point: { x: first.x, y: 110 } };
  if (!operation.nodes.some(n => n.pocketId !== null)) return { index: 3, panel: 'network', tool: 'pipe', target: '[data-tool="pipe"]', title: '3/5 · Ligue a reserva à torre', detail: 'Selecione a torre como origem e trace o tubo até o petróleo. Pontos extras criam curvas.', point: { x: first.x, y: first.y } };
  if (operation.edges.some(e => e.progress < 1)) return { index: 4, panel: 'network', target: '#pause-operation', title: '4/5 · Aguarde a perfuração', detail: 'O tempo precisa estar correndo. A rede começa a extrair quando o caminho estiver completo.' };
  if (operation.sold <= 0) return { index: 5, panel: 'fleet', target: '[data-truck="0"]', title: '5/5 · Faça a primeira entrega', detail: 'Deixe um veículo destinado ao Oeste ou Leste. A receita chega ao descarregar no comprador.' };
  const lessons = [
    { panel: 'goals', title: 'Primeira venda concluída!', detail: 'Acompanhe suas metas e encontre uma segunda reserva. A primeira venda é só o começo.' },
    { panel: 'market', title: 'Bacia · hora de armazenar e negociar', detail: 'Instale um tanque e designe Guardar para esperar preços. Contratos desta região exigem duas reservas produtivas; compare os prazos antes de aceitar.' },
    { panel: 'network', title: 'Serra · contorne obstáculos e gargalos', detail: 'Planeje uma rota com curvas para desviar da rocha, ou pesquise a broca na cidade. Amplie os tubos destacados em laranja.' },
    { panel: 'gas', title: 'Planalto · sincronize gás e entregas', detail: 'Descubra gás, instale uma linha e abra a válvula quando os veículos estiverem a caminho. Compare o bônus ao tempo estimado das viagens.' },
    { panel: 'network', title: 'Fronteira · planeje antes de perfurar', detail: 'Gelo e rocha exigem desvios ou brocas especializadas. Use a prévia de vários pontos e compare o custo total antes de confirmar.' },
  ];
  const lesson = lessons[operation.region];
  return { index: 6, ...lesson, target: `[data-panel="${lesson.panel}"]` };
}
