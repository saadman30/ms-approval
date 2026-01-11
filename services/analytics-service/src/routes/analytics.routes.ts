import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AnalyticsService } from '../services/analytics.service';
import { createAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const querySchema = z.object({
  organizationId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export function createAnalyticsRoutes(analyticsService: AnalyticsService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware();

  // Get task metrics
  router.get('/tasks', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = querySchema.parse(req.query);
      const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      const metrics = await analyticsService.getTaskMetrics(
        query.organizationId,
        startDate,
        endDate
      );

      res.json(metrics);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Get subscription analytics
  router.get('/subscriptions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.query.organizationId as string;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const analytics = await analyticsService.getSubscriptionAnalytics(organizationId);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get usage metrics
  router.get('/usage', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = querySchema.parse(req.query);
      const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      const metrics = await analyticsService.getUsageMetrics(
        query.organizationId,
        startDate,
        endDate
      );

      res.json(metrics);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
