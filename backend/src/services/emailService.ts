import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/db';
import { indexEmail } from '../config/elasticsearch';
import { addEmailJob } from '../queues/emailQueue';
import { EmailJobData, BulkScheduleEmailRequest } from '../types';
import { EmailStatus } from '@prisma/client';

/**
 * Schedule a single email to be sent at a specific time.
 */
export async function scheduleEmail(params: {
  userId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  senderLabel?: string;
  batchId?: string;
}): Promise<{ emailId: string; jobId: string }> {
  const { userId, fromEmail, toEmail, subject, body, scheduledAt, senderLabel, batchId } = params;

  // Generate idempotency key
  const idempotencyKey = `${userId}-${fromEmail}-${toEmail}-${scheduledAt.getTime()}-${uuidv4().slice(0, 8)}`;

  // Create email record in DB
  const email = await prisma.email.create({
    data: {
      userId,
      fromEmail,
      toEmail,
      subject,
      body,
      status: EmailStatus.SCHEDULED,
      scheduledAt,
      idempotencyKey,
      batchId,
      senderLabel,
    },
  });

  // Calculate delay from now
  const delayMs = scheduledAt.getTime() - Date.now();

  // Create job data
  const jobData: EmailJobData = {
    emailId: email.id,
    userId,
    fromEmail,
    toEmail,
    subject,
    body,
    idempotencyKey,
    senderLabel,
  };

  // Add to BullMQ queue with delay
  const jobId = await addEmailJob(jobData, delayMs);

  // Update email with job ID
  await prisma.email.update({
    where: { id: email.id },
    data: { jobId },
  });

  // Index in Elasticsearch
  await indexEmail({
    id: email.id,
    userId,
    fromEmail,
    toEmail,
    subject,
    body,
    status: EmailStatus.SCHEDULED,
    scheduledAt,
    batchId,
    senderLabel,
    createdAt: email.createdAt,
  });

  return { emailId: email.id, jobId };
}

/**
 * Schedule a bulk batch of emails with configurable delay between each.
 */
export async function scheduleBulkEmails(params: {
  userId: string;
  fromEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: Date;
  delayBetweenEmailsMs: number;
  senderLabel?: string;
}): Promise<{ batchId: string; emailCount: number; emailIds: string[] }> {
  const {
    userId,
    fromEmail,
    recipients,
    subject,
    body,
    scheduledAt,
    delayBetweenEmailsMs,
    senderLabel,
  } = params;

  const batchId = uuidv4();
  const emailIds: string[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const toEmail = recipients[i].trim();
    if (!toEmail) continue;

    // Stagger the scheduled time based on position in the batch
    const staggeredTime = new Date(scheduledAt.getTime() + (i * delayBetweenEmailsMs));

    const result = await scheduleEmail({
      userId,
      fromEmail,
      toEmail,
      subject,
      body,
      scheduledAt: staggeredTime,
      senderLabel,
      batchId,
    });

    emailIds.push(result.emailId);
  }

  return { batchId, emailCount: emailIds.length, emailIds };
}

/**
 * Get paginated emails for a user with optional status filter.
 */
export async function getUserEmails(params: {
  userId: string;
  status?: EmailStatus;
  page: number;
  limit: number;
}): Promise<{ emails: Array<Record<string, unknown>>; total: number; page: number; totalPages: number }> {
  const { userId, status, page, limit } = params;

  const where: Record<string, unknown> = { userId };
  if (status) {
    where.status = status;
  }

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  return {
    emails,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Re-queue all SCHEDULED emails from DB on server restart.
 * This ensures persistence — delayed jobs in Redis survive restart,
 * but if Redis was also restarted, we re-create them from DB.
 */
export async function requeuePendingEmails(): Promise<number> {
  const pendingEmails = await prisma.email.findMany({
    where: {
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.RATE_LIMITED] },
      scheduledAt: { gte: new Date() }, // Only future emails
    },
  });

  let requeued = 0;

  for (const email of pendingEmails) {
    const delayMs = email.scheduledAt.getTime() - Date.now();

    if (delayMs <= 0) continue; // Skip if already past due (will be picked up immediately)

    const jobData: EmailJobData = {
      emailId: email.id,
      userId: email.userId,
      fromEmail: email.fromEmail,
      toEmail: email.toEmail,
      subject: email.subject,
      body: email.body,
      idempotencyKey: email.idempotencyKey,
      senderLabel: email.senderLabel || undefined,
    };

    try {
      await addEmailJob(jobData, delayMs);
      requeued++;
    } catch (error) {
      // Job might already exist in Redis (idempotency key match) — that's fine
      console.log(`Job already exists for email ${email.id}, skipping re-queue`);
    }
  }

  console.log(`♻️  Re-queued ${requeued}/${pendingEmails.length} pending emails from DB`);
  return requeued;
}
