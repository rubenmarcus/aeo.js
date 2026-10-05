import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateAEOFiles } from './generate-wrapper';
import * as robots from './robots';
import * as llmsTxt from './llms-txt';
import * as llmsFull from './llms-full';
import * as rawMarkdown from './raw-markdown';
import * as manifest from './manifest';
import * as sitemap from './sitemap';
import * as aiIndex from './ai-index';
import * as schema from './schema';
import type { ResolvedAeoConfig } from '../types';

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

const baseConfig: ResolvedAeoConfig = {
  title: 'Test Site',
  description: 'Test description',
  url: 'https://example.com',
  contentDir: 'content',
  outDir: '/tmp/test-out',
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

describe('generateAEOFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(robots, 'generateRobotsTxt').mockReturnValue('User-agent: *\nAllow: /');
    vi.spyOn(llmsTxt, 'generateLlmsTxt').mockReturnValue('# LLMs.txt');
    vi.spyOn(llmsFull, 'generateLlmsFullTxt').mockReturnValue('# Full LLMs');
    vi.spyOn(manifest, 'generateManifest').mockReturnValue('{"docs":[]}');
    vi.spyOn(sitemap, 'generateSitemap').mockReturnValue('<?xml version="1.0"?>');
    vi.spyOn(aiIndex, 'generateAIIndex').mockReturnValue('{"index":[]}');
    vi.spyOn(rawMarkdown, 'copyMarkdownFiles').mockReturnValue([]);
    vi.spyOn(rawMarkdown, 'generatePageMarkdownFiles').mockReturnValue([]);
  });

  it('should call all enabled generators and return file list', async () => {
    const result = await generateAEOFiles(baseConfig);

    expect(robots.generateRobotsTxt).toHaveBeenCalledWith(baseConfig);
    expect(llmsTxt.generateLlmsTxt).toHaveBeenCalledWith(baseConfig);
    expect(llmsFull.generateLlmsFullTxt).toHaveBeenCalledWith(baseConfig);
    expect(manifest.generateManifest).toHaveBeenCalledWith(baseConfig);
    expect(sitemap.generateSitemap).toHaveBeenCalledWith(baseConfig);
    expect(aiIndex.generateAIIndex).toHaveBeenCalledWith(baseConfig);

    expect(result.files).toContain('robots.txt');
    expect(result.files).toContain('llms.txt');
    expect(result.files).toContain('llms-full.txt');
    expect(result.files).toContain('docs.json');
    expect(result.files).toContain('sitemap.xml');
    expect(result.files).toContain('ai-index.json');
    expect(result.errors).toEqual([]);
  });

  it('should skip disabled generators', async () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      generators: {
        robotsTxt: true,
        llmsTxt: false,
        llmsFullTxt: false,
        rawMarkdown: false,
        manifest: true,
        sitemap: false,
        aiIndex: false,
        schema: false,
      },
    };

    const result = await generateAEOFiles(config);

    expect(robots.generateRobotsTxt).toHaveBeenCalled();
    expect(llmsTxt.generateLlmsTxt).not.toHaveBeenCalled();
    expect(llmsFull.generateLlmsFullTxt).not.toHaveBeenCalled();
    expect(manifest.generateManifest).toHaveBeenCalled();
    expect(sitemap.generateSitemap).not.toHaveBeenCalled();
    expect(aiIndex.generateAIIndex).not.toHaveBeenCalled();

    expect(result.files).toContain('robots.txt');
    expect(result.files).toContain('docs.json');
    expect(result.files).not.toContain('llms.txt');
  });

  it('should handle generator errors gracefully', async () => {
    vi.spyOn(robots, 'generateRobotsTxt').mockImplementation(() => {
      throw new Error('Robots generation failed');
    });

    const result = await generateAEOFiles(baseConfig);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('robots.txt');
    expect(result.files).toContain('llms.txt');
    expect(result.files).toContain('sitemap.xml');
  });

  it('should complete even if all generators fail', async () => {
    vi.spyOn(robots, 'generateRobotsTxt').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(llmsTxt, 'generateLlmsTxt').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(llmsFull, 'generateLlmsFullTxt').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(manifest, 'generateManifest').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(sitemap, 'generateSitemap').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(aiIndex, 'generateAIIndex').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(rawMarkdown, 'generatePageMarkdownFiles').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(rawMarkdown, 'copyMarkdownFiles').mockImplementation(() => { throw new Error('fail'); });
    vi.spyOn(schema, 'generateSchema').mockImplementation(() => { throw new Error('fail'); });

    const result = await generateAEOFiles(baseConfig);

    expect(result.files).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return result shape with files and errors arrays', async () => {
    const result = await generateAEOFiles(baseConfig);

    expect(result).toHaveProperty('files');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.files)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
