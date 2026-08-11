export const SITE = {
  title: 'AEO Demo Site',
  description: 'A demo site showcasing aeo.js — the open-source Answer Engine Optimization library for modern web frameworks',
  url: 'https://demo.aeojs.org',
};

export const AEO_CONFIG = {
  title: SITE.title,
  description: SITE.description,
  url: SITE.url,
  schema: {
    organization: {
      name: 'aeo.js',
      url: SITE.url,
      logo: `${SITE.url}/logo.png`,
      sameAs: [
        'https://github.com/rubenmarcus/aeo.js',
        'https://x.com/aeojs',
      ],
    },
    defaultType: 'Article' as const,
  },
  og: {
    image: `${SITE.url}/og-image.png`,
    twitterHandle: '@aeojs',
    type: 'website' as const,
  },
  widget: {
    enabled: true,
    position: 'bottom-right' as const,
  },
};

export const PAGES = {
  home: {
    title: 'Home',
    heading: 'Answer Engine Optimization for the Modern Web',
    description: 'aeo.js makes your website discoverable by AI crawlers, LLMs, and answer engines — automatically.',
    body: `aeo.js is an open-source library that generates all the files AI systems need to understand your website. It supports 6 major frameworks and produces robots.txt, llms.txt, sitemap.xml, schema.json, and per-page markdown files from your existing content.

Over 2,500 developers use aeo.js to optimize their sites for AI discovery. The library has been downloaded over 50,000 times since its launch in 2024 and supports Next.js, Astro, Nuxt, Vite, Angular, and Webpack out of the box.`,
    stats: [
      { label: 'Downloads', value: '50,000+' },
      { label: 'GitHub Stars', value: '1,200+' },
      { label: 'Frameworks', value: '6' },
      { label: 'Generated Files', value: '8 types' },
    ],
  },
  about: {
    title: 'About',
    heading: 'About aeo.js',
    description: 'Learn how aeo.js generates AI-ready content from your existing pages with zero configuration.',
    body: `aeo.js is a zero-dependency build-time library that transforms any website into an AI-discoverable resource. Founded in 2024, the project addresses a critical gap: most websites are invisible to AI crawlers because they lack the structured files that LLMs and answer engines require.

The library works by scanning your built HTML pages, extracting content, and generating a suite of standardized files. These include robots.txt with AI-specific directives, llms.txt summaries, sitemap.xml, Schema.org JSON-LD structured data, and per-page markdown files that AI systems can parse directly.

Unlike traditional SEO tools that focus on search engine rankings, aeo.js targets the emerging ecosystem of AI-powered search — ChatGPT, Perplexity, Google AI Overviews, and Bing Copilot. These platforms need structured, machine-readable content to generate accurate citations and answers.`,
    features: [
      'Zero-config integration with 6 major frameworks',
      'Automatic Schema.org JSON-LD generation (WebSite, Organization, Article, FAQPage)',
      'Open Graph and Twitter Card meta tags',
      'GEO Readiness Score — a 0-100 audit of your AI discoverability',
      'Per-page AI Citability scoring with actionable optimization hints',
      'Platform-specific insights for ChatGPT, Perplexity, Google AI, and Bing Copilot',
    ],
  },
  products: {
    title: 'Products',
    heading: 'What aeo.js Generates',
    description: 'Discover the 8 file types that aeo.js generates to make your site AI-discoverable.',
    body: 'aeo.js generates 8 types of files from your existing content, each targeting a different aspect of AI discoverability:',
    items: [
      { name: 'robots.txt', description: 'AI-aware directives that allow GPTBot, ClaudeBot, Bingbot, and other AI crawlers to index your content. Includes sitemap references and crawl delay settings.' },
      { name: 'llms.txt', description: 'A concise summary of your site optimized for LLM context windows. Contains site metadata, page list with descriptions, and navigation structure.' },
      { name: 'llms-full.txt', description: 'Complete content export with full markdown text for every page. Designed for AI systems that need deep content understanding.' },
      { name: 'sitemap.xml', description: 'Standard XML sitemap with all discoverable pages, last-modified dates, and change frequency hints for search engines and AI crawlers.' },
      { name: 'ai-index.json', description: 'Structured JSON index with page content, descriptions, keywords, and metadata — purpose-built for AI ingestion pipelines.' },
      { name: 'schema.json', description: 'Schema.org JSON-LD structured data including WebSite, Organization, Article/WebPage, BreadcrumbList, and auto-detected FAQPage schemas.' },
      { name: 'docs.json', description: 'Documentation manifest with categorized content, markdown URLs, and content summaries for AI documentation assistants.' },
      { name: 'Per-page .md files', description: 'Individual markdown files for each page with YAML frontmatter, clean content extraction, and structural preservation.' },
    ],
  },
  docs: {
    title: 'Documentation',
    heading: 'Getting Started with aeo.js',
    description: 'Complete guide to installing and configuring aeo.js in your project.',
    sections: [
      {
        title: 'Installation',
        content: 'Install aeo.js as a dependency in your project with npm install aeo.js. The library has zero runtime dependencies, is under 50KB, and works with Node.js 18 or later.',
      },
      {
        title: 'Quick Start',
        content: 'Add the aeo.js plugin to your framework configuration file. For Vite, add it to vite.config.ts. For Next.js, wrap your config with withAeo(). For Astro, add the integration. For Nuxt, add the module. The plugin automatically scans your pages at build time and generates all AEO files.',
      },
      {
        title: 'Configuration',
        content: 'Create an aeo.config.ts file to customize behavior. Key options include title (site name for Schema.org), url (production URL for sitemaps), description (meta tags and llms.txt), schema.organization (name, logo, sameAs profiles), og.image (default OG image), and generators (toggle individual file generators).',
      },
      {
        title: 'CLI Commands',
        content: 'aeo.js provides three CLI commands: "npx aeo.js generate" generates all AEO files, "npx aeo.js check" shows your GEO readiness score (0-100), and "npx aeo.js report" creates a full AEO/GEO report with citability scores and platform optimization hints.',
      },
    ],
  },
  faq: {
    title: 'FAQ',
    heading: 'Frequently Asked Questions',
    description: 'Common questions about aeo.js, answer engine optimization, and AI discoverability.',
    questions: [
      {
        question: 'What is Answer Engine Optimization (AEO)?',
        answer: 'Answer Engine Optimization is the practice of making your website content easily discoverable and extractable by AI-powered search engines and answer engines. Unlike traditional SEO which focuses on ranking in search results, AEO ensures that AI systems like ChatGPT, Perplexity, and Google AI Overviews can accurately understand, cite, and surface your content.',
      },
      {
        question: 'How is AEO different from SEO?',
        answer: 'SEO focuses on ranking signals like backlinks, keywords, and page speed to appear in traditional search results. AEO focuses on content structure, machine-readable formats, and Schema.org markup to help AI systems extract and cite your content. AEO and SEO are complementary — good AEO practices also improve SEO.',
      },
      {
        question: 'Does aeo.js work with my framework?',
        answer: 'aeo.js supports 6 major frameworks out of the box: Next.js (App Router and Pages Router), Astro, Nuxt 3, Vite (with any frontend library), Angular 17+, and Webpack. Each framework has a dedicated plugin that integrates with its build pipeline.',
      },
      {
        question: 'What is a GEO Readiness Score?',
        answer: 'The GEO Readiness Score is a 0-100 rating that measures how well your site is optimized for AI discovery. It evaluates 5 categories: AI Access, Content Structure, Schema Presence, Meta Quality, and Citability.',
      },
      {
        question: 'Does aeo.js require any external APIs?',
        answer: 'No. aeo.js is a zero-dependency, build-time library. It runs entirely on your machine during the build process with no external API calls, no cloud services, and no tracking.',
      },
      {
        question: 'How do I improve my AI Citability Score?',
        answer: 'Write self-contained paragraphs, include concrete statistics and dates, use FAQ-style headings ending with question marks, structure content with lists and short paragraphs under 167 words, and add a summary section at the top of long pages.',
      },
    ],
  },
  pricing: {
    title: 'Pricing',
    heading: 'Simple, Open-Source Pricing',
    description: 'aeo.js is free and open-source under the MIT license. Enterprise support available for teams.',
    body: `aeo.js is 100% free and open-source under the MIT license. The core library, all framework plugins, CLI tools, and documentation are freely available on GitHub.

For teams that need dedicated support, custom integrations, or priority bug fixes, we offer an Enterprise plan at $49 per month per project. Enterprise customers get direct Slack access to the core team, priority GitHub issues, and custom plugin development.

Since launch, 85% of our users run aeo.js on the free tier. The remaining 15% of Enterprise customers fund ongoing development, ensuring the project stays sustainable.`,
    tiers: [
      { name: 'Open Source', price: 'Free', features: ['All 8 file generators', '6 framework plugins', 'CLI tools', 'GEO Readiness Score', 'Citability analysis', 'Community support'] },
      { name: 'Enterprise', price: '$49/mo', features: ['Everything in Open Source', 'Priority Slack support', 'Custom plugin development', 'Priority bug fixes', 'Dedicated onboarding', 'SLA guarantees'] },
    ],
  },
  blog: {
    title: 'Blog',
    heading: 'Latest from aeo.js',
    description: 'News, updates, and insights about answer engine optimization and AI discoverability.',
    posts: [
      {
        title: 'Why Your Website is Invisible to AI',
        date: '2024-12-15',
        excerpt: 'Over 90% of websites lack the structured files that AI systems need to cite their content.',
        content: 'Most websites today are invisible to AI-powered search engines. AI systems need content in formats like markdown, JSON-LD, and plain text. Without these files, your content does not exist in the AI knowledge base. Studies show that websites with structured AI-ready files are cited 3.2x more frequently by answer engines.',
      },
      {
        title: 'GEO vs SEO: The New Landscape',
        date: '2025-01-20',
        excerpt: 'Generative Engine Optimization is reshaping how we think about web content.',
        content: 'Research from Georgia Tech found that 47% of AI-generated answers cite content from sources that optimize for machine readability. Self-contained factual paragraphs are cited 2.1x more than context-dependent text. Content with statistics is cited 1.8x more than content without.',
      },
    ],
  },
  contact: {
    title: 'Contact',
    heading: 'Contact Us',
    description: 'Get in touch with the aeo.js team for support, partnerships, or contributions.',
    body: 'Reach us at hello@aeojs.org or visit our GitHub repository at github.com/rubenmarcus/aeo.js. We welcome contributions, bug reports, and feature requests. For enterprise inquiries, email enterprise@aeojs.org.',
  },
} as const;

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/products', label: 'Products' },
  { href: '/docs', label: 'Docs' },
  { href: '/faq', label: 'FAQ' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];
