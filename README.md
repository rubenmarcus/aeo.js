<p align="center">
  <h1 align="center">aeo.js</h1>
  <p align="center">Answer Engine Optimization for the modern web.<br/>Make your site discoverable by ChatGPT, Claude, Perplexity, and every AI answer engine.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/aeo.js"><img src="https://img.shields.io/npm/v/aeo.js?style=flat&colorA=0d0d0d&colorB=1a1a1a" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/aeo.js"><img src="https://img.shields.io/npm/dm/aeo.js?style=flat&colorA=0d0d0d&colorB=1a1a1a" alt="npm downloads"></a>
  <a href="https://github.com/rubenmarcus/aeo.js"><img src="https://img.shields.io/github/stars/rubenmarcus/aeo.js?style=flat&colorA=0d0d0d&colorB=1a1a1a" alt="GitHub stars"></a>
  <a href="https://github.com/rubenmarcus/aeo.js/blob/main/LICENSE"><img src="https://img.shields.io/github/license/rubenmarcus/aeo.js?style=flat&colorA=0d0d0d&colorB=1a1a1a" alt="License"></a>
</p>

<p align="center">
  <a href="https://aeojs.org">Documentation</a> · <a href="https://check.aeojs.org">AEO Checker</a> · <a href="https://www.npmjs.com/package/aeo.js">npm</a>
</p>

<p align="center">
  <img src="example.gif" alt="aeo.js in action" width="700">
</p>

## Install

```bash
npm install aeo.js
```

## Check any site in 10 seconds

See how visible a site is to ChatGPT, Claude, Perplexity & co — no install, no config:

```bash
npx aeo.js check mysite.com
```

You get a 0–100 GEO readiness score, an access matrix for 23 AI crawlers, average content citability, and the top fixes — for any deployed site. Also available in the browser at [check.aeojs.org](https://check.aeojs.org).

## Quick Start

### Astro

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { aeoAstroIntegration } from 'aeo.js/astro';

export default defineConfig({
  site: 'https://mysite.com',
  integrations: [
    aeoAstroIntegration({
      title: 'My Site',
      description: 'A site optimized for AI discovery',
      url: 'https://mysite.com',
    }),
  ],
});
```

### Next.js

```js
// next.config.mjs
import { withAeo } from 'aeo.js/next';

export default withAeo({
  aeo: {
    title: 'My Site',
    description: 'A site optimized for AI discovery',
    url: 'https://mysite.com',
  },
});
```

Add the post-build step to `package.json`:

```json
{
  "scripts": {
    "postbuild": "node -e \"import('aeo.js/next').then(m => m.postBuild({ title: 'My Site', url: 'https://mysite.com' }))\""
  }
}
```

### Vite

```js
// vite.config.ts
import { defineConfig } from 'vite';
import { aeoVitePlugin } from 'aeo.js/vite';

export default defineConfig({
  plugins: [
    aeoVitePlugin({
      title: 'My Site',
      description: 'A site optimized for AI discovery',
      url: 'https://mysite.com',
    }),
  ],
});
```

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['aeo.js/nuxt'],
  aeo: {
    title: 'My Site',
    description: 'A site optimized for AI discovery',
    url: 'https://mysite.com',
  },
});
```

### Remix

```json
{
  "scripts": {
    "postbuild": "node -e \"import('aeo.js/remix').then(m => m.postBuild({ title: 'My Site', url: 'https://mysite.com' }))\""
  }
}
```

### SvelteKit

```json
{
  "scripts": {
    "postbuild": "node -e \"import('aeo.js/sveltekit').then(m => m.postBuild({ title: 'My Site', url: 'https://mysite.com' }))\""
  }
}
```

### TanStack Start

```json
{
  "scripts": {
    "postbuild": "node -e \"import('aeo.js/tanstack-start').then(m => m.postBuild({ title: 'My Site', url: 'https://mysite.com' }))\""
  }
}
```

Routes are discovered from `src/routes` (TanStack Router file conventions). No build output yet? Use `generate()` instead of `postBuild()` to emit files into `public/` from your source routes.

### Docusaurus

```js
// docusaurus.config.js
module.exports = {
  plugins: [
    ['aeo.js/docusaurus', { url: 'https://mysite.com', title: 'My Docs' }],
  ],
};
```

`url`, `title`, and `description` default to your Docusaurus `siteConfig` (including `baseUrl`) when omitted. AEO files are generated from the built HTML during `docusaurus build`, and the widget is injected on every page.

### Eleventy

```js
// eleventy.config.js
const aeo = require('aeo.js/eleventy');

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(aeo, { url: 'https://mysite.com', title: 'My Site' });
};
```

Requires Eleventy 2.0+. AEO files are generated from the rendered output into your Eleventy output directory (`_site` by default), and the widget is injected into every HTML page.

### VitePress

```ts
// .vitepress/config.ts
import { defineConfig } from 'vitepress';
import { withAeo } from 'aeo.js/vitepress';

export default defineConfig(withAeo({
  title: 'My Docs',
  // …your VitePress config…
}, { url: 'https://mysite.com' }));
```

`withAeo` wraps your config: it collects pages during `vitepress build`, injects the widget, and generates AEO files into the output directory. `url`, `title`, and `description` default from your VitePress site config (and `sitemap.hostname`).

### Angular

```json
{
  "scripts": {
    "postbuild": "node -e \"import('aeo.js/angular').then(m => m.postBuild({ title: 'My App', url: 'https://myapp.com' }))\""
  }
}
```

### Webpack

```js
// webpack.config.js
const { AeoWebpackPlugin } = require('aeo.js/webpack');

module.exports = {
  plugins: [
    new AeoWebpackPlugin({
      title: 'My Site',
      description: 'A site optimized for AI discovery',
      url: 'https://mysite.com',
    }),
  ],
};
```

### CLI

No framework needed — run standalone:

```bash
npx aeo.js generate --url https://mysite.com --title "My Site"
npx aeo.js init
npx aeo.js check
```

`init` detects your framework, prefills `aeo.config.ts` from package.json, and with `--yes` generates everything in one command:

```bash
npx aeo.js init --url https://mysite.com --yes
```

### MCP server

Let Claude Code, Cursor or any MCP client audit and fix sites conversationally:

```bash
claude mcp add aeo -- npx -y aeo.js mcp
```

Tools: `audit_url` (0-100 GEO score for any live site), `score_citability` (score draft content), `generate_aeo_files` (write the full AEO file set). See the [MCP docs](https://aeojs.org/docs/features/mcp/).

## Supported Frameworks

| Framework | Import |
|-----------|--------|
| Astro | `aeo.js/astro` |
| Next.js | `aeo.js/next` |
| Vite | `aeo.js/vite` |
| Nuxt | `aeo.js/nuxt` |
| Remix | `aeo.js/remix` |
| SvelteKit | `aeo.js/sveltekit` |
| Angular | `aeo.js/angular` |
| Webpack | `aeo.js/webpack` |
| CLI | `npx aeo.js generate` |

## Widget

The Human/AI widget lets visitors toggle between the normal page and its AI-readable markdown version.

| Default | Small | Icon |
|---------|-------|------|
| <img src="widget-default.gif" alt="Default widget" width="220"> | <img src="widget-small.gif" alt="Small widget" width="220"> | <img src="widget-icon.gif" alt="Icon widget" width="220"> |

Framework plugins inject it automatically. For Next.js or manual setups:

```tsx
'use client';
import { useEffect } from 'react';

export function AeoWidgetLoader() {
  useEffect(() => {
    import('aeo.js/widget').then(({ AeoWidget }) => {
      new AeoWidget({
        config: {
          title: 'My Site',
          url: 'https://mysite.com',
          widget: { enabled: true, position: 'bottom-right' },
        },
      });
    });
  }, []);
  return null;
}
```

React and Vue wrapper components are also available:

```tsx
import { AeoReactWidget } from 'aeo.js/react';

<AeoReactWidget config={{ title: 'My Site', url: 'https://mysite.com' }} />
```

```vue
<script setup>
import { AeoVueWidget } from 'aeo.js/vue';
</script>

<template>
  <AeoVueWidget :config="{ title: 'My Site', url: 'https://mysite.com' }" />
</template>
```

## Generated Files

After building, your output directory contains:

```
public/
├── robots.txt        # AI-crawler directives
├── llms.txt          # Short LLM-readable summary
├── llms-full.txt     # Full content for LLMs
├── sitemap.xml       # Standard sitemap
├── docs.json         # Documentation manifest
├── ai-index.json     # AI content index
├── index.md          # Markdown for /
└── about.md          # Markdown for /about
```

## Configuration

```js
import { defineConfig } from 'aeo.js';

export default defineConfig({
  title: 'My Site',
  url: 'https://mysite.com',
  description: 'A description of your site',

  generators: {
    robotsTxt: true,
    llmsTxt: true,
    llmsFullTxt: true,
    rawMarkdown: true,
    sitemap: true,
    aiIndex: true,
    schema: true,
  },

  schema: {
    enabled: true,
    organization: { name: 'My Company', url: 'https://mysite.com' },
    defaultType: 'WebPage',
  },

  og: {
    enabled: true,
    image: 'https://mysite.com/og.png',
    twitterHandle: '@mycompany',
  },

  widget: {
    enabled: true,
    position: 'bottom-right',
    theme: { accent: '#4ADE80', badge: '#4ADE80' },
  },
});
```

Full configuration reference → [aeojs.org/reference/configuration](https://aeojs.org/reference/configuration/)

## Why AEO?

- **58% of searches** end without a click — AI gives the answer directly
- **40% of Gen Z** prefer AI assistants over traditional search engines
- **97% of sites** have no `llms.txt` or structured data for AI crawlers
- **1 minute** to set up with aeo.js

If your site isn't optimized for AI engines, you're invisible to a growing share of users who never open a search results page.

## Links

- [Documentation](https://aeojs.org)
- [AEO Checker](https://check.aeojs.org)
- [npm](https://www.npmjs.com/package/aeo.js)
- [GitHub](https://github.com/rubenmarcus/aeo.js)

## License

MIT
