# Ouro do Subsolo — Android 1.1.0 (debug)

## Aplicativo

- Nome: **Ouro do Subsolo**.
- Identificador: `com.jefferl05.ourodosubsolo`.
- Versão: `1.1.0`, `versionCode 110`.
- Android mínimo: **7.0 / API 24**, com **Android System WebView ou Chrome 105+**.
- Compile/target SDK: **36**.
- APK universal de debug, assinado com a chave de desenvolvimento da máquina.
- Entrada local com campanha empresarial e partida rápida. Ambos funcionam offline.

O aplicativo usa Capacitor e assets locais. Não abre o site remoto, não inclui o SDK do YouTube e não empacota o blog. O empacotador usa `index.html` explícito nas navegações: URLs de diretório seriam interpretadas pelo Capacitor como rotas da SPA principal.

## Arquivos principais

| Caminho | Responsabilidade |
| --- | --- |
| `mobile/package.json`, `mobile/package-lock.json` | Capacitor fixado, dependências independentes do site |
| `mobile/capacitor.config.json` | App ID, diretório local e requisitos do WebView |
| `mobile/android/` | Projeto Android, Gradle Wrapper e recursos nativos |
| `mobile/android/app/src/main/java/com/jefferl05/ourodosubsolo/` | Activity, insets, Voltar, armazenamento atômico, seletor de arquivos, foco de áudio e haptics |
| `public/jogos/petroleo/mobile/` | Gestos, qualidade, preferências, áudio, bootstrap e integração nativa |
| `scripts/package-android.mjs` | Build Astro sem prefixo Pages e cópia apenas dos assets do jogo |
| `scripts/android-branding.mjs` | Ícones PNG originais gerados localmente |
| `scripts/build-android.mjs` | Build de debug, artefato, SHA-256 e metadados |

## Ferramentas usadas

- Node.js **24.20.0** (projeto requer pelo menos 22.12).
- Capacitor Android/Core/CLI **8.5.3**.
- Eclipse Temurin JDK **21.0.12.1+1**.
- Gradle Wrapper **8.14.3**.
- Android Gradle Plugin **8.13.0**.
- Android SDK Platform **36**, Build Tools **36.0.0**.

O Gradle Wrapper e os lockfiles fazem parte do código. Downloads de ferramentas/dependências são necessários para preparar o ambiente; a partida instalada não precisa de rede. O APK não é byte a byte idêntico entre máquinas por causa da chave debug e de metadados de build.

## Compilar no Windows

Na raiz do repositório:

```powershell
npm.cmd ci
npm.cmd ci --prefix mobile

$env:JAVA_HOME='C:\caminho\jdk-21'
$env:ANDROID_HOME='C:\caminho\Android\Sdk'
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;" + $env:Path

# Se ainda não estiverem instalados:
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'

npm.cmd run android:debug
```

O script gera os recursos, sincroniza o Capacitor, executa `assembleDebug` e copia o resultado para:

```text
artifacts/android/ouro-do-subsolo-1.1.0-debug.apk
artifacts/android/ouro-do-subsolo-1.1.0-debug.apk.sha256
artifacts/android/build-info.json
artifacts/android/web-manifest.json
```

`build-info.json` registra hash, tamanho, ferramentas e identificador da build. `mobile/www`, `local.properties`, caches e arquivos de build são locais/ignorados pelo Git.

## Instalar para testar

### Pelo próprio celular

1. Transfira o APK para o aparelho.
2. Abra o arquivo pelo gerenciador de arquivos.
3. Autorize a instalação por esse gerenciador quando o Android solicitar.
4. Abra **Ouro do Subsolo** e escolha um modo.

### Por USB/ADB

Ative a depuração USB e autorize o computador:

```powershell
adb devices -l
adb install -r artifacts/android/ouro-do-subsolo-1.1.0-debug.apk
adb shell am start -n com.jefferl05.ourodosubsolo/.MainActivity
```

`-r` atualiza mantendo os dados se o identificador e a assinatura forem os mesmos. Não desinstale para atualizar. Exportar os saves permite levá-los a outro aparelho ou a uma build com assinatura diferente. A chave debug normalmente fica em `%USERPROFILE%\.android\debug.keystore`; preservá-la é necessário para atualizar esta série de testes sem desinstalar.

## Controles

- Toque seleciona; uma compra exige confirmação.
- Arraste move o campo; pinça amplia mantendo o ponto entre os dedos como âncora.
- Arraste, pinça, cancelamento e rotação não são convertidos em cliques de construção.
- `Centralizar campo` restaura a câmera. Na partida rápida, está no menu de pausa.
- `Ferramentas` recolhe/abre o painel inferior da campanha no celular.
- Em **Som e controles**, a mira deslocada é opcional: seu destino aparece acima do dedo para não ficar encoberto.
- Voltar fecha a camada superior ou cancela a prévia, pausa a operação e, quando apropriado, oferece salvar e sair.
- Retrato/paisagem preservam a partida. A Activity trata barras do sistema e recortes por insets nativos.

## Som, foco e qualidade

Música e efeitos são sintetizados no aparelho: composição original em `modules/music.js`, envelopes suaves, seis vozes transitórias no máximo e uma única instância de música por página. Há sons para scanner, descobertas, perfuração, confirmação, cancelamento, erro, compras, entregas, saturação, derramamento e fim do prazo. Máquinas são atenuadas durante alertas.

Volumes de música e efeitos, mute global, vibração e qualidade ficam em `ouro-mobile-settings-v1`. Mute prevalece sobre os volumes. O aplicativo usa foco de áudio Android e pausa ao perder foco ou entrar em segundo plano. Retomar o aplicativo não retoma automaticamente a operação pausada. Não há avanço de simulação em segundo plano.

Qualidade automática escolhe o perfil econômico em dispositivos com até quatro núcleos lógicos ou até 4 GB reportados pelo navegador; permite substituição manual. Econômica: DPR 1 e até 30 desenhos/s. Alta: DPR limitado a 2 e até 60 desenhos/s. Em pausa: até 12 desenhos/s para manter o planejamento responsivo, com áudio suspenso. O passo da simulação continua em 1/30 s independentemente da renderização.

## Saves Android

Antes de abrir o jogo, o bootstrap carrega o estado nativo. O formato de campanha v3, três espaços e cópias anteriores continuam iguais. A partida rápida usa seu envelope v2 original.

As chaves `ouro-*` são espelhadas em um arquivo privado **AtomicFile**, com gravação agrupada e serializada. Cada snapshot leva os espaços, backups e preferências juntos. `localStorage` mantém a sessão síncrona do jogo e uma sequência monotônica permite recuperar uma cópia local mais recente após falha da gravação nativa. Uma leitura nativa inválida bloqueia a abertura em vez de gravar progresso vazio. Gravações idênticas em pausa não escrevem novamente no disco.

Importação/exportação usam o **Storage Access Framework** (`ACTION_OPEN_DOCUMENT`/`ACTION_CREATE_DOCUMENT`), sem permissão ampla de arquivos. A validação e confirmação do espaço de destino continuam no jogo. A exportação permite escolher onde salvar o JSON.

## Validação e limites desta entrega

```powershell
npm.cmd run check:game
npm.cmd run check:playables
npm.cmd run check:campaign
npm.cmd run check:improvements
npm.cmd run check:android
npm.cmd run lint
```

O teste `check:android:browser` usa Playwright opcional. Defina `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE` e `OURO_SCREENSHOTS` conforme os testes anteriores. Ele serve **o pacote offline real**, bloqueia requisições externas e usa dublês explícitos das APIs Android. Cobre navegação entre páginas, construção por toque, pinça, cancelamento, áudio Web Audio real, rotação, Voltar, foco, importação/exportação e retomada com armazenamento WebView vazio. Também mede desenhos/s e tempo médio de desenho em Chromium desktop com emulação mobile; isso não equivale ao desempenho de um celular Android.

O APK foi compilado e sua assinatura/manifesto foram conferidos com `apksigner` e `aapt`. **Não houve validação em aparelho físico:** nenhum estava conectado. Foi instalado um AVD Android 15/API 35, mas o emulador encerrou com código 1 antes do boot na tentativa sem aceleração. O ambiente informa virtualização de firmware desativada. Assim, ciclo de vida nativo, seletor de arquivos e foco de áudio ainda precisam do teste no APK em aparelho/emulador funcional.

### Roteiro no aparelho

1. Inicie em modo avião, pesquise, construa e espere uma entrega.
2. Faça pinça/arraste e confira que não compram nem posicionam tubos.
3. Rode a tela com uma rota em prévia e com uma carga viajando.
4. Ajuste os dois volumes, mute e vibração; pause/continue repetidamente.
5. Minimize, bloqueie/desbloqueie e reproduza áudio em outro app. A operação deve retornar pausada.
6. Exporte uma campanha, importe em outro espaço e tente importar JSON inválido.
7. Force o fechamento após salvar, reabra e confira capital, cargas e preferências.
8. Instale uma atualização com `adb install -r` e confira os três espaços.

### Logs

```powershell
adb logcat -c
adb logcat Capacitor:V Capacitor/Console:V AndroidRuntime:E '*:S'
adb shell dumpsys package com.jefferl05.ourodosubsolo
```

A build debug permite inspecionar a WebView em `chrome://inspect` no computador conectado. Release desativa a depuração.

## Release e recursos originais

O build release só recebe assinatura própria quando forem definidas `OURO_KEYSTORE`, `OURO_STORE_PASSWORD`, `OURO_KEY_ALIAS` e `OURO_KEY_PASSWORD`. Segredos e keystores são ignorados pelo Git. Não use o certificado debug para produção. Ícone, splash, música e efeitos do jogo são gerados localmente a partir do código original; Capacitor e bibliotecas Android conservam suas licenças de distribuição.
