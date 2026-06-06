import { describe, expect, it } from 'vitest';
import { renderInlineMarkdown } from '../core/inline-agent/markdown';

describe('renderInlineMarkdown', () => {
  it('does not create anchors for unsafe protocols', () => {
    const html = renderInlineMarkdown('[run](javascript:alert(1))');

    expect(html).not.toContain('<a ');
    expect(html).toContain('run');
  });

  it('escapes safe href attributes', () => {
    const html = renderInlineMarkdown('[docs](https://example.com/?q=a&b=c)');

    expect(html).toContain('<a href="https://example.com/?q=a&amp;b=c"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

