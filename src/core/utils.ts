import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import type { AeoConfig, ResolvedAeoConfig, MarkdownFile } from '../types';
import { detectFramework } from './detect';
import { minimatch } from 'minimatch';

/**
 * Escape a string for safe inclusion inside a YAML double-quoted scalar.
 * Backslash must be escaped first so the subsequent quote-escape isn't undone.
 */
export function escapeYamlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function validateConfig(config: AeoConfig): string[] {
  const warnings: string[] = [];

  if (config.url && !/^https?:\/\//.test(config.url)) {
    warnings.push(`url "${config.url}" should start with http:// or https://`);
  }

  if (config.url === 'https://example.com') {
    warnings.push('url is set to the default "https://example.com" — set your actual site URL');
  }

  if (!config.title) {
    warnings.push('title is not set — your generated files will use "My Site"');
  }

  if (config.robots?.crawlDelay && config.robots.crawlDelay < 0) {
    warnings.push('robots.crawlDelay should be a positive number');
  }

  if (config.aiIndex?.maxChunkLength !== undefined && config.aiIndex.maxChunkLength <= 0) {
    warnings.push('aiIndex.maxChunkLength should be a positive number — sub-1 values produce one chunk per paragraph');
  }

  if (config.aiIndex?.maxKeywords !== undefined && config.aiIndex.maxKeywords <= 0) {
    warnings.push('aiIndex.maxKeywords should be a positive number — sub-1 values produce an empty keywords array');
  }

  return warnings;
}

export function resolveConfig(config: AeoConfig = {}): ResolvedAeoConfig {
  const frameworkInfo = detectFramework();

  return {
    title: config.title || 'My Site',
    description: config.description || '',
    url: config.url || 'https://example.com',
    contentDir: config.contentDir || frameworkInfo.contentDir,
    outDir: config.outDir || frameworkInfo.outDir,
    trailingSlash: config.trailingSlash || 'preserve',
    pages: config.pages || [],
    generators: {
      robotsTxt: config.generators?.robotsTxt !== false,
      llmsTxt: config.generators?.llmsTxt !== false,
      llmsFullTxt: config.generators?.llmsFullTxt !== false,
      rawMarkdown: config.generators?.rawMarkdown !== false,
      manifest: config.generators?.manifest !== false,
      sitemap: config.generators?.sitemap !== false,
      aiIndex: config.generators?.aiIndex !== false,
      schema: config.generators?.schema !== false,
    },
    aiIndex: {
      maxChunkLength: config.aiIndex?.maxChunkLength ?? 2000,
      maxKeywords: config.aiIndex?.maxKeywords ?? 10,
    },
    robots: {
      allow: config.robots?.allow || ['/'],
      disallow: config.robots?.disallow || [],
      crawlDelay: config.robots?.crawlDelay || 0,
      sitemap: config.robots?.sitemap || '',
      contentSignal: config.robots?.contentSignal?.trim() || null,
    },
    schema: {
      enabled: config.schema?.enabled !== false,
      organization: {
        name: config.schema?.organization?.name || config.title || 'My Site',
        url: config.schema?.organization?.url || config.url || 'https://example.com',
        logo: config.schema?.organization?.logo || '',
        sameAs: config.schema?.organization?.sameAs || [],
      },
      defaultType: config.schema?.defaultType || 'WebPage',
    },
    og: {
      enabled: config.og?.enabled !== false,
      image: config.og?.image || '',
      twitterHandle: config.og?.twitterHandle || '',
      type: config.og?.type || 'website',
    },
    widget: {
      enabled: config.widget?.enabled !== false,
      position: config.widget?.position || 'bottom-right',
      size: config.widget?.size || 'default',
      theme: {
        background: config.widget?.theme?.background || 'rgba(18, 18, 24, 0.9)',
        text: config.widget?.theme?.text || '#C0C0C5',
        accent: config.widget?.theme?.accent || '#E8E8EA',
        badge: config.widget?.theme?.badge || '#4ADE80',
      },
      humanLabel: config.widget?.humanLabel || 'Human',
      aiLabel: config.widget?.aiLabel || 'AI',
      showBadge: config.widget?.showBadge !== false,
    },
  };
}

export function parseFrontmatter(content: string): { frontmatter: Record<string, any>; content: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/);
  
  if (frontmatterMatch) {
    const frontmatterStr = frontmatterMatch[1];
    const contentWithoutFrontmatter = frontmatterMatch[2];
    
    const frontmatter: Record<string, any> = {};
    const lines = frontmatterStr.split('\n');
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
    
    return { frontmatter, content: contentWithoutFrontmatter };
  }
  
  return { frontmatter: {}, content };
}

export function bumpHeadings(content: string, levels: number = 1): string {
  return content.replace(/^(#{1,6})\s/gm, (match, hashes) => {
    const newLevel = Math.min(hashes.length + levels, 6);
    return '#'.repeat(newLevel) + ' ';
  });
}

export function extractTitle(content: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1];
  
  const h2Match = content.match(/^##\s+(.+)$/m);
  if (h2Match) return h2Match[1];
  
  const firstLine = content.split('\n')[0];
  return firstLine.slice(0, 100);
}

export function readPackageJson(projectRoot: string = process.cwd()): Record<string, any> {
  const packageJsonPath = join(projectRoot, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    return {};
  }
  
  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function getAllMarkdownFiles(
  projectRoot: string,
  include: string[] = ['**/*.md'],
  exclude: string[] = ['**/node_modules/**']
): string[] {
  const files: string[] = [];
  
  function scanDirectory(dir: string): void {
    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relativePath = relative(projectRoot, fullPath);
        
        // Check if path should be excluded
        const shouldExclude = exclude.some(pattern => 
          minimatch(relativePath, pattern) || minimatch(fullPath, pattern)
        );
        
        if (shouldExclude) {
          continue;
        }
        
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip hidden directories
          if (!entry.startsWith('.')) {
            scanDirectory(fullPath);
          }
        } else if (stat.isFile()) {
          // Check if file matches include patterns
          const shouldInclude = include.some(pattern =>
            minimatch(relativePath, pattern) || minimatch(fullPath, pattern)
          );
          
          if (shouldInclude) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }
  }
  
  scanDirectory(projectRoot);
  return files;
}
