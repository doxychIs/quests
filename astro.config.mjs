import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL || 'https://gran.example',
  base: process.env.BASE_PATH || '/',
  output: 'static',
  devToolbar: { enabled: false },
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [{
    name: 'separate-vite-caches',
    hooks: {
      // Astro also starts Vite while building. Keep it from invalidating
      // the optimized modules of an already running local preview.
      'astro:config:setup': ({ command, updateConfig }) => {
        updateConfig({ vite: { cacheDir: `.astro/vite-${command}` } });
      },
    },
  }],
});
