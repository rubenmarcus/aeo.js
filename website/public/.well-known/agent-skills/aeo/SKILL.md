---
name: aeo
description: Make a website discoverable by AI answer engines (ChatGPT, Claude, Perplexity, Gemini). Use when a project needs llms.txt, AI-crawler robots.txt, sitemap.xml, JSON-LD schema, ai-index.json, or an AI-readiness score. Works via npx, framework plugins (Next, Astro, Vite, Nuxt, SvelteKit, Remix, Angular), or an MCP server.
---

# aeo.js — Answer Engine Optimization

Open-source library that makes sites readable and citable by AI answer engines.
npm: `aeo.js` · docs: https://aeojs.org · repo: https://github.com/rubenmarcus/aeo.js

## When to use

- The user wants their site to show up in ChatGPT, Claude, Perplexity or Google AI answers.
- The project is missing `llms.txt`, `robots.txt` AI-crawler rules, `sitemap.xml`, or JSON-LD structured data.
- The user asks "is my site visible to AI?" or wants an AI-readiness score.

## Quick audit (no install)

```bash
npx aeo.js check https://example.com
```

Prints a 0-100 GEO readiness score across six categories: AI Access (16),
Agent Protocols (30), Schema Presence (15), Content Structure, Meta Quality,
Citability (13 each). Use `--json` for machine-readable output. Audit before
and after any change to measure the delta.

## Set up a project

```bash
npx aeo.js init --url https://example.com --yes
```

Detects the framework from package.json, writes `aeo.config.ts` prefilled
with title/url/description, and generates the full file set in one run:
`robots.txt` (with AI bot rules), `llms.txt`, `llms-full.txt`, `sitemap.xml`,
`ai-index.json`, `schema.json`, `docs.json`, per-page markdown.

Interactive without `--yes`; never prompts when stdin is not a TTY, so it is
safe inside agents and CI.

## Framework integration

| Framework | Import |
|-----------|--------|
| Next.js | `aeo.js/next` (`withAeo()`) |
| Astro | `aeo.js/astro` (`aeoAstroIntegration()`) |
| Vite | `aeo.js/vite` (`aeoVitePlugin()`) |
| Nuxt | `aeo.js/nuxt` |
| SvelteKit | `aeo.js/sveltekit` |
| Remix | `aeo.js/remix` |
| Angular | `aeo.js/angular` |

## MCP server

Expose audit/generate as MCP tools for Claude Code, Cursor, etc.:

```bash
claude mcp add aeo -- npx -y aeo.js mcp
```

Tools: `audit_url`, `score_citability` (score draft content before
publishing), `generate_aeo_files`.

## Reading the audit

- **AI Access low**: robots.txt blocks AI crawlers (GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended) or llms.txt/sitemap missing.
- **Agent Protocols low**: none of the emerging agent standards published
  (MCP card, WebMCP, Web Bot Auth, OAuth metadata, ARD, api-catalog,
  agent-skills, DNS-AID). Most sites score near zero here.
- **Schema Presence low**: missing Organization/FAQPage JSON-LD, no `sameAs`
  social profiles, no Person author schema.
- **Content Structure low**: client-rendered only (crawlers fetch raw HTML
  without JavaScript) or thin content. Fix by prerendering/server-rendering.
- **Citability low**: no direct-answer paragraphs, no stats, no FAQ patterns.

Every failing check ships with a concrete fix suggestion in the report.
