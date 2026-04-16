import DOMPurify from 'dompurify';
import { Marked } from 'marked';

/**
 * Isolated `Marked` instance — avoids mutating the shared `marked` global.
 * If a partner page uses `marked` elsewhere with different options, our config
 * does not leak into theirs.
 */
const md = new Marked({
  gfm: true,
  breaks: true,
});

/**
 * Converts markdown to sanitized HTML.
 * Pure function — the Marked instance is immutable after construction.
 * Always pipe through DOMPurify before injecting into the DOM.
 */
export function renderMarkdown(text: string): string {
  const raw = md.parse(text) as string;
  return DOMPurify.sanitize(raw);
}
