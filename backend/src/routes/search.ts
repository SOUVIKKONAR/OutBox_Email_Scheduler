import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { searchEmails } from '../config/elasticsearch';

const router = Router();

router.use(authMiddleware);

// ── GET /api/search — Search emails via Elasticsearch ────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const from = (page - 1) * limit;

    if (!query && !status) {
      res.status(400).json({ error: 'Provide at least a search query (q) or status filter' });
      return;
    }

    const result = await searchEmails(req.user!.id, query, status, from, limit);

    res.json({
      results: result.hits,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
