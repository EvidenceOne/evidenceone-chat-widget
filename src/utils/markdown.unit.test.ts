import { describe, expect, it, vi } from 'vitest';

// DOMPurify requires a real browser DOM — mock it as identity for unit tests.
// XSS sanitization is verified manually in test/index.html (browser test).
vi.mock('dompurify', () => ({
  default: { sanitize: (html: string) => html },
}));

import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold text as <strong>', () => {
    expect(renderMarkdown('**hello**')).toContain('<strong>hello</strong>');
  });

  it('renders italic text as <em>', () => {
    expect(renderMarkdown('_world_')).toContain('<em>world</em>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('`code`')).toContain('<code>code</code>');
  });

  it('renders links as <a> tags', () => {
    const result = renderMarkdown('[EvidenceOne](https://evidenceone.com.br)');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://evidenceone.com.br"');
  });

  it('renders unordered lists', () => {
    const result = renderMarkdown('- item one\n- item two');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>item one</li>');
  });

  it('returns a string for empty input', () => {
    expect(typeof renderMarkdown('')).toBe('string');
  });

  it('converts single newlines to <br> (breaks: true)', () => {
    const result = renderMarkdown('line one\nline two');
    expect(result).toContain('<br');
  });

  it('renders GFM tables (gfm: true)', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |';
    const result = renderMarkdown(md);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>');
  });
});
