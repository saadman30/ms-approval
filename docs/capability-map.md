# Capability Map

## Business Capabilities

### 1. Identity Management
- **Owner**: Identity Service
- **Capabilities**:
  - User registration and profile management
  - Authentication (login/logout)
  - Token issuance and validation
  - Password management (reset, change)
  - Multi-factor authentication (MFA)
- **Exposed APIs**: `/auth/*`
- **Events Consumed**: None (entry point)
- **Events Emitted**: `UserRegistered`, `UserLoggedIn`, `UserLoggedOut`, `PasswordResetRequested`

### 2. Organization & Membership Management
- **Owner**: Organization Service
- **Capabilities**:
  - Organization lifecycle (create, update, delete)
  - User membership management
  - Role-based access control (RBAC)
  - Invitation workflow
- **Exposed APIs**: `/orgs/*`, `/memberships/*`
- **Events Consumed**: `UserRegistered` (from Identity)
- **Events Emitted**: `OrganizationCreated`, `OrganizationUpdated`, `OrganizationDeleted`, `MemberAdded`, `MemberRemoved`, `RoleChanged`, `InvitationSent`, `InvitationAccepted`

### 3. Subscription & Billing
- **Owner**: Billing Service
- **Capabilities**:
  - Plan management (create, update plans)
  - Subscription lifecycle (activate, upgrade, downgrade, cancel)
  - Entitlement management
  - Usage tracking and limits
- **Exposed APIs**: `/subscriptions/*`, `/plans/*`, `/entitlements/*`
- **Events Consumed**: `OrganizationCreated` (from Organization)
- **Events Emitted**: `SubscriptionActivated`, `SubscriptionChanged`, `SubscriptionCancelled`, `EntitlementsUpdated`, `UsageTracked`

### 4. Workflow Management
- **Owner**: Workflow Service
- **Capabilities**:
  - Project management (create, archive)
  - Task management (create, update, assign, change status)
  - Workflow state management
  - Plan limit enforcement (local cache)
- **Exposed APIs**: `/projects/*`, `/tasks/*`
- **Events Consumed**: 
  - `MemberAdded`, `MemberRemoved` (from Organization)
  - `EntitlementsUpdated` (from Billing)
  - `OrganizationDeleted` (from Organization - saga participant)
- **Events Emitted**: `ProjectCreated`, `ProjectArchived`, `TaskCreated`, `TaskUpdated`, `TaskAssigned`, `TaskStatusChanged`

### 5. Notification Delivery
- **Owner**: Notification Service
- **Capabilities**:
  - Email notification delivery
  - In-app notification storage
  - Webhook notification delivery
  - Notification preferences
- **Exposed APIs**: `/notifications/*` (read-only for in-app)
- **Events Consumed**: 
  - `InvitationSent` (from Organization)
  - `PasswordResetRequested` (from Identity)
  - `TaskAssigned` (from Workflow)
  - All business events for notification routing
- **Events Emitted**: None (sink service)

### 6. Audit & Compliance
- **Owner**: Audit Service
- **Capabilities**:
  - Immutable audit log recording
  - Security event tracking
  - Compliance query support
  - Event replay capability
- **Exposed APIs**: `/audit/*` (read-only queries)
- **Events Consumed**: All domain events (write-only consumer)
- **Events Emitted**: None (sink service)

### 7. Analytics & Reporting
- **Owner**: Analytics Service
- **Capabilities**:
  - Usage dashboards
  - Task throughput metrics
  - Subscription analytics
  - Business intelligence queries
- **Exposed APIs**: `/analytics/*` (read-only)
- **Events Consumed**: All domain events (read model builder)
- **Events Emitted**: None (sink service)

## Cross-Cutting Capabilities

### API Gateway
- **Responsibilities**:
  - Request routing
  - Token validation (synchronous call to Identity Service)
  - Rate limiting
  - Correlation ID injection
  - CORS handling

### Observability
- **Distributed Tracing**: OpenTelemetry + Jaeger
- **Metrics**: Prometheus
- **Logging**: Structured JSON logs (Pino) → Loki
