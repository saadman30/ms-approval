import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createLogger, MetricsRegistry, initializeTracing } from '@microservice-learning/observability';
import { pool } from './config/database';
import { OrganizationRepository } from './repositories/organization.repository';
import { MembershipRepository } from './repositories/membership.repository';
import { InvitationRepository } from './repositories/invitation.repository';
import { OrganizationService } from './services/organization.service';
import { EventPublisher } from './events/event-publisher';
import { createOrganizationRoutes } from './routes/organization.routes';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const PORT = process.env.PORT || 3002;
const SERVICE_NAME = 'organization-service';

// Initialize observability
const logger = createLogger({ serviceName: SERVICE_NAME });
const metrics = new MetricsRegistry(SERVICE_NAME);
initializeTracing({ serviceName: SERVICE_NAME });

// Initialize repositories
const organizationRepository = new OrganizationRepository();
const membershipRepository = new MembershipRepository();
const invitationRepository = new InvitationRepository();

// Initialize event publisher
const eventPublisher = new EventPublisher();

// Initialize services
const organizationService = new OrganizationService(
  organizationRepository,
  membershipRepository,
  invitationRepository,
  eventPublisher
);

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
app.use('/orgs', createOrganizationRoutes(organizationService));

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

    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Organization service started');
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
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
