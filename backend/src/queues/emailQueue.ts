import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { EmailJobData } from '../types';

const connection = createRedisConnection();

export const emailQueue = new Queue<EmailJobData>('email-send', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs for visibility
      age: 86400,  // Remove completed jobs after 24h
    },
    removeOnFail: {
      count: 500,
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('Email queue error:', err);
});

/**
 * Add an email job to the queue with a specific delay.
 * 
 * Uses BullMQ delayed jobs — NOT cron.
 * The job ID is the idempotency key to prevent duplicates.
 */
export async function addEmailJob(
  data: EmailJobData,
  delayMs: number
): Promise<string> {
  const job = await emailQueue.add('send-email', data, {
    delay: Math.max(0, delayMs),
    jobId: data.idempotencyKey, // Idempotency: same key = same job, won't duplicate
  });

  return job.id!;
}

/**
 * Reschedule a job by removing it and re-adding with a new delay.
 * Used when rate limits are hit — job is pushed to the next hour window.
 */
export async function rescheduleEmailJob(
  data: EmailJobData,
  delayMs: number
): Promise<string> {
  // Remove existing job if present
  const existingJob = await emailQueue.getJob(data.idempotencyKey);
  if (existingJob) {
    await existingJob.remove();
  }

  // Re-add with new delay and a modified key to allow re-add
  const rescheduledKey = `${data.idempotencyKey}-rescheduled-${Date.now()}`;
  const job = await emailQueue.add('send-email', {
    ...data,
    idempotencyKey: data.idempotencyKey, // Keep original key for DB lookup
  }, {
    delay: Math.max(0, delayMs),
    jobId: rescheduledKey,
  });

  return job.id!;
}

/**
 * Get queue stats for the dashboard.
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
