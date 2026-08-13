import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stencil decorators are compile-time constructs — stub them so the component
// class instantiates as a plain TS class (no rendering in these tests).
vi.mock('@stencil/core', () => {
  const noopDecorator = () => () => undefined;
  return {
    Component: noopDecorator,
    Prop: noopDecorator,
    State: noopDecorator,
    Event: noopDecorator,
    Element: noopDecorator,
    Watch: noopDecorator,
    Method: noopDecorator,
    Listen: noopDecorator,
    Host: () => null,
    h: () => null,
    Fragment: () => null,
  };
});

import { EoMessageBubble } from './eo-message-bubble';

function makeBubble(messageIndex: number) {
  const bubble = new EoMessageBubble();
  bubble.messageRole = 'assistant';
  bubble.messageIndex = messageIndex;
  bubble.content = 'resposta';
  bubble.eoMessageFeedback = { emit: vi.fn() } as unknown as typeof bubble.eoMessageFeedback;
  return bubble;
}

function vote(bubble: EoMessageBubble, value: 'up' | 'down'): void {
  (bubble as unknown as { handleVote: (v: 'up' | 'down') => void }).handleVote(value);
}

describe('eo-message-bubble — feedback votes (spec §3.3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits the internal feedback event with the message index on first vote', () => {
    const bubble = makeBubble(3);

    vote(bubble, 'up');

    expect(bubble.eoMessageFeedback.emit).toHaveBeenCalledExactlyOnceWith({
      messageIndex: 3,
      vote: 'up',
    });
    expect(bubble.vote).toBe('up');
  });

  it('re-clicking the active vote is a no-op — no duplicate event', () => {
    const bubble = makeBubble(1);

    vote(bubble, 'up');
    vote(bubble, 'up');

    expect(bubble.eoMessageFeedback.emit).toHaveBeenCalledOnce();
  });

  it('switching the vote is exclusive and emits the new value', () => {
    const bubble = makeBubble(1);

    vote(bubble, 'up');
    vote(bubble, 'down');

    expect(bubble.vote).toBe('down');
    expect(bubble.eoMessageFeedback.emit).toHaveBeenCalledTimes(2);
    expect(bubble.eoMessageFeedback.emit).toHaveBeenLastCalledWith({
      messageIndex: 1,
      vote: 'down',
    });
  });
});
