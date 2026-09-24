import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.GH_PAGES === 'true' ? '/console-do-jeff/' : '/';
const read = path => readFileSync(join('dist', path), 'utf8');
const pages = readdirSync('dist', { recursive: true }).filter(path => path.endsWith('.html'));
const posts = JSON.parse(read('search-index.json'));
const failures = [];

for (const page of pages) {
  const html = read(page);
  const isGame = page.replaceAll('\\', '/') === 'jogos/petroleo/index.html';
  if (isGame) {
    assert.ok(html.includes('id="game"') && html.includes(`${base}jogos/petroleo/boot.js`), `Entrada do jogo ausente: ${page}`);
  } else {
    assert.ok(html.includes('id="search-input"'), `Busca ausente: ${page}`);
  }
  for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!target.startsWith('/') || target.startsWith('//')) continue;
    const pathname = target.split(/[?#]/)[0];
    if (!pathname.startsWith(base)) {
      failures.push(`${page}: URL fora da base: ${target}`);
      continue;
    }
    const relative = decodeURIComponent(pathname.slice(base.length));
    if (!existsSync(join('dist', relative)) && !existsSync(join('dist', relative, 'index.html'))) {
      failures.push(`${page}: destino inexistente: ${target}`);
    }
  }
  if (page.replaceAll('\\', '/').startsWith('categories/') && !page.replaceAll('\\', '/').endsWith('categories/index.html')) {
    assert.ok(posts.some(post => html.includes(`href="${base}blog/${post.slug}"`)), `Categoria vazia: ${page}`);
  }
}

assert.deepEqual(failures, [], 'Links internos inválidos');
for (const post of posts) {
  const html = read(`blog/${post.slug}/index.html`);
  const time = html.match(/<time datetime="([^"]+)">([^<]+)<\/time>/);
  assert.ok(time, `Data ausente: ${post.slug}`);
  const expected = new Date(time[1]).toLocaleDateString('pt-BR', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  });
  assert.equal(time[2], expected, `Data deslocada: ${post.slug}`);
  assert.ok(read('rss.xml').includes(`${base}blog/${post.slug}/`), `Post ausente do RSS: ${post.slug}`);
}
assert.ok(existsSync('dist/og-default.png'), 'Imagem Open Graph ausente');
assert.ok(existsSync('dist/sitemap-index.xml'), 'Sitemap ausente');
console.log(`Site validado: ${pages.length} páginas, ${posts.length} artigos, links internos, categorias, datas, RSS e SEO.`);
