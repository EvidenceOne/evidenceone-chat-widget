export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export type ChatState = 'idle' | 'loading' | 'streaming' | 'error';
// ChatStatus is the canonical name per spec; ChatState kept for internal use
export type ChatStatus = ChatState;

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
