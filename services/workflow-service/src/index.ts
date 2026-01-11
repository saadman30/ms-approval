import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createLogger, MetricsRegistry, initializeTracing } from '@microservice-learning/observability';
import { pool } from './config/database';
import { ProjectRepository } from './repositories/project.repository';
import { TaskRepository } from './repositories/task.repository';
import { CacheRepository } from './repositories/cache.repository';
import { WorkflowService } from './services/workflow.service';
import { EventPublisher } from './events/event-publisher';
import { EventConsumer } from './events/event-consumer';
import { createWorkflowRoutes } from './routes/workflow.routes';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const PORT = process.env.PORT || 3003;
const SERVICE_NAME = 'workflow-service';

// Initialize observability
const logger = createLogger({ serviceName: SERVICE_NAME });
const metrics = new MetricsRegistry(SERVICE_NAME);
initializeTracing({ serviceName: SERVICE_NAME });

// Initialize repositories
const projectRepository = new ProjectRepository();
const taskRepository = new TaskRepository();
const cacheRepository = new CacheRepository();

// Initialize event publisher
const eventPublisher = new EventPublisher();

// Initialize services
const workflowService = new WorkflowService(
  projectRepository,
  taskRepository,
  cacheRepository,
  eventPublisher
);

// Initialize event consumer
const eventConsumer = new EventConsumer(cacheRepository, projectRepository);

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
app.use('/workflow', createWorkflowRoutes(workflowService));

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
      logger.info({ port: PORT }, 'Workflow service started');
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
