import { prepareNativeStorage, flushNativeStorage, nativeCall, isAndroid } from './native.js';

async function start() {
  try {
    await prepareNativeStorage();
    document.documentElement.classList.toggle('android-app', isAndroid());
    const entry = document.querySelector('script[data-ouro-entry]')?.dataset.ouroEntry;
    if (entry) await import(entry);
    window.addEventListener('ouro:native-back', () => { if (!window.ouroExperience) void nativeCall('exit'); });
    if (isAndroid()) document.addEventListener('click', async event => {
      const link = event.target.closest('a[href]');
      if (!link || link.origin !== location.origin || link.target === '_blank' || event.defaultPrevented) return;
      event.preventDefault();
      if (await flushNativeStorage() === false) return;
      location.href = link.href;
    });
    if (isAndroid()) await nativeCall('ready');
  } catch (error) {
    const panel = document.createElement('section'); panel.className = 'native-load-error';
    const heading = document.createElement('h1'); heading.textContent = 'Não foi possível abrir a expedição';
    const detail = document.createElement('p'); detail.textContent = 'Seus saves Android foram preservados. Feche e abra o aplicativo ou tente novamente.';
    const button = document.createElement('button'); button.textContent = 'Tentar novamente'; button.onclick = () => location.reload();
    panel.append(heading, detail, button); document.body.replaceChildren(panel); console.error(error);
  }
}
await start();
