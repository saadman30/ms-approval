import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createLogger, MetricsRegistry, initializeTracing } from '@microservice-learning/observability';
import { pool } from './config/database';
import { PlanRepository } from './repositories/plan.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { EntitlementRepository } from './repositories/entitlement.repository';
import { UsageRepository } from './repositories/usage.repository';
import { BillingService } from './services/billing.service';
import { EventPublisher } from './events/event-publisher';
import { EventConsumer } from './events/event-consumer';
import { createBillingRoutes } from './routes/billing.routes';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const PORT = process.env.PORT || 3004;
const SERVICE_NAME = 'billing-service';

// Initialize observability
const logger = createLogger({ serviceName: SERVICE_NAME });
const metrics = new MetricsRegistry(SERVICE_NAME);
initializeTracing({ serviceName: SERVICE_NAME });

// Initialize repositories
const planRepository = new PlanRepository();
const subscriptionRepository = new SubscriptionRepository();
const entitlementRepository = new EntitlementRepository();
const usageRepository = new UsageRepository();

// Initialize event publisher
const eventPublisher = new EventPublisher();

// Initialize services
const billingService = new BillingService(
  planRepository,
  subscriptionRepository,
  entitlementRepository,
  usageRepository,
  eventPublisher
);

// Initialize event consumer
const eventConsumer = new EventConsumer(billingService);

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: SERVICE_NAME,
      error: 'Database connection failed',
    });
  }
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

// Routes
app.use('/billing', createBillingRoutes(billingService));

// Run database migrations on startup
async function runMigrations() {
  try {
    const migrationSQL = readFileSync(
      join(__dirname, 'migrations', '001_initial_schema.sql'),
      'utf-8'
    );
    
    await pool.query(migrationSQL);
    logger.info('Database migrations completed');
  } catch (error: any) {
    if (error.code === '42P07') {
      logger.info('Database tables already exist');
    } else {
      logger.error({ error }, 'Migration failed');
      throw error;
    }
  }
}

// Startup
async function start() {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connected');

    await runMigrations();
    await eventPublisher.connect();
    await eventConsumer.connect();
    await eventConsumer.subscribe();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Billing service started');
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await eventConsumer.disconnect();
      await eventPublisher.disconnect();
      await pool.end();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start service');
    process.exit(1);
  }
}

start();
