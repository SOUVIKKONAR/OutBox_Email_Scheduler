# 📋 CONTEXT.md — OutBox Email Scheduler Project Context

> **Purpose**: This file provides complete context for continuing development on this project,
> whether resuming on a different machine, account, or AI assistant instance.

---

## 🎯 Project Goal

Build a **production-grade email scheduler service + dashboard** for the **ReachInbox Hiring Assignment** (Outbox Labs).

### Assignment Requirements Summary
- Full-stack app: Express.js backend + React frontend (TypeScript)
- BullMQ + Redis for job scheduling (NO cron jobs)
- PostgreSQL for persistence (via Prisma ORM)
- Ethereal Email for fake SMTP sending
- Elasticsearch for searchable emails
- Google OAuth login (real, not mock)
- Slack OAuth + real webhook notifications on rate limit
- Rate limiting: per-sender + global, Redis-backed, configurable
- Worker concurrency: configurable, parallel-safe
- Persistence: server restart doesn't lose or duplicate jobs
- Idempotency: same email never sent twice
- Bull Board dashboard for queue visibility
- Frontend: Login, Dashboard (scheduled/sent tabs), Compose (CSV upload), Search

---

## 🏗 Project Structure

```
OutBox/                          # Root monorepo
├── docker-compose.yml           # Redis, PostgreSQL, Elasticsearch
├── package.json                 # Workspace scripts
├── .env.example                 # Template env vars
├── README.md                    # Full documentation
├── demo.md                      # Demo video guide
├── CONTEXT.md                   # This file
│
├── backend/                     # Express.js backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma        # User + Email models
│   └── src/
│       ├── index.ts             # Entry point (Express + init)
│       ├── config/
│       │   ├── env.ts           # Typed env vars
│       │   ├── db.ts            # Prisma client
│       │   ├── redis.ts         # Redis + BullMQ connection
│       │   ├── elasticsearch.ts # ES client + search
│       │   └── ethereal.ts      # SMTP transport
│       ├── middleware/
│       │   └── auth.ts          # JWT auth middleware
│       ├── routes/
│       │   ├── auth.ts          # Google OAuth (Passport.js)
│       │   ├── email.ts         # Schedule/list endpoints
│       │   ├── slack.ts         # Slack OAuth
│       │   └── search.ts       # ES search endpoint
│       ├── queues/
│       │   ├── emailQueue.ts    # BullMQ queue definition
│       │   └── emailWorker.ts   # Worker with rate limiting
│       ├── services/
│       │   ├── emailService.ts  # Schedule/bulk/requeue logic
│       │   ├── rateLimiter.ts   # Redis INCR-based limiter
│       │   └── slackService.ts  # Slack webhook notifications
│       └── types/
│           └── index.ts         # Shared TypeScript types
│
└── frontend/                    # React + Vite frontend
    ├── package.json
    ├── vite.config.ts           # Tailwind v4 + API proxy
    ├── index.html               # Inter font + meta tags
    └── src/
        ├── main.tsx             # Entry point
        ├── App.tsx              # Router + Auth flow
        ├── index.css            # Design system (dark theme)
        ├── api/
        │   └── client.ts        # Axios with auth interceptor
        ├── hooks/
        │   └── useAuth.ts       # Auth state management
        ├── components/
        │   ├── layout/
        │   │   └── Header.tsx   # Logo, user info, Slack connect
        │   ├── ComposeEmail.tsx  # Modal with CSV upload
        │   └── EmailTable.tsx   # Reusable table component
        ├── pages/
        │   ├── Login.tsx        # Google OAuth login page
        │   ├── Dashboard.tsx    # Main dashboard (tabs, stats)
        │   └── Callback.tsx     # OAuth callback handler
        └── types/
            └── index.ts         # Frontend type definitions
```

---

## 🔑 Key Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **ORM** | Prisma | Type-safe queries, migration support, great DX |
| **Queue** | BullMQ | Required by assignment, excellent delayed job support |
| **Rate Limiter** | Redis INCR + TTL | Atomic, multi-instance safe, no race conditions |
| **Auth** | Passport.js + JWT | Google OAuth strategy, stateless JWT tokens |
| **Search** | Elasticsearch | Required by assignment, full-text search capability |
| **Frontend Build** | Vite | Fast HMR, modern bundling, great TS support |
| **CSS** | Tailwind CSS v4 | Required by assignment, utility-first |
| **Queue Dashboard** | @bull-board/express | Official BullMQ dashboard integration |

---

## 📊 Database Schema

### Users Table
- `id` (UUID, PK)
- `googleId` (unique, from Google OAuth)
- `email`, `name`, `avatar`
- `slackToken`, `slackWebhook`, `slackChannel` (nullable, for Slack integration)

### Emails Table
- `id` (UUID, PK)
- `userId` (FK → Users)
- `jobId` (BullMQ job ID)
- `idempotencyKey` (unique, prevents duplicates)
- `fromEmail`, `toEmail`, `subject`, `body`
- `status` (SCHEDULED | QUEUED | SENDING | SENT | FAILED | RATE_LIMITED)
- `scheduledAt`, `sentAt`, `failedAt`
- `etherealUrl` (preview link)
- `batchId` (groups bulk emails)

---

## 🔄 Critical Flows

### Scheduling Flow
1. API receives schedule request
2. Create Email record in PostgreSQL (status: SCHEDULED)
3. Calculate delay: `scheduledAt - Date.now()`
4. Add BullMQ delayed job with `jobId = idempotencyKey`
5. Index in Elasticsearch

### Worker Processing Flow
1. Job fires after delay
2. Idempotency check: skip if already SENT
3. Rate limit check (sender + global)
4. If rate limited → reschedule to next hour, notify Slack
5. If allowed → increment counters, send via Ethereal
6. Update DB status → SENT
7. Update Elasticsearch index

### Restart Recovery Flow
1. Server starts → calls `requeuePendingEmails()`
2. Queries DB for SCHEDULED/RATE_LIMITED emails with future scheduledAt
3. For each: creates BullMQ delayed job
4. BullMQ's idempotent jobId prevents duplicates

---

## 🛠 Development Status

### Completed ✅
- [x] Docker Compose infrastructure
- [x] Backend project structure
- [x] Prisma schema + models
- [x] Express server with all middleware
- [x] Google OAuth authentication
- [x] BullMQ queue + worker
- [x] Ethereal SMTP integration
- [x] Redis-backed rate limiting
- [x] Slack OAuth + notifications
- [x] Elasticsearch integration
- [x] Email scheduling API (single + bulk)
- [x] Restart recovery (requeuePendingEmails)
- [x] Bull Board dashboard
- [x] Frontend: Login page
- [x] Frontend: Dashboard with stats
- [x] Frontend: Email tables (scheduled/sent)
- [x] Frontend: Compose email modal
- [x] Frontend: CSV upload + parsing
- [x] Frontend: Slack connect/disconnect
- [x] Frontend: Search, pagination, auto-refresh
- [x] README documentation
- [x] Demo guide

### To Do / Polish ❌
- [ ] Run Prisma migrations and test end-to-end
- [ ] Test rate limiting under load
- [ ] Record demo video
- [ ] Add @types for missing packages if needed
- [ ] Production build test

---

## 🧪 Testing Commands

```bash
# Start infrastructure
docker-compose up -d

# Run backend
cd backend && npm run dev

# Run frontend
cd frontend && npm run dev

# Run Prisma migration
cd backend && npx prisma migrate dev --name init

# Generate Prisma client
cd backend && npx prisma generate

# View database
cd backend && npx prisma studio
```

---

## 📝 Notes for Continuation

1. **If Google OAuth isn't working**: Need to set up Google Cloud Console project with OAuth 2.0 credentials, add `http://localhost:3001/api/auth/google/callback` as authorized redirect URI.

2. **If Elasticsearch fails**: App works without it — search returns empty. Start ES via Docker if needed.

3. **If Slack isn't working**: Need Slack App with `incoming-webhook` and `chat:write` scopes, redirect URI set to `http://localhost:3001/api/slack/callback`.

4. **Ethereal emails**: Check preview URLs in the API response or database `ethereal_url` field. View at https://ethereal.email.

5. **Rate limit testing**: Set `MAX_EMAILS_PER_HOUR_PER_SENDER=5` to trigger rate limiting quickly.
