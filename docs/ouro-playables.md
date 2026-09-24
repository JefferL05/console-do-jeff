# Ouro do Subsolo: candidato para YouTube Playables

## Artefato

Execute `npm.cmd run build:playables` na raiz. Saídas:

- `artifacts/ouro-playables.zip`: pacote independente.
- `artifacts/ouro-playables/index.html`: entrada na raiz do pacote.
- `artifacts/ouro-playables-manifest.json`: tamanhos e inventário.
- `artifacts/ouro-balance.json`: relatório de simulações, gerado por `check:balance`.

O pacote atual tem 14 arquivos e aproximadamente 38 KiB compactados, sem contar a transferência do SDK hospedado pelo YouTube. Não contém testes, mocks, dependências do site ou fontes externas. A música original é sintetizada localmente em um loop reutilizável. O único script externo é `https://www.youtube.com/game_api/v1`, carregado de forma síncrona antes dos módulos do jogo. Os nomes e referências internas são relativos e compatíveis com as regras de arquivos consultadas.

Fora do ambiente Playables, o SDK oficial opera em modo no-op e o jogo usa a implementação local. Dentro do host, `ytgame.IN_PLAYABLES_ENV` seleciona as APIs reais. Se o SDK não carregar no pacote exportado, a tela inicial informa o problema e permite recarregar; não finge uma conexão com o YouTube.

## Comportamento da integração

- A tela explícita de carregamento precede `firstFrameReady`. Só após carregar progresso e disponibilizar o menu é chamado `gameReady`.
- `loadData` deve concluir com sucesso antes de qualquer `saveData`. Uma falha de rede mantém a tela de nova tentativa, impedindo sobrescrever uma partida anterior.
- O formato existente versão 2 permanece compatível. O idioma não é salvo: é consultado com `getLanguage`. Português usa pt-BR; inglês é a alternativa para demais idiomas.
- Dentro do host, não se acessa `localStorage`, Page Visibility ou `navigator.language`. No site, continuam disponíveis as implementações locais apropriadas.
- Pausa do SDK cancela `requestAnimationFrame`, bloqueia entrada, suspende áudio e faz a tentativa final de salvamento. Retomada vem exclusivamente de `onResume`; uma pausa voluntária anterior permanece ativa.
- As preferências separadas de música e efeitos sonoros nunca superam o mute do YouTube. O áudio só é inicializado após um gesto do usuário; não há reprodução antes de iniciar/continuar. Pausa suspende também o loop musical, sem criar novas instâncias na retomada.
- Salvamentos são serializados. Pendências são agrupadas no snapshot mais recente, evitando que uma gravação antiga termine por cima de uma nova.
- O payload tem limite operacional de 64 KiB em UTF-16 para manter margem no envio final, inferior ao máximo de 3 MiB do SDK.
- O recorde é o maior capital final entre partidas. `sendScore` recebe o valor inteiro que a oficina exibe, após sucesso do salvamento. Não há normalização entre modos: partidas de cinco minutos podem alcançar recordes maiores.

## Verificações executadas

```powershell
npm.cmd run check:game
npm.cmd run check:playables
npm.cmd run check:balance
npm.cmd run lint
npm.cmd run build:playables
```

- 14 suítes de simulação e 3.000 terrenos.
- 11 suítes de contrato SDK/áudio: prontidão, proteção contra sobrescrita, serialização, pausa, efeitos/música, recorde, idioma, migração de preferências e limites de payload.
- 480 partidas de balanceamento com duas estratégias automatizadas.
- Navegador mobile/desktop: regressão por toque, teclado, rotação, persistência, partida completa e falhas de armazenamento.
- Pacote independente sob a CSP da documentação oficial: partida em inglês, salvamento/recarga, pausa sem novos desenhos, bloqueio de entrada, preservação de pausa manual e recorde coerente com o save.
- ZIP lido com a biblioteca de compressão do sistema, confirmando a estrutura de arquivos.

Os testes de SDK usam dublês aderentes às assinaturas documentadas. São testes do nosso código, **não execução da suíte oficial nem aprovação do YouTube**. Os dublês ficam somente nos scripts de teste.

## Validação oficial e publicação

A tentativa de abrir a suíte oficial no navegador automatizado carregou a página, mas o componente interativo não ficou disponível no prazo observado. Assim, os testes oficiais permanecem pendentes.

Abra a [suíte oficial](https://developers.google.com/youtube/gaming/playables/test_suite) em um navegador interativo e siga o [guia](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide). Use o pacote candidato no fluxo disponibilizado pela ferramenta/portal. Registre os resultados antes de considerar o pacote pronto para submissão. O processo de lançamento depende do acesso ao programa e da orientação do Partner Manager.

Em Android e iPhone reais, os próximos ensaios são uma rodada completa em retrato/paisagem, interrupção por troca de aplicativo, mute do sistema/YouTube, retomada com cargas em trânsito e uma sessão prolongada para verificar aquecimento e bateria. O jogo do site pode ser acessado pelo IP do computador na mesma rede usando `npm.cmd run dev -- --host 0.0.0.0`; o comportamento do SDK deve ser verificado no host oficial.

## Fontes oficiais consultadas

- [Primeiros passos e URL do SDK](https://developers.google.com/youtube/gaming/playables/reference/getting_started) — revisão de 2026-06-02.
- [Referência das APIs](https://developers.google.com/youtube/gaming/playables/reference/sdk) — revisão de 2026-06-04.
- [Integração](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration) — revisão de 2026-06-16.
- [Idiomas: inglês obrigatório](https://developers.google.com/youtube/gaming/playables/certification/requirements_i18n_l10n) — revisão de 2026-06-16.
- [Limites de arquivos e estabilidade](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability) — revisão de 2026-06-16.
- [Guia da suíte e CSP](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide) — revisão de 2025-08-20.

Estado deste artefato: **candidato técnico local; certificação, testes em aparelhos reais e publicação pendentes**.
