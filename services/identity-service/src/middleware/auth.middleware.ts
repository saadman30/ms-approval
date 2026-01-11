import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function createAuthMiddleware(authService: AuthService) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7);
      const validation = await authService.validateToken(token);

      if (!validation) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      req.userId = validation.userId;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}
