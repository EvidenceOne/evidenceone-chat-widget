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

import { ConsentRequiredError, TokenRejectedError } from '../../services/chat.service';
import { SSEEvent } from '../../models/types';
import { EoChat } from './eo-chat';

type ChatServiceMock = { sendMessage: ReturnType<typeof vi.fn> };

/** Async generator that throws `err` before yielding anything. */
function throwingStream(err: Error) {
  // eslint-disable-next-line require-yield
  return async function* (): AsyncGenerator<SSEEvent> {
    throw err;
  };
}

function makeComponent(chatService: ChatServiceMock) {
  const cmp = new EoChat();
  cmp.authStatus = 'ready';
  (cmp as unknown as { authService: unknown }).authService = {
    ensureValidToken: vi.fn(async () => 'tok_fresh'),
    clearToken: vi.fn(),
  };
  (cmp as unknown as { chatService: unknown }).chatService = chatService;
  cmp.eoChatClose = { emit: vi.fn() } as unknown as typeof cmp.eoChatClose;
  cmp.eoChatNewSession = { emit: vi.fn() } as unknown as typeof cmp.eoChatNewSession;
  cmp.eoChatRetry = { emit: vi.fn() } as unknown as typeof cmp.eoChatRetry;
  cmp.eoChatConsentRequired = { emit: vi.fn() } as unknown as typeof cmp.eoChatConsentRequired;
  return cmp;
}

async function send(cmp: EoChat, text: string): Promise<void> {
  await (cmp as unknown as { handleSend: (text: string) => Promise<void> }).handleSend(text);
}

function authServiceOf(cmp: EoChat) {
  return (cmp as unknown as { authService: { clearToken: ReturnType<typeof vi.fn> } }).authService;
}

describe('eo-chat — 403 CONSENT_REQUIRED on chat (spec §2.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('hands off to the consent screen without clearing the token and without retrying', async () => {
    const chatService: ChatServiceMock = {
      sendMessage: vi.fn(throwingStream(new ConsentRequiredError())),
    };
    const cmp = makeComponent(chatService);

    await send(cmp, 'qual a dose?');

    expect(cmp.eoChatConsentRequired.emit).toHaveBeenCalledOnce();
    expect(authServiceOf(cmp).clearToken).not.toHaveBeenCalled();
    expect(chatService.sendMessage).toHaveBeenCalledOnce(); // no silent retry
    expect(cmp.status).toBe('idle');
  });

  it('drops the pending assistant bubble but keeps the user message', async () => {
    const chatService: ChatServiceMock = {
      sendMessage: vi.fn(throwingStream(new ConsentRequiredError())),
    };
    const cmp = makeComponent(chatService);

    await send(cmp, 'qual a dose?');

    expect(cmp.messages).toHaveLength(1);
    expect(cmp.messages[0].role).toBe('user');
    expect(cmp.messages[0].content).toBe('qual a dose?');
  });

  it('plain TokenRejectedError keeps the existing silent re-auth + one retry', async () => {
    const chatService: ChatServiceMock = {
      sendMessage: vi.fn(throwingStream(new TokenRejectedError())),
    };
    const cmp = makeComponent(chatService);

    await send(cmp, 'oi');

    expect(authServiceOf(cmp).clearToken).toHaveBeenCalledOnce();
    expect(chatService.sendMessage).toHaveBeenCalledTimes(2); // original + 1 retry
    expect(cmp.eoChatConsentRequired.emit).not.toHaveBeenCalled();
  });
});
