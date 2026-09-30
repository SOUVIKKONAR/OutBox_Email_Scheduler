import jwt from 'jsonwebtoken';
import axios from 'axios';
import { env } from './backend/src/config/env';

const API_URL = `http://localhost:${env.PORT}/api`;

const token = jwt.sign(
  {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  env.JWT_SECRET,
  { expiresIn: '1h' }
);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: `Bearer ${token}`
  }
});

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- STARTING TESTS ---');
  
  // Test 1: Normal Scheduling
  console.log('\n[TEST 1] Normal Scheduling');
  const res1 = await api.post('/emails/schedule', {
    fromEmail: 'test@outbox.com',
    toEmail: 'target1@example.com',
    subject: 'Test 1',
    body: 'Hello',
    scheduledAt: new Date(Date.now() + 5000).toISOString()
  });
  console.log('Scheduled email:', res1.data.emailId);
  
  // Wait for it to process
  await delay(10000);
  const status1 = await api.get('/emails/all');
  const e1 = status1.data.emails.find((e: any) => e.id === res1.data.emailId);
  console.log(`Email Status: ${e1?.status}`);

  // Test 3/4/5: Concurrency, Min Delay, Rate limit
  console.log('\n[TEST 3,4,5] Concurrency & Rate Limit (Hourly Limit = 2, Delay = 2000)');
  // We'll trigger bulk scheduling
  const resBulk = await api.post('/emails/schedule-bulk', {
    fromEmail: 'limited@outbox.com',
    recipients: ['1@ex.com', '2@ex.com', '3@ex.com', '4@ex.com'],
    subject: 'Bulk Rate Limit Test',
    body: 'Testing',
    scheduledAt: new Date(Date.now() + 2000).toISOString(),
    delayBetweenEmailsMs: '0' // we want them all to fire at once to test worker concurrency delay
  });
  console.log(`Scheduled bulk emails: ${resBulk.data.emailCount}`);
  
  // Wait for processing
  await delay(15000);
  const statusBulk = await api.get('/emails/all');
  const bulkEmails = statusBulk.data.emails.filter((e: any) => e.batchId === resBulk.data.batchId);
  
  console.log('Bulk Email Statuses:');
  bulkEmails.forEach((e: any) => {
    console.log(`- To: ${e.toEmail} | Status: ${e.status} | ScheduledFor: ${new Date(e.scheduledAt).toLocaleTimeString()}`);
  });

  console.log('--- TESTS COMPLETE ---');
}

runTests().catch(console.error);
