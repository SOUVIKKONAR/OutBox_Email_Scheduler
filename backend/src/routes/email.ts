import { Router, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { scheduleEmail, scheduleBulkEmails, getUserEmails } from '../services/emailService';
import { prisma } from '../config/db';
import { getRateLimitInfo } from '../services/rateLimiter';
import { env } from '../config/env';
import { EmailStatus } from '@prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authMiddleware);

// ── POST /api/emails/schedule — Schedule a single email ──────────
router.post('/schedule', async (req: AuthRequest, res: Response) => {
  try {
    const { fromEmail, toEmail, subject, body, scheduledAt, senderLabel } = req.body;

    if (!fromEmail || !toEmail || !subject || !body || !scheduledAt) {
      res.status(400).json({ error: 'Missing required fields: fromEmail, toEmail, subject, body, scheduledAt' });
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      res.status(400).json({ error: 'Invalid scheduledAt date format' });
      return;
    }

    const result = await scheduleEmail({
      userId: req.user!.id,
      fromEmail,
      toEmail,
      subject,
      body,
      scheduledAt: scheduledDate,
      senderLabel,
    });

    res.status(201).json({
      message: 'Email scheduled successfully',
      ...result,
    });
  } catch (error) {
    console.error('Schedule email error:', error);
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

// ── POST /api/emails/schedule-bulk — Schedule bulk emails ────────
router.post('/schedule-bulk', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { fromEmail, subject, body, scheduledAt, delayBetweenEmailsMs, hourlyLimit, senderLabel } = req.body;

    if (!fromEmail || !subject || !body || !scheduledAt) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    let recipients: string[] = [];

    // Parse recipients from CSV file
    if (req.file) {
      const content = req.file.buffer.toString('utf-8');

      // Try CSV parse first
      try {
        const records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });

        // Look for email column (case-insensitive)
        for (const record of records) {
          const emailField = Object.keys(record).find(
            (key) => key.toLowerCase() === 'email' || key.toLowerCase() === 'e-mail' || key.toLowerCase() === 'emailaddress'
          );
          if (emailField && record[emailField]) {
            recipients.push(record[emailField]);
          }
        }
      } catch {
        // Fallback: treat as plain text, one email per line
        recipients = content
          .split(/[\n,;]+/)
          .map((line: string) => line.trim())
          .filter((line: string) => line.includes('@'));
      }
    }

    // Also accept recipients from body
    if (req.body.recipients) {
      const bodyRecipients = Array.isArray(req.body.recipients)
        ? req.body.recipients
        : JSON.parse(req.body.recipients);
      recipients = [...recipients, ...bodyRecipients];
    }

    // Deduplicate
    recipients = [...new Set(recipients)];

    if (recipients.length === 0) {
      res.status(400).json({ error: 'No valid email recipients found' });
      return;
    }

    const delayMs = parseInt(delayBetweenEmailsMs || String(env.DELAY_BETWEEN_EMAILS_MS), 10);

    const result = await scheduleBulkEmails({
      userId: req.user!.id,
      fromEmail,
      recipients,
      subject,
      body,
      scheduledAt: new Date(scheduledAt),
      delayBetweenEmailsMs: delayMs,
      senderLabel,
    });

    res.status(201).json({
      message: `${result.emailCount} emails scheduled successfully`,
      ...result,
    });
  } catch (error) {
    console.error('Bulk schedule error:', error);
    res.status(500).json({ error: 'Failed to schedule bulk emails' });
  }
});

// ── GET /api/emails/scheduled — Get scheduled emails ─────────────
router.get('/scheduled', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);

    const result = await getUserEmails({
      userId: req.user!.id,
      status: EmailStatus.SCHEDULED,
      page,
      limit,
    });

    res.json(result);
  } catch (error) {
    console.error('Get scheduled emails error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

// ── GET /api/emails/sent — Get sent emails ───────────────────────
router.get('/sent', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);

    const result = await getUserEmails({
      userId: req.user!.id,
      status: EmailStatus.SENT,
      page,
      limit,
    });

    res.json(result);
  } catch (error) {
    console.error('Get sent emails error:', error);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

// ── GET /api/emails/all — Get all emails ─────────────────────────
router.get('/all', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const status = req.query.status as EmailStatus | undefined;

    const result = await getUserEmails({
      userId: req.user!.id,
      status,
      page,
      limit,
    });

    res.json(result);
  } catch (error) {
    console.error('Get all emails error:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// ── GET /api/emails/stats — Get queue stats ──────────────────────
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const counts = await prisma.email.groupBy({
      by: ['status'],
      where: { userId: req.user!.id },
      _count: { status: true }
    });

    const stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };

    counts.forEach(c => {
      if (c.status === 'SCHEDULED' || c.status === 'RATE_LIMITED') {
        stats.delayed += c._count.status;
      } else if (c.status === 'QUEUED' || c.status === 'SENDING') {
        stats.active += c._count.status;
      } else if (c.status === 'SENT') {
        stats.completed += c._count.status;
      } else if (c.status === 'FAILED') {
        stats.failed += c._count.status;
      }
    });

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
});

// ── GET /api/emails/rate-limit/:sender — Get rate limit info ─────
router.get('/rate-limit/:sender', async (req: AuthRequest, res: Response) => {
  try {
    const info = await getRateLimitInfo(req.params.sender);
    res.json(info);
  } catch (error) {
    console.error('Get rate limit error:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit info' });
  }
});

export default router;
