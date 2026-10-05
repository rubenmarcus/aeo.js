import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateManifest } from './manifest';
import type { ResolvedAeoConfig } from '../types';

vi.mock('fs', () => ({
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('# Test\n\nContent'),
  existsSync: vi.fn().mockReturnValue(false),
}));

const baseConfig: ResolvedAeoConfig = {
  url: 'https://example.com',
  title: 'Example Site',
  description: 'An example website',
  contentDir: '/project/content',
  outDir: 'public',
  pages: [
    { pathname: '/', title: 'Home', description: 'Homepage' },
    { pathname: '/about', title: 'About Us', description: 'Learn about our company' },
    { pathname: '/products', title: 'Products' },
    { pathname: '/contact', title: 'Contact', description: 'Get in touch' },
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

describe('generateManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate valid JSON manifest', () => {
    const result = generateManifest(baseConfig);
    const manifest = JSON.parse(result);

    expect(manifest).toHaveProperty('version', '1.0');
    expect(manifest).toHaveProperty('generated');
    expect(manifest.site).toEqual({
      title: 'Example Site',
      description: 'An example website',
      url: 'https://example.com',
    });
    expect(manifest.documents).toHaveLength(4);
  });

  it('should format document entries correctly', () => {
    const result = generateManifest(baseConfig);
    const manifest = JSON.parse(result);

    const homeDoc = manifest.documents.find((d: any) => d.url === 'https://example.com');
    expect(homeDoc).toMatchObject({
      url: 'https://example.com',
      title: 'Home',
      description: 'Homepage',
    });

    const aboutDoc = manifest.documents.find((d: any) => d.url.includes('/about'));
    expect(aboutDoc).toMatchObject({
      url: 'https://example.com/about',
      title: 'About Us',
      description: 'Learn about our company',
    });
  });

  it('should handle empty pages array', () => {
    const config: ResolvedAeoConfig = { ...baseConfig, pages: [] };
    const result = generateManifest(config);
    const manifest = JSON.parse(result);

    expect(manifest.documents).toEqual([]);
    expect(manifest.metadata.totalDocuments).toBe(0);
  });

  it('should include metadata', () => {
    const result = generateManifest(baseConfig);
    const manifest = JSON.parse(result);

    expect(manifest.metadata).toMatchObject({
      totalDocuments: 4,
      generator: 'aeo.js',
      generatorUrl: 'https://aeojs.org',
    });
  });

  it('should include timestamp in generated field', () => {
    const beforeTime = new Date().toISOString();
    const result = generateManifest(baseConfig);
    const manifest = JSON.parse(result);
    const afterTime = new Date().toISOString();

    expect(manifest.generated).toBeDefined();
    expect(manifest.generated >= beforeTime).toBe(true);
    expect(manifest.generated <= afterTime).toBe(true);
  });

  it('should sort documents by URL', () => {
    const result = generateManifest(baseConfig);
    const manifest = JSON.parse(result);
    const urls = manifest.documents.map((d: any) => d.url);

    const sorted = [...urls].sort();
    expect(urls).toEqual(sorted);
  });
});
