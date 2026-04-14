import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Anonymous'),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    image: z.object({
      url: z.string(),
      alt: z.string()
    }).optional(),
    draft: z.boolean().default(false),
    readingTime: z.number().optional()
  })
});

export const collections = { posts };
