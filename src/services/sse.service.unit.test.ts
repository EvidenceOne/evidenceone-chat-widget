import { describe, expect, it } from 'vitest';
import { SSEService } from './sse.service';

describe('SSEService.parseLine', () => {
  it('parses a delta event', () => {
    const line = 'data: {"type":"delta","content":"hello"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'delta', content: 'hello' });
  });

  it('parses a status event', () => {
    const line = 'data: {"type":"status","content":"processing"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'status', content: 'processing' });
  });

  it('parses a metrics event', () => {
    const line = 'data: {"type":"metrics","content":"tokens=42"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'metrics', content: 'tokens=42' });
  });

  it('parses a visual_result event', () => {
    const line = 'data: {"type":"visual_result","content":"<svg/>"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'visual_result', content: '<svg/>' });
  });

  it('parses an error event with message and code', () => {
    const line = 'data: {"type":"error","message":"Serviço indisponível","code":"SERVICE_UNAVAILABLE"}';
    expect(SSEService.parseLine(line)).toEqual({
      type: 'error',
      message: 'Serviço indisponível',
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('parses the [DONE] sentinel as an end event', () => {
    expect(SSEService.parseLine('data: [DONE]')).toEqual({ type: 'end' });
  });

  it('returns null for non-data lines', () => {
    expect(SSEService.parseLine('event: message')).toBeNull();
    expect(SSEService.parseLine(': comment')).toBeNull();
    expect(SSEService.parseLine('id: 42')).toBeNull();
  });

  it('returns null for an empty line', () => {
    expect(SSEService.parseLine('')).toBeNull();
  });

  it('returns null for malformed JSON after data: prefix', () => {
    expect(SSEService.parseLine('data: {broken')).toBeNull();
  });

  it('handles whitespace around the data value', () => {
    const line = 'data:  {"type":"delta","content":"x"} ';
    expect(SSEService.parseLine(line)).toEqual({ type: 'delta', content: 'x' });
  });
});

describe('SSEService.streamEvents', () => {
  function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  }

  it('yields events from a single-chunk stream', async () => {
    const stream = makeStream(['data: {"type":"delta","content":"hi"}\n\ndata: [DONE]\n\n']);
    const events = [];
    for await (const event of SSEService.streamEvents(stream)) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'delta', content: 'hi' }, { type: 'end' }]);
  });

  it('handles events split across multiple chunks', async () => {
    const stream = makeStream([
      'data: {"type":"delta"',
      ',"content":"split"}\n\n',
    ]);
    const events = [];
    for await (const event of SSEService.streamEvents(stream)) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'delta', content: 'split' }]);
  });

  it('skips non-data lines and empty lines', async () => {
    const stream = makeStream([
      'event: message\n',
      'data: {"type":"delta","content":"x"}\n',
      '\n',
      'data: [DONE]\n\n',
    ]);
    const events = [];
    for await (const event of SSEService.streamEvents(stream)) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'delta', content: 'x' }, { type: 'end' }]);
  });

  it('stops yielding events when the abort signal fires', async () => {
    // Infinite-ish stream — never closes naturally
    const encoder = new TextEncoder();
    let pushed = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pushed < 100) {
          controller.enqueue(encoder.encode(`data: {"type":"delta","content":"t${pushed}"}\n\n`));
          pushed++;
        } else {
          controller.close();
        }
      },
    });

    const controller = new AbortController();
    const events = [];
    let iterations = 0;
    for await (const event of SSEService.streamEvents(stream, controller.signal)) {
      events.push(event);
      iterations++;
      if (iterations === 2) controller.abort();
    }
    // Should terminate shortly after abort — we got a couple events then stopped.
    expect(events.length).toBeLessThan(20);
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('returns cleanly when signal is already aborted before first read', async () => {
    const stream = makeStream(['data: {"type":"delta","content":"ignored"}\n\n']);
    const controller = new AbortController();
    controller.abort();

    const events = [];
    for await (const event of SSEService.streamEvents(stream, controller.signal)) {
      events.push(event);
    }
    expect(events).toEqual([]);
  });
});
