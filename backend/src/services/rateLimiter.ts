import { redis } from '../config/redis';
import { env } from '../config/env';

/**
 * Redis-backed rate limiter for email sending.
 * 
 * Uses Redis INCR + TTL for atomic, multi-instance-safe rate limiting.
 * Keys are scoped by sender + hour window to enforce per-sender hourly limits.
 * 
 * Strategy:
 * - Each sender gets a Redis key like `ratelimit:{senderEmail}:{hourWindow}`
 * - hourWindow is calculated as Math.floor(Date.now() / 3600000)
 * - The key auto-expires after 1 hour via TTL
 * - INCR is atomic, so multiple workers can safely increment
 * 
 * When limit is hit:
 * - Jobs are NOT dropped or failed permanently
 * - Instead, they are rescheduled to the next available hour window
 * - A Slack notification is sent (if connected)
 */

function getHourWindow(): number {
  return Math.floor(Date.now() / 3600000);
}

function getSenderKey(senderEmail: string, hourWindow?: number): string {
  const window = hourWindow ?? getHourWindow();
  return `ratelimit:sender:${senderEmail}:${window}`;
}

function getGlobalKey(hourWindow?: number): string {
  const window = hourWindow ?? getHourWindow();
  return `ratelimit:global:${window}`;
}

export async function checkSenderRateLimit(senderEmail: string): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  nextWindowMs: number;
}> {
  const hourWindow = getHourWindow();
  const key = getSenderKey(senderEmail, hourWindow);
  
  const currentCount = parseInt(await redis.get(key) || '0', 10);
  const limit = env.MAX_EMAILS_PER_HOUR_PER_SENDER;

  // Calculate when the next hour window starts
  const nextWindowMs = ((hourWindow + 1) * 3600000) - Date.now();

  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
    nextWindowMs,
  };
}

export async function checkGlobalRateLimit(): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  nextWindowMs: number;
}> {
  const hourWindow = getHourWindow();
  const key = getGlobalKey(hourWindow);

  const currentCount = parseInt(await redis.get(key) || '0', 10);
  const limit = env.MAX_EMAILS_PER_HOUR;

  const nextWindowMs = ((hourWindow + 1) * 3600000) - Date.now();

  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
    nextWindowMs,
  };
}

export async function incrementSenderCount(senderEmail: string): Promise<number> {
  const hourWindow = getHourWindow();
  const key = getSenderKey(senderEmail, hourWindow);

  const count = await redis.incr(key);
  
  // Set TTL if this is the first increment (count === 1)
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour TTL
  }

  return count;
}

export async function incrementGlobalCount(): Promise<number> {
  const hourWindow = getHourWindow();
  const key = getGlobalKey(hourWindow);

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 3600);
  }

  return count;
}

export async function getRateLimitInfo(senderEmail: string): Promise<{
  senderCount: number;
  senderLimit: number;
  globalCount: number;
  globalLimit: number;
}> {
  const hourWindow = getHourWindow();
  
  const [senderCount, globalCount] = await Promise.all([
    redis.get(getSenderKey(senderEmail, hourWindow)),
    redis.get(getGlobalKey(hourWindow)),
  ]);

  return {
    senderCount: parseInt(senderCount || '0', 10),
    senderLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    globalCount: parseInt(globalCount || '0', 10),
    globalLimit: env.MAX_EMAILS_PER_HOUR,
  };
}
