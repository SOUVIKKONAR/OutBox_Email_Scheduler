export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Email {
  id: string;
  userId: string;
  jobId: string | null;
  idempotencyKey: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  etherealUrl: string | null;
  batchId: string | null;
  senderLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EmailStatus = 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';

export interface PaginatedResponse<T> {
  emails: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface SlackStatus {
  connected: boolean;
  hasWebhook: boolean;
  hasToken: boolean;
}

export interface ScheduleEmailPayload {
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  senderLabel?: string;
}

export interface BulkSchedulePayload {
  fromEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsMs: number;
  hourlyLimit?: number;
  senderLabel?: string;
}

export interface SearchResult {
  results: Email[];
  total: number;
  page: number;
  totalPages: number;
}
