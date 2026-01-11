import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createLogger, MetricsRegistry, initializeTracing } from '@microservice-learning/observability';
import { pool } from './config/database';
import { NotificationRepository } from './repositories/notification.repository';
import { DeliveryRepository } from './repositories/delivery.repository';
import { NotificationService } from './services/notification.service';
import { EventConsumer } from './events/event-consumer';
import { createNotificationRoutes } from './routes/notification.routes';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const PORT = process.env.PORT || 3005;
const SERVICE_NAME = 'notification-service';

// Initialize observability
const logger = createLogger({ serviceName: SERVICE_NAME });
const metrics = new MetricsRegistry(SERVICE_NAME);
initializeTracing({ serviceName: SERVICE_NAME });

// Initialize repositories
const notificationRepository = new NotificationRepository();
const deliveryRepository = new DeliveryRepository();

// Initialize services
const notificationService = new NotificationService(
  notificationRepository,
  deliveryRepository
);

// Initialize event consumer
const eventConsumer = new EventConsumer(notificationService);

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
app.use('/notifications', createNotificationRoutes(notificationService));

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
    await eventConsumer.connect();
    await eventConsumer.subscribe();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Notification service started');
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await eventConsumer.disconnect();
      await pool.end();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start service');
    process.exit(1);
  }
}

start();
