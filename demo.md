# 🎬 Demo Guide — OutBox Email Scheduler

This document provides a step-by-step guide for recording the demo video (max 5 minutes).

---

## Demo Segment 1: Login & Dashboard (30s)

1. Open `http://localhost:5173` → Login page appears
2. Click "Sign in with Google" → Google OAuth flow
3. Redirected to Dashboard → Show user name, email, avatar in header
4. Point out: Stats cards, Scheduled/Sent tabs, Compose button, Slack Connect

---

## Demo Segment 2: Schedule Emails (1 min)

### Single Email
1. Click "Compose Email" button
2. Fill in:
   - **From**: `demo@outbox.ai`
   - **To**: `test@example.com` (in the recipient text area)
   - **Subject**: `Hello from OutBox!`
   - **Body**: `<h1>Welcome</h1><p>This is a test email from OutBox scheduler.</p>`
   - **Start Time**: Set to 1 minute from now
3. Click "Schedule Email" → Toast notification confirms
4. Switch to "Scheduled" tab → Email appears with `SCHEDULED` badge

### Bulk Email via CSV
1. Click "Compose Email" again
2. Upload a CSV file with columns: `email` containing 5-10 emails
3. Show "X email addresses detected"
4. Set delay between emails: `3000` ms
5. Set hourly limit: `10`
6. Schedule → All emails appear in scheduled tab

---

## Demo Segment 3: Email Sending (1 min)

1. Wait for scheduled time → Emails start sending
2. Refresh dashboard → Status changes from `SCHEDULED` → `SENDING` → `SENT`
3. Switch to "Sent" tab → Shows sent emails with timestamp
4. Click "View" on a sent email → Opens Ethereal preview URL showing the rendered email

---

## Demo Segment 4: Slack Notifications (30s)

1. Click "Connect Slack" in header → Slack OAuth flow
2. Authorize the app → Redirected back with "Slack connected!" toast
3. Schedule emails that would hit the rate limit (hourly limit = 5, schedule 10)
4. When rate limit is hit → Show the Slack channel receiving the notification:
   > ⚠️ Rate Limit Alert
   > Hourly rate limit reached for sender `demo@outbox.ai`
   > Current count: 5/5
   > Next window opens in: 55 minutes

---

## Demo Segment 5: Server Restart Persistence (1 min)

1. Schedule 5 emails for 3 minutes from now
2. Show them in the "Scheduled" tab
3. **Stop the backend** (`Ctrl+C` in terminal)
4. Wait 10 seconds
5. **Restart the backend** (`npm run dev`)
6. Show logs: `♻️ Re-queued 5/5 pending emails from DB`
7. Wait for the scheduled time → Emails are sent correctly
8. Check "Sent" tab → All 5 emails marked as SENT
9. Confirm: **No duplicates, no missed emails**

---

## Demo Segment 6: Bull Board Dashboard (30s)

1. Open `http://localhost:3001/admin/queues`
2. Show the `email-send` queue
3. Point out: Waiting, Active, Completed, Failed, Delayed counts
4. Show a completed job's details (data, return value, timestamps)

---

## Demo Segment 7: Rate Limiting Under Load (30s)

1. Via Postman or frontend, schedule 20+ emails for the same time
2. Set `MAX_EMAILS_PER_HOUR_PER_SENDER=5` in env
3. Show in Bull Board: First 5 complete, rest are rescheduled
4. Show in dashboard: Status changes from `SCHEDULED` → `RATE_LIMITED` → back to `SCHEDULED` (rescheduled)
5. Explain: "Jobs are not dropped — they are pushed to the next available hour window"

---

## Key Points to Emphasize

- ✅ **No cron jobs** — All scheduling via BullMQ delayed jobs
- ✅ **Idempotent** — Same email won't be sent twice (DB check + BullMQ job ID)
- ✅ **Persistent** — Survives server restart via DB re-queue
- ✅ **Rate limited** — Redis counters, not in-memory (multi-instance safe)
- ✅ **Real Slack integration** — Not mock/log, actual webhook message
- ✅ **Searchable** — Elasticsearch for full-text search
- ✅ **Live dashboard** — Bull Board for queue visibility

---

## Sample CSV File for Demo

```csv
email
john@example.com
jane@example.com
bob@example.com
alice@example.com
charlie@example.com
dave@example.com
eve@example.com
frank@example.com
grace@example.com
henry@example.com
```

Save this as `leads.csv` for the bulk upload demo.
