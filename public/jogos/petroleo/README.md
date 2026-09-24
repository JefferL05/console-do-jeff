# Ouro do Subsolo — mobile-first

Jogo original de exploração, logística e negociação em JavaScript + Canvas 2D, integrado ao Astro em `/jogos/petroleo/`. Versão do site em português, recursos gráficos e sons gerados localmente. O pacote separado para YouTube Playables inclui o SDK oficial e interfaces em português/inglês, selecionadas pela API de idioma do YouTube.

## Executar

Na raiz do repositório, no Windows:

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Abra `http://localhost:4321/jogos/petroleo/` (ou a porta indicada pelo Astro). Em outros sistemas, use `npm` no lugar de `npm.cmd`. Para acessar de um celular na mesma rede, use o IP local do computador e a porta indicada, com a conexão liberada no firewall.

Produção: `npm.cmd run build`. Prévia: `npm.cmd run preview -- --host 0.0.0.0 --port 4322`. O HTML gerado fica em `dist/jogos/petroleo/index.html`. Os caminhos respeitam `BASE_URL`, inclusive o prefixo de GitHub Pages.

## Jogar

1. Escolha uma concessão e uma partida rápida (3 minutos) ou estratégica (5 minutos).
2. Com **Explorar**, toque no subsolo. Veja a área e confirme a sondagem. Cancelar é gratuito.
3. Com **Perfurar**, selecione o petróleo revelado. O trajeto e o preço aparecem antes da compra.
4. Para ramificar, selecione uma reserva com conexão pronta e depois outra descoberta. Cada ramificação tem fluxo próprio; cruzamentos não criam junções. Não há ciclos ou duas conexões para o mesmo bolsão.
5. Selecione **Oeste**, **Leste** ou **Guardar**. Tendência é o movimento recente do preço, não uma previsão.
6. Compare extração e capacidade estimada da frota. Amplie tanque/transporte em **Melhorar**.

As ações funcionam com toque, mouse ou teclado. Com o campo focado: setas movem a mira, Enter seleciona, Escape cancela e Espaço pausa. Tab acessa os controles HTML. Pausa também oferece ajuda, som, reinício e concessões.

### Música e efeitos

A trilha original country/folk tem melodia de cordas dedilhadas sintetizadas, baixo alternado e percussão a 120 BPM. O loop de 32 segundos é gerado localmente com Web Audio, sem downloads ou temporizadores de agendamento. Começa ao iniciar/continuar uma partida e para durante pausas e menus. No menu **Ⅱ**, os botões **Música** e **Efeitos sonoros** são independentes e suas preferências ficam salvas. O mute do YouTube sempre prevalece. Saves antigos continuam válidos, com música habilitada por padrão após o primeiro gesto do jogador.

### Logística e economia

- Capital inicial de $ 1.500. Custos e taxas centralizados em `modules/config.js`.
- Sondagem: $ 80. Poço: $ 200 + $ 1,80 por unidade de trajeto. Ramificação: $ 90 + trajeto.
- Perfuração leva tempo e tem indicador de progresso. Poço pronto extrai até 2,8 b/s.
- O tanque recebe a extração e para os poços quando fica cheio, sem eliminar petróleo.
- Veículos possuem carga, destino e estados de carregamento, ida, entrega e retorno.
- A primeira carga sai cheia ou após dois segundos de carregamento com carga positiva.
- Receita entra **uma vez por entrega**, pelo preço vigente na chegada.
- Trocar o destino afeta as próximas cargas. As já iniciadas preservam seu destino.
- Guardar impede novos carregamentos; entregas em andamento continuam.
- A partida termina imediatamente no prazo: estoque e cargas não entregues não são liquidados, mas continuam discriminados no balanço.
- Lucro líquido = capital final − capital inicial. Receita, despesas e petróleo são conservados na simulação.

### Concessões e oficina

1. **Vale Dourado:** tutorial com primeira reserva indicada e acessível; meta de lucro $ 500.
2. **Bacia do Cedro:** reservas menores e mais dispersas; foco em ramificações; meta $ 1.000.
3. **Serra de Cobre:** reservas profundas e rocha exigindo broca reforçada; meta $ 1.500.

Todos os terrenos têm semente reproduzível e uma reserva inicial acessível. Concluir uma concessão libera a seguinte, mesmo com prejuízo. A repetição mantém semente, perfil e duração; usa as melhorias permanentes atuais.

Cada conclusão dá uma ficha, mais uma por medalha: atingir a meta de lucro, vender pelo menos 85% do extraído (mínimo 50 barris vendidos) e extrair 40% do terreno. Essas fichas são separadas do dinheiro da partida. A oficina melhora tanque inicial, capacidade dos veículos e raio de sondagem para **novas** operações, até três níveis cada. A mesma conclusão não pode recompensar duas vezes.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| `src/pages/jogos/petroleo.astro` | Interface acessível, diálogos e caminho base |
| `game.js` | Orquestração, loop fixo, eventos e fluxo de telas |
| `boot.js` | Tela de carregamento, prontidão e carregamento assíncrono seguro |
| `style.css` | Retrato/paisagem, áreas seguras, controles de 48 px |
| `modules/config.js` | Custos, taxas, modos, perfis e melhorias |
| `modules/terrain.js` | Geração determinística e colisão com rochas |
| `modules/simulation.js` | Economia, fluxo de petróleo, frota e progressão |
| `modules/renderer.js` | Câmera isotrópica, desenho e cache do fundo |
| `modules/input.js` | Toque/arraste/cancelamento, mouse e teclado |
| `modules/ui.js` | Indicadores e painéis HTML |
| `modules/persistence.js` | Formato versionado e validação do estado |
| `modules/platform.js` | Adaptadores local/YouTube para nuvem, ciclo de vida, áudio e recorde |
| `modules/music.js` | Composição original, síntese e reprodução do loop musical |
| `modules/i18n.js` | Traduções e formatação numérica pt-BR/en |

Simulação a 30 passos/s, renderização independente com `requestAnimationFrame`, HUD atualizado no máximo a cada 150 ms. A câmera mantém proporções e aplica transformação inversa aos toques. DPR limitado a 2; fundo em cache e até 12 efeitos transitórios. Animações decorativas respeitam `prefers-reduced-motion`.

### Salvamento e retomada

Envelope versão 2 inclui partida, progresso e preferência de efeitos sonoros. No site, usa a chave local `ouro-subsolo-save-v2`; dentro do YouTube, usa exclusivamente `loadData`/`saveData`. Salva após ações, a cada cinco segundos de jogo e na pausa/saída. Cargas e tempos de viagem são preservados. No site, retomada explícita; no YouTube, pausa/retomada pelo SDK preserva também a pausa voluntária nos menus. Não simula tempo em segundo plano. Compras em prévia ainda não confirmadas não são persistidas e não cobram nada.

A validação verifica versão, tipos, números finitos, coordenadas, terreno original, topologia, capacidade, frota e balanço de petróleo/dinheiro. O formato versão 2 anterior continua compatível. Dados inválidos são ignorados; o progresso válido é recuperado quando possível. No site, sem armazenamento, o jogo permanece utilizável e informa que o progresso pode ser perdido. No YouTube, falha ao carregar a nuvem oferece nova tentativa e impede gravar progresso vazio sobre a partida existente. Gravações são serializadas e pendências agrupadas no estado mais recente. Fechar abruptamente pode perder progresso desde o último salvamento bem-sucedido.

## Verificação

```powershell
npm.cmd run check:game
npm.cmd run check:playables
npm.cmd run check:balance
npm.cmd run build
```

`scripts/check-petroleo.mjs`: 14 suítes, incluindo 3.000 terrenos, prévias gratuitas, custos, primeira entrega do tutorial, preço/destino na entrega, tanque cheio, ramificações, rochas, pausa, persistência corrompida, partidas completas, progressão e transformação de coordenadas após mudança de tamanho.

### Navegador (opcional)

`scripts/check-petroleo-browser.mjs` usa Playwright como ferramenta de desenvolvimento opcional. Não é dependência de produção. Com Playwright instalado, execute contra a prévia de produção:

```powershell
$env:OURO_URL='http://localhost:4322/jogos/petroleo/'
$env:OURO_SCREENSHOTS="$env:TEMP\ouro-screenshots"
# Se Playwright estiver fora do repositório, indique o arquivo index.mjs:
$env:PLAYWRIGHT_MODULE='C:\caminho\node_modules\playwright\index.mjs'
$env:BROWSER_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/check-petroleo-browser.mjs
```

Verifica 360×640, 390×844 e 412×915 e suas rotações, alvos de 48 px, ausência de rolagem/clipping, toque real, arraste e cancelamento de ponteiro, prévia/cancelamento/confirmação, salvamento/recarga, partida completa por toque com relógio acelerado, progressão, desktop/teclado e falhas de armazenamento. Capturas são gravadas fora do código quando `OURO_SCREENSHOTS` é definido.

Última medição em **Microsoft Edge headless no Windows, build de produção, emulação mobile, DPR 2**, janelas de três segundos em tempo real: 55 fps em 360×640 e 59 fps em 390×844 e 412×915; média de desenho do Canvas de 0,32–0,60 ms por frame. A medição ocorre antes de instalar o relógio virtual usado para acelerar a partida de teste. Isso mede somente esse ambiente, não um celular físico nem todo o custo de composição. `window.ouroDiagnostics` expõe um retrato somente de leitura de fps, tempo de desenho, viewport e DPR para medição local. Não envia telemetria.

## YouTube Playables

```powershell
npm.cmd run build:playables
```

Gera `artifacts/ouro-playables/` e `artifacts/ouro-playables.zip`, com `index.html` na raiz, referências relativas e o SDK oficial carregado antes do código do jogo. Esses arquivos de build são ignorados pelo Git. O site normal continua sem dependência do SDK externo.

Integrações implementadas: `firstFrameReady`, `gameReady`, `IN_PLAYABLES_ENV`, `loadData`, `saveData`, `getLanguage`, `isAudioEnabled`, `onAudioEnabledChange`, `onPause`, `onResume`, `sendScore` e diagnóstico de falhas via `logWarning`. O recorde enviado é o capital final inteiro, idêntico ao exibido na oficina, e só é enviado após um salvamento bem-sucedido.

Os 11 testes de contrato em `scripts/check-petroleo-platform.mjs` e o teste de navegador `scripts/check-petroleo-sdk-browser.mjs` utilizam **dublês de teste**, nunca incluídos no pacote. O teste de navegador serve o pacote com a CSP oficial, cobre o fluxo completo em inglês e verifica interrupção real de desenho/entrada durante pausa do host. Usa as mesmas variáveis `PLAYWRIGHT_MODULE` e `BROWSER_EXECUTABLE` do teste mobile. Execute após `build:playables`.

`scripts/check-petroleo-audiovisual.mjs` verifica Web Audio real no navegador: início após gesto, pausa, preferências independentes, salvamento/recarga e ausência de loops duplicados. Também captura a frota de oito veículos em retrato/paisagem para inspeção visual do contato das rodas com a estrada. Usa as mesmas variáveis dos outros testes de navegador e `OURO_URL` para a prévia de produção.

**Estado: candidato de desenvolvimento, ainda não certificado nem publicado.** A página da suíte oficial foi acessada, mas seu componente interativo não carregou no navegador automatizado desta sessão; não há resultado oficial de certificação. Instruções e fontes consultadas estão em `docs/ouro-playables.md` na raiz do repositório.

## Revisão de balanceamento

`check:balance` executa 480 partidas com 40 sementes espalhadas pelo espaço de uint32, dois modos, três perfis e duas políticas. A política inicial usa um poço; a de expansão explora somente áreas reveladas e compra ramificações/frota. Ambas recebem a mesma pista inicial do tutorial. Relatório completo: `artifacts/ouro-balance.json`.

Na revisão atual, as políticas concluíram todas as partidas com lucro; primeira entrega em até 10 segundos de simulação. No modo rápido, a mediana de lucro com um poço foi $ 812; expandindo, foi $ 4.779 no Vale, $ 4.386 na Bacia e $ 3.561 na Serra. O modo clássico permite esgotar o terreno com a política de expansão: o próximo ajuste deve ser guiado por jogadores reais, antes de tornar os objetivos mais exigentes. Essas simulações não medem dificuldade humana, retenção ou diversão.

Validações ainda necessárias: suíte oficial, sessões em Android/iOS reais (áreas seguras e interrupções), bateria/desempenho prolongado, áudio no Safari, leitores de tela e balanceamento com jogadores. A exploração espacial no Canvas ainda depende de visão. O escopo usa logística simplificada e três concessões curtas; não inclui adversários ou multiplayer.
