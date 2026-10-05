import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateSitemap } from './sitemap';
import fs from 'fs';
import path from 'path';
import type { ResolvedAeoConfig } from '../types';

vi.mock('fs');
vi.mock('path');

describe('generateSitemap', () => {
  const mockFs = fs as any;
  const mockPath = path as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
    
    mockFs.existsSync.mockReturnValue(true);
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    mockPath.relative.mockImplementation((from: string, to: string) => 
      to.replace(from + '/', '')
    );
    mockPath.extname.mockImplementation((file: string) => {
      if (file.endsWith('.md')) return '.md';
      if (file.endsWith('.mdx')) return '.mdx';
      if (file.endsWith('.html')) return '.html';
      return '';
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseConfig: ResolvedAeoConfig = {
    url: 'https://example.com',
    title: 'Test Site',
    description: 'Test description',
    contentDir: '/test/content',
    outDir: 'public',
    pages: [],
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

  it('should generate sitemap.xml with all routes', () => {
    mockFs.readdirSync.mockReturnValue(['index.md', 'about.md', 'products.md', 'contact.md']);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    });
    
    const sitemap = generateSitemap(baseConfig);
    
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap).toContain('</urlset>');
    
    expect(sitemap).toContain('<loc>https://example.com</loc>');
    expect(sitemap).toContain('<loc>https://example.com/about</loc>');
    expect(sitemap).toContain('<loc>https://example.com/products</loc>');
    expect(sitemap).toContain('<loc>https://example.com/contact</loc>');
  });

  it('should include priority when specified', () => {
    mockFs.readdirSync.mockReturnValue(['index.md', 'about.md']);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    });
    
    const sitemap = generateSitemap(baseConfig);
    
    expect(sitemap).toContain('<priority>0.8</priority>');
  });

  it('should use default priority when not specified', () => {
    mockFs.readdirSync.mockReturnValue(['products.md']);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    });
    
    const sitemap = generateSitemap(baseConfig);
    
    expect(sitemap).toContain('<priority>0.8</priority>');
  });

  it('should include lastmod with current date', () => {
    mockFs.readdirSync.mockReturnValue(['index.md']);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    });
    
    const sitemap = generateSitemap(baseConfig);
    
    expect(sitemap).toContain('<lastmod>2024-01-15</lastmod>');
  });

  it('should handle empty routes gracefully', () => {
    mockFs.readdirSync.mockReturnValue([]);
    
    const sitemap = generateSitemap(baseConfig);
    
    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap).toContain('</urlset>');
    expect(sitemap).toContain('<loc>https://example.com</loc>');
  });

  it('should escape special characters in URLs', () => {
    const configWithSpecialChars = {
      ...baseConfig,
      url: 'https://example.com/search?q=test&category=books'
    };
    
    mockFs.readdirSync.mockReturnValue(['product/<id>.md']);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    });
    
    const sitemap = generateSitemap(configWithSpecialChars);
    
    // URLs should be properly escaped in XML
    expect(sitemap).toMatch(/search\?q=test&amp;category=books/);
    expect(sitemap).toMatch(/product\/&lt;id&gt;/);
  });

  it('should format XML with proper indentation', () => {
    mockFs.readdirSync.mockReturnValue(['about.md', 'products.md']);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    });
    
    const sitemap = generateSitemap(baseConfig);
    const lines = sitemap.split('\n');
    
    expect(lines[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
    expect(lines[1]).toBe('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(lines.some(line => line.startsWith('  <url>'))).toBe(true);
    expect(lines.some(line => line.startsWith('    <loc>'))).toBe(true);
  });

  it('should handle routes with trailing slashes correctly', () => {
    mockFs.readdirSync.mockReturnValue(['about/.md', 'products/.md']);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    });
    
    const sitemap = generateSitemap(baseConfig);
    
    expect(sitemap).toContain('<loc>https://example.com/about/</loc>');
    expect(sitemap).toContain('<loc>https://example.com/products/</loc>');
  });
  
  it('filters /sitemap, /sitemap-N, and /sitemap-index from config.pages', () => {
    mockFs.readdirSync.mockReturnValue([]);
    const configWithSitemapPages = {
      ...baseConfig,
      pages: [
        { pathname: '/', title: 'Home', description: '', content: '' },
        { pathname: '/about', title: 'About', description: '', content: '' },
        { pathname: '/sitemap', title: '', description: '', content: '' },
        { pathname: '/sitemap-0', title: '', description: '', content: '' },
        { pathname: '/sitemap-1', title: '', description: '', content: '' },
        { pathname: '/sitemap-index', title: '', description: '', content: '' },
        { pathname: '/sitemap.xml', title: '', description: '', content: '' },
        { pathname: '/sitemap-0.xml', title: '', description: '', content: '' },
      ],
    };

    const sitemap = generateSitemap(configWithSitemapPages);

    expect(sitemap).toContain('<loc>https://example.com/about</loc>');
    expect(sitemap).not.toContain('/sitemap-0');
    expect(sitemap).not.toContain('/sitemap-1');
    expect(sitemap).not.toContain('/sitemap-index');
    expect(sitemap).not.toContain('/sitemap.xml');
    expect(sitemap).not.toMatch(/<loc>https:\/\/example\.com\/sitemap<\/loc>/);
  });

  it('preserves legitimate paths that start with sitemap- but are not sitemap files', () => {
    mockFs.readdirSync.mockReturnValue([]);
    const configWithSitemapNamedPages = {
      ...baseConfig,
      pages: [
        { pathname: '/sitemap-guide', title: 'Sitemap Guide', description: '', content: '' },
        { pathname: '/sitemap-tutorial', title: 'Tutorial', description: '', content: '' },
        { pathname: '/sitemaps-explained', title: 'Explained', description: '', content: '' },
        { pathname: '/sitemap-0', title: '', description: '', content: '' },
      ],
    };

    const sitemap = generateSitemap(configWithSitemapNamedPages);

    expect(sitemap).toContain('<loc>https://example.com/sitemap-guide</loc>');
    expect(sitemap).toContain('<loc>https://example.com/sitemap-tutorial</loc>');
    expect(sitemap).toContain('<loc>https://example.com/sitemaps-explained</loc>');
    expect(sitemap).not.toContain('<loc>https://example.com/sitemap-0</loc>');
  });

  it('filters sitemap-named files discovered in contentDir', () => {
    mockFs.readdirSync.mockReturnValue([
      'index.md',
      'about.md',
      'sitemap-0.html',
      'sitemap-index.html',
      'sitemap-guide.md',
    ]);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
    });

    const sitemap = generateSitemap(baseConfig);

    expect(sitemap).toContain('<loc>https://example.com/about</loc>');
    expect(sitemap).toContain('<loc>https://example.com/sitemap-guide</loc>');
    expect(sitemap).not.toContain('/sitemap-0');
    expect(sitemap).not.toContain('/sitemap-index');
  });

  it('should handle subdirectories recursively', () => {
    const files = ['index.md', 'blog', 'docs'];
    
    mockFs.readdirSync.mockImplementation((dir: string) => {
      if (dir === '/test/content') return files;
      if (dir === '/test/content/blog') return ['post1.md', 'post2.md'];
      if (dir === '/test/content/docs') return ['guide.md', 'api'];
      if (dir === '/test/content/docs/api') return ['reference.md'];
      return [];
    });
    
    mockFs.statSync.mockImplementation((path: string) => {
      const isDir = path.includes('/blog') || path.includes('/docs') || path.includes('/api');
      return {
        isDirectory: () => isDir && !path.endsWith('.md'),
        isFile: () => path.endsWith('.md')
      };
    });
    
    const sitemap = generateSitemap(baseConfig);
    
    // index.md collapses to the site root, not /index
    expect(sitemap).toContain('<loc>https://example.com</loc>');
    expect(sitemap).not.toContain('<loc>https://example.com/index</loc>');
    expect(sitemap).toContain('<loc>https://example.com/blog/post1</loc>');
    expect(sitemap).toContain('<loc>https://example.com/blog/post2</loc>');
    expect(sitemap).toContain('<loc>https://example.com/docs/guide</loc>');
    expect(sitemap).toContain('<loc>https://example.com/docs/api/reference</loc>');
  });
});
