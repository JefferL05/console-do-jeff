# Console do Jeff

Blog técnico focado em desenvolvimento de software, boas práticas e tecnologias modernas. Construído com Astro para máxima performance e legibilidade.

## Stack

- **Framework**: Astro 4 (SSG)
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

## Desenvolvimento

```bash
npm install
npm run dev
```

## Deploy

### GitHub Pages

```bash
npm run build
git push origin main
```

O workflow `.github/workflows/deploy.yml` faz o build e publica automaticamente em `https://JefferL05.github.io/console-do-jeff/`.

## Performance

- SSG: Páginas pré-renderizadas
- Sem JavaScript desnecessário
- Imagens otimizadas com lazy loading
- CSS minificado automaticamente
- RSS generation automática
