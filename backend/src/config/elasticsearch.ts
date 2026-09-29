import { Client } from '@elastic/elasticsearch';
import { env } from './env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
});

const INDEX_NAME = 'emails';

export async function initElasticsearch(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              fromEmail: { type: 'keyword' },
              toEmail: { type: 'keyword' },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              batchId: { type: 'keyword' },
              senderLabel: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log('✅ Elasticsearch index "emails" created');
    } else {
      console.log('✅ Elasticsearch index "emails" already exists');
    }
  } catch (error) {
    console.error('❌ Elasticsearch initialization failed:', error);
    // Non-fatal: app can work without ES, just no search
  }
}

export async function indexEmail(email: {
  id: string;
  userId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  batchId?: string | null;
  senderLabel?: string | null;
  createdAt: Date;
}): Promise<void> {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        fromEmail: email.fromEmail,
        toEmail: email.toEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        batchId: email.batchId,
        senderLabel: email.senderLabel,
        createdAt: email.createdAt,
      },
    });
  } catch (error) {
    console.error('Failed to index email to ES:', error);
  }
}

export async function updateEmailIndex(id: string, fields: Record<string, unknown>): Promise<void> {
  try {
    await esClient.update({
      index: INDEX_NAME,
      id,
      doc: fields,
    });
  } catch (error) {
    console.error('Failed to update email in ES:', error);
  }
}

export async function searchEmails(
  userId: string,
  query: string,
  status?: string,
  from = 0,
  size = 20
): Promise<{ hits: Array<{ id: string; [key: string]: unknown }>; total: number }> {
  try {
    const must: Array<Record<string, unknown>> = [
      { term: { userId } },
    ];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['subject', 'body', 'toEmail', 'fromEmail'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (status) {
      must.push({ term: { status } });
    }

    const result = await esClient.search({
      index: INDEX_NAME,
      from,
      size,
      query: {
        bool: { must },
      },
      sort: [{ createdAt: { order: 'desc' } }],
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...(hit._source as Record<string, unknown>),
    }));

    const total = typeof result.hits.total === 'number'
      ? result.hits.total
      : result.hits.total?.value || 0;

    return { hits, total };
  } catch (error) {
    console.error('Elasticsearch search failed:', error);
    return { hits: [], total: 0 };
  }
}
