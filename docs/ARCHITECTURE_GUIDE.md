# Architecture Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Principles](#architectural-principles)
3. [Service Architecture](#service-architecture)
4. [Data Architecture](#data-architecture)
5. [Event-Driven Architecture](#event-driven-architecture)
6. [API Design](#api-design)
7. [Security Architecture](#security-architecture)
8. [Observability](#observability)
9. [Deployment Architecture](#deployment-architecture)
10. [Failure Handling](#failure-handling)
11. [Development Guidelines](#development-guidelines)
12. [Testing Strategy](#testing-strategy)

---

## System Overview

### Business Domain

**Multi-tenant B2B SaaS: Subscription-based Workflow Platform**

The system enables organizations to manage projects and tasks with subscription-based access control and feature limits.

### Core Capabilities

1. **Identity Management** - User authentication and authorization
2. **Organization Management** - Multi-tenant organization and membership management
3. **Workflow Management** - Projects and tasks management
4. **Billing & Subscriptions** - Plan management and entitlement enforcement
5. **Notifications** - Multi-channel notification delivery
6. **Audit & Compliance** - Immutable audit logging
7. **Analytics** - Event-sourced analytics and reporting

### Technology Stack

- **Runtime**: Node.js 18+ with TypeScript (strict mode)
- **Framework**: ExpressJS
- **Databases**: PostgreSQL (per service), Redis (notifications)
- **Messaging**: Apache Kafka / Redpanda (Kafka-compatible)
- **API Gateway**: Node.js/Express with token validation
- **Observability**: 
  - Logging: Pino (structured JSON) → Loki
  - Metrics: Prometheus
  - Tracing: OpenTelemetry → Jaeger

---

## Architectural Principles

### Non-Negotiable Rules

1. **One Service = One Business Capability**
   - Each service owns a distinct business capability
   - Services are independently deployable

2. **One Service = One Database**
   - No shared databases between services
   - Each service has exclusive ownership of its data

3. **No Direct Database Access**
   - Services cannot read another service's database
   - Cross-service data access via events or APIs only

4. **Event-Driven by Default**
   - Cross-service communication defaults to async events
   - Synchronous calls only for:
     - Authentication (token validation)
     - User-facing read paths

5. **Eventual Consistency**
   - System is eventually consistent
   - Services must handle stale data gracefully

6. **Design for Failure**
   - Services must degrade gracefully
   - Partial outages are survivable

### Design Patterns

- **Event Sourcing**: Events are the source of truth
- **CQRS**: Command Query Responsibility Segregation
- **Saga Pattern**: Distributed transactions via orchestration
- **Circuit Breaker**: Prevent cascade failures
- **Outbox Pattern**: Reliable event publishing
- **Cache-Aside**: Local caching with event-driven invalidation

---

## Service Architecture

### Service Landscape

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│              (Token Validation & Routing)                  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Identity    │    │ Organization │    │   Workflow   │
│   Service    │    │   Service     │    │   Service    │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Billing    │    │ Notification │    │    Audit     │
│   Service    │    │   Service     │    │   Service    │
└──────────────┘    └──────────────┘    └──────────────┘
        │
        ▼
┌──────────────┐
│  Analytics   │
│   Service    │
└──────────────┘
```

### Service Details

#### 1. Identity Service

**Port**: 3001  
**Database**: PostgreSQL (`identity`)

**Responsibilities**:
- User registration and authentication
- JWT token issuance (access + refresh)
- Token validation
- Password management
- Session management
- MFA support (structure in place)

**Data Owned**:
- Users
- Credentials (hashed passwords)
- Sessions
- Password reset tokens
- MFA secrets

**APIs**:
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `POST /auth/validate` - Validate token (for API Gateway)

**Events Published**:
- `UserRegistered`
- `UserLoggedIn`
- `UserLoggedOut`
- `PasswordResetRequested`

**Dependencies**: None (entry point)

---

#### 2. Organization Service

**Port**: 3002  
**Database**: PostgreSQL (`organization`)

**Responsibilities**:
- Organization lifecycle (create, delete)
- Membership management
- Role-based access control (RBAC)
- Invitation workflow

**Data Owned**:
- Organizations
- Memberships
- Invitations

**APIs**:
- `POST /orgs` - Create organization
- `GET /orgs/:id` - Get organization
- `DELETE /orgs/:id` - Delete organization
- `POST /orgs/:id/members` - Add member
- `DELETE /orgs/:id/members/:userId` - Remove member
- `PATCH /orgs/:id/members/:userId/role` - Change role
- `POST /orgs/:id/invitations` - Send invitation
- `POST /orgs/invitations/:token/accept` - Accept invitation
- `POST /orgs/invitations/:token/reject` - Reject invitation

**Events Published**:
- `OrganizationCreated`
- `OrganizationDeleted`
- `MemberAdded`
- `MemberRemoved`
- `RoleChanged`
- `InvitationSent`

**Events Consumed**: `UserRegistered` (future enhancement)

---

#### 3. Billing Service

**Port**: 3004  
**Database**: PostgreSQL (`billing`)

**Responsibilities**:
- Plan management
- Subscription lifecycle
- Entitlement management
- Usage tracking

**Data Owned**:
- Plans
- Subscriptions
- Entitlements (cached for fast access)
- Usage records

**APIs**:
- `GET /billing/plans` - Get active plans
- `POST /billing/plans` - Create plan
- `POST /billing/subscriptions` - Create subscription
- `GET /billing/subscriptions/:organizationId` - Get subscription
- `PATCH /billing/subscriptions/:subscriptionId/plan` - Change plan
- `POST /billing/subscriptions/:subscriptionId/cancel` - Cancel subscription
- `GET /billing/entitlements/:organizationId` - Get entitlements
- `POST /billing/usage` - Track usage
- `GET /billing/usage/:organizationId` - Get usage

**Events Published**:
- `SubscriptionActivated`
- `SubscriptionChanged`
- `SubscriptionCancelled`
- `EntitlementsUpdated`

**Events Consumed**: `OrganizationCreated` (auto-create subscription)

---

#### 4. Workflow Service

**Port**: 3003  
**Database**: PostgreSQL (`workflow`)

**Responsibilities**:
- Project management
- Task management
- Plan limit enforcement (using cached entitlements)
- Membership verification (using cached membership data)

**Data Owned**:
- Projects
- Tasks
- Membership cache (from Organization events)
- Entitlements cache (from Billing events)

**APIs**:
- `POST /workflow/projects` - Create project
- `GET /workflow/projects` - Get projects
- `POST /workflow/projects/:id/archive` - Archive project
- `POST /workflow/tasks` - Create task
- `GET /workflow/tasks` - Get tasks
- `PATCH /workflow/tasks/:id` - Update task

**Events Published**:
- `ProjectCreated`
- `ProjectArchived`
- `TaskCreated`
- `TaskUpdated`
- `TaskAssigned`
- `TaskStatusChanged`

**Events Consumed**:
- `MemberAdded` (update membership cache)
- `MemberRemoved` (update membership cache)
- `RoleChanged` (update membership cache)
- `EntitlementsUpdated` (update entitlements cache)
- `OrganizationDeleted` (archive projects)

---

#### 5. Notification Service

**Port**: 3005  
**Database**: PostgreSQL (`notification`)

**Responsibilities**:
- Multi-channel notification delivery
- Email notifications
- In-app notifications
- Webhook notifications
- Idempotent event processing

**Data Owned**:
- Notifications
- Notification deliveries (for idempotency)

**APIs**:
- `GET /notifications` - Get user notifications
- `PATCH /notifications/:id/read` - Mark as read

**Events Published**: None (sink service)

**Events Consumed**:
- `InvitationSent` (send email)
- `PasswordResetRequested` (send email)
- `TaskAssigned` (send in-app notification)

---

#### 6. Audit Service

**Port**: 3006  
**Database**: PostgreSQL (`audit`)

**Responsibilities**:
- Immutable audit logging
- Compliance tracking
- Event recording

**Data Owned**:
- Audit logs (append-only)

**APIs**:
- `GET /audit` - Query audit logs (with filters)

**Events Published**: None (sink service)

**Events Consumed**: All domain events

---

#### 7. Analytics Service

**Port**: 3007  
**Database**: PostgreSQL (`analytics`)

**Responsibilities**:
- Event-sourced analytics
- Task throughput metrics
- Subscription analytics
- Usage dashboards

**Data Owned**:
- Task metrics (read model)
- Subscription analytics (read model)
- Usage dashboards (read model)

**APIs**:
- `GET /analytics/tasks` - Get task metrics
- `GET /analytics/subscriptions` - Get subscription analytics
- `GET /analytics/usage` - Get usage metrics

**Events Published**: None (sink service)

**Events Consumed**:
- `TaskCreated`
- `TaskStatusChanged`
- `ProjectCreated`
- `SubscriptionActivated`
- `SubscriptionChanged`

---

## Data Architecture

### Database Isolation

Each service has its own PostgreSQL database:

| Service | Database | Port |
|---------|----------|------|
| Identity | `identity` | 5432 |
| Organization | `organization` | 5433 |
| Workflow | `workflow` | 5434 |
| Billing | `billing` | 5435 |
| Audit | `audit` | 5436 |
| Analytics | `analytics` | 5437 |
| Notification | `notification` | 5432 (shared) |

### Data Ownership Matrix

| Data Entity | Owner Service | Access Pattern |
|------------|---------------|----------------|
| User | Identity | Direct read/write |
| Credential | Identity | Direct read/write |
| Session | Identity | Direct read/write |
| Organization | Organization | Direct read/write |
| Membership | Organization | Direct read/write, cached in Workflow |
| Invitation | Organization | Direct read/write |
| Plan | Billing | Direct read/write |
| Subscription | Billing | Direct read/write |
| Entitlement | Billing | Direct read/write, cached in Workflow |
| Usage | Billing | Direct read/write |
| Project | Workflow | Direct read/write |
| Task | Workflow | Direct read/write |
| Notification | Notification | Direct read/write |
| Audit Log | Audit | Append-only write |
| Analytics Read Model | Analytics | Derived from events |

### Caching Strategy

#### Workflow Service Caches

1. **Membership Cache**
   - Source: Organization Service events
   - Key: `membership:{organizationId}:{userId}`
   - TTL: 1 hour (event-driven invalidation)
   - Strategy: Fail closed (security critical)

2. **Entitlements Cache**
   - Source: Billing Service events
   - Key: `entitlements:{organizationId}`
   - TTL: 1 hour (event-driven invalidation)
   - Strategy: Fail open (availability critical)

### Data Consistency Model

- **Strong Consistency**: Within a service's own database
- **Eventual Consistency**: Across services via events
- **Cache Consistency**: Eventually consistent (updated via events)

---

## Event-Driven Architecture

### Event Flow

```
Service A (Producer) → Kafka Topic → Service B (Consumer)
```

### Event Schema

All events follow this base structure:

```typescript
interface BaseEvent {
  eventId: string;          // UUID (for idempotency)
  eventType: string;        // e.g., "OrganizationCreated"
  eventVersion: string;     // e.g., "v1"
  timestamp: string;        // ISO 8601
  source: string;           // Service name
  correlationId: string;    // For tracing
  traceId?: string;         // OpenTelemetry trace ID
  userId?: string;          // Actor (if applicable)
  organizationId?: string;  // Tenant context (if applicable)
  metadata?: Record<string, any>;
  data: any;                // Event-specific data
}
```

### Event Topics

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `identity.user.registered` | Identity | Organization, Audit |
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

### Event Versioning

- Events are versioned (v1, v2, ...)
- Backward compatibility maintained for at least 2 versions
- Consumers must handle multiple versions
- Deprecation notice in metadata for old versions

### Idempotency

- All event consumers must be idempotent
- Check `eventId` before processing
- Use database unique constraints where applicable
- Event replay supported via `eventId` deduplication

### Event Ordering

- Events are ordered within a partition key (organizationId or userId)
- Partition key ensures related events are processed in order
- Cross-partition events may be processed out of order (acceptable)

---

## API Design

### API Gateway

**Port**: 8080  
**URL**: `http://localhost:8080`

**Responsibilities**:
- Request routing
- Token validation (synchronous call to Identity Service)
- Token caching (5 minute TTL)
- Correlation ID injection
- CORS handling

### API Routes

| Route | Service | Auth Required |
|-------|---------|---------------|
| `/auth/*` | Identity | No |
| `/orgs/*` | Organization | Yes |
| `/workflow/*` | Workflow | Yes |
| `/billing/*` | Billing | Yes |
| `/notifications/*` | Notification | Yes |
| `/audit/*` | Audit | Yes |
| `/analytics/*` | Analytics | Yes |

### Authentication Flow

```
1. Client → POST /auth/login
2. Identity Service → Returns { accessToken, refreshToken }
3. Client → API Request with Header: Authorization: Bearer {accessToken}
4. API Gateway → Validates token with Identity Service
5. API Gateway → Adds X-User-ID header
6. API Gateway → Routes to target service
```

### Request Headers

- `Authorization: Bearer <token>` - Required for authenticated endpoints
- `X-Correlation-ID` - Optional (auto-generated if missing)
- `X-Organization-ID` - Optional (for organization-scoped operations)
- `X-User-ID` - Set by API Gateway after token validation

### Response Format

**Success Response**:
```json
{
  "data": { ... },
  "metadata": {
    "correlationId": "uuid",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "details": { ... },
  "correlationId": "uuid",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Security Architecture

### Authentication

- **Method**: JWT (JSON Web Tokens)
- **Access Token**: Short-lived (15 minutes)
- **Refresh Token**: Long-lived (7 days)
- **Validation**: Synchronous call to Identity Service (via API Gateway)

### Authorization

- **Method**: RBAC (Role-Based Access Control)
- **Scope**: Organization-scoped
- **Roles**: `owner`, `admin`, `member`, `viewer`
- **Enforcement**: Workflow Service (using cached membership data)

### Token Security

- Tokens signed with secret key (JWT_SECRET)
- Tokens contain minimal claims (userId only)
- Refresh tokens stored hashed in database
- Token validation cached for 5 minutes (API Gateway)

### Multi-Tenancy

- **Isolation**: Organization-scoped data
- **Enforcement**: Database queries filtered by organizationId
- **Cache**: Membership verified before operations
- **Strategy**: Fail closed for security (reject on cache miss)

### Data Protection

- Passwords: Hashed with bcrypt (10 rounds)
- Sensitive data: Never logged
- Audit: All security-sensitive actions logged
- Encryption: TLS for all external communication

---

## Observability

### Logging

**Format**: Structured JSON (Pino)

**Fields**:
- `timestamp` - ISO 8601
- `level` - info, warn, error, debug
- `service` - Service name
- `correlationId` - Request correlation ID
- `traceId` - OpenTelemetry trace ID
- `message` - Log message
- `context` - Additional context

**Example**:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "service": "identity-service",
  "correlationId": "abc-123",
  "traceId": "xyz-789",
  "message": "User logged in",
  "userId": "user-123"
}
```

**Aggregation**: Loki

### Metrics

**Format**: Prometheus

**Key Metrics**:
- `http_request_duration_seconds` - Request latency
- `http_requests_total` - Request count
- `http_request_errors_total` - Error count
- `db_query_duration_seconds` - Database query latency
- `db_connections_active` - Active database connections
- `kafka_messages_consumed_total` - Kafka messages consumed
- `kafka_messages_produced_total` - Kafka messages produced
- `kafka_consumer_lag` - Consumer lag
- `business_events_processed_total` - Business events processed

**Aggregation**: Prometheus  
**Visualization**: Grafana

### Tracing

**Format**: OpenTelemetry

**Trace Propagation**:
- `traceId` propagated via headers
- `correlationId` for request correlation
- Distributed tracing across services

**Visualization**: Jaeger

### Health Checks

All services expose `/health` endpoint:

```json
{
  "status": "healthy",
  "service": "identity-service",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Metrics Endpoint

All services expose `/metrics` endpoint (Prometheus format).

---

## Deployment Architecture

### Local Development

**Docker Compose**:
- All services runnable via `docker-compose up`
- Infrastructure services included:
  - Redpanda (Kafka)
  - PostgreSQL (per service)
  - Redis
  - Prometheus
  - Jaeger
  - Loki
  - Grafana

**Service Ports**:
- Identity: 3001
- Organization: 3002
- Workflow: 3003
- Billing: 3004
- Notification: 3005
- Audit: 3006
- Analytics: 3007
- API Gateway: 8080

### Production Deployment

**Container Strategy**:
- Each service has its own Dockerfile
- No multi-service containers
- Independent scaling per service

**Database Strategy**:
- One database per service
- No shared databases
- Connection pooling per service

**Kafka Strategy**:
- Topic partitioning by organizationId/userId
- Consumer groups per service
- Dead-letter queues for failed events

### Scaling

**Horizontal Scaling**:
- Services scale independently
- Stateless services (except database connections)
- Load balancing via API Gateway

**Database Scaling**:
- Read replicas (future)
- Connection pooling
- Query optimization

### Rollout Strategy

**Deployment**:
- Rolling deployments
- Blue-green deployments (for critical services)
- Canary deployments (future)

**Rollback**:
- Database migrations are backward compatible
- Event versioning supports rollback
- Service versioning via Docker tags

---

## Failure Handling

### Failure Scenarios

See [Failure Mode Analysis](./failure-mode-analysis.md) for detailed scenarios.

### Mitigation Strategies

1. **Circuit Breakers**
   - Prevent cascade failures
   - Open circuit after threshold failures
   - Half-open state for recovery

2. **Retries**
   - Exponential backoff with jitter
   - Max retry attempts (3)
   - Idempotent operations only

3. **Timeouts**
   - All external calls have timeouts
   - Default: 2 seconds
   - Configurable per service

4. **Graceful Degradation**
   - Services continue with cached data
   - Fail open for availability (entitlements)
   - Fail closed for security (membership)

5. **Dead-Letter Queues**
   - Failed events sent to DLQ
   - Manual inspection and replay
   - Alerting on DLQ size

### Saga Pattern

**Organization Deletion Saga**:

1. Organization Service: Mark organization as deleted
2. Publish `OrganizationDeleted` event
3. Workflow Service: Archive all projects
4. Billing Service: Cancel subscription
5. Audit Service: Log final state
6. Compensation: If any step fails, rollback previous steps

---

## Development Guidelines

### Code Structure

```
service-name/
├── src/
│   ├── config/          # Configuration (database, etc.)
│   ├── migrations/      # Database migrations
│   ├── repositories/    # Data access layer
│   ├── services/        # Business logic
│   ├── events/          # Event publishers/consumers
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── types/           # TypeScript types
│   └── index.ts         # Entry point
├── package.json
├── tsconfig.json
└── Dockerfile
```

### Naming Conventions

- **Files**: kebab-case (`user.repository.ts`)
- **Classes**: PascalCase (`UserRepository`)
- **Functions**: camelCase (`createUser`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Events**: PascalCase (`UserRegistered`)

### Error Handling

```typescript
try {
  // Operation
} catch (error) {
  logger.error({ error, context }, 'Operation failed');
  throw new Error('User-friendly message');
}
```

### Event Publishing

```typescript
const event = createEvent(
  'EventType',
  'v1',
  { /* data */ },
  {
    source: 'service-name',
    correlationId: getCorrelationId(),
    userId: userId,
    organizationId: organizationId,
  }
);

await eventPublisher.publish('topic.name', event);
```

### Event Consumption

```typescript
await this.consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    try {
      const event = JSON.parse(message.value.toString());
      await this.handleEvent(event);
    } catch (error) {
      logger.error({ error, topic }, 'Failed to process event');
      // Send to DLQ
    }
  },
});
```

### Database Migrations

- Migrations run automatically on service startup
- Migrations are idempotent (check if table exists)
- No destructive migrations (only additive)

### Testing

- Unit tests for business logic
- Integration tests for API endpoints
- Event consumer tests
- End-to-end tests for critical flows

---

## Testing Strategy

### Unit Tests

- Test business logic in isolation
- Mock external dependencies
- Test error scenarios

### Integration Tests

- Test API endpoints
- Test database operations
- Test event publishing/consumption

### End-to-End Tests

- Test complete user flows
- Test cross-service interactions
- Test failure scenarios

### Load Testing

- Test under expected load
- Identify bottlenecks
- Test scaling behavior

### Chaos Testing

- Test service failures
- Test network partitions
- Test event duplication
- Test partial failures

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Request Latency** (p50, p95, p99)
2. **Error Rate** (4xx, 5xx)
3. **Database Connection Pool** (active, idle)
4. **Kafka Consumer Lag**
5. **Event Processing Rate**
6. **Cache Hit Rate**

### Alerts

- Service down (health check fails)
- High error rate (> 1%)
- High latency (p95 > 1s)
- Kafka consumer lag (> 1000 messages)
- Database connection pool exhausted

---

## Future Enhancements

1. **Rate Limiting** - Implement in API Gateway
2. **Dead-Letter Queue** - Proper DLQ handling
3. **Circuit Breakers** - Implement circuit breaker pattern
4. **Saga Orchestration** - Enhanced saga orchestration
5. **Email Integration** - Real email service integration
6. **Webhook Delivery** - Implement webhook delivery
7. **Kubernetes Manifests** - Production K8s deployment
8. **API Documentation** - OpenAPI/Swagger docs
9. **GraphQL Gateway** - Optional GraphQL layer
10. **Multi-Region** - Multi-region deployment support

---

## Glossary

- **Event**: Immutable fact that occurred in the system
- **Saga**: Distributed transaction pattern
- **CQRS**: Command Query Responsibility Segregation
- **Idempotency**: Operation can be safely retried
- **Eventual Consistency**: System will eventually be consistent
- **Circuit Breaker**: Pattern to prevent cascade failures
- **Correlation ID**: Unique ID for tracing requests across services
- **Trace ID**: OpenTelemetry trace identifier
- **Partition Key**: Kafka partition key for event ordering
- **Dead-Letter Queue**: Queue for failed events

---

## References

- [Capability Map](./capability-map.md)
- [Event Schemas](./event-schemas.md)
- [Data Ownership Matrix](./data-ownership-matrix.md)
- [Failure Mode Analysis](./failure-mode-analysis.md)
- [Implementation Status](../IMPLEMENTATION_STATUS.md)

---

**Last Updated**: 2024-01-01  
**Version**: 1.0.0
