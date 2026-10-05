#!/usr/bin/env node

import { generateAEOFiles } from './core/generate-wrapper';
import { resolveConfig, readPackageJson } from './core/utils';
import { detectFramework } from './core/detect';
import type { FrameworkType } from './types';
import { auditSite, formatAuditReport } from './core/audit';
import { generateReport, formatReportMarkdown, formatReportJson } from './core/report';
import { discover, crawlPages } from './core/remote-crawl';
import { buildRemoteReport, formatRemoteReport } from './core/remote-audit';
import type { RemoteScanReport } from './core/remote-audit';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'node:readline/promises';
import { VERSION } from './index';

const HELP = `
aeo.js v${VERSION} — Answer Engine Optimization for the modern web

Usage:
  npx aeo.js <command> [options]

Commands:
  generate          Generate all AEO files (robots.txt, llms.txt, sitemap.xml, etc.)
  init              Create aeo.config.ts: detects the framework, prefills from package.json,
                    optionally generates everything in one run
  check [url]       GEO readiness score (0-100) — local setup, or any live site
  report [url]      Full AEO/GEO report with citability scores and platform hints
  mcp               Run an MCP server (stdio) exposing audit and generation tools

Options:
  --out <dir>       Output directory (default: auto-detected)
  --url <url>       Site URL (default: https://example.com)
  --title <title>   Site title (default: from package.json name)
  --no-widget       Disable widget generation
  --yes             init: skip prompts, generate immediately (agent-friendly)
  --force           init: overwrite an existing aeo.config.ts
  --help, -h        Show this help message
  --version, -v     Show version

Examples:
  npx aeo.js generate
  npx aeo.js generate --url https://mysite.com --title "My Site"
  npx aeo.js init
  npx aeo.js check
  npx aeo.js check mysite.com
  npx aeo.js check https://mysite.com --json
  npx aeo.js report
  npx aeo.js init --url https://mysite.com --yes
`;

// Map kebab-case flag names to the camelCase keys the rest of the CLI reads.
const FLAG_ALIASES: Record<string, string> = {
  'no-widget': 'noWidget',
};

// Flags that always represent a boolean value, regardless of how they were passed.
const BOOLEAN_FLAGS: Record<string, true> = {
  help: true,
  version: true,
  noWidget: true,
  json: true,
  yes: true,
  force: true,
};

function normalizeKey(key: string): string {
  return FLAG_ALIASES[key] ?? key;
}

function coerceValue(key: string, raw: string): string | boolean {
  if (BOOLEAN_FLAGS[key]) {
    return raw !== 'false' && raw !== '0';
  }
  return raw;
}

export function parseArgs(args: string[]): { command: string; flags: Record<string, string | boolean>; positionals: string[] } {
  let command = 'help';
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // Support both "--flag value" and "--flag=value" forms
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      const key = normalizeKey(arg.slice(2, eq));
      flags[key] = coerceValue(key, arg.slice(eq + 1));
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg.startsWith('--')) {
      const key = normalizeKey(arg.slice(2));
      if (BOOLEAN_FLAGS[key]) {
        // Boolean flags never consume the next token.
        flags[key] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = coerceValue(key, args[++i]);
      }
    } else if (!arg.startsWith('-')) {
      if (command === 'help') {
        command = arg;
      } else {
        positionals.push(arg);
      }
    }
  }

  return { command, flags, positionals };
}

/**
 * Normalize a CLI target into an http(s) URL, accepting bare domains
 * like "example.com". Returns null for anything that isn't a usable target.
 */
export function normalizeTargetUrl(input: string): string | null {
  let candidate = input.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(candidate)) return null;
    candidate = 'https://' + candidate;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

async function cmdGenerate(flags: Record<string, string | boolean>): Promise<void> {
  const framework = detectFramework();
  console.log(`[aeo.js] Detected framework: ${framework.framework}`);

  const config = resolveConfig({
    title: typeof flags.title === 'string' ? flags.title : undefined,
    url: typeof flags.url === 'string' ? flags.url : undefined,
    outDir: typeof flags.out === 'string' ? flags.out : undefined,
    widget: flags.noWidget ? { enabled: false } : undefined,
  });

  console.log(`[aeo.js] Output directory: ${config.outDir}`);
  console.log(`[aeo.js] Generating AEO files...`);

  const result = await generateAEOFiles(config);

  if (result.files.length > 0) {
    console.log(`[aeo.js] Generated ${result.files.length} files:`);
    for (const file of result.files) {
      console.log(`  - ${file}`);
    }
  } else {
    console.log('[aeo.js] No files generated.');
  }

  if (result.errors.length > 0) {
    console.error(`[aeo.js] ${result.errors.length} error(s):`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
}

/** Turn "@scope/my-site" into "My Site" for config prefill. */
function humanizePkgName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const base = name.split('/').pop() ?? name;
  return base
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || undefined;
}

/** Framework-specific wiring snippet printed after init, when one exists. */
function pluginSnippet(framework: FrameworkType): string | null {
  switch (framework) {
    case 'next':
      return [
        '// next.config.mjs',
        "import withAeo from 'aeo.js/next';",
        '',
        'export default withAeo({ aeo: { /* mirrors aeo.config.ts */ } });',
      ].join('\n');
    case 'vite':
      return [
        '// vite.config.ts',
        "import { aeoVitePlugin } from 'aeo.js/vite';",
        '',
        'export default defineConfig({ plugins: [aeoVitePlugin()] });',
      ].join('\n');
    case 'astro':
      return [
        '// astro.config.mjs',
        "import { aeoAstroIntegration } from 'aeo.js/astro';",
        '',
        'export default defineConfig({ integrations: [aeoAstroIntegration()] });',
      ].join('\n');
    default:
      return null;
  }
}

function buildConfigTemplate(title: string, url: string, description: string): string {
  const descLine = description
    ? `description: ${JSON.stringify(description)},`
    : `// description: 'A site optimized for AI discovery',`;
  return `import { defineConfig } from 'aeo.js';

export default defineConfig({
  // Required
  title: ${JSON.stringify(title)},
  url: ${JSON.stringify(url)},

  // Optional
  ${descLine}

  // Toggle individual generators
  generators: {
    robotsTxt: true,
    llmsTxt: true,
    llmsFullTxt: true,
    rawMarkdown: true,
    manifest: true,
    sitemap: true,
    aiIndex: true,
  },

  // Customize robots.txt
  robots: {
    allow: ['/'],
    disallow: ['/admin'],
    crawlDelay: 0,
  },

  // Widget configuration
  widget: {
    enabled: true,
    position: 'bottom-right',
    humanLabel: 'Human',
    aiLabel: 'AI',
    showBadge: true,
    theme: {
      background: 'rgba(18, 18, 24, 0.9)',
      text: '#C0C0C5',
      accent: '#E8E8EA',
      badge: '#4ADE80',
    },
  },
});
`;
}

async function cmdInit(flags: Record<string, string | boolean>): Promise<void> {
  const cwd = process.cwd();
  const configPath = join(cwd, 'aeo.config.ts');

  if (existsSync(configPath) && flags.force !== true) {
    console.error('[aeo.js] aeo.config.ts already exists. Use --force to overwrite it.');
    process.exit(1);
  }

  const framework = detectFramework(cwd);
  const pkg = readPackageJson(cwd);
  console.log(`[aeo.js] Detected framework: ${framework.framework}`);

  const flagTitle = typeof flags.title === 'string' ? flags.title : undefined;
  const flagUrl = typeof flags.url === 'string' ? flags.url : undefined;
  const flagDescription = typeof flags.description === 'string' ? flags.description : undefined;

  let title = flagTitle ?? humanizePkgName(pkg.name);
  let url = flagUrl;
  const description =
    flagDescription ?? (typeof pkg.description === 'string' ? pkg.description : '');
  // Prompts only when interactive; --yes (or a non-TTY agent) never blocks.
  const interactive = process.stdin.isTTY && flags.yes !== true;
  if (interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!title) {
        title = (await rl.question('Site title? ')).trim() || 'My Site';
      }
      if (!url) {
        url = (await rl.question('Site URL (e.g. https://mysite.com)? ')).trim() || undefined;
      }
    } finally {
      rl.close();
    }
  }

  if (!title) title = 'My Site';
  if (!url) {
    url = 'https://example.com';
    console.error('[aeo.js] No URL provided — config uses a placeholder. Pass --url or edit aeo.config.ts.');
  }

  writeFileSync(configPath, buildConfigTemplate(title, url, description), 'utf-8');
  console.log(`[aeo.js] Created aeo.config.ts (title: ${title}, url: ${url})`);

  const snippet = pluginSnippet(framework.framework);
  if (snippet) {
    console.log(`[aeo.js] Optional ${framework.framework} wiring:\n${snippet}`);
  }

  if (flags.yes === true) {
    console.log('[aeo.js] Generating AEO files...');
    const config = resolveConfig({ url, widget: flags.noWidget ? { enabled: false } : undefined });
    const result = await generateAEOFiles(config);
    for (const file of result.files) console.log(`  - ${file}`);
    for (const error of result.errors) console.error(`  - ${error}`);
    if (result.errors.length > 0) process.exit(1);
    console.log(`[aeo.js] Done. After deploy, verify with: npx aeo.js check ${url}`);
  } else {
    console.log('[aeo.js] Next: edit aeo.config.ts, then run `npx aeo.js generate`.');
    console.log(`[aeo.js] After deploy, verify with: npx aeo.js check ${url}`);
  }
}

async function scanRemote(targetUrl: string): Promise<RemoteScanReport> {
  if (typeof fetch !== 'function') {
    console.error('[aeo.js] URL checks require Node 18+ (global fetch).');
    process.exit(1);
  }

  console.error(`[aeo.js] Scanning ${targetUrl} ...`);
  const discovery = await discover(targetUrl);

  if (!discovery.homepage) {
    console.error(`[aeo.js] Could not reach ${targetUrl} — check the URL and try again.`);
    process.exit(1);
  }

  const pages = await crawlPages(discovery, targetUrl);
  console.error(`[aeo.js] Crawled ${pages.length} page(s).`);
  return buildRemoteReport(targetUrl, discovery, pages);
}

/** Report JSON for terminal output — drops raw page HTML to keep it readable. */
function remoteReportJson(report: RemoteScanReport): string {
  return JSON.stringify(
    {
      ...report,
      discovery: {
        ...report.discovery,
        homepage: report.discovery.homepage ? { url: report.discovery.homepage.url } : null,
      },
      pages: report.pages.map(({ html: _html, ...page }) => page),
    },
    null,
    2
  );
}

async function cmdCheckRemote(targetUrl: string, flags: Record<string, string | boolean>): Promise<void> {
  const report = await scanRemote(targetUrl);

  if (flags.json) {
    console.log(remoteReportJson(report));
    return;
  }

  console.log(formatRemoteReport(report));
}

async function cmdReportRemote(targetUrl: string, flags: Record<string, string | boolean>): Promise<void> {
  const report = await scanRemote(targetUrl);

  if (flags.json) {
    console.log(remoteReportJson(report));
    return;
  }

  console.log(formatRemoteReport(report));
  console.log('Platform hints:');
  for (const hint of report.platformHints) {
    console.log(`  ${hint.platform} [${hint.status}]`);
    for (const tip of hint.tips) {
      console.log(`    * ${tip}`);
    }
  }
  console.log();
  console.log('Per-page citability:');
  for (const page of report.citability.pages) {
    console.log(`  ${page.score}/100  ${page.pathname}`);
  }
}

function cmdCheck(flags: Record<string, string | boolean>): void {
  const framework = detectFramework();
  const config = resolveConfig({
    title: typeof flags.title === 'string' ? flags.title : undefined,
    url: typeof flags.url === 'string' ? flags.url : undefined,
    outDir: typeof flags.out === 'string' ? flags.out : undefined,
  });

  // Run the GEO audit
  const auditResult = auditSite(config);

  if (flags.json) {
    console.log(JSON.stringify({ framework: framework.framework, config: { title: config.title, url: config.url, outDir: config.outDir }, audit: auditResult }, null, 2));
    return;
  }

  console.log(`[aeo.js] AEO Configuration Check`);
  console.log(`${'─'.repeat(40)}`);
  console.log(`  Framework:    ${framework.framework}`);
  console.log(`  Content dir:  ${config.contentDir}`);
  console.log(`  Output dir:   ${config.outDir}`);
  console.log(`  Title:        ${config.title}`);
  console.log(`  URL:          ${config.url}`);
  console.log(`  Widget:       ${config.widget.enabled ? 'enabled' : 'disabled'}`);
  console.log();
  console.log(`  Generators:`);

  const generators = [
    ['robots.txt', config.generators.robotsTxt],
    ['llms.txt', config.generators.llmsTxt],
    ['llms-full.txt', config.generators.llmsFullTxt],
    ['raw markdown', config.generators.rawMarkdown],
    ['docs.json', config.generators.manifest],
    ['sitemap.xml', config.generators.sitemap],
    ['ai-index.json', config.generators.aiIndex],
    ['schema.json', config.generators.schema],
  ] as const;

  for (const [name, enabled] of generators) {
    console.log(`    ${enabled ? '+' : '-'} ${name}`);
  }

  // Check for config file
  const configPath = join(process.cwd(), 'aeo.config.ts');
  const configPathJs = join(process.cwd(), 'aeo.config.js');
  const hasConfig = existsSync(configPath) || existsSync(configPathJs);

  console.log();
  if (hasConfig) {
    console.log(`  Config file: found`);
  } else {
    console.log(`  Config file: not found (using defaults)`);
    console.log(`  Run \`npx aeo.js init\` to create one.`);
  }

  // GEO Readiness Audit
  console.log();
  console.log(formatAuditReport(auditResult));
}

function cmdReport(flags: Record<string, string | boolean>): void {
  const config = resolveConfig({
    title: typeof flags.title === 'string' ? flags.title : undefined,
    url: typeof flags.url === 'string' ? flags.url : undefined,
    outDir: typeof flags.out === 'string' ? flags.out : undefined,
  });

  const report = generateReport(config);

  if (flags.json) {
    console.log(formatReportJson(report));
  } else {
    console.log(formatReportMarkdown(report));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, flags, positionals } = parseArgs(args);

  if (flags.version) {
    console.log(VERSION);
    return;
  }

  if (flags.help || command === 'help') {
    console.log(HELP);
    return;
  }

  // "check <url>" / "report <url>" audit a live site instead of the local setup
  let targetUrl: string | null = null;
  if ((command === 'check' || command === 'report') && positionals.length > 0) {
    targetUrl = normalizeTargetUrl(positionals[0]);
    if (!targetUrl) {
      console.error(`[aeo.js] "${positionals[0]}" is not a valid URL or domain.`);
      process.exit(1);
    }
  }

  switch (command) {
    case 'generate':
      await cmdGenerate(flags);
      break;
    case 'init':
      await cmdInit(flags);
      break;
    case 'check':
      if (targetUrl) {
        await cmdCheckRemote(targetUrl, flags);
      } else {
        cmdCheck(flags);
      }
      break;
    case 'report':
      if (targetUrl) {
        await cmdReportRemote(targetUrl, flags);
      } else {
        cmdReport(flags);
      }
      break;
    case 'mcp': {
      const { runMcpStdio } = await import('./core/mcp-server');
      runMcpStdio();
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

// Only run the CLI when invoked directly. Importing this module (e.g. tests
// importing parseArgs) must not trigger main() and process.exit().
function isDirectInvocation(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  // Match the bun/node-bundled distribution names and the ts source.
  return /(\/|\\)(cli|aeo\.js|aeojs)(\.[mc]?[tj]s)?$/.test(entry);
}

if (isDirectInvocation()) {
  main().catch((error) => {
    console.error('[aeo.js] Fatal error:', error.message);
    process.exit(1);
  });
}
