import { Request, Response, NextFunction } from 'express';
import { WorkflowService } from '../services/workflow.service';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  organizationId?: string;
}

export function createAuthMiddleware(workflowService: WorkflowService) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const userId = req.headers['x-user-id'] as string;
      const organizationId = req.headers['x-organization-id'] as string || req.params.organizationId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      if (organizationId) {
        // Verify membership (fail closed for security)
        const isMember = await workflowService.verifyMembership(organizationId, userId);
        if (!isMember) {
          return res.status(403).json({ error: 'User is not a member of this organization' });
        }
      }

      req.userId = userId;
      req.organizationId = organizationId;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}
