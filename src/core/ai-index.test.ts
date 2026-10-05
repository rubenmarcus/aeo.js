import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAIIndex } from './ai-index';
import type { ResolvedAeoConfig } from '../types';

vi.mock('fs', () => ({
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('# Test\n\nContent'),
  existsSync: vi.fn().mockReturnValue(false),
}));

const baseConfig: ResolvedAeoConfig = {
  url: 'https://example.com',
  title: 'Test Site',
  description: 'A test site',
  contentDir: '/project/content',
  outDir: 'public',
  pages: [
    { pathname: '/', title: 'Home', description: 'Homepage', content: 'Welcome to our site. We offer great products and services.' },
    { pathname: '/about', title: 'About', description: 'About us', content: 'Learn more about our company and team.' },
    { pathname: '/contact', title: 'Contact' },
  ],
  generators: {
    robotsTxt: true,
    llmsTxt: true,
    llmsFullTxt: true,
    rawMarkdown: true,
    manifest: true,
    sitemap: true,
    aiIndex: true,
    schema: true,
  },
  aiIndex: {
    maxChunkLength: 2000,
    maxKeywords: 10,
  },
  robots: { allow: ['/'], disallow: [], crawlDelay: 0, sitemap: '', contentSignal: null },
  widget: {
    enabled: true,
    position: 'bottom-right',
    theme: { background: '#000', text: '#fff', accent: '#eee', badge: '#4ADE80' },
    humanLabel: 'Human',
    aiLabel: 'AI',
    showBadge: true,
    size: 'default' as const,
  },
  schema: {
    enabled: true,
    organization: { name: 'Test', url: 'https://example.com', logo: '', sameAs: [] },
    defaultType: 'WebPage',
  },
  og: {
    enabled: false,
    image: '',
    twitterHandle: '',
    type: 'website',
  },
};

describe('generateAIIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid JSON index', () => {
    const result = generateAIIndex(baseConfig);
    const index = JSON.parse(result);

    expect(index).toHaveProperty('version', '1.0');
    expect(index).toHaveProperty('generated');
    expect(index.site).toEqual({
      title: 'Test Site',
      description: 'A test site',
      url: 'https://example.com',
    });
    expect(index.entries.length).toBeGreaterThan(0);
  });

  it('should create entries with required fields', () => {
    const result = generateAIIndex(baseConfig);
    const index = JSON.parse(result);

    for (const entry of index.entries) {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('url');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('content');
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBe(16);
    }
  });

  it('should generate unique IDs for each entry', () => {
    const result = generateAIIndex(baseConfig);
    const index = JSON.parse(result);
    const ids = index.entries.map((e: any) => e.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should extract keywords from content', () => {
    const result = generateAIIndex(baseConfig);
    const index = JSON.parse(result);

    const homeEntry = index.entries.find((e: any) => e.url === 'https://example.com');
    expect(homeEntry?.keywords).toBeDefined();
    expect(Array.isArray(homeEntry?.keywords)).toBe(true);
  });

  it('should preserve Unicode keywords from international content', () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      pages: [
        {
          pathname: '/international',
          title: 'International',
          content: [
            'caf\u00e9 r\u00e9sum\u00e9 na\u00efve fa\u00e7ade',
            '\ud55c\uad6d\uc5b4 \uac80\uc0c9 \ucd5c\uc801\ud654 \ucf58\ud150\uce20 \ud55c\uad6d\uc5b4 \uac80\uc0c9',
            'AI SEO UX',
          ].join(' '),
        },
      ],
    };

    const result = generateAIIndex(config);
    const index = JSON.parse(result);
    const entry = index.entries.find((e: any) => e.url === 'https://example.com/international');

    expect(entry?.keywords).toEqual(expect.arrayContaining([
      'caf\u00e9',
      'r\u00e9sum\u00e9',
      '\ud55c\uad6d\uc5b4',
      '\uac80\uc0c9',
      '\ucd5c\uc801\ud654',
      '\ucf58\ud150\uce20',
    ]));
    expect(entry?.keywords).not.toContain('ai');
    expect(entry?.keywords).not.toContain('seo');
    expect(entry?.keywords).not.toContain('ux');
  });

  it('should use configured max chunk length', () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      aiIndex: {
        ...baseConfig.aiIndex,
        maxChunkLength: 20,
      },
      pages: [
        {
          pathname: '/chunked',
          title: 'Chunked',
          content: [
            'First paragraph content.',
            'Second paragraph content.',
            'Third paragraph content.',
          ].join('\n\n'),
        },
      ],
    };

    const result = generateAIIndex(config);
    const index = JSON.parse(result);
    const entries = index.entries
      .filter((e: any) => e.url === 'https://example.com/chunked')
      .sort((a: any, b: any) => a.metadata.chunkIndex - b.metadata.chunkIndex);

    expect(entries).toHaveLength(3);
    expect(entries.map((entry: any) => entry.metadata.chunkIndex)).toEqual([0, 1, 2]);
  });

  it('should use configured max keywords', () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      aiIndex: {
        ...baseConfig.aiIndex,
        maxKeywords: 2,
      },
      pages: [
        {
          pathname: '/keywords',
          title: 'Keywords',
          content: 'alpha alpha alpha beta beta gamma delta epsilon',
        },
      ],
    };

    const result = generateAIIndex(config);
    const index = JSON.parse(result);
    const entry = index.entries.find((e: any) => e.url === 'https://example.com/keywords');

    expect(entry?.keywords).toEqual(['alpha', 'beta']);
  });

  it('should handle pages without content', () => {
    const result = generateAIIndex(baseConfig);
    const index = JSON.parse(result);

    const contactEntry = index.entries.find((e: any) => e.url.includes('/contact'));
    expect(contactEntry).toBeDefined();
    expect(contactEntry?.title).toBe('Contact');
  });

  it('should surface page tags verbatim in entry metadata', () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      pages: [
        {
          pathname: '/tools/roi',
          title: 'ROI Calculator',
          description: 'Estimate return on investment',
          content: 'Use this calculator to estimate ROI for your campaign.',
          tags: ['calculator', 'template'],
        },
        {
          pathname: '/guides/setup',
          title: 'Setup Guide',
          tags: ['guide'],
        },
      ],
    };

    const result = generateAIIndex(config);
    const index = JSON.parse(result);

    const roiEntry = index.entries.find((e: any) => e.url === 'https://example.com/tools/roi');
    expect(roiEntry?.metadata?.tags).toEqual(['calculator', 'template']);

    const guideEntry = index.entries.find((e: any) => e.url === 'https://example.com/guides/setup');
    expect(guideEntry?.metadata?.tags).toEqual(['guide']);
  });

  it('should omit tags from metadata when not provided', () => {
    const result = generateAIIndex(baseConfig);
    const index = JSON.parse(result);

    const homeEntry = index.entries.find((e: any) => e.url === 'https://example.com');
    expect(homeEntry?.metadata?.tags).toBeUndefined();
  });

  it('should omit tags when an empty array is provided', () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      pages: [{ pathname: '/empty-tags', title: 'Empty', tags: [] }],
    };
    const result = generateAIIndex(config);
    const index = JSON.parse(result);

    const entry = index.entries.find((e: any) => e.url === 'https://example.com/empty-tags');
    expect(entry?.metadata?.tags).toBeUndefined();
  });

  it('should carry tags on every chunk of multi-chunk content', () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      aiIndex: { ...baseConfig.aiIndex, maxChunkLength: 20 },
      pages: [
        {
          pathname: '/tools/roi',
          title: 'ROI Calculator',
          content: [
            'First paragraph content.',
            'Second paragraph content.',
            'Third paragraph content.',
          ].join('\n\n'),
          tags: ['calculator', 'template'],
        },
      ],
    };

    const result = generateAIIndex(config);
    const index = JSON.parse(result);
    const chunks = index.entries
      .filter((e: any) => e.url === 'https://example.com/tools/roi')
      .sort((a: any, b: any) => a.metadata.chunkIndex - b.metadata.chunkIndex);

    expect(chunks).toHaveLength(3);
    for (const chunk of chunks) {
      expect(chunk.metadata.tags).toEqual(['calculator', 'template']);
    }
  });

  it('should handle empty pages', () => {
    const config: ResolvedAeoConfig = { ...baseConfig, pages: [] };
    const result = generateAIIndex(config);
    const index = JSON.parse(result);

    expect(index.entries).toEqual([]);
    expect(index.metadata.totalEntries).toBe(0);
  });

  it('should include metadata with embedding recommendations', () => {
    const result = generateAIIndex(baseConfig);
    const index = JSON.parse(result);

    expect(index.metadata).toMatchObject({
      generator: 'aeo.js',
      generatorUrl: 'https://aeojs.org',
    });
    expect(index.metadata.embedding).toBeDefined();
  });
});
