import { describe, expect, it } from 'vitest';
import { SSEService } from './sse.service';

describe('SSEService.parseLine', () => {
  it('parses a token event', () => {
    const line = 'data: {"type":"token","data":"hello"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'token', data: 'hello' });
  });

  it('parses a content event', () => {
    const line = 'data: {"type":"content","data":"full text"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'content', data: 'full text' });
  });

  it('parses a final_response event', () => {
    const line = 'data: {"type":"final_response","data":"complete answer"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'final_response', data: 'complete answer' });
  });

  it('parses a progress event', () => {
    const line = 'data: {"type":"progress","data":"processing"}';
    expect(SSEService.parseLine(line)).toEqual({ type: 'progress', data: 'processing' });
  });

  it('parses an error event with message and code', () => {
    const line = 'data: {"type":"error","message":"Serviço indisponível","code":"SERVICE_UNAVAILABLE"}';
    expect(SSEService.parseLine(line)).toEqual({
      type: 'error',
      message: 'Serviço indisponível',
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('parses the [DONE] sentinel as a done event', () => {
    expect(SSEService.parseLine('data: [DONE]')).toEqual({ type: 'done' });
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
    const line = 'data:  {"type":"token","data":"x"} ';
    // trim() in parseLine handles trailing space; leading double-space is part of raw
    // spec behavior: slice(6) + trim() — should parse correctly
    expect(SSEService.parseLine(line)).toEqual({ type: 'token', data: 'x' });
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
    const stream = makeStream(['data: {"type":"token","data":"hi"}\n\ndata: [DONE]\n\n']);
    const events = [];
    for await (const event of SSEService.streamEvents(stream)) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'token', data: 'hi' }, { type: 'done' }]);
  });

  it('handles events split across multiple chunks', async () => {
    // Split the message mid-line to test buffering
    const stream = makeStream([
      'data: {"type":"token"',
      ',"data":"split"}\n\n',
    ]);
    const events = [];
    for await (const event of SSEService.streamEvents(stream)) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'token', data: 'split' }]);
  });

  it('skips non-data lines and empty lines', async () => {
    const stream = makeStream([
      'event: message\n',
      'data: {"type":"token","data":"x"}\n',
      '\n',
      'data: [DONE]\n\n',
    ]);
    const events = [];
    for await (const event of SSEService.streamEvents(stream)) {
      events.push(event);
    }
    expect(events).toEqual([{ type: 'token', data: 'x' }, { type: 'done' }]);
  });

  it('stops yielding events when the abort signal fires', async () => {
    // Infinite-ish stream — never closes naturally
    const encoder = new TextEncoder();
    let pushed = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pushed < 100) {
          controller.enqueue(encoder.encode(`data: {"type":"token","data":"t${pushed}"}\n\n`));
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
    // Exact count depends on buffering, but must be << 100.
    expect(events.length).toBeLessThan(20);
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('returns cleanly when signal is already aborted before first read', async () => {
    const stream = makeStream(['data: {"type":"token","data":"ignored"}\n\n']);
    const controller = new AbortController();
    controller.abort();

    const events = [];
    for await (const event of SSEService.streamEvents(stream, controller.signal)) {
      events.push(event);
    }
    expect(events).toEqual([]);
  });
});
