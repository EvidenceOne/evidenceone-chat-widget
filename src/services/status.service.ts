/** What GET /status tells the widget. */
export interface ServiceStatus {
  maintenance: boolean;
}

/** The server refused the request because the product is in maintenance (503 MAINTENANCE). */
export class MaintenanceError extends Error {
  constructor() {
    super('O EvidenceOne está em manutenção.');
    this.name = 'MaintenanceError';
  }
}

/** A 5xx the API itself did not write (load balancer page, empty body): the service is down. */
export class ApiUnreachableError extends Error {
  constructor(status: number) {
    super(`Serviço indisponível: ${status}`);
    this.name = 'ApiUnreachableError';
  }
}

/** A status check that hangs is useless for noticing an outage. */
const STATUS_TIMEOUT_MS = 8_000;

/** `error` of the 503 the server answers while in maintenance. */
const MAINTENANCE_ERROR = 'MAINTENANCE';

/**
 * Availability of the EvidenceOne service: GET {apiUrl}/status (public — no API
 * key, no token) plus the pure rules that classify failures of the other calls.
 */
export class StatusService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * True for `{ "error": "MAINTENANCE" }`. Decided on the body, never on the
   * status: other 503s (e.g. "Queue service unavailable") are ordinary errors.
   */
  static isMaintenanceBody(body: unknown): boolean {
    return (body as { error?: unknown } | null)?.error === MAINTENANCE_ERROR;
  }

  /**
   * Classifies a non-ok response of any EvidenceOne call: MaintenanceError,
   * ApiUnreachableError, or null when the API answered on its own and the
   * caller should keep its ordinary error handling.
   */
  static failureOf(status: number, body: unknown): MaintenanceError | ApiUnreachableError | null {
    if (StatusService.isMaintenanceBody(body)) return new MaintenanceError();
    // The API always explains itself in JSON (`error`, or `message` on older routes);
    // a 5xx without either came from something in front of it.
    const { error, message } = (body ?? {}) as { error?: unknown; message?: unknown };
    const answeredByApi = typeof error === 'string' || typeof message === 'string';
    if (status >= 500 && !answeredByApi) return new ApiUnreachableError(status);
    return null;
  }

  /** True when a call failed because the service could not be reached at all. */
  static isUnreachable(err: unknown): boolean {
    // fetch network failures surface as TypeError ("Failed to fetch").
    return err instanceof ApiUnreachableError || err instanceof TypeError;
  }

  /** Rejects when the server gives no usable answer — the caller counts it as a failed check. */
  async getStatus(): Promise<ServiceStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.apiUrl}/status`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Status failed: ${res.status}`);

      const parsed = (await res.json()) as { data?: { maintenance?: unknown } };
      if (typeof parsed.data?.maintenance !== 'boolean') {
        throw new Error('Resposta de status inválida do servidor');
      }
      return { maintenance: parsed.data.maintenance };
    } finally {
      clearTimeout(timer);
    }
  }
}
