# Console do Jeff

Blog técnico focado em desenvolvimento de software, boas práticas e tecnologias modernas. Construído com Astro para máxima performance e legibilidade.

## Stack

- **Framework**: Astro 7 (SSG)
- **Styling**: Tailwind CSS + Typography Plugin
- **Content**: MDX (Markdown + React Components)
- **Search**: Fuse.js (Fuzzy Search)
- **Icons**: Lucide React
- **Syntax Highlighting**: Shiki

## Funcionalidades

- Dark/Light Mode com persistência via LocalStorage
- Table of Contents automática com scroll spy
- Code highlighting com botão de copiar
- Busca fuzzy instantânea no cliente
- RSS Feed automático
- SEO completo (OpenGraph, Twitter Cards)
- Categorias, páginas de tags e arquivo por ano
- Componentes MDX reutilizáveis (Callout)

### Frontmatter

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| title | string | Sim | Título do post |
| description | string | Sim | Descrição para SEO |
| pubDate | date | Sim | Data de publicação |
| updatedDate | date | Não | Data de atualização |
| author | string | Não | Autor (padrão: "Anonymous") |
| category | string | Sim | Categoria |
| tags | string[] | Não | Tags (padrão: []) |
| image | object | Não | Objeto com url e alt |
| draft | boolean | Não | Se true, não aparece em produção |
| readingTime | number | Não | Tempo de leitura em minutos; calculado quando omitido |

As datas são apresentadas em UTC para preservar o dia de valores como `2026-04-13`.
Datas com horário e fuso são convertidas para UTC antes da apresentação.

## Componentes MDX

### Callout

```mdx
<Callout type="info|warning|success|error" title="Título opcional">
  Conteúdo do callout
</Callout>
```

### CodeBlock (usado automaticamente)

Basta usar blocos de código Markdown - o botão de copiar é adicionado automaticamente.
O componente `CopyCode.astro` adiciona os botões aos blocos renderizados pelo Shiki.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Requer Node.js 22.12 ou superior. Para validar:

```bash
npm run lint
npm run build
npm run check:site
```

`check:site` verifica links internos, categorias, datas, busca no HTML, RSS e arquivos de SEO.
Ao testar GitHub Pages localmente, defina `GH_PAGES=true` tanto para o build quanto para a verificação.
Pull requests são validados com e sem o prefixo do GitHub Pages.

## Deploy

### GitHub Pages

```bash
npm run build
git push origin main
```

O workflow `.github/workflows/deploy.yml` faz o build e publica automaticamente em `https://JefferL05.github.io/console-do-jeff/`.

### Vercel

O domínio canônico padrão é `https://console-do-jeff.vercel.app`.
Para um domínio próprio, configure `SITE_URL` com a URL pública completa.
URLs temporárias de preview não são usadas como canonical. O sitemap é gerado no build.

A imagem de compartilhamento padrão é `public/og-default.png`; o SVG correspondente é o arquivo editável.

## Performance

- SSG: Páginas pré-renderizadas
- Sem JavaScript desnecessário
- Imagens externas com lazy loading
- CSS minificado automaticamente
- RSS generation automática
