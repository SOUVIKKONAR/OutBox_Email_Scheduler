import { Worker, Job, DelayedError } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { sendEmail } from '../config/ethereal';
import { updateEmailIndex } from '../config/elasticsearch';
import {
  checkSenderRateLimit,
  checkGlobalRateLimit,
  incrementSenderCount,
  incrementGlobalCount,
} from '../services/rateLimiter';
import { notifyRateLimitHit } from '../services/slackService';
import { rescheduleEmailJob } from './emailQueue';
import { EmailJobData } from '../types';

const connection = createRedisConnection();

/**
 * BullMQ Worker for processing email send jobs.
 * 
 * Features:
 * - Configurable concurrency (env.WORKER_CONCURRENCY)
 * - Per-sender + global rate limiting via Redis counters
 * - Minimum delay between sends (env.DELAY_BETWEEN_EMAILS_MS)
 * - Idempotency check against DB before sending
 * - Automatic rescheduling when rate limited (jobs NOT dropped)
 * - Slack notification when rate limit is hit
 * - Elasticsearch index update on status change
 * 
 * BullMQ handles persistence in Redis — if the server restarts,
 * delayed jobs are still in Redis and will fire at the correct time.
 */

// Enforce delay between individual sends
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, userId, fromEmail, toEmail, subject, body, idempotencyKey } = job.data;

  console.log(`📧 Processing job ${job.id} | Email: ${emailId} | To: ${toEmail}`);

  // ── Idempotency Check ──────────────────────────────────────────
  const email = await prisma.email.findUnique({
    where: { idempotencyKey },
  });

  if (!email) {
    console.warn(`⚠️  Email record not found for key ${idempotencyKey}, skipping`);
    return;
  }

  if (email.status === 'SENT') {
    console.log(`⏭️  Email ${emailId} already sent, skipping (idempotent)`);
    return;
  }

  // ── Rate Limit Check ───────────────────────────────────────────
  const [senderLimit, globalLimit] = await Promise.all([
    checkSenderRateLimit(fromEmail),
    checkGlobalRateLimit(),
  ]);

  if (!senderLimit.allowed) {
    console.log(`🚫 Sender rate limit hit for ${fromEmail}: ${senderLimit.currentCount}/${senderLimit.limit}`);

    // Update status to RATE_LIMITED
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'RATE_LIMITED' },
    });

    // Notify via Slack
    await notifyRateLimitHit(
      userId,
      fromEmail,
      senderLimit.currentCount,
      senderLimit.limit,
      senderLimit.nextWindowMs
    );

    // Update DB with new scheduled time
    const newScheduledAt = new Date(Date.now() + senderLimit.nextWindowMs + 1000);
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: newScheduledAt,
      },
    });

    await updateEmailIndex(emailId, { status: 'SCHEDULED', scheduledAt: newScheduledAt });

    // Delay the current job in BullMQ
    await job.moveToDelayed(Date.now() + senderLimit.nextWindowMs + 1000, job.token);
    throw new DelayedError();
  }

  if (!globalLimit.allowed) {
    console.log(`🚫 Global rate limit hit: ${globalLimit.currentCount}/${globalLimit.limit}`);

    const newScheduledAt = new Date(Date.now() + globalLimit.nextWindowMs + 1000);
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: newScheduledAt,
      },
    });

    await updateEmailIndex(emailId, { status: 'SCHEDULED', scheduledAt: newScheduledAt });

    // Delay the current job in BullMQ
    await job.moveToDelayed(Date.now() + globalLimit.nextWindowMs + 1000, job.token);
    throw new DelayedError();
  }

  // ── Send Email ─────────────────────────────────────────────────
  try {
    // Update status to SENDING
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'SENDING' },
    });

    // Enforce minimum delay between sends
    await delay(env.DELAY_BETWEEN_EMAILS_MS);

    // Increment rate limit counters BEFORE sending (pessimistic)
    await Promise.all([
      incrementSenderCount(fromEmail),
      incrementGlobalCount(),
    ]);

    // Send via Ethereal
    const result = await sendEmail({
      from: fromEmail,
      to: toEmail,
      subject,
      html: body,
    });

    // Update DB to SENT
    const sentAt = new Date();
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt,
        etherealUrl: result.previewUrl || null,
      },
    });

    // Update Elasticsearch
    await updateEmailIndex(emailId, { status: 'SENT', sentAt });

    console.log(`✅ Email sent: ${emailId} | To: ${toEmail} | Preview: ${result.previewUrl}`);

  } catch (error) {
    const failureReason = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Email send failed: ${emailId}`, error);

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason,
      },
    });

    await updateEmailIndex(emailId, { status: 'FAILED' });

    // Let BullMQ handle retries via the throw
    throw error;
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>('email-send', processEmailJob, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    limiter: {
      max: env.MAX_EMAILS_PER_HOUR,
      duration: 3600000, // 1 hour in ms
    },
  });

  worker.on('completed', (job) => {
    console.log(`✅ Job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job failed: ${job?.id}`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`🔧 Email worker started with concurrency: ${env.WORKER_CONCURRENCY}`);
  console.log(`⏱️  Delay between emails: ${env.DELAY_BETWEEN_EMAILS_MS}ms`);
  console.log(`📊 Rate limits: ${env.MAX_EMAILS_PER_HOUR}/hr global, ${env.MAX_EMAILS_PER_HOUR_PER_SENDER}/hr per sender`);

  return worker;
}
