export default defineNuxtConfig({
  modules: ['aeo.js/nuxt'],
  aeo: {
    title: 'AEO Demo Site',
    description: 'A demo site showcasing aeo.js — the open-source Answer Engine Optimization library',
    url: 'https://demo.aeojs.org',
    schema: {
      organization: {
        name: 'aeo.js',
        url: 'https://demo.aeojs.org',
        logo: 'https://demo.aeojs.org/logo.png',
        sameAs: ['https://github.com/rubenmarcus/aeo.js', 'https://x.com/aeojs'],
      },
      defaultType: 'Article',
    },
    og: {
      image: 'https://demo.aeojs.org/og-image.png',
      twitterHandle: '@aeojs',
    },
  },
  devtools: { enabled: false },
  // Needed for file:../../ symlink — ensures @nuxt/kit resolves from this project
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
  },
});
