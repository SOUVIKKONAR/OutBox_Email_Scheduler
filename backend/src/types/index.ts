import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface ScheduleEmailRequest {
  fromEmail: string;
  toEmail: string | string[];
  subject: string;
  body: string;
  scheduledAt: string; // ISO date string
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  senderLabel?: string;
}

export interface BulkScheduleEmailRequest {
  fromEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  senderLabel?: string;
  recipients: string[]; // Array of email addresses
}

export interface EmailJobData {
  emailId: string;
  userId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  senderLabel?: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
}
