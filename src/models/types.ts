/** A cited source under an assistant answer. `url` optional — plain citations render as text. */
export interface MessageSource {
  title: string;
  url?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  /** True when the assistant response failed to complete — shown as an inline error in the bubble. */
  error?: boolean;
  /** Present only when the stream carried sources — the "Fontes" section renders solely off this. */
  sources?: MessageSource[];
}

export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error';

export type AuthStatus = 'idle' | 'loading' | 'ready' | 'error' | 'blocked' | 'consent';

/**
 * Consent state carried by the `/partner/session` response (sibling server
 * spec §3.1). `required: true` gates the chat behind the opt-in screen;
 * `reconsent: true` selects the re-collection copy (widget-14).
 * `termsVersion`/`comms` are the server's record of the last acceptance —
 * informational for the widget.
 */
export interface ConsentState {
  required: boolean;
  /**
   * True when the user already accepted an OLDER Terms version (re-collection).
   * Absent on servers that predate widget-14 ⇒ first-acceptance copy.
   */
  reconsent?: boolean;
  termsVersion?: string;
  comms?: boolean;
}

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
  /** Optional — servers without consent support omit it (treated as not required). */
  consent?: ConsentState;
}

// Native event names from the Agent contract (API_CONTRACT.md).
// `delta` = incremental text chunk, `end` = stream terminator,
// `sources` = citations for the current answer (shape tolerated, spec §3.3),
// `status` / `metrics` / `visual_result` are observational events the widget ignores.
export type SSEEventType =
  | 'status'
  | 'delta'
  | 'visual_result'
  | 'metrics'
  | 'error'
  | 'end'
  | 'sources';

export interface SSEEvent {
  type: SSEEventType;
  /** Incremental text chunk for delta events (matches the server's JSON field). */
  content?: string;
  /** Error event: human-readable message */
  message?: string;
  /** Error event: machine-readable code */
  code?: string;
  /** Sources event: payload shape unconfirmed — normalized by extractSources(). */
  sources?: unknown;
}

/** Payload of the public `eoFeedback` event — the seam for future backend wiring (spec §3.3). */
export interface EoFeedbackDetail {
  sessionId: string;
  /** Index of the voted assistant message within the current conversation. */
  messageIndex: number;
  vote: 'up' | 'down';
}
