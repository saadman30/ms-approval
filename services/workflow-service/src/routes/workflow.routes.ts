import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WorkflowService } from '../services/workflow.service';
import { createAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { getCorrelationId } from '@microservice-learning/observability';

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  assignedTo: z.string().uuid().optional(),
});

export function createWorkflowRoutes(workflowService: WorkflowService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(workflowService);

  // Projects
  router.post('/projects', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const organizationId = req.headers['x-organization-id'] as string || req.body.organizationId;
      const input = createProjectSchema.parse(req.body);

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const project = await workflowService.createProject(
        {
          organizationId,
          name: input.name,
          description: input.description,
          createdBy: req.userId!,
        },
        correlationId
      );

      res.status(201).json(project);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to create project' });
    }
  });

  router.get('/projects', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.headers['x-organization-id'] as string || req.query.organizationId as string;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      // TODO: Implement get projects
      res.status(501).json({ error: 'Not implemented' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/projects/:id/archive', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { id } = req.params;

      const project = await workflowService.archiveProject(id, req.userId!, correlationId);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to archive project' });
    }
  });

  // Tasks
  router.post('/tasks', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const organizationId = req.headers['x-organization-id'] as string || req.body.organizationId;
      const input = createTaskSchema.parse(req.body);

      if (!organizationId || !req.body.projectId) {
        return res.status(400).json({ error: 'Organization ID and Project ID required' });
      }

      const task = await workflowService.createTask(
        {
          organizationId,
          projectId: req.body.projectId,
          title: input.title,
          description: input.description,
          createdBy: req.userId!,
        },
        correlationId
      );

      res.status(201).json(task);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to create task' });
    }
  });

  router.get('/tasks', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Implement get tasks
      res.status(501).json({ error: 'Not implemented' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch('/tasks/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const { id } = req.params;
      const input = updateTaskSchema.parse(req.body);

      const task = await workflowService.updateTask(id, input, req.userId!, correlationId);
      res.json(task);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Failed to update task' });
    }
  });

  return router;
}
