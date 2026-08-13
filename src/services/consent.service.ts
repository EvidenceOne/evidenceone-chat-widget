/**
 * Records the doctor's consent decision — `POST /partner/consent` with the
 * session bearer token (sibling server spec §3.2).
 *
 * No automatic retry, no queue (pattern of the other services): `accept` is
 * retried by the user via the "Continuar" button; `decline` is best-effort.
 */
export class ConsentService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * Registers acceptance. Awaits the server's 201 — the chat is released only
   * after this resolves (spec §2.4).
   *
   * @throws Error on network failure or any non-ok response — the consent
   *         screen shows the error banner and keeps the modal for retry.
   */
  async accept(token: string, comms: boolean): Promise<void> {
    const res = await this.post(token, {
      action: 'accepted',
      termsAccepted: true,
      commsAccepted: comms,
    });
    if (!res.ok) {
      throw new Error(`Falha ao registrar consentimento: ${res.status}`);
    }
  }

  /**
   * Registers refusal, fire-and-forget: a logging failure must never keep the
   * user from closing the widget (spec §2.4).
   */
  decline(token: string): void {
    void this.post(token, {
      action: 'declined',
      termsAccepted: false,
      commsAccepted: false,
    }).catch(() => undefined);
  }

  private post(
    token: string,
    body: { action: 'accepted' | 'declined'; termsAccepted: boolean; commsAccepted: boolean },
  ): Promise<Response> {
    return fetch(`${this.apiUrl}/partner/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }
}
