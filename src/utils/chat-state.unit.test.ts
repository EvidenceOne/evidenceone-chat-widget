import { describe, expect, it } from 'vitest';
import { AuthStatus, Message } from '../models/types';
import { applySSEEvent, canStartNewSession, extractSources, isInputDisabled } from './chat-state';

const baseMessages: Message[] = [
  { id: 'u1', role: 'user', content: 'pergunta' },
  { id: 'a1', role: 'assistant', content: '', isStreaming: true },
];

describe('applySSEEvent', () => {
  it('appends delta content to the assistant message', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'delta', content: 'hello' });
    expect(result[1].content).toBe('hello');
  });

  it('appends multiple deltas incrementally', () => {
    let msgs = baseMessages;
    msgs = applySSEEvent(msgs, 'a1', { type: 'delta', content: 'he' });
    msgs = applySSEEvent(msgs, 'a1', { type: 'delta', content: 'llo' });
    expect(msgs[1].content).toBe('hello');
  });

  it('stops streaming and keeps content on error event with prior content', () => {
    const msgs: Message[] = [
      { id: 'a1', role: 'assistant', content: 'partial answer', isStreaming: true },
    ];
    const result = applySSEEvent(msgs, 'a1', { type: 'error', message: 'timeout' });
    expect(result[0].isStreaming).toBe(false);
    expect(result[0].content).toBe('partial answer');
  });

  it('shows fallback message on error event when content is empty', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'error', message: 'timeout' });
    expect(result[1].isStreaming).toBe(false);
    expect(result[1].content).toContain('Erro');
  });

  it('stops streaming on end event', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'end' });
    expect(result[1].isStreaming).toBe(false);
  });

  it('does not mutate or change other messages', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'delta', content: 'x' });
    expect(result[0]).toBe(baseMessages[0]); // user message — same reference
  });

  it('returns messages unchanged for status events', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'status', content: 'queued' });
    expect(result).toBe(baseMessages);
  });

  it('returns messages unchanged for metrics events', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'metrics', content: 'tokens=100' });
    expect(result).toBe(baseMessages);
  });

  it('returns messages unchanged for visual_result events', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'visual_result', content: '<svg/>' });
    expect(result).toBe(baseMessages);
  });

  it('returns messages unchanged when assistantId does not match', () => {
    const result = applySSEEvent(baseMessages, 'unknown', { type: 'delta', content: 'x' });
    expect(result[1].content).toBe('');
  });

  it('handles delta event with missing content gracefully', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'delta' });
    expect(result[1].content).toBe(''); // no change
  });
});

describe('isInputDisabled', () => {
  it('locks the input while a message is in flight', () => {
    expect(isInputDisabled('streaming', 'ready')).toBe(true);
    expect(isInputDisabled('loading', 'ready')).toBe(true);
  });

  it('locks the input on every non-usable auth state, including consent', () => {
    const locked: AuthStatus[] = ['loading', 'error', 'blocked', 'consent'];
    for (const authStatus of locked) {
      expect(isInputDisabled('idle', authStatus)).toBe(true);
    }
  });

  it('keeps the input enabled when the chat is usable or pre-auth', () => {
    expect(isInputDisabled('idle', 'ready')).toBe(false);
    expect(isInputDisabled('idle', 'idle')).toBe(false);
  });
});

describe('extractSources', () => {
  it('normalizes an array of { title, url } objects', () => {
    expect(
      extractSources({
        type: 'sources',
        sources: [{ title: 'UpToDate', url: 'https://uptodate.com/x' }],
      }),
    ).toEqual([{ title: 'UpToDate', url: 'https://uptodate.com/x' }]);
  });

  it('accepts link/href aliases and falls back to the URL as title', () => {
    expect(
      extractSources({
        type: 'sources',
        sources: [{ link: 'https://pubmed.gov/1' }, { href: 'https://who.int/2', title: ' OMS ' }],
      }),
    ).toEqual([
      { title: 'https://pubmed.gov/1', url: 'https://pubmed.gov/1' },
      { title: 'OMS', url: 'https://who.int/2' },
    ]);
  });

  it('accepts plain-string items and a JSON-string payload under content', () => {
    expect(
      extractSources({
        type: 'sources',
        content: JSON.stringify(['https://pubmed.gov/9', 'Diretriz SBC 2025']),
      }),
    ).toEqual([
      { title: 'https://pubmed.gov/9', url: 'https://pubmed.gov/9' },
      { title: 'Diretriz SBC 2025' },
    ]);
  });

  it('keeps URL-less citations as plain text entries', () => {
    expect(extractSources({ type: 'sources', sources: [{ title: 'NEJM 2024;390:123' }] })).toEqual([
      { title: 'NEJM 2024;390:123' },
    ]);
  });

  it('rejects non-http(s) URLs — no javascript: links', () => {
    expect(
      extractSources({
        type: 'sources',
        // eslint-disable-next-line no-script-url
        sources: [{ title: 'x', url: 'javascript:alert(1)' }],
      }),
    ).toEqual([{ title: 'x' }]);
  });

  it('yields [] for malformed payloads', () => {
    expect(extractSources({ type: 'sources' })).toEqual([]);
    expect(extractSources({ type: 'sources', content: '{broken' })).toEqual([]);
    expect(extractSources({ type: 'sources', sources: { not: 'a list' } })).toEqual([]);
    expect(extractSources({ type: 'sources', sources: [42, null, {}] })).toEqual([]);
  });
});

describe('applySSEEvent — sources', () => {
  it('attaches normalized sources to the target assistant message', () => {
    const result = applySSEEvent(baseMessages, 'a1', {
      type: 'sources',
      sources: [{ title: 'Fonte', url: 'https://e.com' }],
    });
    expect(result[1].sources).toEqual([{ title: 'Fonte', url: 'https://e.com' }]);
    expect(result[0].sources).toBeUndefined();
  });

  it('is a no-op when the payload yields no sources', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'sources', sources: [] });
    expect(result).toBe(baseMessages);
  });
});

describe('canStartNewSession', () => {
  it("only allows 'Nova conversa' when the chat is usable", () => {
    expect(canStartNewSession('ready')).toBe(true);
    const notUsable: AuthStatus[] = ['idle', 'loading', 'error', 'blocked', 'consent'];
    for (const authStatus of notUsable) {
      expect(canStartNewSession(authStatus)).toBe(false);
    }
  });
});
