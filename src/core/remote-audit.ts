import type { AuditResult, AuditCategory, AuditIssue } from './audit';
import { getGrade } from './audit';
import type { DiscoveryResult, CrawledPage, BotAccessEntry } from './remote-crawl';
import { scorePageCitability } from './citability';
import type { PageCitabilityResult } from './citability';
import { generatePlatformHints } from './platform-hints';
import type { PlatformHint } from './platform-hints';

export type RemoteScanReport = {
  url: string;
  scannedAt: string;
  discovery: DiscoveryResult;
  pages: CrawledPage[];
  audit: AuditResult;
  citability: {
    averageScore: number;
    pages: PageCitabilityResult[];
  };
  platformHints: PlatformHint[];
  botAccess: BotAccessEntry[];
  usesAeoJs: boolean;
};

function auditAiAccess(discovery: DiscoveryResult): AuditCategory {
  const majorBots = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot'];
  const allowedMajorBots = discovery.botAccess.filter((b) => majorBots.includes(b.bot) && b.allowed).length;
  const totalAllowed = discovery.botAccess.filter((b) => b.allowed).length;

  const noBlanketDisallow = !discovery.robotsTxt.hasAiDisallow;

  const checks = [
    { label: 'robots.txt exists', passed: discovery.robotsTxt.exists, points: 3 },
    { label: 'llms.txt exists', passed: discovery.llmsTxt.exists, points: 3 },
    { label: 'sitemap.xml exists', passed: discovery.sitemap.exists, points: 3 },
    { label: 'No blanket disallow rules blocking AI crawlers', passed: noBlanketDisallow, points: 3 },
    {
      label: 'Major AI bots allowed (GPTBot, ClaudeBot, Google-Extended, PerplexityBot)',
      passed: allowedMajorBots >= 3,
      points: 3,
    },
    {
      label: `${totalAllowed}/${discovery.botAccess.length} AI crawlers can access site`,
      passed: totalAllowed >= discovery.botAccess.length * 0.7,
      points: 3,
    },
  ];

  return {
    name: 'AI Access',
    score: checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0),
    maxScore: 18,
    checks: checks.map((c) => ({ ...c, points: c.passed ? c.points : 0 })),
  };
}

function auditContentStructure(pages: CrawledPage[]): AuditCategory {
  const hasPages = pages.length > 0;
  const pagesWithContent = pages.filter((p) => p.content && p.content.length > 50);
  const hasHeadings = pages.some((p) => p.html && /<h[1-3][^>]*>/i.test(p.html));
  const hasGoodParagraphs = pages.some((p) => {
    if (!p.content) return false;
    return p.content.split(/\n\n+/).some((para) => {
      const words = para.trim().split(/\s+/).length;
      return words >= 20 && words <= 200;
    });
  });

  const imgStats = pages.reduce(
    (acc, p) => {
      if (!p.html) return acc;
      const imgs = p.html.match(/<img[^>]*>/gi) ?? [];
      acc.total += imgs.length;
      acc.withAlt += imgs.filter((img) => /alt=["'][^"']+["']/i.test(img)).length;
      return acc;
    },
    { total: 0, withAlt: 0 }
  );
  const hasGoodAltText = imgStats.total === 0 || imgStats.withAlt / imgStats.total >= 0.7;
  // Server-rendered content: the crawler fetches raw HTML without executing
  // JavaScript, so a near-empty homepage text means client-rendered content
  // most AI crawlers never see.
  const homepageWords = (pages[0]?.content ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const isServerRendered = homepageWords >= 60;

  const checks = [
    { label: 'Pages found', passed: hasPages, points: 2 },
    {
      label: 'Content server-rendered (no JS required)',
      passed: isServerRendered,
      points: 4,
    },
    { label: 'Pages with substantial content', passed: pagesWithContent.length > 0, points: 2 },
    { label: 'Heading structure present', passed: hasHeadings, points: 2 },
    { label: 'Well-structured paragraphs', passed: hasGoodParagraphs, points: 2 },
    { label: 'Images have alt text (70%+)', passed: hasGoodAltText, points: 1 },
  ];

  return {
    name: 'Content Structure',
    score: checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0),
    maxScore: 13,
    checks: checks.map((c) => ({ ...c, points: c.passed ? c.points : 0 })),
  };
}

function auditSchemaPresence(pages: CrawledPage[]): AuditCategory {
  const allJsonLd = pages.flatMap((p) => p.jsonLd ?? []) as Record<string, unknown>[];
  const hasSchema = allJsonLd.length > 0;
  const orgSchema = allJsonLd.find((s) => s['@type'] === 'Organization');
  const hasOrgName = !!(orgSchema && orgSchema.name);
  const hasOrgLogo = !!(orgSchema && orgSchema.logo);
  const hasArticleOrWebPage = allJsonLd.some(
    (s) => s['@type'] === 'Article' || s['@type'] === 'WebPage' || s['@type'] === 'BlogPosting'
  );
  const hasFaqOrHowTo = allJsonLd.some(
    (s) =>
      s['@type'] === 'FAQPage' ||
      s['@type'] === 'HowTo' ||
      (Array.isArray(s['@type']) &&
        ((s['@type'] as string[]).includes('FAQPage') || (s['@type'] as string[]).includes('HowTo')))
  );

  const checks = [
    { label: 'JSON-LD schema found', passed: hasSchema, points: 3 },
    { label: 'Organization name', passed: hasOrgName, points: 3 },
    { label: 'Organization logo', passed: hasOrgLogo, points: 2 },
    { label: 'FAQPage or HowTo schema', passed: hasFaqOrHowTo, points: 3 },
    { label: 'Article/WebPage schema', passed: hasArticleOrWebPage, points: 2 },
  ];

  return {
    name: 'Schema Presence',
    score: checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0),
    maxScore: 13,
    checks: checks.map((c) => ({ ...c, points: c.passed ? c.points : 0 })),
  };
}

function auditMetaQuality(pages: CrawledPage[]): AuditCategory {
  const homepage = pages[0];
  // Use the raw <title> tag content for length check (extractTitle strips pipe separators)
  const rawTitleMatch = homepage?.html?.match(/<title>([^<]*)<\/title>/i);
  const title = rawTitleMatch?.[1]?.trim() || homepage?.title || '';
  const desc = homepage?.description ?? '';
  const hasGoodTitle = title.length >= 10 && title.length <= 70;
  const hasGoodDesc = desc.length >= 50 && desc.length <= 200;
  const hasOg = homepage?.ogTags ? Object.keys(homepage.ogTags).length > 0 : false;
  const pagesWithTitles = pages.filter((p) => p.title && p.title.length > 0);
  const titleCoverage = pages.length > 0 ? pagesWithTitles.length / pages.length >= 0.8 : false;
  const hasCanonical = homepage?.html ? /<link[^>]+rel=["']canonical["']/i.test(homepage.html) : false;

  const checks = [
    { label: 'Title length (10-70 chars)', passed: hasGoodTitle, points: 3 },
    { label: 'Description length (50-200 chars)', passed: hasGoodDesc, points: 3 },
    { label: 'Open Graph tags present', passed: hasOg, points: 2 },
    { label: '80%+ pages have titles', passed: titleCoverage, points: 2 },
    { label: 'Canonical URL set', passed: hasCanonical, points: 3 },
  ];

  return {
    name: 'Meta Quality',
    score: checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0),
    maxScore: 13,
    checks: checks.map((c) => ({ ...c, points: c.passed ? c.points : 0 })),
  };
}

function auditCitability(pages: CrawledPage[]): AuditCategory {
  const hasDirectAnswers = pages.some((p) => {
    if (!p.content) return false;
    return p.content.split(/\n\n+/).some((para) => {
      const words = para.trim().split(/\s+/);
      return words.length >= 20 && words.length <= 200;
    });
  });

  const hasStats = pages.some(
    (p) => p.content && /\d+%|\$[\d,]+|\d{4}|\d+\s*(million|billion|thousand)/i.test(p.content)
  );

  const hasFaq = pages.some(
    (p) => (p.content && /\?\s*\n/m.test(p.content)) || (p.html && /<(details|summary|dt)/i.test(p.html))
  );

  const hasLists = pages.some((p) => p.html && /<[ou]l[^>]*>[\s\S]*?<li/i.test(p.html));

  const totalWords = pages.reduce((sum, p) => sum + (p.content?.split(/\s+/).length ?? 0), 0);

  const checks = [
    { label: 'Direct answer paragraphs', passed: hasDirectAnswers, points: 3 },
    { label: 'Statistical data present', passed: hasStats, points: 2 },
    { label: 'FAQ/Q&A patterns', passed: hasFaq, points: 3 },
    { label: 'Structured lists', passed: hasLists, points: 2 },
    { label: '500+ total words', passed: totalWords >= 500, points: 3 },
  ];

  return {
    name: 'Citability',
    score: checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0),
    maxScore: 13,
    checks: checks.map((c) => ({ ...c, points: c.passed ? c.points : 0 })),
  };
}
/**
 * The protocol surface agents use to discover, integrate and transact with a
 * site — the checks popularized by Cloudflare's isitagentready, is-agentic
 * and Ora that a content-only audit misses.
 */
function auditAgentProtocols(discovery: DiscoveryResult): AuditCategory {
  const p = discovery.protocols;
  const checks = [
    {
      label: 'Agent discovery Link headers (RFC 8288)',
      passed: p.linkHeaders.length > 0,
      points: 3,
    },
    {
      label: 'Markdown content negotiation',
      passed: p.markdownNegotiation,
      points: 3,
    },
    {
      label: 'MCP server card (/.well-known/mcp)',
      passed: p.mcpCard,
      points: 3,
    },
    {
      label: 'WebMCP manifest',
      passed: p.webmcp,
      points: 2,
    },
    {
      label: 'Web Bot Auth key directory',
      passed: p.webBotAuth,
      points: 2,
    },
    {
      label: 'OAuth Protected Resource metadata (RFC 9728)',
      passed: p.oauthProtectedResource,
      points: 2,
    },
    {
      label: 'ARD manifest (/.well-known/ard.json)',
      passed: p.ard,
      points: 2,
    },
    {
      label: 'Content Signals policy in robots.txt',
      passed: p.contentSignals !== null,
      points: 2,
    },
    {
      label: 'API Catalog (/.well-known/api-catalog)',
      passed: p.apiCatalog,
      points: 2,
    },
    {
      label: 'A2A agent card (/.well-known/agent-card.json)',
      passed: p.agentCard,
      points: 2,
    },
    {
      label: 'OAuth Authorization Server metadata (RFC 8414)',
      passed: p.oauthAuthorizationServer,
      points: 1,
    },
    {
      label: 'Auth.md for agent authentication',
      passed: p.authMd,
      points: 1,
    },
    {
      label: 'llms-full.txt published',
      passed: discovery.llmsFullTxt.exists,
      points: 1,
    },
    {
      label: 'Agent Skills index (/.well-known/agent-skills)',
      passed: p.agentSkills,
      points: 1,
    },
    {
      label: 'OpenAPI spec published',
      passed: p.openApi,
      points: 1,
    },
    {
      label: 'DNS-AID records (_agents SVCB/HTTPS)',
      passed: p.dnsAid,
      points: 1,
    },
    {
      label: 'Agentic commerce signal (x402)',
      passed: p.commerce,
      points: 1,
    },
  ];

  return {
    name: 'Agent Protocols',
    score: checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0),
    maxScore: 30,
    checks: checks.map((c) => ({ ...c, points: c.passed ? c.points : 0 })),
  };
}

const FIX_SUGGESTIONS: Record<string, string> = {
  'robots.txt exists': 'Create a robots.txt file that allows AI crawlers. aeo.js generates this automatically.',
  'llms.txt exists': 'Create an llms.txt file describing your site for LLMs. aeo.js generates this automatically.',
  'sitemap.xml exists': 'Create a sitemap.xml to help AI crawlers discover your content. aeo.js generates this automatically.',
  'Major AI bots allowed (GPTBot, ClaudeBot, Google-Extended, PerplexityBot)':
    'Update robots.txt to allow major AI crawlers. Remove Disallow rules for GPTBot, ClaudeBot, Google-Extended, and PerplexityBot.',
  'Images have alt text (70%+)':
    'Add descriptive alt text to your images. Good alt text helps AI understand visual content and improves accessibility.',
  'FAQPage or HowTo schema':
    'Add FAQPage or HowTo structured data to boost AI citation rate. aeo.js can generate this automatically.',
  'JSON-LD schema found': 'Add JSON-LD structured data to your pages. aeo.js can inject schema automatically.',
  'Organization name': 'Add Organization schema with your company name.',
  'Organization logo': 'Add a logo URL to your Organization schema.',
  'Article/WebPage schema': 'Add Article or WebPage schema to content pages.',
  'Title length (10-70 chars)': 'Update your page title to be between 10-70 characters.',
  'Description length (50-200 chars)': 'Add a meta description between 50-200 characters.',
  'Open Graph tags present': 'Add Open Graph meta tags (og:title, og:description, og:image). aeo.js can inject these.',
  '80%+ pages have titles': 'Ensure most pages have unique, descriptive titles.',
  'Canonical URL set': 'Add a canonical URL link tag to prevent duplicate content issues.',
  'Direct answer paragraphs': 'Write clear, self-contained paragraphs that directly answer questions.',
  'Statistical data present': 'Include specific numbers, percentages, and data points in your content.',
  'FAQ/Q&A patterns': 'Add FAQ sections or question-and-answer formatted content.',
  'Structured lists': 'Use bulleted or numbered lists to organize key information.',
  '500+ total words': 'Add more substantial content across your pages.',
  'Pages found': 'Ensure your site has crawlable HTML pages.',
  'Pages with substantial content': 'Add meaningful content (50+ characters) to your pages.',
  'Heading structure present': 'Use H1-H3 headings to structure your content hierarchically.',
  'Well-structured paragraphs': 'Write paragraphs between 20-200 words for optimal AI readability.',
  'Content server-rendered (no JS required)':
    'Prerender or server-render your HTML. AI crawlers fetch raw HTML without executing JavaScript, so client-only content is invisible to them.',
  'Agent discovery Link headers (RFC 8288)':
    'Add Link response headers pointing agents to your key resources, e.g. Link: </.well-known/api-catalog>; rel="api-catalog" or </docs>; rel="service-doc".',
  'Markdown content negotiation':
    'Serve markdown when a client sends Accept: text/markdown. Agents get clean content without HTML parsing — on Cloudflare this is one toggle (Markdown for Agents).',
  'MCP server card (/.well-known/mcp)':
    'Publish /.well-known/mcp describing your MCP server so agents can discover and connect to it.',
  'WebMCP manifest':
    'Publish a WebMCP manifest at /.well-known/webmcp (or a link rel="webmcp" hint) describing the tools your site exposes over HTTP to AI clients.',
  'Web Bot Auth key directory':
    'Publish /.well-known/http-message-signatures-directory so automated traffic can prove bot identity with signed requests (Web Bot Auth).',
  'OAuth Protected Resource metadata (RFC 9728)':
    'Publish /.well-known/oauth-protected-resource so agents know which authorization server protects your API and which scopes they need.',
  'ARD manifest (/.well-known/ard.json)':
    'Publish an ARD manifest at /.well-known/ard.json listing your agentic resources (tools, skills, MCP servers) for AI discovery services.',
  'OAuth Authorization Server metadata (RFC 8414)':
    'Publish /.well-known/oauth-authorization-server describing your OAuth endpoints so agents can obtain tokens without hand-holding.',
  'Auth.md for agent authentication':
    'Publish auth.md at your site root with human-readable instructions for agents that need to authenticate against your API.',
  'Content Signals policy in robots.txt':
    'Declare a Content-Signal line in robots.txt (e.g. Content-Signal: ai-train=no, search=yes, ai-input=yes) to state how AI systems may use your content.',
  'API Catalog (/.well-known/api-catalog)':
    'Publish an RFC 9727 API catalog at /.well-known/api-catalog linking your OpenAPI specs and API documentation.',
  'A2A agent card (/.well-known/agent-card.json)':
    'Publish an A2A agent card at /.well-known/agent-card.json so other agents can discover your agent\'s capabilities.',
  'llms-full.txt published':
    'Publish llms-full.txt with your full content in markdown — agents that can\'t crawl every page still get everything.',
  'Agent Skills index (/.well-known/agent-skills)':
    'Publish an Agent Skills index at /.well-known/agent-skills/index.json to advertise ready-made skills for coding agents.',
  'OpenAPI spec published':
    'Publish your OpenAPI spec at /openapi.json — it lets agents call your API with typed, predictable requests.',
  'DNS-AID records (_agents SVCB/HTTPS)':
    'Publish DNS-AID records (e.g. _index._agents.yourdomain.com as SVCB/HTTPS) so agents can discover your endpoints via DNS.',
  'Agentic commerce signal (x402)':
    'If agents can pay for your API or content, advertise it via /.well-known/x402 so agentic commerce flows can find you.',
};

function getFixSuggestion(label: string): string | undefined {
  if (FIX_SUGGESTIONS[label]) return FIX_SUGGESTIONS[label];
  // Handle dynamic labels like "15/23 AI crawlers can access site"
  if (label.includes('AI crawlers can access site')) {
    return 'Review your robots.txt to allow more AI crawlers. Blocking bots reduces your visibility in AI search engines.';
  }
  return undefined;
}

function collectIssues(categories: AuditCategory[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const cat of categories) {
    for (const check of cat.checks) {
      if (!check.passed) {
        issues.push({
          category: cat.name,
          severity: 'error',
          message: `Missing: ${check.label}`,
          fix: getFixSuggestion(check.label),
        });
      }
    }
  }
  return issues;
}

/**
 * Audit a live site's GEO readiness from crawled data.
 * Six categories / 100-point scale: AI Access (18), Agent Protocols (30),
 * Content Structure, Schema Presence, Meta Quality, Citability (13 each).
 */
export function remoteAuditSite(discovery: DiscoveryResult, pages: CrawledPage[]): AuditResult {
  const categories = [
    auditAiAccess(discovery),
    auditAgentProtocols(discovery),
    auditContentStructure(pages),
    auditSchemaPresence(pages),
    auditMetaQuality(pages),
    auditCitability(pages),
  ];

  const score = categories.reduce((s, c) => s + c.score, 0);
  const issues = collectIssues(categories);

  return {
    score,
    categories,
    issues,
    suggestions: issues
      .filter((i) => i.fix)
      .map((i) => i.fix as string)
      .slice(0, 5),
  };
}

/**
 * Detect whether a site uses aeo.js based on known signatures:
 * generator comments in llms.txt/robots.txt, aeo:* meta tags,
 * widget classes, attribution links, and ai-index.json content.
 */
export function detectAeoJs(discovery: DiscoveryResult, pages: CrawledPage[]): boolean {
  if (discovery.llmsTxt.content && /generated by aeo\.js/i.test(discovery.llmsTxt.content)) {
    return true;
  }

  if (discovery.robotsTxt.content && /robots\.txt generated by aeo\.js/i.test(discovery.robotsTxt.content)) {
    return true;
  }

  for (const page of pages) {
    if (!page.html) continue;
    if (/<meta\s+name=["']aeo:/i.test(page.html)) return true;
    if (/class=["'][^"']*aeo-(toggle|badge|overlay)/i.test(page.html)) return true;
    if (/by aeo\.js/i.test(page.html) || /aeojs\.org/i.test(page.html)) return true;
  }

  if (discovery.aiIndex?.exists && discovery.aiIndex.content && /aeo\.js/i.test(discovery.aiIndex.content)) {
    return true;
  }

  return false;
}

/**
 * Build a full remote scan report: 5-category audit, per-page citability,
 * platform hints (including Claude and Gemini), bot access matrix.
 */
export function buildRemoteReport(targetUrl: string, discovery: DiscoveryResult, pages: CrawledPage[]): RemoteScanReport {
  const audit = remoteAuditSite(discovery, pages);

  const citabilityPages = pages.map((p) =>
    scorePageCitability({
      pathname: p.pathname,
      title: p.title,
      description: p.description,
      content: p.content ?? '',
    })
  );

  const averageScore =
    citabilityPages.length > 0
      ? Math.round(citabilityPages.reduce((s, p) => s + p.score, 0) / citabilityPages.length)
      : 0;

  const platformHints = generatePlatformHints(audit, { averageScore });

  // Claude and Gemini hints are driven by live bot access, which only remote scans have
  const claudeBot = discovery.botAccess.find((b) => b.bot === 'ClaudeBot');
  const claudeSearchBot = discovery.botAccess.find((b) => b.bot === 'Claude-SearchBot');
  const claudeAllowed = claudeBot?.allowed !== false;
  const claudeTips: string[] = [];
  if (!claudeAllowed) claudeTips.push('Unblock ClaudeBot in robots.txt to allow Claude to access your content.');
  if (!claudeSearchBot?.allowed) claudeTips.push("Allow Claude-SearchBot for Claude's search features.");
  if (!discovery.llmsTxt.exists)
    claudeTips.push("Add llms.txt — Claude uses this to understand your site's purpose and structure.");
  if (averageScore < 50)
    claudeTips.push('Improve content citability — Claude prioritizes well-structured, self-contained paragraphs.');
  if (claudeTips.length === 0)
    claudeTips.push('Your site is well-optimized for Claude. Keep llms.txt updated as your content evolves.');

  const googleExtended = discovery.botAccess.find((b) => b.bot === 'Google-Extended');
  const geminiDeep = discovery.botAccess.find((b) => b.bot === 'Gemini-Deep-Research');
  const geminiTips: string[] = [];
  if (!googleExtended?.allowed)
    geminiTips.push('Allow Google-Extended in robots.txt — this controls whether your content trains Gemini.');
  if (!geminiDeep?.allowed) geminiTips.push("Allow Gemini-Deep-Research for Google's AI research agent feature.");
  const allJsonLd = pages.flatMap((p) => p.jsonLd ?? []) as Record<string, unknown>[];
  if (!allJsonLd.some((s) => s['@type'] === 'FAQPage'))
    geminiTips.push('Add FAQPage schema — Gemini heavily favors structured Q&A content for AI Overviews.');
  if (averageScore < 50)
    geminiTips.push('Improve content structure — Gemini needs clear headings and direct-answer paragraphs.');
  if (geminiTips.length === 0)
    geminiTips.push('Your site is well-optimized for Gemini. Maintain your structured data and content quality.');

  platformHints.push(
    {
      platform: 'Claude',
      status: !claudeAllowed ? 'critical' : claudeTips.length > 2 ? 'needs-work' : 'good',
      tips: claudeTips,
    },
    {
      platform: 'Gemini',
      status: !googleExtended?.allowed ? 'critical' : geminiTips.length > 2 ? 'needs-work' : 'good',
      tips: geminiTips,
    }
  );

  return {
    url: targetUrl,
    scannedAt: new Date().toISOString(),
    discovery,
    pages,
    audit,
    citability: {
      averageScore,
      pages: citabilityPages,
    },
    platformHints,
    botAccess: discovery.botAccess,
    usesAeoJs: detectAeoJs(discovery, pages),
  };
}

/**
 * Format a remote scan report for terminal output.
 */
export function formatRemoteReport(report: RemoteScanReport): string {
  const lines: string[] = [];
  const { audit, discovery } = report;

  lines.push(`GEO Readiness Score for ${report.url}: ${audit.score}/100 (${getGrade(audit.score)})`);
  lines.push('═'.repeat(50));
  lines.push('');

  lines.push('AEO files:');
  const files: Array<[string, boolean]> = [
    ['robots.txt', discovery.robotsTxt.exists],
    ['llms.txt', discovery.llmsTxt.exists],
    ['llms-full.txt', discovery.llmsFullTxt.exists],
    ['sitemap.xml', discovery.sitemap.exists],
    ['ai-index.json', discovery.aiIndex.exists],
  ];
  for (const [name, exists] of files) {
    lines.push(`  ${exists ? '+' : '-'} ${name}`);
  }
  lines.push('');

  const allowed = report.botAccess.filter((b) => b.allowed);
  const blocked = report.botAccess.filter((b) => !b.allowed);
  lines.push(`AI crawler access: ${allowed.length}/${report.botAccess.length} allowed`);
  if (blocked.length > 0) {
    lines.push(`  Blocked: ${blocked.map((b) => b.bot).join(', ')}`);
  }
  lines.push('');

  for (const cat of audit.categories) {
    lines.push(`${cat.name}: ${cat.score}/${cat.maxScore}`);
    const bar = '█'.repeat(cat.score) + '░'.repeat(cat.maxScore - cat.score);
    lines.push(`  ${bar}`);
    for (const check of cat.checks) {
      lines.push(`  ${check.passed ? '+' : '-'} ${check.label}`);
    }
    lines.push('');
  }

  lines.push(`Citability: ${report.citability.averageScore}/100 average across ${report.pages.length} page(s)`);
  lines.push('');

  if (audit.suggestions.length > 0) {
    lines.push('Top fixes:');
    for (const suggestion of audit.suggestions) {
      lines.push(`  * ${suggestion}`);
    }
    lines.push('');
  }

  if (report.usesAeoJs) {
    lines.push('This site appears to be using aeo.js.');
  } else {
    lines.push('Get these files generated automatically: npm install aeo.js — https://aeojs.org');
  }

  return lines.join('\n');
}
