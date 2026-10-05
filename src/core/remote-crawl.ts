import { extractTextFromHtml, extractTitle, extractDescription, extractJsonLd } from './html-extract';

export interface BotAccessEntry {
  bot: string;
  company: string;
  purpose: string;
  allowed: boolean;
}
/**
 * Agent-facing protocol surface: the emerging standards agent-readiness
 * scanners (Cloudflare's isitagentready, is-agentic, Ora) grade and that a
 * plain content audit misses.
 */
export interface ProtocolDiscovery {
  /** RFC 8288 Link response headers on the homepage (agent discovery hints). */
  linkHeaders: string[];
  /** Server honors `Accept: text/markdown` with a markdown response. */
  markdownNegotiation: boolean;
  /** Raw Content-Signal directive from robots.txt, if declared. */
  contentSignals: string | null;
  /** RFC 9727 API catalog at /.well-known/api-catalog. */
  apiCatalog: boolean;
  /** MCP server card at /.well-known/mcp. */
  mcpCard: boolean;
  /** A2A agent card at /.well-known/agent-card.json. */
  agentCard: boolean;
  /** Agent Skills index at /.well-known/agent-skills/index.json. */
  agentSkills: boolean;
  /** OpenAPI spec at /openapi.json or /swagger.json. */
  openApi: boolean;
  /** DNS-AID: SVCB/HTTPS records under _agents.<host> (via DNS-over-HTTPS). */
  dnsAid: boolean;
  /** Agentic commerce signal: /.well-known/x402 or x402 payment headers. */
  commerce: boolean;
  /** Web Bot Auth key directory at /.well-known/http-message-signatures-directory. */
  webBotAuth: boolean;
  /** OAuth Authorization Server Metadata (RFC 8414). */
  oauthAuthorizationServer: boolean;
  /** OAuth Protected Resource Metadata (RFC 9728). */
  oauthProtectedResource: boolean;
  /** Auth.md prose for agent registration, at /auth.md or /.well-known/auth.md. */
  authMd: boolean;
  /** WebMCP manifest: /.well-known/webmcp(.json) or link rel="webmcp". */
  webmcp: boolean;
  /** ARD manifest at /.well-known/ard.json. */
  ard: boolean;
}
export interface DiscoveryResult {
  robotsTxt: { exists: boolean; content: string | null; hasAiDisallow: boolean };
  llmsTxt: { exists: boolean; contentLength: number; content?: string | null };
  llmsFullTxt: { exists: boolean; contentLength: number };
  sitemap: { exists: boolean; urls: string[] };
  aiIndex: { exists: boolean; content?: string | null };
  homepage: { html: string; url: string } | null;
  botAccess: BotAccessEntry[];
  /** Agent-facing protocol surface, probed during discovery. */
  protocols: ProtocolDiscovery;
}

export interface CrawledPage {
  url: string;
  pathname: string;
  html: string;
  title?: string;
  description?: string;
  content?: string;
  jsonLd?: object[];
  ogTags?: Record<string, string>;
}

export interface RemoteCrawlOptions {
  /** Per-request timeout in milliseconds. Default: 12000. */
  timeoutMs?: number;
  /** Maximum inner pages to crawl beyond the homepage. Default: 10. */
  maxPages?: number;
  /** Concurrent page fetches. Default: 5. */
  concurrency?: number;
  /** User-Agent header for all requests. */
  userAgent?: string;
}

const DEFAULTS: Required<RemoteCrawlOptions> = {
  timeoutMs: 12000,
  maxPages: 10,
  concurrency: 5,
  userAgent: 'aeo.js (+https://aeojs.org)',
};

const MAX_URLS_FROM_SITEMAP = 20;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

/**
 * Returns true if the URL resolves to a private/loopback/link-local address
 * that should never be fetched by the crawler (SSRF guard).
 */
export function isPrivateUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true; // unparseable → treat as private
  }

  const hostname = parsed.hostname.toLowerCase();

  // Hostname-based checks
  if (hostname === 'localhost') return true;
  // mDNS and common internal-only TLDs bypass IP-range checks entirely
  if (hostname.endsWith('.local') || hostname === 'local') return true;
  if (hostname.endsWith('.internal') || hostname === 'internal') return true;
  if (hostname.endsWith('.lan') || hostname === 'lan') return true;
  if (hostname.endsWith('.localhost')) return true;

  // IPv6 loopback / ULA / link-local (string checks are sufficient here)
  if (hostname === '::1') return true;
  if (hostname === '[::1]') return true;
  // ULA fc00::/7 — starts with fc or fd
  if (/^\[?fc/i.test(hostname) || /^\[?fd/i.test(hostname)) return true;
  // Link-local fe80::/10
  if (/^\[?fe80/i.test(hostname)) return true;

  // Strip IPv6 brackets for numeric range checks
  const host = hostname.replace(/^\[|\]$/g, '');

  // IPv4 range checks
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const o1 = Number(ipv4[1]);
    const o2 = Number(ipv4[2]);
    if (o1 === 127) return true;                             // 127.x.x.x loopback
    if (o1 === 0) return true;                               // 0.0.0.0/8
    if (o1 === 10) return true;                              // 10.x.x.x
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;    // 172.16–31.x.x
    if (o1 === 192 && o2 === 168) return true;               // 192.168.x.x
    if (o1 === 169 && o2 === 254) return true;               // 169.254.x.x link-local / cloud metadata
  }

  return false;
}

/** Known AI crawlers checked against robots.txt. */
export const AI_BOTS: ReadonlyArray<Omit<BotAccessEntry, 'allowed'>> = [
  { bot: 'GPTBot', company: 'OpenAI', purpose: 'AI training & ChatGPT' },
  { bot: 'ChatGPT-User', company: 'OpenAI', purpose: 'ChatGPT browsing' },
  { bot: 'OAI-SearchBot', company: 'OpenAI', purpose: 'ChatGPT search' },
  { bot: 'ClaudeBot', company: 'Anthropic', purpose: 'Claude AI training' },
  { bot: 'Claude-User', company: 'Anthropic', purpose: 'Claude web access' },
  { bot: 'Claude-SearchBot', company: 'Anthropic', purpose: 'Claude search' },
  { bot: 'anthropic-ai', company: 'Anthropic', purpose: 'Claude training (legacy)' },
  { bot: 'Google-Extended', company: 'Google', purpose: 'Gemini AI training' },
  { bot: 'Gemini-Deep-Research', company: 'Google', purpose: 'Gemini Deep Research' },
  { bot: 'PerplexityBot', company: 'Perplexity', purpose: 'Perplexity search' },
  { bot: 'Perplexity-User', company: 'Perplexity', purpose: 'Perplexity browsing' },
  { bot: 'Bytespider', company: 'ByteDance', purpose: 'TikTok / Doubao AI' },
  { bot: 'CCBot', company: 'Common Crawl', purpose: 'Open training datasets' },
  { bot: 'Meta-ExternalAgent', company: 'Meta', purpose: 'Llama AI training' },
  { bot: 'FacebookBot', company: 'Meta', purpose: 'Meta link previews & AI' },
  { bot: 'Amazonbot', company: 'Amazon', purpose: 'Alexa & Rufus AI' },
  { bot: 'Applebot-Extended', company: 'Apple', purpose: 'Apple Intelligence' },
  { bot: 'cohere-ai', company: 'Cohere', purpose: 'Cohere AI training' },
  { bot: 'DuckAssistBot', company: 'DuckDuckGo', purpose: 'DuckAssist AI answers' },
  { bot: 'GrokBot', company: 'xAI', purpose: 'Grok AI training' },
  { bot: 'AI2Bot', company: 'Allen AI', purpose: 'Academic AI research' },
  { bot: 'YouBot', company: 'You.com', purpose: 'You.com AI search' },
  { bot: 'PetalBot', company: 'Huawei', purpose: 'Petal Search & AI' },
];

async function fetchWithTimeout(url: string, opts: Required<RemoteCrawlOptions>): Promise<Response | null> {
  // SSRF guard: reject requests to private / loopback / link-local addresses
  if (isPrivateUrl(url)) return null;

  let currentUrl = url;
  let redirectCount = 0;
  const MAX_REDIRECTS = 5;

  while (redirectCount <= MAX_REDIRECTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': opts.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual',
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).href;
      } catch {
        return null;
      }
      if (isPrivateUrl(nextUrl)) return null;
      currentUrl = nextUrl;
      redirectCount++;
      continue;
    }

    return res;
  }

  return null; // too many redirects
}

async function readBodyWithTimeout(res: Response, timeoutMs: number): Promise<string | null> {
  const bodyTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const text = await Promise.race([res.text().catch(() => null), bodyTimeout]);
  return text && text.length <= MAX_BODY_BYTES ? text : null;
}

async function fetchText(url: string, opts: Required<RemoteCrawlOptions>): Promise<string | null> {
  const res = await fetchWithTimeout(url, opts);
  if (!res || !res.ok) return null;

  const contentLength = Number(res.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) return null;

  return readBodyWithTimeout(res, opts.timeoutMs);
}
/** Fetch with a custom Accept header, mirroring fetchWithTimeout's guards. */
async function fetchWithAccept(
  url: string,
  accept: string,
  opts: Required<RemoteCrawlOptions>
): Promise<Response | null> {
  // SSRF guard: reject requests to private / loopback / link-local addresses
  if (isPrivateUrl(url)) return null;

  try {
    return await fetch(url, {
      headers: { 'user-agent': opts.userAgent, accept },
      redirect: 'follow',
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch {
    return null;
  }
}

/** True when the URL answers 2xx. Bodies are discarded unread. */
async function probeOk(url: string, accept: string, opts: Required<RemoteCrawlOptions>): Promise<boolean> {
  const res = await fetchWithAccept(url, accept, opts);
  if (!res) return false;
  res.body?.cancel().catch(() => {});
  return res.ok;
}

/**
 * DNS-AID (draft-mozleywilliams-dnsop-dnsaid): agents discover a site's
 * agentic entrypoints through SVCB/HTTPS records under `_agents.<host>`.
 * Resolved via DNS-over-HTTPS so it works wherever raw DNS is unavailable.
 */
async function hasDnsAidRecords(hostname: string, opts: Required<RemoteCrawlOptions>): Promise<boolean> {
  // Never resolve (or embed in a DoH query) private hostnames.
  if (isPrivateUrl(`http://${hostname}/`)) return false;

  const names = [`_agents.${hostname}`, `_index._agents.${hostname}`, `_a2a._agents.${hostname}`];
  for (const name of names) {
    const res = await fetchWithAccept(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=HTTPS`,
      'application/dns-json',
      opts
    );
    if (!res?.ok) continue;
    const json = await res
      .text()
      .then((body) => JSON.parse(body) as { Status?: number; Answer?: Array<{ type: number }> })
      .catch(() => null);
    // 64 = SVCB, 65 = HTTPS
    if (json?.Status === 0 && json.Answer?.some((a) => a.type === 64 || a.type === 65)) {
      return true;
    }
  }
  return false;
}

function parseContentSignals(robotsTxt: string | null): string | null {
  if (!robotsTxt) return null;
  const match = robotsTxt.match(/^content-signal:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

export function parseSitemapUrls(xml: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null && urls.length < MAX_URLS_FROM_SITEMAP) {
    const loc = match[1];
    if (loc.startsWith('http')) {
      urls.push(loc);
    } else {
      try {
        urls.push(new URL(loc, baseUrl).href);
      } catch {
        // skip malformed <loc> entries
      }
    }
  }
  return urls;
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const origin = new URL(baseUrl).origin;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('/') && !href.startsWith('//')) {
      links.push(origin + href);
    } else if (href.startsWith(origin)) {
      links.push(href);
    }
  }
  const seen = new Set<string>();
  return links
    .filter((link) => {
      const clean = link.split('#')[0].split('?')[0];
      if (seen.has(clean)) return false;
      if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip)$/i.test(clean)) return false;
      seen.add(clean);
      return true;
    })
    .slice(0, 5);
}

export function extractOgTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const ogRegex = /<meta\s+(?:property|name)=["'](og:[^"']+)["']\s+content=["']([^"']*)["']/gi;
  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    tags[match[1]] = match[2];
  }
  // Also try reversed attribute order
  const ogRegex2 = /<meta\s+content=["']([^"']*)["']\s+(?:property|name)=["'](og:[^"']+)["']/gi;
  while ((match = ogRegex2.exec(html)) !== null) {
    tags[match[2]] = match[1];
  }
  return tags;
}

/**
 * Parse robots.txt into an access matrix for known AI crawlers.
 * A missing robots.txt means every bot is allowed.
 */
export function parseRobotsTxtBotAccess(robotsTxt: string | null): BotAccessEntry[] {
  if (!robotsTxt) {
    return AI_BOTS.map((b) => ({ ...b, allowed: true }));
  }

  const lines = robotsTxt.split('\n').map((l) => l.trim());

  const rules: Map<string, { allow: string[]; disallow: string[] }> = new Map();
  let currentAgents: string[] = [];

  for (const line of lines) {
    if (line.startsWith('#') || line === '') {
      if (line === '') currentAgents = [];
      continue;
    }

    const uaMatch = line.match(/^user-agent:\s*(.+)$/i);
    if (uaMatch) {
      const agent = uaMatch[1].trim().toLowerCase();
      currentAgents.push(agent);
      if (!rules.has(agent)) rules.set(agent, { allow: [], disallow: [] });
      continue;
    }

    const disallowMatch = line.match(/^disallow:\s*(.*)$/i);
    if (disallowMatch && currentAgents.length > 0) {
      const path = disallowMatch[1].trim();
      for (const agent of currentAgents) {
        rules.get(agent)!.disallow.push(path);
      }
      continue;
    }

    const allowMatch = line.match(/^allow:\s*(.*)$/i);
    if (allowMatch && currentAgents.length > 0) {
      const path = allowMatch[1].trim();
      for (const agent of currentAgents) {
        rules.get(agent)!.allow.push(path);
      }
    }
  }

  const wildcardRules = rules.get('*');
  const wildcardBlocks = wildcardRules?.disallow.includes('/') ?? false;
  const wildcardAllowsRoot = wildcardRules?.allow.some((a) => a === '/' || a === '/*') ?? false;

  return AI_BOTS.map((botDef) => {
    const botRules = rules.get(botDef.bot.toLowerCase());

    let allowed: boolean;
    if (botRules) {
      const hasDisallowAll = botRules.disallow.includes('/');
      const hasExplicitAllow = botRules.allow.some((a) => a === '/' || a === '/*');
      if (hasDisallowAll && !hasExplicitAllow) {
        allowed = false;
      } else {
        // Explicit allow, partial disallow, or empty disallow all leave the bot allowed
        allowed = true;
      }
    } else {
      allowed = !wildcardBlocks || wildcardAllowsRoot;
    }

    return { ...botDef, allowed };
  });
}

/**
 * Fetch a site's AEO discovery surface: robots.txt, llms.txt, llms-full.txt,
 * sitemap.xml, ai-index.json and the homepage HTML, the AI bot access matrix,
 * and the agent protocol surface (MCP/A2A cards, Web Bot Auth, OAuth
 * metadata, WebMCP, ARD, DNS-AID, x402, …).
 */
export async function discover(targetUrl: string, options: RemoteCrawlOptions = {}): Promise<DiscoveryResult> {
  const opts = { ...DEFAULTS, ...options };
  const origin = new URL(targetUrl).origin;
  const hostname = new URL(targetUrl).hostname;

  const [
    robotsText,
    llmsText,
    llmsFullText,
    sitemapText,
    aiIndexRes,
    homepageRes,
    markdownRes,
    apiCatalogOk,
    mcpCardOk,
    agentCardOk,
    agentSkillsOk,
    openApiOk,
    x402WellKnownOk,
    dnsAidOk,
    webBotAuthOk,
    oauthAsOk,
    oauthPrOk,
    authMdOk,
    webmcpOk,
    ardOk,
  ] = await Promise.all([
    fetchText(`${origin}/robots.txt`, opts),
    fetchText(`${origin}/llms.txt`, opts),
    fetchText(`${origin}/llms-full.txt`, opts),
    fetchText(`${origin}/sitemap.xml`, opts),
    fetchWithTimeout(`${origin}/ai-index.json`, opts),
    fetchWithTimeout(targetUrl, opts),
    // Markdown content negotiation: does the site serve markdown to agents
    // that ask for it instead of HTML?
    fetchWithAccept(targetUrl, 'text/markdown, text/html;q=0.5', opts),
    probeOk(`${origin}/.well-known/api-catalog`, 'application/linkset+json, application/json', opts),
    // MCP server card lives at /.well-known/mcp/server-card.json per the MCP
    // spec; some deployments answer on the bare /.well-known/mcp instead.
    (async () =>
      (await probeOk(`${origin}/.well-known/mcp/server-card.json`, 'application/json, */*', opts)) ||
      (await probeOk(`${origin}/.well-known/mcp`, 'application/json, */*', opts)))(),
    // A2A moved /.well-known/agent.json to agent-card.json; accept either.
    (async () =>
      (await probeOk(`${origin}/.well-known/agent-card.json`, 'application/json, */*', opts)) ||
      (await probeOk(`${origin}/.well-known/agent.json`, 'application/json, */*', opts)))(),
    probeOk(`${origin}/.well-known/agent-skills/index.json`, 'application/json, */*', opts),
    (async () =>
      (await probeOk(`${origin}/openapi.json`, 'application/json, */*', opts)) ||
      (await probeOk(`${origin}/swagger.json`, 'application/json, */*', opts)))(),
    probeOk(`${origin}/.well-known/x402`, 'application/json, */*', opts),
    hasDnsAidRecords(hostname, opts),
    // Web Bot Auth: bots prove identity via signed requests; the key
    // directory is a JWKS-style well-known file.
    probeOk(
      `${origin}/.well-known/http-message-signatures-directory`,
      'application/http-message-signatures-directory+json, application/json, */*',
      opts
    ),
    // OAuth Authorization Server Metadata (RFC 8414).
    probeOk(`${origin}/.well-known/oauth-authorization-server`, 'application/json, */*', opts),
    // OAuth Protected Resource Metadata (RFC 9728).
    probeOk(`${origin}/.well-known/oauth-protected-resource`, 'application/json, */*', opts),
    // Auth.md: prose instructions for agents that need to authenticate.
    // WorkOS hosts it at the service root; some sites use .well-known.
    (async () =>
      (await probeOk(`${origin}/auth.md`, 'text/markdown, text/plain, */*', opts)) ||
      (await probeOk(`${origin}/.well-known/auth.md`, 'text/markdown, text/plain, */*', opts)))(),
    // WebMCP manifest: .well-known path, or a link rel="webmcp" hint.
    (async () =>
      (await probeOk(`${origin}/.well-known/webmcp`, 'application/json, */*', opts)) ||
      (await probeOk(`${origin}/.well-known/webmcp.json`, 'application/json, */*', opts)))(),
    // Agentic Resource Discovery manifest.
    probeOk(`${origin}/.well-known/ard.json`, 'application/json, */*', opts),
  ]);

  const homepageContentLength = Number(homepageRes?.headers.get('content-length') ?? '0');
  const homepageHtml =
    homepageRes?.ok && homepageContentLength <= MAX_BODY_BYTES
      ? await readBodyWithTimeout(homepageRes, opts.timeoutMs)
      : null;
  const linkHeaders = homepageRes?.headers.get('link') ?? null;
  const homepageHeaderNames = homepageRes ? [...homepageRes.headers.keys()] : [];
  const markdownContentType = (markdownRes?.headers.get('content-type') ?? '').toLowerCase();
  markdownRes?.body?.cancel().catch(() => {});

  const hasAiDisallow = robotsText
    ? /disallow:\s*\/\s*$/im.test(robotsText) || /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(robotsText)
    : false;

  return {
    robotsTxt: {
      exists: robotsText !== null,
      content: robotsText,
      hasAiDisallow,
    },
    llmsTxt: {
      exists: llmsText !== null,
      contentLength: llmsText?.length ?? 0,
      content: llmsText,
    },
    llmsFullTxt: {
      exists: llmsFullText !== null,
      contentLength: llmsFullText?.length ?? 0,
    },
    sitemap: {
      exists: sitemapText !== null,
      urls: sitemapText ? parseSitemapUrls(sitemapText, origin) : [],
    },
    aiIndex: {
      exists: Boolean(
        aiIndexRes?.ok && (aiIndexRes.headers.get('content-type') ?? '').toLowerCase().includes('application/json')
      ),
      content: await (async () => {
        if (!aiIndexRes?.ok) return null;
        const cl = Number(aiIndexRes.headers.get('content-length') ?? '0');
        if (cl > MAX_BODY_BYTES) return null;
        return readBodyWithTimeout(aiIndexRes, opts.timeoutMs);
      })(),
    },
    homepage: homepageHtml ? { html: homepageHtml, url: targetUrl } : null,
    botAccess: parseRobotsTxtBotAccess(robotsText),
    protocols: {
      linkHeaders: linkHeaders ? [linkHeaders] : [],
      markdownNegotiation: Boolean(markdownRes?.ok) && markdownContentType.includes('markdown'),
      contentSignals: parseContentSignals(robotsText),
      apiCatalog: apiCatalogOk,
      mcpCard: mcpCardOk,
      agentCard: agentCardOk,
      agentSkills: agentSkillsOk,
      openApi: openApiOk,
      dnsAid: dnsAidOk,
      commerce:
        x402WellKnownOk ||
        homepageHeaderNames.some((h) => h.startsWith('x402') || h.startsWith('x-payment')),
      webBotAuth: webBotAuthOk,
      oauthAuthorizationServer: oauthAsOk,
      oauthProtectedResource: oauthPrOk,
      authMd: authMdOk,
      webmcp:
        webmcpOk ||
        (homepageHtml ? /rel=["']?webmcp/i.test(homepageHtml) : false) ||
        (linkHeaders ? /rel=["']?webmcp/i.test(linkHeaders) : false),
      ard: ardOk,
    },
  };
}

/**
 * Crawl the homepage plus up to `maxPages` inner pages, preferring sitemap URLs
 * and falling back to homepage links.
 */
export async function crawlPages(
  discovery: DiscoveryResult,
  targetUrl: string,
  options: RemoteCrawlOptions = {}
): Promise<CrawledPage[]> {
  const opts = { ...DEFAULTS, ...options };
  const pages: CrawledPage[] = [];
  const origin = new URL(targetUrl).origin;

  if (discovery.homepage) {
    pages.push(buildCrawledPage(discovery.homepage.url, discovery.homepage.html));
  }

  let innerUrls: string[] = [];
  if (discovery.sitemap.urls.length > 0) {
    // Remap sitemap URLs to the target origin if domains differ (e.g. www vs apex)
    innerUrls = discovery.sitemap.urls
      .map((u) => {
        try {
          const parsed = new URL(u);
          return parsed.origin !== origin ? origin + parsed.pathname : u;
        } catch {
          return u;
        }
      })
      .filter((u) => u !== targetUrl && u !== targetUrl + '/' && u !== origin && u !== origin + '/')
      .slice(0, opts.maxPages);
  }

  if (innerUrls.length === 0 && discovery.homepage) {
    innerUrls = extractLinks(discovery.homepage.html, origin).filter((u) => u !== targetUrl && u !== targetUrl + '/');
  }

  for (let i = 0; i < innerUrls.length; i += opts.concurrency) {
    const batch = innerUrls.slice(i, i + opts.concurrency);
    const results = await Promise.all(
      batch.map(async (url) => {
        const html = await fetchText(url, opts);
        if (!html) return null;
        return buildCrawledPage(url, html);
      })
    );
    for (const page of results) {
      if (page) pages.push(page);
    }
  }

  return pages;
}

function buildCrawledPage(url: string, html: string): CrawledPage {
  return {
    url,
    pathname: new URL(url).pathname,
    html,
    title: extractTitle(html) ?? undefined,
    description: extractDescription(html) ?? undefined,
    content: extractTextFromHtml(html),
    jsonLd: extractJsonLd(html),
    ogTags: extractOgTags(html),
  };
}
