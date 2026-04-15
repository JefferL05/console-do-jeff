import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const views: Record<string, number> = {};

  posts.forEach(post => {
    views[post.id] = Math.floor(Math.random() * 500) + 100;
  });

  return new Response(JSON.stringify(views), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    }
  });
};
