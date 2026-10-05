import { describe, it, expect } from 'vitest';
import { generateReport, formatReportMarkdown, formatReportJson } from './report';
import type { ResolvedAeoConfig } from '../types';

function makeConfig(): ResolvedAeoConfig {
  return {
    title: 'Test Site',
    description: 'A test site for reports',
    url: 'https://test.com',
    pages: [
      { pathname: '/', title: 'Home', description: 'Welcome', content: '# Welcome\n\nOur platform serves 10,000 users. Founded in 2020.\n\n## What do we do?\n\nWe build tools for developers.\n\n- Fast builds\n- AI optimization\n- Schema generation' },
      { pathname: '/about', title: 'About', description: 'About us', content: 'About our company and mission.' },
    ],
    outDir: './out',
    contentDir: '',
    generators: { robotsTxt: true, llmsTxt: true, llmsFullTxt: true, rawMarkdown: true, manifest: true, sitemap: true, aiIndex: true, schema: true },
    aiIndex: { maxChunkLength: 2000, maxKeywords: 10 },
    robots: { allow: ['/'], disallow: [], crawlDelay: 0, sitemap: '/sitemap.xml', contentSignal: null },
    schema: { enabled: true, organization: { name: 'Test Co', url: 'https://test.com', logo: '', sameAs: [] }, defaultType: 'WebPage' },
    og: { enabled: true, image: '', twitterHandle: '', type: 'website' },
    widget: { enabled: false, position: 'bottom-right', size: 'default' as const, theme: { background: '', text: '', accent: '', badge: '' }, humanLabel: '', aiLabel: '', showBadge: false },
  } as ResolvedAeoConfig;
}

describe('generateReport', () => {
  it('returns a complete report', () => {
    const report = generateReport(makeConfig());
    expect(report.site.title).toBe('Test Site');
    expect(report.audit.score).toBeGreaterThanOrEqual(0);
    expect(report.citability.pages).toHaveLength(2);
    expect(report.platformHints.length).toBeGreaterThanOrEqual(4);
    expect(report.generatedAt).toBeTruthy();
  });
});

describe('formatReportMarkdown', () => {
  it('outputs markdown with all sections', () => {
    const report = generateReport(makeConfig());
    const md = formatReportMarkdown(report);
    expect(md).toContain('# AEO/GEO Report');
    expect(md).toContain('## GEO Readiness Score');
    expect(md).toContain('## AI Citability');
    expect(md).toContain('## Platform Optimization');
    expect(md).toContain('ChatGPT');
    expect(md).toContain('Perplexity');
    expect(md).toContain('Google AI');
    expect(md).toContain('Bing Copilot');
  });
});

describe('formatReportJson', () => {
  it('outputs valid JSON', () => {
    const report = generateReport(makeConfig());
    const json = formatReportJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.site.title).toBe('Test Site');
    expect(parsed.audit).toBeDefined();
    expect(parsed.citability).toBeDefined();
    expect(parsed.platformHints).toBeDefined();
  });
});
