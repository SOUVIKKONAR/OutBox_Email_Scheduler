import { redis } from '../config/redis';
import { env } from '../config/env';

/**
 * Redis-backed atomic rate limiter and concurrency spacer.
 */

function getHourWindow(): number {
  return Math.floor(Date.now() / 3600000);
}

function getSenderKey(senderEmail: string, hourWindow: number): string {
  return `ratelimit:sender:${senderEmail}:${hourWindow}`;
}

function getGlobalKey(hourWindow: number): string {
  return `ratelimit:global:${hourWindow}`;
}

// Atomic rate limiting logic ensuring thread safety across multiple workers
const ATOMIC_RATE_LIMIT_SCRIPT = `
  local senderKey = KEYS[1]
  local globalKey = KEYS[2]
  local senderLimit = tonumber(ARGV[1])
  local globalLimit = tonumber(ARGV[2])
  local ttl = tonumber(ARGV[3])
  
  local senderCount = tonumber(redis.call('GET', senderKey) or '0')
  local globalCount = tonumber(redis.call('GET', globalKey) or '0')
  
  if senderCount >= senderLimit then
    return {0, senderCount, senderLimit, 0, globalCount, globalLimit}
  end
  
  if globalCount >= globalLimit then
    return {0, senderCount, senderLimit, 1, globalCount, globalLimit}
  end
  
  local newSenderCount = redis.call('INCR', senderKey)
  if newSenderCount == 1 then
    redis.call('EXPIRE', senderKey, ttl)
  end
  
  local newGlobalCount = redis.call('INCR', globalKey)
  if newGlobalCount == 1 then
    redis.call('EXPIRE', globalKey, ttl)
  end
  
  return {1, newSenderCount, senderLimit, 2, newGlobalCount, globalLimit}
`;

export async function checkAndReserveRateLimit(senderEmail: string): Promise<{
  allowed: boolean;
  senderHit: boolean;
  globalHit: boolean;
  senderCount: number;
  globalCount: number;
  nextWindowMs: number;
}> {
  const hourWindow = getHourWindow();
  const senderKey = getSenderKey(senderEmail, hourWindow);
  const globalKey = getGlobalKey(hourWindow);
  
  const nextWindowMs = ((hourWindow + 1) * 3600000) - Date.now();

  const result = await redis.eval(
    ATOMIC_RATE_LIMIT_SCRIPT,
    2,
    senderKey,
    globalKey,
    env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    env.MAX_EMAILS_PER_HOUR,
    3600
  ) as number[];

  const [allowed, senderCount, , hitType, globalCount] = result;

  return {
    allowed: allowed === 1,
    senderHit: hitType === 0,
    globalHit: hitType === 1,
    senderCount,
    globalCount,
    nextWindowMs,
  };
}

// Atomic spacer ensuring exact delay spacing even under heavy worker concurrency
const ATOMIC_SPACER_SCRIPT = `
  local key = KEYS[1]
  local delay = tonumber(ARGV[1])
  local now = tonumber(ARGV[2])
  
  local last = redis.call('GET', key)
  if not last then last = now end
  
  local nextSend = math.max(tonumber(last), now)
  redis.call('SET', key, nextSend + delay, 'PX', delay * 2)
  
  return nextSend - now
`;

export async function reserveNextSendSlot(senderEmail: string, delayMs: number): Promise<number> {
  const key = `send_spacer:${senderEmail}`;
  const now = Date.now();
  
  const waitMs = await redis.eval(
    ATOMIC_SPACER_SCRIPT,
    1,
    key,
    delayMs,
    now
  ) as number;
  
  return waitMs;
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
