# Data Ownership Matrix

## Rule: Each service owns its data exclusively. No service may read another service's database.

| Data Entity | Owner Service | Access Pattern | Replication Strategy |
|------------|---------------|----------------|---------------------|
| **User** | Identity Service | Direct read/write | None - source of truth |
| **Credential** | Identity Service | Direct read/write | None - never replicated |
| **Session** | Identity Service | Direct read/write | None - ephemeral |
| **Organization** | Organization Service | Direct read/write | Cached in Workflow Service (membership only) |
| **Membership** | Organization Service | Direct read/write | Cached in Workflow Service (for authorization) |
| **Role** | Organization Service | Direct read/write | Cached in Workflow Service (for authorization) |
| **Invitation** | Organization Service | Direct read/write | None |
| **Subscription** | Billing Service | Direct read/write | None - source of truth |
| **Plan** | Billing Service | Direct read/write | None - source of truth |
| **Entitlement** | Billing Service | Direct read/write | Cached in Workflow Service (for limit enforcement) |
| **Usage** | Billing Service | Direct read/write | None |
| **Project** | Workflow Service | Direct read/write | None |
| **Task** | Workflow Service | Direct read/write | None |
| **Workflow State** | Workflow Service | Direct read/write | None |
| **Notification** | Notification Service | Direct read/write | None |
| **Audit Log** | Audit Service | Append-only write | None - immutable |
| **Analytics Read Model** | Analytics Service | Derived from events | None - rebuilt from events |

## Caching Strategy

### Workflow Service Caches

1. **Membership Cache** (from Organization Service events)
   - Key: `membership:{organizationId}:{userId}`
   - TTL: 1 hour
   - Invalidation: On `MemberRemoved`, `RoleChanged` events
   - Fallback: Reject request if cache miss (fail closed for security)

2. **Entitlement Cache** (from Billing Service events)
   - Key: `entitlements:{organizationId}`
   - TTL: 1 hour
   - Invalidation: On `EntitlementsUpdated`, `SubscriptionCancelled` events
   - Fallback: Use default limits (fail open for availability)

### Cache Consistency Model

- **Eventually Consistent**: Caches updated via events
- **Staleness Acceptable**: Up to 1 hour delay acceptable
- **Security vs Availability Trade-off**:
  - Membership: Fail closed (security critical)
  - Entitlements: Fail open (availability critical)

## Data Access Patterns

### Synchronous Reads (Allowed)
- Identity Service: Token validation (via API Gateway)
- Organization Service: Membership queries (via API Gateway, for user-facing reads)

### Asynchronous Reads (Default)
- All other cross-service data access via events
- Services maintain local read models/caches

## Saga Data Management

### Organization Deletion Saga
- **Coordinator**: Organization Service
- **Participants**: Workflow Service, Billing Service, Audit Service
- **Compensation**: 
  - Workflow: Restore archived projects (if possible)
  - Billing: Reactivate subscription (if within grace period)
  - Audit: Append compensation event (no rollback)
