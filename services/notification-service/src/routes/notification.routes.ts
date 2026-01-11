import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { createAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

export function createNotificationRoutes(notificationService: NotificationService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware();

  // Get user notifications
  router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await notificationService.getNotificationsForUser(
        req.userId!,
        limit
      );

      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mark notification as read
  router.patch('/:id/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      await notificationService.markNotificationAsRead(id);
      res.json({ message: 'Notification marked as read' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
