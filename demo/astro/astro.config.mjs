import { defineConfig } from 'astro/config';
import aeoAstroIntegration from 'aeo.js/astro';

export default defineConfig({
  site: 'https://aeo-js.vercel.app',
  integrations: [
    aeoAstroIntegration({
      title: 'AEO Demo Site',
      description: 'A demo site showcasing aeo.js — the open-source Answer Engine Optimization library for modern web frameworks',
      url: 'https://aeo-js.vercel.app',
      schema: {
        organization: {
          name: 'aeo.js',
          url: 'https://aeo-js.vercel.app',
          logo: 'https://aeo-js.vercel.app/logo.png',
          sameAs: ['https://github.com/rubenmarcus/aeo.js', 'https://x.com/aeojs'],
        },
        defaultType: 'Article',
      },
      og: {
        image: 'https://aeo-js.vercel.app/og-image.png',
        twitterHandle: '@aeojs',
      },
    }),
  ],
});
