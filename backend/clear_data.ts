import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Client } from '@elastic/elasticsearch';

const prisma = new PrismaClient();
const redis = new Redis('redis://localhost:6379');
const esClient = new Client({ node: 'http://localhost:9200' });

async function clearData() {
  console.log('🧹 Clearing data...');

  // 1. Clear PostgreSQL (Only Emails, preserve Users so they stay logged in)
  await prisma.email.deleteMany({});
  console.log('✅ PostgreSQL emails cleared.');

  // 2. Clear Redis (BullMQ queues and Rate Limit keys)
  await redis.flushall();
  console.log('✅ Redis data flushed (Queues & Rate Limiters cleared).');
  await redis.disconnect();

  // 3. Clear Elasticsearch
  try {
    await esClient.indices.delete({ index: 'emails' });
    console.log('✅ Elasticsearch index deleted.');
  } catch (err: any) {
    if (err.meta?.body?.error?.type === 'index_not_found_exception') {
      console.log('✅ Elasticsearch index did not exist, skipping.');
    } else {
      console.error('❌ Failed to clear Elasticsearch:', err.message);
    }
  }

  await prisma.$disconnect();
  console.log('🎉 Project history completely wiped. Ready for fresh testing!');
}

clearData().catch(console.error);
