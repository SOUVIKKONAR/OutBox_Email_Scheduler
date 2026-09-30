import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/db';
import { indexEmail } from '../config/elasticsearch';
import { addEmailJob, emailQueue } from '../queues/emailQueue';
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

  // Generate deterministic idempotency key
  const idempotencyKey = `${userId}-${fromEmail}-${toEmail}-${scheduledAt.getTime()}-${batchId || 'single'}`;

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

  // Filter valid emails
  const validRecipients = recipients.map(r => r.trim()).filter(Boolean);
  if (validRecipients.length === 0) {
    return { batchId, emailCount: 0, emailIds: [] };
  }

  // Pre-generate data for all emails
  const emailData = validRecipients.map((toEmail, i) => {
    const id = uuidv4();
    const staggeredTime = new Date(scheduledAt.getTime() + (i * delayBetweenEmailsMs));
    const idempotencyKey = `${userId}-${fromEmail}-${toEmail}-${staggeredTime.getTime()}-${batchId}`;
    
    emailIds.push(id);

    return {
      id,
      userId,
      fromEmail,
      toEmail,
      subject,
      body,
      status: EmailStatus.SCHEDULED,
      scheduledAt: staggeredTime,
      idempotencyKey,
      batchId,
      senderLabel,
      createdAt: new Date(),
    };
  });

  // 1. Prisma Bulk Insert
  await prisma.email.createMany({
    data: emailData,
  });

  // 2. BullMQ Bulk Add
  const bullJobs = emailData.map(e => {
    const delayMs = Math.max(0, e.scheduledAt.getTime() - Date.now());
    const jobData: EmailJobData = {
      emailId: e.id,
      userId: e.userId,
      fromEmail: e.fromEmail,
      toEmail: e.toEmail,
      subject: e.subject,
      body: e.body,
      idempotencyKey: e.idempotencyKey,
      senderLabel: e.senderLabel || undefined,
    };
    return {
      name: 'send-email',
      data: jobData,
      opts: {
        jobId: e.idempotencyKey,
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    };
  });
  
  // addBulk is much faster for 1000+ jobs
  const addedJobs = await emailQueue.addBulk(bullJobs);

  // Note: we'd ideally bulk update Prisma with jobIds, but jobId is just idempotencyKey here or we can omit it since we rely on idempotency. Wait, in scheduleEmail we do:
  // await prisma.email.update({ where: { id }, data: { jobId } });
  // For bulk, let's just use a transaction or execute raw, but it's optional if we use idempotency.
  
  // 3. Elasticsearch Bulk Index
  try {
    const operations = emailData.flatMap(doc => [
      { index: { _index: 'emails', _id: doc.id } },
      doc
    ]);
    const { esClient } = await import('../config/elasticsearch');
    await esClient.bulk({ refresh: true, operations });
  } catch (error) {
    console.error('Failed to bulk index emails to ES:', error);
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
      // Note: We deliberately do NOT filter by scheduledAt >= Date.now() here.
      // We want to fetch all pending emails, including those that became overdue
      // while the server was down, so we can process them immediately.
    },
  });

  let requeued = 0;

  for (const email of pendingEmails) {
    const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());

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
