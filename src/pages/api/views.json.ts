import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const VIEW_COUNTERS: Record<string, number> = {};
const RATE_LIMIT_MAP: Record<string, { count: number; timestamp: number }> = {};

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);

  const views: Record<string, number> = {};
  posts.forEach(post => {
    views[post.id] = VIEW_COUNTERS[post.id] ?? Math.floor(Math.random() * 500) + 100;
  });

  return new Response(JSON.stringify(views), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60'
    }
  });
};

export const POST: APIRoute = async ({ request, params }) => {
  const url = new URL(request.url);
  const slug = url.pathname.split('/').pop() || 'unknown';
  
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] 
    || request.headers.get('cf-connecting-ip') 
    || 'unknown';
  
  const userAgent = request.headers.get('user-agent') || '';

  if (/bot|crawl|slurp|spider|aarch64|arm/i.test(userAgent)) {
    return new Response(JSON.stringify({ error: 'Bot detected' }), { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const now = Date.now();
  const rateLimitKey = `${clientIP}:${Math.floor(now / 60000)}`;
  
  if (RATE_LIMIT_MAP[rateLimitKey]) {
    RATE_LIMIT_MAP[rateLimitKey].count++;
    if (RATE_LIMIT_MAP[rateLimitKey].count > 10) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } else {
    RATE_LIMIT_MAP[rateLimitKey] = { count: 1, timestamp: now };
  }

  const count = VIEW_COUNTERS[slug] || Math.floor(Math.random() * 500) + 100;
  VIEW_COUNTERS[slug] = count + 1;

  return new Response(JSON.stringify({ views: VIEW_COUNTERS[slug] }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=10'
    }
  });
};