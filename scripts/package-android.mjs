import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'mobile/www');
const build = spawnSync(process.execPath, [join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], { cwd: root, env: { ...process.env, GH_PAGES: 'false' }, stdio: 'inherit' });
if (build.status !== 0) throw new Error('Falha ao gerar páginas Astro para Android.');
await rm(output, { recursive: true, force: true }); await mkdir(join(output, 'jogos/petroleo/campanha'), { recursive: true });
for (const folder of ['modules', 'enterprise', 'mobile']) await cp(join(root, 'public/jogos/petroleo', folder), join(output, 'jogos/petroleo', folder), { recursive: true });
for (const file of ['boot.js', 'game.js', 'style.css']) await cp(join(root, 'public/jogos/petroleo', file), join(output, 'jogos/petroleo', file));
for (const mode of ['classic', 'campaign']) {
  const path = mode === 'classic' ? 'jogos/petroleo/index.html' : 'jogos/petroleo/campanha/index.html';
  let html = await readFile(join(root, 'dist', path), 'utf8');
  const entry = mode === 'classic' ? '/jogos/petroleo/boot.js' : '/jogos/petroleo/enterprise/app.js';
  html = html.replace(/<script[^>]*src="[^"]*(?:boot|app)\.js"[^>]*><\/script>/, `<script type="module" src="/jogos/petroleo/mobile/bootstrap.js" data-ouro-entry="${entry}"></script>`);
  html = html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; connect-src \'self\'; img-src \'self\' data: blob:; media-src \'self\' blob:; object-src \'none\'; base-uri \'self\'">');
  html = html.replace(/<script[^>]*src="https?:[^>]*><\/script>/g, '');
  // Capacitor treats extensionless URLs as SPA routes. Explicit HTML paths are
  // required for this multi-page application to reach each game entry.
  html = html.replace(/href="(\/jogos\/petroleo\/(?:campanha\/)?)"/g, 'href="$1index.html"');
  if (!html.includes('data-ouro-entry=') || html.includes('youtube.com/game_api')) throw new Error('Entrada offline inválida.');
  await writeFile(join(output, path), html);
}
await writeFile(join(output, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#102621"><title>Ouro do Subsolo</title><link rel="stylesheet" href="/jogos/petroleo/enterprise/style.css"><style>body{min-height:100dvh;display:grid;place-items:center;padding:24px}.launcher{max-width:520px;width:100%}.launcher h1{font-size:42px;margin:20px 0}.launcher a{display:block;padding:20px;margin:12px 0;border:1px solid #cbb176;border-radius:14px;text-decoration:none;background:#213e31}.launcher small{display:block;margin-top:7px}.mark{font-size:60px;color:#edc17a}</style></head><body><main class="launcher"><span class="mark">◆</span><p class="eyebrow">EDIÇÃO ANDROID · OFFLINE</p><h1>Ouro do Subsolo</h1><p>Uma fortuna para descobrir. Sua operação, seu ritmo.</p><a href="/jogos/petroleo/campanha/index.html">Campanha empresarial<small>Construa redes, administre a frota e conquiste a cidade.</small></a><a href="/jogos/petroleo/index.html">Partida rápida<small>Concessões curtas para explorar, perfurar e vender.</small></a><p>Versão 1.1.0 · saves no aparelho · sem conexão obrigatória</p></main><script type="module" src="/jogos/petroleo/mobile/bootstrap.js"></script></body></html>`);
const manifest = [];
await writeFile(join(output, 'unsupported.html'), '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atualize o WebView</title><body style="background:#102621;color:#f1d29b;font-family:system-ui;padding:30px"><h1>Atualize o Android System WebView</h1><p>Este jogo precisa de WebView ou Chrome versão 105 ou superior. Atualize o componente nas configurações ou na loja do aparelho e abra o jogo novamente.</p><p>O jogo e seus saves continuam no aparelho.</p></body></html>');
async function inventory(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name, path = join(dir, entry.name);
    if (entry.isDirectory()) await inventory(path, rel + '/');
    else { const data = await readFile(path); manifest.push({ file: rel, bytes: data.length }); }
  }
}
await inventory(output);
await mkdir(join(root, 'artifacts/android'), { recursive: true });
await writeFile(join(root, 'artifacts/android/web-manifest.json'), JSON.stringify({ version: '1.1.0', offline: true, files: manifest }, null, 2));
console.log(`Android offline: ${manifest.length} arquivos, ${(manifest.reduce((sum, f) => sum + f.bytes, 0) / 1024).toFixed(1)} KiB. ${output}`);
