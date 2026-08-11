import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aeoVitePlugin } from 'aeo.js/vite';

export default defineConfig({
  plugins: [
    react(),
    aeoVitePlugin({
      title: 'AEO Demo Site',
      description: 'A demo site showcasing aeo.js integration with Vite + React',
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
      pages: [
        { pathname: '/', title: 'Home', description: 'Welcome to AEO Demo' },
        { pathname: '/about', title: 'About', description: 'About the AEO Demo' },
        { pathname: '/products', title: 'Products', description: 'Our Products' },
        { pathname: '/docs', title: 'Documentation', description: 'Getting Started with aeo.js' },
        { pathname: '/faq', title: 'FAQ', description: 'Frequently Asked Questions' },
        { pathname: '/pricing', title: 'Pricing', description: 'Simple, Open-Source Pricing' },
        { pathname: '/blog', title: 'Blog', description: 'Latest from aeo.js' },
        { pathname: '/contact', title: 'Contact', description: 'Contact Us' },
      ],
    }),
  ],
});
