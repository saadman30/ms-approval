import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  organizationId?: string;
}

// Simple middleware to extract userId from JWT (in production, validate with Identity Service)
export function createAuthMiddleware() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      // In production, call Identity Service to validate token
      // For now, extract userId from token payload (simplified)
      const token = authHeader.substring(7);
      // TODO: Validate token with Identity Service
      // For now, assume token is valid and contains userId in header
      const userId = req.headers['x-user-id'] as string;
      
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      req.userId = userId;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}
