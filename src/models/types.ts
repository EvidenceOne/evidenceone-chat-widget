export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  /** True when the assistant response failed to complete — shown as an inline error in the bubble. */
  error?: boolean;
}

export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error';

export type AuthStatus = 'idle' | 'loading' | 'ready' | 'error';

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

export interface SessionResponse {
  session_token: string;
  session_id: string;
  expires_in: number;
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
