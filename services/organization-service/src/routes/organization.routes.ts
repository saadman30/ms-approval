import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OrganizationService } from '../services/organization.service';
import { createAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { getCorrelationId } from '@microservice-learning/observability';

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

const changeRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

export function createOrganizationRoutes(organizationService: OrganizationService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware();

  // Create organization
  router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const input = createOrgSchema.parse(req.body);

      const result = await organizationService.createOrganization(
        {
          name: input.name,
          createdBy: req.userId!,
        },
        correlationId
      );

      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to create organization' });
    }
  });

  // Get organization
  router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Implement get organization
      res.status(501).json({ error: 'Not implemented' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete organization
  router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { id } = req.params;

      await organizationService.deleteOrganization(id, req.userId!, correlationId);
      res.json({ message: 'Organization deleted' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete organization' });
    }
  });

  // Add member
  router.post('/:id/members', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { id } = req.params;
      const input = addMemberSchema.parse(req.body);

      const membership = await organizationService.addMember(
        {
          organizationId: id,
          userId: input.userId,
          role: input.role,
        },
        req.userId!,
        correlationId
      );

      res.status(201).json(membership);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to add member' });
    }
  });

  // Remove member
  router.delete('/:id/members/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { id, userId } = req.params;

      await organizationService.removeMember(id, userId, req.userId!, correlationId);
      res.json({ message: 'Member removed' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to remove member' });
    }
  });

  // Change role
  router.patch('/:id/members/:userId/role', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { userId } = req.params;
      const input = changeRoleSchema.parse(req.body);

      // TODO: Get membership ID from userId and organizationId
      res.status(501).json({ error: 'Not implemented' });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to change role' });
    }
  });

  // Send invitation
  router.post('/:id/invitations', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { id } = req.params;
      const input = inviteSchema.parse(req.body);

      const invitation = await organizationService.sendInvitation(
        {
          organizationId: id,
          inviteeEmail: input.email,
          role: input.role,
          sentBy: req.userId!,
        },
        correlationId
      );

      res.status(201).json(invitation);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to send invitation' });
    }
  });

  // Accept invitation
  router.post('/invitations/:token/accept', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const userId = req.body.userId || req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const membership = await organizationService.acceptInvitation(token, userId);
      res.json(membership);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to accept invitation' });
    }
  });

  // Reject invitation
  router.post('/invitations/:token/reject', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      await organizationService.rejectInvitation(token);
      res.json({ message: 'Invitation rejected' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to reject invitation' });
    }
  });

  return router;
}
