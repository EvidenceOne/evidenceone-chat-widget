import { describe, expect, it } from 'vitest';
import { Message } from '../models/types';
import { applySSEEvent } from './chat-state';

const baseMessages: Message[] = [
  { id: 'u1', role: 'user', content: 'pergunta' },
  { id: 'a1', role: 'assistant', content: '', isStreaming: true },
];

describe('applySSEEvent', () => {
  it('appends token data to the assistant message', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'token', data: 'hello' });
    expect(result[1].content).toBe('hello');
  });

  it('appends multiple tokens incrementally', () => {
    let msgs = baseMessages;
    msgs = applySSEEvent(msgs, 'a1', { type: 'token', data: 'he' });
    msgs = applySSEEvent(msgs, 'a1', { type: 'token', data: 'llo' });
    expect(msgs[1].content).toBe('hello');
  });

  it('replaces content on content event', () => {
    const msgs: Message[] = [
      { id: 'a1', role: 'assistant', content: 'partial', isStreaming: true },
    ];
    const result = applySSEEvent(msgs, 'a1', { type: 'content', data: 'complete' });
    expect(result[0].content).toBe('complete');
  });

  it('replaces content and stops streaming on final_response', () => {
    const msgs: Message[] = [
      { id: 'a1', role: 'assistant', content: 'partial', isStreaming: true },
    ];
    const result = applySSEEvent(msgs, 'a1', { type: 'final_response', data: 'final answer' });
    expect(result[0].content).toBe('final answer');
    expect(result[0].isStreaming).toBe(false);
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

  it('stops streaming on done event', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'done' });
    expect(result[1].isStreaming).toBe(false);
  });

  it('does not mutate or change other messages', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'token', data: 'x' });
    expect(result[0]).toBe(baseMessages[0]); // user message — same reference
  });

  it('returns messages unchanged for progress events', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'progress', data: 'queued' });
    expect(result).toBe(baseMessages);
  });

  it('returns messages unchanged when assistantId does not match', () => {
    const result = applySSEEvent(baseMessages, 'unknown', { type: 'token', data: 'x' });
    expect(result[1].content).toBe('');
  });

  it('handles token event with missing data gracefully', () => {
    const result = applySSEEvent(baseMessages, 'a1', { type: 'token' });
    expect(result[1].content).toBe(''); // no change
  });
});
