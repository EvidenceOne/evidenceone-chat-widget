import { describe, expect, it } from 'vitest';
import { AuthStatus, Message } from '../models/types';
import { applySSEEvent, canStartNewSession, isInputDisabled } from './chat-state';

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

describe('canStartNewSession', () => {
  it("only allows 'Nova conversa' when the chat is usable", () => {
    expect(canStartNewSession('ready')).toBe(true);
    const notUsable: AuthStatus[] = ['idle', 'loading', 'error', 'blocked', 'consent'];
    for (const authStatus of notUsable) {
      expect(canStartNewSession(authStatus)).toBe(false);
    }
  });
});
