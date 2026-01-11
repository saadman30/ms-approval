import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createLogger, MetricsRegistry, initializeTracing } from '@microservice-learning/observability';
import { pool } from './config/database';
import { UserRepository } from './repositories/user.repository';
import { CredentialRepository } from './repositories/credential.repository';
import { SessionRepository } from './repositories/session.repository';
import { AuthService } from './services/auth.service';
import { EventPublisher } from './events/event-publisher';
import { createAuthRoutes } from './routes/auth.routes';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const PORT = process.env.PORT || 3001;
const SERVICE_NAME = 'identity-service';

// Initialize observability
const logger = createLogger({ serviceName: SERVICE_NAME });
const metrics = new MetricsRegistry(SERVICE_NAME);
initializeTracing({ serviceName: SERVICE_NAME });

// Initialize repositories
const userRepository = new UserRepository();
const credentialRepository = new CredentialRepository();
const sessionRepository = new SessionRepository();

// Initialize event publisher
const eventPublisher = new EventPublisher();

// Initialize services
const authService = new AuthService(
  userRepository,
  credentialRepository,
  sessionRepository,
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
    // Check database
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
app.use('/auth', createAuthRoutes(authService));

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
      // Table already exists
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
    // Connect to database
    await pool.query('SELECT 1');
    logger.info('Database connected');

    // Run migrations
    await runMigrations();

    // Connect to Kafka
    await eventPublisher.connect();

    // Start server
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Identity service started');
    });

    // Graceful shutdown
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
