import { describe, it, expect, beforeEach, vi } from 'vitest';
import { copyRawMarkdown, generatePageMarkdownFiles } from './raw-markdown';
import { readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import type { ResolvedAeoConfig } from '../types';

vi.mock('fs', () => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  copyFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn(),
}));

vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.filter(Boolean).join('/')),
    relative: vi.fn((from: string, to: string) => to.replace(from + '/', '')),
    extname: vi.fn((file: string) => {
      const match = file.match(/\.[^.]+$/);
      return match ? match[0] : '';
    }),
    dirname: vi.fn((file: string) => {
      const parts = file.split('/');
      parts.pop();
      return parts.join('/');
    }),
  };
});

const createConfig = (overrides = {}): ResolvedAeoConfig => ({
  url: 'https://example.com',
  title: 'Test Site',
  description: 'Test description',
  contentDir: 'content',
  outDir: 'public/aeo',
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
  ...overrides,
});

describe('copyRawMarkdown', () => {
  const mockReaddirSync = vi.mocked(readdirSync);
  const mockStatSync = vi.mocked(statSync);
  const mockCopyFileSync = vi.mocked(copyFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should copy markdown files from source to output directory', () => {
    mockReaddirSync.mockReturnValue(['page1.md', 'page2.md', 'image.png'] as any);
    mockStatSync.mockReturnValue({ isFile: () => true, isDirectory: () => false } as any);

    const result = copyRawMarkdown(createConfig());

    expect(mockCopyFileSync).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('should skip non-markdown files', () => {
    mockReaddirSync.mockReturnValue(['doc.md', 'script.js', 'style.css'] as any);
    mockStatSync.mockReturnValue({ isFile: () => true, isDirectory: () => false } as any);

    const result = copyRawMarkdown(createConfig());

    expect(mockCopyFileSync).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('should handle missing directory gracefully', () => {
    mockReaddirSync.mockImplementation(() => { throw new Error('ENOENT'); });

    const result = copyRawMarkdown(createConfig());

    expect(result).toEqual([]);
    expect(mockCopyFileSync).not.toHaveBeenCalled();
  });

  it('does not read or warn when contentDir does not exist (#74)', () => {
    vi.mocked(existsSync).mockReturnValueOnce(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = copyRawMarkdown(createConfig());

    expect(result).toEqual([]);
    expect(mockReaddirSync).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should recursively copy from subdirectories', () => {
    mockReaddirSync.mockImplementation((dirPath) => {
      const pathStr = dirPath.toString();
      if (pathStr === 'content') return ['docs', 'root.md'] as any;
      if (pathStr.endsWith('docs')) return ['guide.md'] as any;
      return [];
    });
    mockStatSync.mockImplementation((path) => {
      const pathStr = path.toString();
      if (pathStr.includes('docs') && !pathStr.includes('.md')) {
        return { isFile: () => false, isDirectory: () => true } as any;
      }
      return { isFile: () => true, isDirectory: () => false } as any;
    });

    const result = copyRawMarkdown(createConfig());

    expect(mockCopyFileSync).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('should handle copy errors for individual files', () => {
    mockReaddirSync.mockReturnValue(['file1.md', 'file2.md'] as any);
    mockStatSync.mockReturnValue({ isFile: () => true, isDirectory: () => false } as any);
    mockCopyFileSync
      .mockImplementationOnce(() => { throw new Error('Permission denied'); })
      .mockImplementationOnce(() => undefined);

    const result = copyRawMarkdown(createConfig());

    expect(mockCopyFileSync).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
  });
});

describe('generatePageMarkdownFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip pages without content', () => {
    const config = createConfig({
      pages: [
        { pathname: '/', title: 'Home' },
        { pathname: '/about', title: 'About' },
      ],
    });

    const result = generatePageMarkdownFiles(config);

    expect(result).toHaveLength(0);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('should generate .md files for pages with content', () => {
    const config = createConfig({
      pages: [
        { pathname: '/', title: 'Home', content: 'Welcome to our site' },
        { pathname: '/about', title: 'About', description: 'About us', content: 'We are great' },
      ],
    });

    const result = generatePageMarkdownFiles(config);

    expect(result).toHaveLength(2);
    expect(writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('should include frontmatter in generated files', () => {
    const config = createConfig({
      pages: [
        { pathname: '/about', title: 'About', description: 'About us', content: 'Content here' },
      ],
    });

    generatePageMarkdownFiles(config);

    const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(writtenContent).toContain('---');
    expect(writtenContent).toContain('title: "About"');
    expect(writtenContent).toContain('description: "About us"');
    expect(writtenContent).toContain('generated_by: aeo.js');
    expect(writtenContent).toContain('# About');
    expect(writtenContent).toContain('Content here');
  });

  it('should escape double quotes in title frontmatter', () => {
    const config = createConfig({
      pages: [
        { pathname: '/test', title: 'He said "hello"', content: 'Body text' },
      ],
    });

    generatePageMarkdownFiles(config);

    const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(writtenContent).toContain('title: "He said \\"hello\\""');
  });

  it('should escape double quotes in description frontmatter', () => {
    const config = createConfig({
      pages: [
        { pathname: '/test', title: 'Test', description: 'A "great" page', content: 'Body' },
      ],
    });

    generatePageMarkdownFiles(config);

    const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(writtenContent).toContain('description: "A \\"great\\" page"');
  });

  it('should escape backslashes in title frontmatter', () => {
    const config = createConfig({
      pages: [
        { pathname: '/test', title: 'Path\\to\\file', content: 'Body' },
      ],
    });

    generatePageMarkdownFiles(config);

    const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(writtenContent).toContain('title: "Path\\\\to\\\\file"');
  });
});
