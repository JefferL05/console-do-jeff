import { createPlatform } from './modules/platform.js';
import { setLanguage, translateDOM, t } from './modules/i18n.js';

const panel = document.getElementById('loading');
const status = document.getElementById('loading-status');
const retry = document.getElementById('retry-load');
const sdk = Reflect.get(globalThis, 'ytgame');
const needsSdk = document.documentElement.dataset.platform === 'youtube';
setLanguage(needsSdk ? 'en' : 'pt-BR');
let busy = false;
const platform = createPlatform({ sdk });
const waitForResume = () => platform.suspended ? new Promise(resolve => {
  const unsubscribe = platform.onResume(() => { unsubscribe(); resolve(); });
}) : Promise.resolve();
platform.onSuspend(() => { if (platform.hosted) document.body.inert = true; });
platform.onResume(() => { document.body.inert = false; if (!panel.hidden) platform.firstFrameReady(); });

async function boot() {
  if (busy) return;
  busy = true; retry.hidden = true;
  try {
    if (needsSdk && !sdk) throw new Error('sdk');
    await waitForResume();
    // Allow the explicit loading screen to paint before notifying the host.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await waitForResume();
    platform.firstFrameReady();
    const [saved, language] = await Promise.all([platform.load(), platform.language()]);
    await waitForResume();
    setLanguage(language); translateDOM(document.body);
    if (saved.loadFailed) throw new Error('load');
    await waitForResume();
    const { startApp } = await import('./game.js');
    startApp(platform, saved);
    panel.hidden = true;
    platform.gameReady();
  } catch (error) {
    await waitForResume();
    status.textContent = t(error.message === 'sdk' ? 'O SDK do YouTube não carregou. Verifique a conexão e recarregue.' : 'Não foi possível carregar a expedição. Tente novamente para preservar seu progresso.');
    retry.hidden = false;
  } finally { busy = false; }
}
retry.addEventListener('click', () => { if (needsSdk && !sdk) location.reload(); else void boot(); });
void boot();
