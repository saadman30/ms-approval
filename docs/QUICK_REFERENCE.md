# Quick Reference Guide

## Service Ports

| Service | Port | Health Check |
|---------|------|--------------|
| API Gateway | 8080 | `http://localhost:8080/health` |
| Identity | 3001 | `http://localhost:3001/health` |
| Organization | 3002 | `http://localhost:3002/health` |
| Workflow | 3003 | `http://localhost:3003/health` |
| Billing | 3004 | `http://localhost:3004/health` |
| Notification | 3005 | `http://localhost:3005/health` |
| Audit | 3006 | `http://localhost:3006/health` |
| Analytics | 3007 | `http://localhost:3007/health` |

## Database Ports

| Service | Database | Port |
|---------|----------|------|
| Identity | `identity` | 5432 |
| Organization | `organization` | 5433 |
| Workflow | `workflow` | 5434 |
| Billing | `billing` | 5435 |
| Audit | `audit` | 5436 |
| Analytics | `analytics` | 5437 |
| Notification | `notification` | 5432 |

## Kafka Topics

| Topic | Producer | Key Consumers |
|-------|----------|---------------|
| `identity.user.registered` | Identity | Audit |
| `identity.user.logged-in` | Identity | Audit |
| `identity.user.logged-out` | Identity | Audit |
| `identity.password.reset-requested` | Identity | Notification, Audit |
| `organization.created` | Organization | Billing, Audit |
| `organization.deleted` | Organization | Workflow, Audit |
| `organization.member.added` | Organization | Workflow, Audit |
| `organization.member.removed` | Organization | Workflow, Audit |
| `organization.role.changed` | Organization | Workflow, Audit |
| `organization.invitation.sent` | Organization | Notification, Audit |
| `billing.subscription.activated` | Billing | Analytics, Audit |
| `billing.subscription.changed` | Billing | Analytics, Audit |
| `billing.subscription.cancelled` | Billing | Audit |
| `billing.entitlements.updated` | Billing | Workflow, Audit |
| `workflow.project.created` | Workflow | Analytics, Audit |
| `workflow.project.archived` | Workflow | Audit |
| `workflow.task.created` | Workflow | Analytics, Audit |
| `workflow.task.updated` | Workflow | Audit |
| `workflow.task.assigned` | Workflow | Notification, Audit |
| `workflow.task.status-changed` | Workflow | Analytics, Audit |

## Common API Endpoints

### Authentication (Public)
```bash
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### Organizations
```bash
POST /orgs
GET /orgs/:id
DELETE /orgs/:id
POST /orgs/:id/members
DELETE /orgs/:id/members/:userId
POST /orgs/:id/invitations
```

### Workflow
```bash
POST /workflow/projects
GET /workflow/projects
POST /workflow/projects/:id/archive
POST /workflow/tasks
GET /workflow/tasks
PATCH /workflow/tasks/:id
```

### Billing
```bash
GET /billing/plans
POST /billing/subscriptions
GET /billing/entitlements/:organizationId
POST /billing/usage
```

## Environment Variables

### Common Variables
- `NODE_ENV` - Environment (development, production)
- `LOG_LEVEL` - Log level (info, warn, error, debug)
- `KAFKA_BROKERS` - Kafka broker URLs (comma-separated)
- `JAEGER_ENDPOINT` - Jaeger endpoint URL

### Service-Specific Variables

**Identity Service**:
- `JWT_SECRET` - JWT signing secret
- `JWT_ACCESS_EXPIRY` - Access token expiry (default: 15m)
- `JWT_REFRESH_EXPIRY` - Refresh token expiry (default: 7d)

**Database** (per service):
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

## Docker Commands

```bash
# Start all infrastructure
docker-compose up -d

# Stop all infrastructure
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]
```

## NPM Commands

```bash
# Install all dependencies
npm install

# Build all packages and services
npm run build

# Run tests
npm run test

# Lint code
npm run lint
```

## Service Development

```bash
# Start a service in development mode
cd services/[service-name]
npm run dev

# Build a service
npm run build

# Start a service
npm start
```

## Observability URLs

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000
- **Jaeger**: http://localhost:16686
- **Loki**: http://localhost:3100

## Common Patterns

### Creating an Event
```typescript
const event = createEvent(
  'EventType',
  'v1',
  { /* event data */ },
  {
    source: 'service-name',
    correlationId: getCorrelationId(),
    userId: userId,
    organizationId: organizationId,
  }
);
```

### Publishing an Event
```typescript
await eventPublisher.publish('topic.name', event);
```

### Consuming an Event
```typescript
await this.consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    await this.handleEvent(event);
  },
});
```

### Database Query
```typescript
const result = await pool.query(
  'SELECT * FROM table WHERE id = $1',
  [id]
);
```

### Error Handling
```typescript
try {
  // Operation
} catch (error) {
  logger.error({ error, context }, 'Operation failed');
  throw new Error('User-friendly message');
}
```

## Troubleshooting

### Service won't start
1. Check database connection
2. Check Kafka connection
3. Check port availability
4. Check logs: `docker-compose logs [service-name]`

### Events not being consumed
1. Check Kafka is running: `docker-compose ps redpanda`
2. Check consumer group: Kafka UI or CLI
3. Check service logs for errors
4. Verify topic exists

### Database connection errors
1. Check database is running: `docker-compose ps postgres-*`
2. Check connection string in environment variables
3. Check database credentials
4. Check network connectivity

### Token validation fails
1. Check Identity Service is running
2. Check JWT_SECRET is set
3. Check token expiry
4. Check API Gateway can reach Identity Service
