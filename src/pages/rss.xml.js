import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const base = import.meta.env.BASE_URL;

  return rss({
    title: 'Console do Jeff',
    description: 'Blog técnico de alta performance focado em desenvolvimento de software',
    site: context.site,
    items: sortedPosts.map(post => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `${base}blog/${post.id}/`,
      categories: [post.data.category, ...post.data.tags]
    })),
    customData: `<language>pt-BR</language>`,
    stylesheet: `${base}rss/styles.xsl`
  });
}
