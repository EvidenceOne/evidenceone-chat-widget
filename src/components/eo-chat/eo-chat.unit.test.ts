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

describe('eo-chat — connection-failure messaging', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('a network failure mid-send shows the connection message in the errored bubble', async () => {
    const chatService: ChatServiceMock = {
      sendMessage: vi.fn(throwingStream(new TypeError('Failed to fetch'))),
    };
    const cmp = makeComponent(chatService);

    await send(cmp, 'oi');

    const assistant = cmp.messages[1];
    expect(assistant.error).toBe(true);
    expect(assistant.content).toBe(
      'Não foi possível conectar. Verifique sua conexão e tente novamente.',
    );
    expect(chatService.sendMessage).toHaveBeenCalledOnce(); // no auto-retry for network errors
    expect(cmp.status).toBe('idle');
  });

  it('non-network stream failures get the generic processing message', async () => {
    const chatService: ChatServiceMock = {
      sendMessage: vi.fn(throwingStream(new Error('boom'))),
    };
    const cmp = makeComponent(chatService);

    await send(cmp, 'oi');

    expect(cmp.messages[1].error).toBe(true);
    expect(cmp.messages[1].content).toBe('Erro ao processar resposta.');
  });

  it('auth unreachable at send time surfaces a failed exchange — never silent', async () => {
    const chatService: ChatServiceMock = { sendMessage: vi.fn() };
    const cmp = makeComponent(chatService);
    (cmp as unknown as { authService: { ensureValidToken: () => Promise<string> } }).authService = {
      ensureValidToken: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
      clearToken: vi.fn(),
    } as never;

    await send(cmp, 'qual a dose?');

    expect(chatService.sendMessage).not.toHaveBeenCalled();
    expect(cmp.messages).toHaveLength(2);
    expect(cmp.messages[0]).toMatchObject({ role: 'user', content: 'qual a dose?' });
    expect(cmp.messages[1]).toMatchObject({
      role: 'assistant',
      error: true,
      content: 'Não foi possível conectar. Verifique sua conexão e tente novamente.',
    });
    expect(cmp.status).toBe('idle'); // input usable again — the bubble's "!" re-sends
  });
});

describe('eo-chat — blocked-screen retry state', () => {
  it('stamps the pendency banner when a retry settles back into blocked', () => {
    const cmp = makeComponent({ sendMessage: vi.fn() });
    cmp.retryPending = true;

    cmp.onAuthStatusChange('blocked');

    expect(cmp.retryPending).toBe(false);
    expect(cmp.lastRetryAt).toMatch(/^\d{2}:\d{2}$/);
  });

  it('clears the retry context when auth leaves the blocked/loading pair', () => {
    const cmp = makeComponent({ sendMessage: vi.fn() });
    cmp.retryPending = true;
    cmp.lastRetryAt = '16:13';

    cmp.onAuthStatusChange('ready');

    expect(cmp.retryPending).toBe(false);
    expect(cmp.lastRetryAt).toBeNull();
  });
});

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
