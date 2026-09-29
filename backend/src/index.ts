import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import { connectDB } from './config/db';
import { initEthereal } from './config/ethereal';
import { initElasticsearch } from './config/elasticsearch';
import { emailQueue } from './queues/emailQueue';
import { startEmailWorker } from './queues/emailWorker';
import { requeuePendingEmails } from './services/emailService';

import authRoutes from './routes/auth';
import emailRoutes from './routes/email';
import slackRoutes from './routes/slack';
import searchRoutes from './routes/search';

async function main() {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  // ── Bull Board (BullMQ Dashboard) ────────────────────────────
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // ── API Routes ───────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/search', searchRoutes);

  // ── Health Check ─────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // ── Initialize Services ──────────────────────────────────────
  await connectDB();
  await initEthereal();

  // Elasticsearch init is non-blocking (app works without it)
  initElasticsearch().catch((err) => {
    console.warn('⚠️  Elasticsearch not available:', err.message);
  });

  // ── Start Worker ─────────────────────────────────────────────
  startEmailWorker();

  // ── Re-queue Pending Emails on Restart ───────────────────────
  // This ensures persistence: emails scheduled before a restart
  // are re-added to BullMQ queue with correct delays.
  await requeuePendingEmails();

  // ── Start Server ─────────────────────────────────────────────
  app.listen(env.PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       📧 OutBox Email Scheduler Started         ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🌐 API:       http://localhost:${env.PORT}           ║`);
    console.log(`║  📊 Bull Board: http://localhost:${env.PORT}/admin/queues ║`);
    console.log(`║  🏠 Frontend:  ${env.FRONTEND_URL}          ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
