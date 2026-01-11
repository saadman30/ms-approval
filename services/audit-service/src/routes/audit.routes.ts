import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuditService } from '../services/audit.service';
import { createAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  offset: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

export function createAuditRoutes(auditService: AuditService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware();

  // Query audit logs
  router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = querySchema.parse(req.query);
      
      // Convert date strings to Date objects
      const auditQuery = {
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      };

      const logs = await auditService.query(auditQuery);
      res.json(logs);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
