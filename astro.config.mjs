import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isGithubPages = process.env.GH_PAGES === 'true';
const site = isGithubPages
  ? 'https://JefferL05.github.io/console-do-jeff'
  : `https://${process.env.VERCEL_URL ?? 'console-do-jeff.vercel.app'}`;

export default defineConfig({
  site,
  base: isGithubPages ? '/console-do-jeff/' : '/',
  integrations: [
    mdx(),
    react()
  ],
  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'wrap' }]
      ]
    }),
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  },
  vite: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@layouts': resolve(__dirname, 'src/layouts'),
        '@utils': resolve(__dirname, 'src/utils')
      }
    }
  }
});
