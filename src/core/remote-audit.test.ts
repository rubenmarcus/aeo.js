import { describe, it, expect } from 'vitest';
import { remoteAuditSite, buildRemoteReport, detectAeoJs, formatRemoteReport } from './remote-audit';
import type { DiscoveryResult, CrawledPage, ProtocolDiscovery } from './remote-crawl';
 import { AI_BOTS } from './remote-crawl';
function makeProtocols(overrides: Partial<ProtocolDiscovery> = {}): ProtocolDiscovery {
  return {
    linkHeaders: [],
    markdownNegotiation: false,
    contentSignals: null,
    apiCatalog: false,
    mcpCard: false,
    agentCard: false,
    agentSkills: false,
    openApi: false,
    dnsAid: false,
    commerce: false,
    webBotAuth: false,
    oauthAuthorizationServer: false,
    oauthProtectedResource: false,
    authMd: false,
    webmcp: false,
    ard: false,
    ...overrides,
  };
}

function makeDiscovery(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  return {
    robotsTxt: { exists: true, content: 'User-agent: *\nDisallow:\n', hasAiDisallow: false },
    llmsTxt: { exists: true, contentLength: 100, content: '# Site\n' },
    llmsFullTxt: { exists: false, contentLength: 0 },
    sitemap: { exists: true, urls: [] },
    aiIndex: { exists: false, content: null },
    homepage: null,
    botAccess: AI_BOTS.map((b) => ({ ...b, allowed: true })),
    protocols: makeProtocols(),
    ...overrides,
  };
}

const RICH_CONTENT = [
  'This product helps over 10,000 developers optimize their sites for AI answer engines every single month of the year.',
  'The audit covers five categories and produces a score from 0 to 100 based on measurable signals found in the HTML.',
  'What is AEO?\nAnswer Engine Optimization is the practice of making content easy for AI assistants to find and cite.',
].join('\n\n');

function makePage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  const html = `<!doctype html><html><head>
    <title>A Reasonably Sized Page Title</title>
    <meta name="description" content="A description that is comfortably between fifty and two hundred characters long for the meta check.">
    <meta property="og:title" content="A Page">
    <link rel="canonical" href="https://a.com/">
    <script type="application/ld+json">{"@type":"Organization","name":"Acme","logo":"https://a.com/logo.png","sameAs":["https://x.com/acme","https://github.com/acme"]}</script>
    <script type="application/ld+json">{"@type":"Person","name":"Jane Author","url":"https://a.com/authors/jane"}</script>
    <script type="application/ld+json">{"@type":"WebPage","name":"Home"}</script>
    <script type="application/ld+json">{"@type":"FAQPage"}</script>
  </head><body>
    <h1>Heading</h1>
    <ul><li>One</li><li>Two</li></ul>
    <img src="x.png" alt="described image">
    <p>${RICH_CONTENT}</p>
  </body></html>`;
  return {
    url: 'https://a.com/',
    pathname: '/',
    html,
    title: 'A Reasonably Sized Page Title',
    description: 'A description that is comfortably between fifty and two hundred characters long for the meta check.',
    content: RICH_CONTENT,
    jsonLd: [
      { '@type': 'Organization', name: 'Acme', logo: 'https://a.com/logo.png', sameAs: ['https://x.com/acme'] },
      { '@type': 'Person', name: 'Jane Author', url: 'https://a.com/authors/jane' },
      { '@type': 'WebPage', name: 'Home' },
      { '@type': 'FAQPage' },
    ],
    ogTags: { 'og:title': 'A Page' },
    ...overrides,
  };
}

describe('remoteAuditSite', () => {
  it('scores a well-optimized site high across all categories', () => {
    const result = remoteAuditSite(
      makeDiscovery({
        llmsFullTxt: { exists: true, contentLength: 5000 },
        protocols: makeProtocols({
          linkHeaders: ['</.well-known/api-catalog>; rel="api-catalog"'],
          markdownNegotiation: true,
          contentSignals: 'search=yes',
          apiCatalog: true,
          mcpCard: true,
          agentCard: true,
          agentSkills: true,
          openApi: true,
          dnsAid: true,
          commerce: true,
          webBotAuth: true,
          oauthAuthorizationServer: true,
          oauthProtectedResource: true,
          authMd: true,
          webmcp: true,
          ard: true,
        }),
      }),
      [makePage()]
    );
    expect(result.categories).toHaveLength(6);
    expect(result.categories.reduce((s, c) => s + c.maxScore, 0)).toBe(100);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.issues.length).toBeLessThanOrEqual(2);
  });


  it('scores an empty site low and reports issues with fixes', () => {
    const discovery = makeDiscovery({
      robotsTxt: { exists: false, content: null, hasAiDisallow: false },
      llmsTxt: { exists: false, contentLength: 0, content: null },
      sitemap: { exists: false, urls: [] },
    });
    const result = remoteAuditSite(discovery, []);
    expect(result.score).toBeLessThan(40);
    expect(result.issues.length).toBeGreaterThan(5);
    expect(result.issues.some((i) => i.fix?.includes('llms.txt'))).toBe(true);
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('penalizes AI Access when major bots are blocked', () => {
    const blockedAccess = AI_BOTS.map((b) => ({
      ...b,
      allowed: !['GPTBot', 'ClaudeBot', 'PerplexityBot'].includes(b.bot),
    }));
    const result = remoteAuditSite(makeDiscovery({ botAccess: blockedAccess }), [makePage()]);
    const aiAccess = result.categories.find((c) => c.name === 'AI Access')!;
    expect(aiAccess.checks.find((c) => c.label.startsWith('Major AI bots'))?.passed).toBe(false);
  });
});

describe('remoteAuditSite — Agent Protocols category', () => {
  it('scores zero and emits fix suggestions when no protocols are published', () => {
    const result = remoteAuditSite(makeDiscovery(), []);
    const category = result.categories.find((c) => c.name === 'Agent Protocols')!;
    expect(category.score).toBe(0);
    expect(category.maxScore).toBe(30);
    expect(category.checks).toHaveLength(17);
    const issues = result.issues.filter((i) => i.category === 'Agent Protocols');
    expect(issues.every((i) => typeof i.fix === 'string' && i.fix.length > 0)).toBe(true);
  });

  it('weights the high-signal protocols more than the niche ones', () => {
    const result = remoteAuditSite(
      makeDiscovery({
        protocols: makeProtocols({
          linkHeaders: ['</docs>; rel="service-doc"'],
          markdownNegotiation: true,
          mcpCard: true,
        }),
      }),
      []
    );
    const category = result.categories.find((c) => c.name === 'Agent Protocols')!;
    // 3 + 3 + 3: discovery headers, markdown negotiation and MCP card
    expect(category.score).toBe(9);
  });
});

describe('detectAeoJs', () => {
  it('detects via llms.txt signature', () => {
    const discovery = makeDiscovery({
      llmsTxt: { exists: true, contentLength: 50, content: '# Site\n\nGenerated by aeo.js\n' },
    });
    expect(detectAeoJs(discovery, [])).toBe(true);
  });

  it('detects via widget classes in HTML', () => {
    const page = makePage({ html: '<html><body><div class="aeo-toggle"></div></body></html>' });
    expect(detectAeoJs(makeDiscovery(), [page])).toBe(true);
  });

  it('returns false without signatures', () => {
    const page = makePage({ html: '<html><body><p>plain</p></body></html>' });
    expect(detectAeoJs(makeDiscovery(), [page])).toBe(false);
  });
});

describe('buildRemoteReport', () => {
  it('builds a full report with citability and platform hints', () => {
    const report = buildRemoteReport('https://a.com', makeDiscovery(), [makePage()]);

    expect(report.url).toBe('https://a.com');
    expect(report.audit.score).toBeGreaterThan(0);
    expect(report.citability.pages).toHaveLength(1);
    expect(report.citability.averageScore).toBe(report.citability.pages[0].score);

    const platforms = report.platformHints.map((h) => h.platform);
    expect(platforms).toContain('ChatGPT / SearchGPT');
    expect(platforms).toContain('Perplexity');
    expect(platforms).toContain('Claude');
    expect(platforms).toContain('Gemini');
  });

  it('flags Claude as critical when ClaudeBot is blocked', () => {
    const botAccess = AI_BOTS.map((b) => ({ ...b, allowed: b.bot !== 'ClaudeBot' }));
    const report = buildRemoteReport('https://a.com', makeDiscovery({ botAccess }), [makePage()]);
    const claude = report.platformHints.find((h) => h.platform === 'Claude')!;
    expect(claude.status).toBe('critical');
    expect(claude.tips.some((t) => t.includes('Unblock ClaudeBot'))).toBe(true);
  });

  it('handles a site with no crawled pages', () => {
    const report = buildRemoteReport('https://a.com', makeDiscovery(), []);
    expect(report.citability.averageScore).toBe(0);
    expect(report.audit.score).toBeGreaterThanOrEqual(0);
  });
});

describe('formatRemoteReport', () => {
  it('renders score, files, bot access, and categories', () => {
    const report = buildRemoteReport('https://a.com', makeDiscovery(), [makePage()]);
    const text = formatRemoteReport(report);

    expect(text).toContain('GEO Readiness Score for https://a.com');
    expect(text).toContain('+ robots.txt');
    expect(text).toContain('+ llms.txt');
    expect(text).toContain('- llms-full.txt');
    expect(text).toContain('AI crawler access:');
    expect(text).toContain('AI Access:');
    expect(text).toContain('Citability:');
  });

  it('lists blocked bots and the install hint for non-aeo.js sites', () => {
    const botAccess = AI_BOTS.map((b) => ({ ...b, allowed: b.bot !== 'GPTBot' }));
    const page = makePage({ html: '<html><body><p>plain</p></body></html>', jsonLd: [] });
    const report = buildRemoteReport('https://a.com', makeDiscovery({ botAccess }), [page]);
    const text = formatRemoteReport(report);

    expect(text).toContain('Blocked: GPTBot');
    expect(text).toContain('npm install aeo.js');
  });
});
