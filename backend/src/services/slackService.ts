import axios from 'axios';
import { prisma } from '../config/db';

/**
 * Slack notification service.
 * 
 * Sends notifications to Slack when rate limits are hit.
 * Uses stored webhook URLs per user/tenant.
 * 
 * If Slack is not connected, notifications are silently skipped (no crash).
 */

export async function sendSlackNotification(
  userId: string,
  message: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { slackWebhook: true, slackToken: true, slackChannel: true },
    });

    if (!user?.slackWebhook && !user?.slackToken) {
      // Slack not connected — silently skip
      console.log(`ℹ️  Slack not connected for user ${userId}, skipping notification`);
      return false;
    }

    // Use webhook URL if available
    if (user.slackWebhook) {
      await axios.post(user.slackWebhook, {
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ *Rate Limit Alert*\n${message}`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `_Sent from OutBox Email Scheduler at ${new Date().toISOString()}_`,
              },
            ],
          },
        ],
      });
      console.log(`📢 Slack notification sent to user ${userId}`);
      return true;
    }

    // Use Bot token + chat.postMessage if webhook not available
    if (user.slackToken && user.slackChannel) {
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel: user.slackChannel,
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ *Rate Limit Alert*\n${message}`,
            },
          },
        ],
      }, {
        headers: {
          Authorization: `Bearer ${user.slackToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(`📢 Slack notification sent via bot to user ${userId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
    return false;
  }
}

export async function notifyRateLimitHit(
  userId: string,
  senderEmail: string,
  currentCount: number,
  limit: number,
  nextWindowMs: number
): Promise<void> {
  const nextWindowMinutes = Math.ceil(nextWindowMs / 60000);
  const message = `🚫 Hourly rate limit reached for sender \`${senderEmail}\`.\n` +
    `• Current count: *${currentCount}/${limit}*\n` +
    `• Next window opens in: *${nextWindowMinutes} minutes*\n` +
    `• Emails have been rescheduled to the next available window.`;

  await sendSlackNotification(userId, message);
}
