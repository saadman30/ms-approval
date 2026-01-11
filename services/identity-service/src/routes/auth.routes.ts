import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { createAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { getCorrelationId } from '@microservice-learning/observability';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Register
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const input = registerSchema.parse(req.body);

      const result = await authService.register(
        input.email,
        input.password,
        input.firstName,
        input.lastName,
        correlationId
      );

      res.status(201).json({
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        tokens: result.tokens,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  });

  // Login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const input = loginSchema.parse(req.body);

      const result = await authService.login(
        {
          email: input.email,
          password: input.password,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
        correlationId
      );

      res.json({
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
        tokens: result.tokens,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(401).json({ error: error.message || 'Login failed' });
    }
  });

  // Refresh token
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const input = refreshTokenSchema.parse(req.body);
      const tokens = await authService.refreshToken(input.refreshToken);

      res.json({ tokens });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(401).json({ error: error.message || 'Token refresh failed' });
    }
  });

  // Logout
  router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const correlationId = req.headers['x-correlation-id'] as string || getCorrelationId();
      const sessionId = req.headers['x-session-id'] as string;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }

      await authService.logout(sessionId, req.userId!, correlationId);
      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Logout failed' });
    }
  });

  // Validate token (for API Gateway)
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const token = req.body.token || req.headers.authorization?.substring(7);
      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }

      const validation = await authService.validateToken(token);
      if (!validation) {
        return res.status(401).json({ valid: false });
      }

      res.json({ valid: true, userId: validation.userId });
    } catch (error: any) {
      res.status(401).json({ valid: false, error: error.message });
    }
  });

  return router;
}
