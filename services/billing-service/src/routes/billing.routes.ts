import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { BillingService } from '../services/billing.service';
import { createAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { getCorrelationId } from '@microservice-learning/observability';

const createPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  billingPeriod: z.enum(['monthly', 'yearly']),
  priceAmount: z.number().positive(),
  priceCurrency: z.string().optional(),
  maxProjects: z.number().int().positive().optional(),
  maxTasks: z.number().int().positive().optional(),
  maxMembers: z.number().int().positive().optional(),
  features: z.array(z.string()).optional(),
});

const createSubscriptionSchema = z.object({
  planId: z.string().uuid(),
});

const changePlanSchema = z.object({
  planId: z.string().uuid(),
});

const trackUsageSchema = z.object({
  metricName: z.string(),
  metricValue: z.number().int().positive().optional(),
});

export function createBillingRoutes(billingService: BillingService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware();

  // Plans
  router.get('/plans', async (req: Request, res: Response) => {
    try {
      // TODO: Implement get active plans
      res.status(501).json({ error: 'Not implemented' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/plans', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const input = createPlanSchema.parse(req.body);
      const plan = await billingService.createPlan(input);
      res.status(201).json(plan);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to create plan' });
    }
  });

  // Subscriptions
  router.post('/subscriptions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const organizationId = req.headers['x-organization-id'] as string || req.body.organizationId;
      const input = createSubscriptionSchema.parse(req.body);

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const result = await billingService.createSubscription(
        {
          organizationId,
          planId: input.planId,
        },
        correlationId
      );

      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to create subscription' });
    }
  });

  router.get('/subscriptions/:organizationId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Implement get subscription
      res.status(501).json({ error: 'Not implemented' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch('/subscriptions/:subscriptionId/plan', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { subscriptionId } = req.params;
      const input = changePlanSchema.parse(req.body);

      const result = await billingService.changePlan(subscriptionId, input.planId, correlationId);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to change plan' });
    }
  });

  router.post('/subscriptions/:subscriptionId/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { subscriptionId } = req.params;
      const cancelAtPeriodEnd = req.body.cancelAtPeriodEnd || false;

      const subscription = await billingService.cancelSubscription(
        subscriptionId,
        cancelAtPeriodEnd,
        correlationId
      );

      res.json(subscription);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to cancel subscription' });
    }
  });

  // Entitlements
  router.get('/entitlements/:organizationId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { organizationId } = req.params;
      const entitlements = await billingService.getEntitlements(organizationId);

      if (!entitlements) {
        return res.status(404).json({ error: 'No entitlements found' });
      }

      res.json(entitlements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Usage
  router.post('/usage', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.headers['x-organization-id'] as string || req.body.organizationId;
      const input = trackUsageSchema.parse(req.body);

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const usage = await billingService.trackUsage({
        organizationId,
        ...input,
      });

      res.status(201).json(usage);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to track usage' });
    }
  });

  router.get('/usage/:organizationId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Implement get usage
      res.status(501).json({ error: 'Not implemented' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
