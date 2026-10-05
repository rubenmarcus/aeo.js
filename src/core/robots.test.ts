import { describe, it, expect } from 'vitest'
import { generateRobotsTxt } from './robots'
import type { ResolvedAeoConfig } from '../types'

describe('generateRobotsTxt', () => {
  const baseConfig: ResolvedAeoConfig = {
    url: 'https://example.com',
    title: 'Test Site',
    description: 'Test description',
    contentDir: 'content',
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
  }

  it('should generate robots.txt with AI crawler rules', () => {
    const result = generateRobotsTxt(baseConfig)
    
    expect(result).toContain('User-agent: GPTBot')
    expect(result).toContain('User-agent: ChatGPT-User')
    expect(result).toContain('User-agent: CCBot')
    expect(result).toContain('User-agent: Claude-Web')
    expect(result).toContain('User-agent: ClaudeBot')
    expect(result).toContain('Allow: /')
    expect(result).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('should include all AI crawlers', () => {
    const result = generateRobotsTxt(baseConfig)
    
    expect(result).toContain('User-agent: PerplexityBot')
    expect(result).toContain('User-agent: Google-Extended')
    expect(result).toContain('User-agent: Bingbot')
    expect(result).toContain('User-agent: DeepSeekBot')
    expect(result).toContain('User-agent: cohere-ai')
  })

  it('should include AEO file references', () => {
    const result = generateRobotsTxt(baseConfig)
    
    expect(result).toContain('# AEO (Answer Engine Optimization) files')
    expect(result).toContain('# https://example.com/llms.txt')
    expect(result).toContain('# https://example.com/llms-full.txt')
    expect(result).toContain('# https://example.com/docs.json')
    expect(result).toContain('# https://example.com/ai-index.json')
  })

  it('should handle missing url', () => {
    const config: ResolvedAeoConfig = {
      ...baseConfig,
      url: '',
    }
    
    const result = generateRobotsTxt(config)
    
    expect(result).not.toContain('Sitemap:')
    expect(result).toContain('# /llms.txt')
  })


  it('emits a Content-Signal policy line when configured', () => {
    const result = generateRobotsTxt({
      ...baseConfig,
      robots: { allow: ['/'], disallow: [], crawlDelay: 0, sitemap: '', contentSignal: 'search=yes, ai-train=yes' },
    })

    expect(result).toContain('Content-Signal: search=yes, ai-train=yes')
  })

  it('omits the Content-Signal section when no policy is set', () => {
    expect(generateRobotsTxt(baseConfig)).not.toContain('Content-Signal')
  })
  it('should include traditional search engines', () => {
    const result = generateRobotsTxt(baseConfig)

    expect(result).toContain('User-agent: Googlebot')
    expect(result).toContain('Allow: /')
    expect(result).toContain('User-agent: Bingbot')
    expect(result).toContain('Allow: /')
  })

  it('does not duplicate Bingbot or SemrushBot user-agent entries', () => {
    const result = generateRobotsTxt(baseConfig)
    const bingbotMatches = result.match(/^User-agent: Bingbot$/gm) || []
    const semrushMatches = result.match(/^User-agent: SemrushBot$/gim) || []

    expect(bingbotMatches.length).toBe(1)
    expect(semrushMatches.length).toBe(1)
  })
})
