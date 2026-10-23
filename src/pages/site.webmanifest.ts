const base = import.meta.env.BASE_URL;

const manifest = {
  name: 'Console do Jeff',
  short_name: 'Console',
  description: 'Projetos, código e aprendizados de Jefferson Lopes no desenvolvimento de software.',
  lang: 'pt-BR',
  dir: 'ltr',
  start_url: base,
  scope: base,
  display: 'standalone',
  background_color: '#faf9f6',
  theme_color: '#0f766e',
  icons: [
    {
      src: `${base}favicon.svg`,
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any'
    },
    {
      src: `${base}og-default.png`,
      sizes: '1200x630',
      type: 'image/png',
      purpose: 'any'
    }
  ]
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8'
    }
  });
}
