export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  /** True when the assistant response failed to complete — shown as an inline error in the bubble. */
  error?: boolean;
}

export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error';

export type AuthStatus = 'idle' | 'loading' | 'ready' | 'error' | 'blocked';

export interface EoErrorDetail {
  code: string;
  message: string;
}

export interface DoctorData {
  email: string;
  name: string;
  crm: string;
  phone: string;
  specialty?: string;
}

/**
 * How the widget identifies the doctor to the partner-session endpoint. Either
 * the client supplies the full doctor object (`client_provided` partners) or an
 * opaque partner token the server exchanges at the partner gateway
 * (`partner_gateway` partners). `lookup` is an optional generic value (id,
 * email, name — the partner decides) that keys a `{lookup}`-templated gateway
 * URL on the server.
 */
export type IdentityPayload =
  | { doctor: DoctorData }
  | { partnerToken: string; lookup?: string };

/** Inner `data` of a resolved partner session (NestJS `ApiResponse` envelope). */
export interface PartnerSessionData {
  sessionToken: string;
  sessionId: string;
  expiresIn: number;
}

// Native event names from the Agent contract (API_CONTRACT.md).
// `delta` = incremental text chunk, `end` = stream terminator,
// `status` / `metrics` / `visual_result` are observational events the widget ignores.
export type SSEEventType = 'status' | 'delta' | 'visual_result' | 'metrics' | 'error' | 'end';

export interface SSEEvent {
  type: SSEEventType;
  /** Incremental text chunk for delta events (matches the server's JSON field). */
  content?: string;
  /** Error event: human-readable message */
  message?: string;
  /** Error event: machine-readable code */
  code?: string;
}
