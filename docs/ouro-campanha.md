# Ouro do Subsolo — campanha empresarial

## Acesso

Abra **Campanha empresarial** no menu do jogo, ou `/jogos/petroleo/campanha/`. A rota respeita `BASE_URL`, incluindo GitHub Pages. O modo de operações rápidas continua na entrada original.

## As sete etapas implementadas

1. **Exploração:** prospector com pesquisa temporizada e marcador aproximado; sonda que revela o trajeto; scanner de raio ajustável (35–130), cobrado por área; prévia e confirmação gratuitas até a compra. Descobertas e pesquisas em andamento são salvas.
2. **Rede:** torres posicionáveis, tubos por segmentos, curvas, ramificações, perfuração progressiva, melhorias de diâmetro e válvulas. A rede é uma floresta dirigida: cada nó tem um único pai, cruzamentos não conectam tubos e uma reserva não pode ser conectada duas vezes. Descendentes compartilham a capacidade de todos os segmentos anteriores e da bomba. A prioridade de extração alterna entre reservas para evitar bloqueio permanente entre irmãs.
3. **Logística:** reservatórios individuais nas torres, tanques posicionáveis e melhoráveis, frota de até 12 veículos. Ordens Oeste/Leste buscam óleo em torres e tanques; Guardar transporta das torres aos tanques; Parado suspende novas tarefas. Cargas em andamento preservam o destino. Tanque cheio retém a carga sem descartá-la; uma ordem de venda recupera essa carga. Partidas perto do prazo podem sair incompletas.
4. **Economia:** dois mercados com preços determinísticos, histórico, tendência e contratos opcionais de entrega. O preço é aplicado exatamente uma vez na chegada. Contratos contam apenas vendas posteriores à aceitação, têm prazo absoluto e bônus único. Expiração não aplica multa. Balanço distingue construções, receitas, bônus, multas, estoque, trânsito, perdas e retorno ao patrimônio.
5. **Campanha:** dez temporadas em cinco regiões, prefeitura com três lotes disputados e um municipal, leilões ascendentes com reserva operacional, oito tecnologias permanentes, banco e histórico. O orçamento da operação sai efetivamente do patrimônio; caixa restante e recompensas retornam ao encerrar. Arrendamento não é devolvido. Juros de 5% incidem na dívida restante ao fim da temporada.
6. **Recursos avançados:** rocha, gelo, brocas especializadas, bolsas de gás e amostras raras. Linhas de gás exclusivas levam o recurso a um comprador, começam fechadas e levam tempo para construir. Uma bolsa aceita uma única linha; consumo finito, bônus limitado a $ 4/b e decaimento de $ 0,50/s após fechar. Amostras reveladas rendem $ 350 de patrimônio no balanço.
7. **Competição:** três rivais determinísticos com prioridades diferentes, reservas financeiras, investimentos e resultados econômicos. Participações de 5% são disputadas uma vez por temporada; leilões ignorados ocorrem entre os rivais. Ao fim, maior participação vence; patrimônio líquido desempata. Os resultados dos rivais são modelados economicamente, não por operações simultâneas no campo.

## Modos de risco

- **Tranquilo:** a torre cheia interrompe a extração.
- **Empresarial:** ao atingir 95% do reservatório, começa o aviso. Após três segundos de saturação, o óleo que exceder a capacidade é perdido e gera $ 3/b de multa. Válvulas e transporte permitem reagir. Multas podem deixar o caixa operacional negativo e são transferidas ao patrimônio no balanço.

## Fluxo sugerido para a primeira temporada

1. Compre melhorias que desejar antes de arrendar, mantendo pelo menos $ 2.700 para terreno municipal e orçamento.
2. Arrende o lote municipal e inicie a operação. Um veículo já está incluído.
3. Use Scanner próximo à bandeira. Confirme a pesquisa.
4. Em Rede, instale uma torre acima da reserva. A ferramenta muda para Tubo.
5. Toque na reserva e confirme o segmento. A produção começa após a perfuração.
6. Em Frota, acompanhe viagens e contrate transporte se a torre começar a encher.
7. Instale tanques e designe Guardar se quiser esperar preços. Mude para Oeste/Leste com antecedência para escoar.
8. Compare os três objetivos em Metas; contratos e gás ficam em seus painéis.
9. Receba o balanço e volte à cidade. Participe do leilão de ações antes de arrendar o próximo terreno.

## Controles e ciclo de vida

Canvas com toque, mouse, setas e Enter; Escape cancela a prévia. Zoom 1×–3× e arraste facilitam a precisão no celular. Reservas descobertas e origens também têm seleção por controles HTML. Todos os botões têm altura mínima de 48 px. Os painéis ficam ao lado do campo no desktop e abaixo no celular.

Pausa permite planejar e construir sem avançar o tempo. Abrir ajuda ou confirmação pausa a operação. Sair da aba também pausa; o retorno é explícito. Animações decorativas respeitam movimento reduzido. A simulação usa passos fixos de 1/30 s, não acumula tempo em segundo plano e não recupera grandes atrasos de frame. Fundo em cache e DPR máximo 2.

## Salvamento e migração

Envelope **versão 3**, chave `ouro-subsolo-enterprise-v3`. Campanha e operação são gravadas juntas em uma única string após decisões, a cada cinco segundos e na saída. Validação inclui terreno original, topologia, referências, capacidades, preços, contratos, leilões, limites tecnológicos e conservação de petróleo/gás/dinheiro. Saves retomam pausados. Corrupção abre recuperação e bloqueia sobrescrita automática; começar outra campanha exige confirmação. Falha de leitura permite sessão temporária com gravação bloqueada, preservando dados possivelmente existentes.

Na primeira campanha, pesquisas válidas de tanque, carga e sondagem do envelope v2 da partida rápida são importadas para tecnologias equivalentes. O save v2 original permanece intacto. A campanha tem armazenamento e progresso próprios; não converte uma operação rápida em uma rede empresarial no meio da partida.

O pacote YouTube Playables permanece com a entrada de operações rápidas e seu armazenamento pelo SDK. O link web da campanha é removido no empacotamento; esta campanha usa armazenamento local no site.

## Arquitetura

Código em `public/jogos/petroleo/enterprise/`:

| Arquivo | Papel |
| --- | --- |
| `config.js` | Regras, regiões, tecnologias, custos e transações |
| `exploration.js` | Geração, scanner, prospector, sonda e colisões |
| `pipes.js` | Rede, construção, vazão compartilhada, perdas e válvulas |
| `logistics.js` | Torres/tanques, tarefas, viagens e cargas |
| `market.js` | Preços, histórico, entregas e contratos |
| `gas.js` | Linhas, consumo, pressão comercial e decaimento |
| `simulation.js` | Operação, passo fixo, objetivos e balanço |
| `campaign.js` | Temporadas, cidade, banco, tecnologia e leilões |
| `rivals.js` | Valorações e evolução determinística dos rivais |
| `persistence.js` | Envelope v3 e validação sem dependência do DOM |
| `renderer.js` | Canvas, câmera, animação e cache |
| `app.js` | Navegação, controles, ciclo de vida e apresentação |

Página: `src/pages/jogos/petroleo/campanha.astro`.

## Verificação

```powershell
npm.cmd run check:campaign
npm.cmd run check:game
npm.cmd run check:playables
npm.cmd run lint
npm.cmd run build
npm.cmd run check:site
```

Teste de navegador com Playwright opcional, fora das dependências de produção:

```powershell
$env:CAMPAIGN_URL='http://127.0.0.1:4324/jogos/petroleo/campanha/'
$env:PLAYWRIGHT_MODULE='C:\caminho\playwright\index.mjs'
$env:BROWSER_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$env:OURO_SCREENSHOTS='C:\caminho\capturas'
npm.cmd run check:campaign:browser
```

A suíte pura cobre 500 terrenos, curvas e gargalos, pausas, transporte, contratos, gás, corrupção de saves, campanhas de dez temporadas e 30 operações completas. A suíte de navegador cobre entrada, construção por toque, primeira entrega, recarga, atribuição da frota, zoom, teclado, balanço, retorno à cidade, importação v2 e recuperação de armazenamento. O balanceamento ainda deve ser refinado com partidas humanas; testes determinísticos verificam regras e viabilidade, não diversão.
