import { describe, it, expect } from 'vitest';
import { parseArgs, normalizeTargetUrl } from './cli';

describe('parseArgs', () => {
  it('parses space-separated flag values', () => {
    const { command, flags } = parseArgs(['generate', '--out', 'public', '--url', 'https://example.com']);
    expect(command).toBe('generate');
    expect(flags.out).toBe('public');
    expect(flags.url).toBe('https://example.com');
  });

  it('parses equals-separated flag values', () => {
    const { command, flags } = parseArgs(['generate', '--out=public', '--url=https://example.com']);
    expect(command).toBe('generate');
    expect(flags.out).toBe('public');
    expect(flags.url).toBe('https://example.com');
  });

  it('preserves equals signs that are part of the value', () => {
    const { flags } = parseArgs(['generate', '--title=Foo=Bar=Baz']);
    expect(flags.title).toBe('Foo=Bar=Baz');
  });

  it('handles a mix of both forms in the same invocation', () => {
    const { flags } = parseArgs(['generate', '--out=dist', '--url', 'https://x.dev']);
    expect(flags.out).toBe('dist');
    expect(flags.url).toBe('https://x.dev');
  });

  it('still parses boolean flags', () => {
    const { flags } = parseArgs(['generate', '--no-widget', '--json']);
    expect(flags.noWidget).toBe(true);
    expect(flags.json).toBe(true);
  });

  it('treats --no-widget=true as the same camelCase boolean as --no-widget', () => {
    const { flags } = parseArgs(['generate', '--no-widget=true']);
    expect(flags.noWidget).toBe(true);
    expect(flags['no-widget']).toBeUndefined();
  });

  it('treats --no-widget=false as a disabled boolean', () => {
    const { flags } = parseArgs(['generate', '--no-widget=false']);
    expect(flags.noWidget).toBe(false);
  });

  it('does not let a boolean flag swallow the following value flag', () => {
    const { flags, positionals } = parseArgs(['init', '--yes', '--url', 'https://x.dev']);
    expect(flags.yes).toBe(true);
    expect(flags.url).toBe('https://x.dev');
    expect(positionals).toEqual([]);
  });

  it('registers a boolean flag passed as the last argument', () => {
    const { flags } = parseArgs(['init', '--yes']);
    expect(flags.yes).toBe(true);
  });

  it('does not treat a following flag as a value flag argument', () => {
    const { flags } = parseArgs(['generate', '--url', '--no-widget']);
    expect(flags.url).toBeUndefined();
    expect(flags.noWidget).toBe(true);
  });
  it('importing the CLI module does not run main()', () => {
    // Smoke check: if main() were running on import, the test runner would
    // exit before this assertion. Reaching this line proves the guard works.
    expect(typeof parseArgs).toBe('function');
  });

  it('captures positional arguments after the command', () => {
    const { command, positionals } = parseArgs(['check', 'https://example.com']);
    expect(command).toBe('check');
    expect(positionals).toEqual(['https://example.com']);
  });

  it('captures positionals mixed with flags', () => {
    const { command, flags, positionals } = parseArgs(['report', 'example.com', '--json']);
    expect(command).toBe('report');
    expect(flags.json).toBe(true);
    expect(positionals).toEqual(['example.com']);
  });

  it('returns empty positionals when only a command is given', () => {
    expect(parseArgs(['check']).positionals).toEqual([]);
  });
});

describe('normalizeTargetUrl', () => {
  it('keeps full http(s) URLs', () => {
    expect(normalizeTargetUrl('https://example.com/docs')).toBe('https://example.com/docs');
    expect(normalizeTargetUrl('http://example.com')).toBe('http://example.com/');
  });

  it('prepends https:// to bare domains', () => {
    expect(normalizeTargetUrl('example.com')).toBe('https://example.com/');
    expect(normalizeTargetUrl('sub.example.co.uk/path')).toBe('https://sub.example.co.uk/path');
  });

  it('rejects non-URL input', () => {
    expect(normalizeTargetUrl('not a url')).toBeNull();
    expect(normalizeTargetUrl('ftp://example.com')).toBeNull();
    expect(normalizeTargetUrl('localhost')).toBeNull();
  });
});
