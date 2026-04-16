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

export type SSEEventType = 'progress' | 'token' | 'content' | 'final_response' | 'error' | 'done';

export interface SSEEvent {
  type: SSEEventType;
  data?: string;
  message?: string; // error event: human-readable message
  code?: string;    // error event: machine-readable code
}
