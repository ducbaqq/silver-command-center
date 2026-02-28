import { Router, Request, Response } from 'express';
import { getData } from './store';
import { refreshAll } from './scheduler';

const router = Router();

// GET /api/data — return full dashboard data
router.get('/api/data', (_req: Request, res: Response) => {
  const data = getData();
  if (!data) {
    res.status(503).json({
      error: 'Data not yet loaded. Please wait for the first refresh cycle (up to 60 seconds).',
    });
    return;
  }
  res.json(data);
});

// POST /api/refresh — trigger manual refresh
router.post('/api/refresh', async (_req: Request, res: Response) => {
  try {
    // Don't await — return immediately and let it run in background
    refreshAll().catch((e) => console.error('[Routes] Manual refresh error:', e));
    res.json({ success: true, message: 'Data refresh triggered. Check /api/data in ~10 seconds.' });
  } catch (e) {
    res.status(500).json({ error: 'Refresh failed to start', details: String(e) });
  }
});

// GET /api/health — health check
router.get('/api/health', (_req: Request, res: Response) => {
  const data = getData();
  res.json({
    status: 'ok',
    hasData: !!data,
    lastUpdated: data?.lastUpdated || null,
    silverPrice: data?.price?.spot || null,
    signal: data?.signal?.action || null,
  });
});

export default router;
