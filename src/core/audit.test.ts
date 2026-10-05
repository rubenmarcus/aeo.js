import { describe, it, expect } from 'vitest';
import { auditSite, formatAuditReport } from './audit';
import type { ResolvedAeoConfig } from '../types';

function makeConfig(overrides: Partial<ResolvedAeoConfig> = {}): ResolvedAeoConfig {
  return {
    title: 'Test Site',
    description: 'A test site for auditing GEO readiness',
    url: 'https://example.com',
    pages: [],
    outDir: './out',
    contentDir: '',
    generators: { robotsTxt: true, llmsTxt: true, llmsFullTxt: true, rawMarkdown: true, manifest: true, sitemap: true, aiIndex: true, schema: true },
    aiIndex: { maxChunkLength: 2000, maxKeywords: 10 },
    robots: { allow: ['/'], disallow: [], crawlDelay: 0, sitemap: '/sitemap.xml', contentSignal: null },
    schema: {
      enabled: true,
      organization: { name: 'Test Org', url: 'https://example.com', logo: 'https://example.com/logo.png', sameAs: ['https://twitter.com/test'] },
      defaultType: 'WebPage',
    },
    og: { enabled: true, image: 'https://example.com/og.png', twitterHandle: '@test', type: 'website' },
    widget: { enabled: false, position: 'bottom-right', size: 'default' as const, theme: { background: '', text: '', accent: '', badge: '' }, humanLabel: '', aiLabel: '', showBadge: false },
    ...overrides,
  } as ResolvedAeoConfig;
}

describe('auditSite', () => {
  it('returns a score between 0 and 100', () => {
    const result = auditSite(makeConfig());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('has 5 categories', () => {
    const result = auditSite(makeConfig());
    expect(result.categories).toHaveLength(5);
    expect(result.categories.map(c => c.name)).toEqual([
      'AI Access', 'Content Structure', 'Schema Presence', 'Meta Quality', 'Citability',
    ]);
  });

  it('scores high for a well-configured site with content', () => {
    const config = makeConfig({
      url: 'https://mysite.com',
      title: 'My Awesome Website Platform',
      description: 'A comprehensive platform for building awesome websites with modern tools and techniques',
      pages: [
        { pathname: '/', title: 'Home', description: 'Welcome to My Site', content: '# Welcome\n\nOur platform serves 10,000 customers worldwide. Founded in 2020, we provide:\n\n- Fast builds\n- SEO optimization\n- AI-ready content\n\n## What is MySite?\n\nMysite is a modern web platform that helps developers build faster. We process over 1 million requests daily with 99.9% uptime.\n\n## How does it work?\n\nSimply install our package and configure your project. The system automatically optimizes your content for search engines and AI assistants.\n\nOur technology stack includes React, Node.js, and cutting-edge AI algorithms that analyze your content structure.' },
        { pathname: '/about', title: 'About Us', description: 'Learn about our company', content: 'About Us is a page with information.\n\n## Who are we?\n\nWe are a team of 50 engineers dedicated to building the best platform.' },
        { pathname: '/docs', title: 'Documentation', description: 'Read our docs', content: 'Documentation for using our platform.' },
      ],
      schema: {
        enabled: true,
        organization: { name: 'My Company', url: 'https://mysite.com', logo: 'https://mysite.com/logo.png', sameAs: ['https://twitter.com/mysite'] },
        defaultType: 'WebPage',
      },
    });

    const result = auditSite(config);
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('scores low for minimal config', () => {
    const config = makeConfig({
      title: 'x',
      description: '',
      url: 'https://example.com',
      pages: [],
      generators: { robotsTxt: false, llmsTxt: false, llmsFullTxt: false, rawMarkdown: false, manifest: false, sitemap: false, aiIndex: false, schema: false },
      schema: { enabled: false, organization: { name: '', url: '', logo: '', sameAs: [] }, defaultType: 'WebPage' },
      og: { enabled: false, image: '', twitterHandle: '', type: 'website' },
    });

    const result = auditSite(config);
    expect(result.score).toBeLessThan(25);
    expect(result.issues.length).toBeGreaterThan(5);
  });

  it('detects blanket disallow rules', () => {
    const config = makeConfig({ robots: { allow: [], disallow: ['/'], crawlDelay: 0, sitemap: '', contentSignal: null } });
    const result = auditSite(config);
    const aiAccess = result.categories.find(c => c.name === 'AI Access')!;
    const blockCheck = aiAccess.checks.find(c => c.label.includes('blanket disallow'));
    expect(blockCheck?.passed).toBe(false);
  });

  it('detects missing FAQ patterns in citability', () => {
    const config = makeConfig({
      pages: [{ pathname: '/', content: 'Just plain text without any question headings or structure at all. This is a long enough paragraph to count as content for the audit.'.repeat(5) }],
    });
    const result = auditSite(config);
    const citability = result.categories.find(c => c.name === 'Citability')!;
    const faqCheck = citability.checks.find(c => c.label.includes('FAQ'));
    expect(faqCheck?.passed).toBe(false);
  });

  it('matches schema FAQ eligibility when auditing schema presence', () => {
    const config = makeConfig({
      pages: [{
        pathname: '/pricing',
        content: '## Pricing?\n\nPlans start at $10 per month.',
      }],
    });
    const result = auditSite(config);
    const schemaPresence = result.categories.find(c => c.name === 'Schema Presence')!;
    const faqOrHowToCheck = schemaPresence.checks.find(c => c.label === 'FAQPage or HowTo schema');
    expect(faqOrHowToCheck?.passed).toBe(false);
  });

  it('requires at least two HowTo steps when auditing schema presence', () => {
    const config = makeConfig({
      pages: [{
        pathname: '/install',
        content: '## Step 1: Install\n\nRun npm install aeo.js.',
      }],
    });
    const result = auditSite(config);
    const schemaPresence = result.categories.find(c => c.name === 'Schema Presence')!;
    const faqOrHowToCheck = schemaPresence.checks.find(c => c.label === 'FAQPage or HowTo schema');
    expect(faqOrHowToCheck?.passed).toBe(false);
  });

  it('passes schema presence for FAQ content that can generate FAQPage schema', () => {
    const config = makeConfig({
      pages: [{
        pathname: '/faq',
        content: '## What is aeo.js?\n\naeo.js generates answer-engine assets for websites.',
      }],
    });
    const result = auditSite(config);
    const schemaPresence = result.categories.find(c => c.name === 'Schema Presence')!;
    const faqOrHowToCheck = schemaPresence.checks.find(c => c.label === 'FAQPage or HowTo schema');
    expect(faqOrHowToCheck?.passed).toBe(true);
  });

  it('passes schema presence for HowTo content with two or more step headings', () => {
    const config = makeConfig({
      pages: [{
        pathname: '/install',
        content: '## Step 1: Install\n\nRun npm install aeo.js.\n\n## Step 2: Configure\n\nCreate aeo.config.ts.',
      }],
    });
    const result = auditSite(config);
    const schemaPresence = result.categories.find(c => c.name === 'Schema Presence')!;
    const faqOrHowToCheck = schemaPresence.checks.find(c => c.label === 'FAQPage or HowTo schema');
    expect(faqOrHowToCheck?.passed).toBe(true);
  });
});

describe('formatAuditReport', () => {
  it('generates a readable report', () => {
    const result = auditSite(makeConfig());
    const report = formatAuditReport(result);
    expect(report).toContain('GEO Readiness Score:');
    expect(report).toContain('AI Access:');
    expect(report).toContain('Content Structure:');
    expect(report).toContain('Schema Presence:');
    expect(report).toContain('Meta Quality:');
    expect(report).toContain('Citability:');
  });

  it('includes grade label', () => {
    const result = auditSite(makeConfig());
    const report = formatAuditReport(result);
    expect(report).toMatch(/Excellent|Good|Fair|Needs Work|Poor/);
  });
});
