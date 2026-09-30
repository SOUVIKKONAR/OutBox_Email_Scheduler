import { Worker, Job, DelayedError } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { sendEmail } from '../config/ethereal';
import { updateEmailIndex } from '../config/elasticsearch';
import {
  checkAndReserveRateLimit,
  reserveNextSendSlot,
} from '../services/rateLimiter';
import { notifyRateLimitHit } from '../services/slackService';
import { EmailJobData } from '../types';

const connection = createRedisConnection();

/**
 * BullMQ Worker for processing email send jobs.
 */

// Enforce delay between individual sends
function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
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

  // ── Rate Limit Check (Atomic) ──────────────────────────────────
  const limitCheck = await checkAndReserveRateLimit(fromEmail);

  if (!limitCheck.allowed) {
    const isSenderHit = limitCheck.senderHit;
    
    console.log(`🚫 Rate limit hit: Sender (${limitCheck.senderCount}), Global (${limitCheck.globalCount})`);

    // Update status to RATE_LIMITED
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'RATE_LIMITED' },
    });

    if (isSenderHit) {
      // Notify via Slack, but don't crash if Slack fails
      try {
        await notifyRateLimitHit(
          userId,
          fromEmail,
          limitCheck.senderCount,
          env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          limitCheck.nextWindowMs
        );
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError);
      }
    }

    // Update DB with new scheduled time
    const newScheduledAt = new Date(Date.now() + limitCheck.nextWindowMs + 1000);
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: newScheduledAt,
      },
    });

    try {
      await updateEmailIndex(emailId, { status: 'SCHEDULED', scheduledAt: newScheduledAt });
    } catch (esError) {
      console.error('Failed to update Elasticsearch index:', esError);
    }

    // Delay the current job in BullMQ
    await job.moveToDelayed(Date.now() + limitCheck.nextWindowMs + 1000, job.token);
    throw new DelayedError();
  }

  // ── Send Email ─────────────────────────────────────────────────
  try {
    // Update status to SENDING
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'SENDING' },
    });

    // Enforce atomic minimum delay between sends under concurrency
    const waitMs = await reserveNextSendSlot(fromEmail, env.DELAY_BETWEEN_EMAILS_MS);
    if (waitMs > 0) {
      await delay(waitMs);
    }

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

    try {
      await updateEmailIndex(emailId, { status: 'SENT', sentAt });
    } catch (esError) {
      console.error('Failed to update Elasticsearch index on sent:', esError);
    }

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

    try {
      await updateEmailIndex(emailId, { status: 'FAILED' });
    } catch (esError) {
      console.error('Failed to update Elasticsearch index on fail:', esError);
    }

    // Let BullMQ handle retries via the throw
    throw error;
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>('email-send', processEmailJob, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    // Note: BullMQ rate limiter removed because we manage custom per-sender and global limit atomically in Redis
  });

  worker.on('completed', (job) => {
    console.log(`✅ Job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    // Ignore DelayedError logs since it's just rescheduling
    if (err.name !== 'DelayedError') {
      console.error(`❌ Job failed: ${job?.id}`, err.message);
    }
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`🔧 Email worker started with concurrency: ${env.WORKER_CONCURRENCY}`);
  console.log(`⏱️  Delay between emails: ${env.DELAY_BETWEEN_EMAILS_MS}ms`);
  console.log(`📊 Rate limits: ${env.MAX_EMAILS_PER_HOUR}/hr global, ${env.MAX_EMAILS_PER_HOUR_PER_SENDER}/hr per sender`);

  return worker;
}
