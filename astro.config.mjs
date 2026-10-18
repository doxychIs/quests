import { defineConfig } from 'astro/config';
export default defineConfig({site:process.env.SITE_URL || 'https://gran.example',base:process.env.BASE_PATH || '/',output:'static',devToolbar:{enabled:false},trailingSlash:'always',build:{format:'directory'}});
