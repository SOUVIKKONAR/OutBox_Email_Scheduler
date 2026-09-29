import { Router, Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// ── GET /api/slack/connect — Initiate Slack OAuth ────────────────
router.get('/connect', authMiddleware, (req: AuthRequest, res: Response) => {
  const state = req.user!.id; // Pass userId as state to retrieve after callback

  const scopes = 'incoming-webhook,chat:write';
  const url = `https://slack.com/oauth/v2/authorize?` +
    `client_id=${env.SLACK_CLIENT_ID}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(env.SLACK_REDIRECT_URI)}` +
    `&state=${state}`;

  res.redirect(url);
});

// ── GET /api/slack/callback — Handle Slack OAuth callback ────────
router.get('/callback', async (req, res: Response) => {
  try {
    const { code, state } = req.query;
    const userId = state as string;

    if (!code || !userId) {
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&reason=missing_params`);
      return;
    }

    // Exchange code for token
    const tokenResponse = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      },
    });

    const data = tokenResponse.data;

    if (!data.ok) {
      console.error('Slack OAuth error:', data.error);
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&reason=${data.error}`);
      return;
    }

    // Store token and webhook URL
    const updateData: Record<string, string> = {};

    if (data.access_token) {
      updateData.slackToken = data.access_token;
    }

    if (data.incoming_webhook?.url) {
      updateData.slackWebhook = data.incoming_webhook.url;
    }

    if (data.incoming_webhook?.channel_id) {
      updateData.slackChannel = data.incoming_webhook.channel_id;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    console.log(`✅ Slack connected for user ${userId}`);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (error) {
    console.error('Slack callback error:', error);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&reason=internal`);
  }
});

// ── GET /api/slack/status — Check Slack connection status ────────
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { slackWebhook: true, slackToken: true, slackChannel: true },
    });

    res.json({
      connected: !!(user?.slackWebhook || user?.slackToken),
      hasWebhook: !!user?.slackWebhook,
      hasToken: !!user?.slackToken,
    });
  } catch (error) {
    console.error('Slack status error:', error);
    res.status(500).json({ error: 'Failed to check Slack status' });
  }
});

// ── POST /api/slack/disconnect — Disconnect Slack ────────────────
router.post('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        slackToken: null,
        slackWebhook: null,
        slackChannel: null,
      },
    });

    res.json({ message: 'Slack disconnected successfully' });
  } catch (error) {
    console.error('Slack disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

export default router;
