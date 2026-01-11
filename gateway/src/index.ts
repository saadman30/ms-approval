import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { randomUUID } from 'crypto';
import { createLogger, MetricsRegistry, initializeTracing } from '@microservice-learning/observability';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 8080;
const SERVICE_NAME = 'api-gateway';

// Initialize observability
const logger = createLogger({ serviceName: SERVICE_NAME });
const metrics = new MetricsRegistry(SERVICE_NAME);
initializeTracing({ serviceName: SERVICE_NAME });

// Service URLs
const IDENTITY_SERVICE = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
const ORGANIZATION_SERVICE = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:3002';
const WORKFLOW_SERVICE = process.env.WORKFLOW_SERVICE_URL || 'http://localhost:3003';
const BILLING_SERVICE = process.env.BILLING_SERVICE_URL || 'http://localhost:3004';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
const AUDIT_SERVICE = process.env.AUDIT_SERVICE_URL || 'http://localhost:3006';
const ANALYTICS_SERVICE = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007';

// Token validation cache (5 minute TTL)
const tokenCache = new Map<string, { userId: string; expires: number }>();

async function validateToken(token: string): Promise<{ valid: boolean; userId?: string }> {
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return { valid: true, userId: cached.userId };
  }

  try {
    const response = await axios.post(
      `${IDENTITY_SERVICE}/auth/validate`,
      { token },
      {
        timeout: 1000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.valid && response.data.userId) {
      // Cache the result (5 minutes)
      tokenCache.set(token, {
        userId: response.data.userId,
        expires: Date.now() + 5 * 60 * 1000,
      });

      return { valid: true, userId: response.data.userId };
    }

    return { valid: false };
  } catch (error) {
    logger.error({ error }, 'Token validation failed');
    return { valid: false };
  }
}

// Auth middleware
function createAuthMiddleware() {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const validation = await validateToken(token);

    if (!validation.valid) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.headers['x-user-id'] = validation.userId!;
    next();
  };
}

const app = express();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Correlation-ID, X-User-ID, X-Organization-ID');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metricsOutput = await metrics.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metricsOutput);
  } catch (error) {
    logger.error({ error }, 'Failed to get metrics');
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Identity Service (public endpoints)
app.use(
  '/auth',
  createProxyMiddleware({
    target: IDENTITY_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/auth': '' },
    onProxyReq: (proxyReq, req) => {
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] as string);
      }
    },
  })
);

const authMiddleware = createAuthMiddleware();

// Organization Service
app.use(
  '/orgs',
  authMiddleware,
  createProxyMiddleware({
    target: ORGANIZATION_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/orgs': '/orgs' },
    onProxyReq: (proxyReq, req) => {
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] as string);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-ID', req.headers['x-user-id'] as string);
      }
      if (req.headers['x-organization-id']) {
        proxyReq.setHeader('X-Organization-ID', req.headers['x-organization-id'] as string);
      }
    },
  })
);

// Workflow Service
app.use(
  '/workflow',
  authMiddleware,
  createProxyMiddleware({
    target: WORKFLOW_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/workflow': '/workflow' },
    onProxyReq: (proxyReq, req) => {
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] as string);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-ID', req.headers['x-user-id'] as string);
      }
      if (req.headers['x-organization-id']) {
        proxyReq.setHeader('X-Organization-ID', req.headers['x-organization-id'] as string);
      }
    },
  })
);

// Billing Service
app.use(
  '/billing',
  authMiddleware,
  createProxyMiddleware({
    target: BILLING_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/billing': '/billing' },
    onProxyReq: (proxyReq, req) => {
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] as string);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-ID', req.headers['x-user-id'] as string);
      }
      if (req.headers['x-organization-id']) {
        proxyReq.setHeader('X-Organization-ID', req.headers['x-organization-id'] as string);
      }
    },
  })
);

// Notification Service
app.use(
  '/notifications',
  authMiddleware,
  createProxyMiddleware({
    target: NOTIFICATION_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/notifications': '/notifications' },
    onProxyReq: (proxyReq, req) => {
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] as string);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-ID', req.headers['x-user-id'] as string);
      }
    },
  })
);

// Audit Service
app.use(
  '/audit',
  authMiddleware,
  createProxyMiddleware({
    target: AUDIT_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/audit': '/audit' },
    onProxyReq: (proxyReq, req) => {
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] as string);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-ID', req.headers['x-user-id'] as string);
      }
    },
  })
);

// Analytics Service
app.use(
  '/analytics',
  authMiddleware,
  createProxyMiddleware({
    target: ANALYTICS_SERVICE,
    changeOrigin: true,
    pathRewrite: { '^/analytics': '/analytics' },
    onProxyReq: (proxyReq, req) => {
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('X-Correlation-ID', req.headers['x-correlation-id'] as string);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-ID', req.headers['x-user-id'] as string);
      }
    },
  })
);

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API Gateway started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
