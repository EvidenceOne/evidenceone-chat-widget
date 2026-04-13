import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Converts markdown to sanitized HTML.
 * Pure function — no side effects.
 * Always pipe through DOMPurify before injecting into the DOM.
 */
export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  return DOMPurify.sanitize(raw);
}
