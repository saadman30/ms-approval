# Enterprise Microservices Learning Project

A multi-tenant B2B SaaS workflow platform built as an event-driven microservices architecture for learning enterprise-scale patterns, trade-offs, and practices.

## Architecture Overview

This project implements 7 microservices following strict architectural boundaries:

1. **Identity Service** - Authentication and user management
2. **Organization Service** - Tenant and membership management
3. **Workflow Service** - Projects and tasks management
4. **Billing Service** - Subscriptions and entitlements
5. **Notification Service** - Multi-channel notification delivery
6. **Audit Service** - Immutable audit logging
7. **Analytics Service** - Event-sourced analytics

## Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: ExpressJS
- **Databases**: PostgreSQL (per service), Redis (notifications)
- **Messaging**: Apache Kafka / Redpanda
- **Observability**: OpenTelemetry, Prometheus, Loki, Jaeger
- **API Gateway**: NGINX / Traefik

## Project Structure

```
.
├── services/           # Microservices
│   ├── identity-service/
│   ├── organization-service/
│   ├── workflow-service/
│   ├── billing-service/
│   ├── notification-service/
│   ├── audit-service/
│   └── analytics-service/
├── packages/          # Shared packages
│   ├── events/        # Event schemas and types
│   ├── observability/ # Logging, metrics, tracing
│   └── common/        # Shared utilities
├── infrastructure/    # Docker, K8s configs
├── docs/              # Design artifacts
└── gateway/           # API Gateway config
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Kafka/Redpanda (via Docker)

### Local Development

1. **Start infrastructure**:
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build services**:
   ```bash
   npm run build
   ```

4. **Start services** (in separate terminals):
   ```bash
   cd services/identity-service && npm start
   cd services/organization-service && npm start
   # ... etc
   ```

### Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Architecture Guide](./docs/ARCHITECTURE_GUIDE.md)** - Complete system architecture documentation
- **[Quick Reference](./docs/QUICK_REFERENCE.md)** - Quick reference for ports, endpoints, and commands
- **[Capability Map](./docs/capability-map.md)** - Business capabilities and service ownership
- **[Event Schemas](./docs/event-schemas.md)** - All domain event definitions
- **[Data Ownership Matrix](./docs/data-ownership-matrix.md)** - Data ownership and access patterns
- **[Failure Mode Analysis](./docs/failure-mode-analysis.md)** - Failure scenarios and mitigation strategies
- **[Implementation Status](./IMPLEMENTATION_STATUS.md)** - Current implementation status

## Key Architectural Principles

1. **One service = one database** (no sharing)
2. **Async events for cross-service communication** (default)
3. **Synchronous calls only for auth and user-facing reads**
4. **Eventual consistency is expected**
5. **Design for failure first**

## Observability

All services implement:
- Structured JSON logging (Pino)
- Prometheus metrics
- OpenTelemetry distributed tracing
- Correlation IDs for request tracking

## License

MIT
