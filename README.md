<<<<<<< HEAD
# console-do-jeff
Blog
=======
# TechBlog - Blog Técnico de Alta Performance

Blog técnico, construí­do com Astro 4.0 para máxima performance e legibilidade.

## Stack

- **Framework**: Astro 4.0 (SSG)
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
- Sitemap automático
- SEO completo (OpenGraph, Twitter Cards)
- Categorização e arquivo por ano
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

## Componentes MDX

### Callout

```mdx
<Callout type="info|warning|success|error" title="Título opcional">
  Conteúdo do callout
</Callout>
```

### CodeBlock (usado automaticamente)

Basta usar blocos de código Markdown - o botão de copiar é adicionado automaticamente.

## Deploy

### Vercel

```bash
npm run build
vercel deploy
```

### Netlify

```bash
npm run build
netlify deploy --prod
```

## Performance

- SSG: Páginas pré-renderizadas
- Sem JavaScript desnecessário
- Imagens otimizadas com lazy loading
- CSS minificado automaticamente
- Sitemap e RSS generation automática

