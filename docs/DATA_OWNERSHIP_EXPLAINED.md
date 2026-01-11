# Data Ownership Matrix - Purpose and Explanation

## What is a Data Ownership Matrix?

A **Data Ownership Matrix** is a document that explicitly defines which microservice owns and controls each piece of data in the system. It's a critical architectural artifact that enforces the fundamental microservices principle: **"One service = one database"** and **"No service may read another service's database."**

## Why is it Critical?

### 1. **Enforces Service Boundaries**

In microservices, services must be **loosely coupled** and **independently deployable**. The data ownership matrix makes it crystal clear:

- ✅ **What data each service can directly access**
- ❌ **What data each service must NOT access directly**

**Example from our system:**
- ✅ Workflow Service can directly read/write `projects` and `tasks`
- ❌ Workflow Service CANNOT directly read `organizations` or `subscriptions`
- ✅ Workflow Service must use cached data or events to get organization/membership info

### 2. **Prevents Database Coupling**

**The Problem Without Data Ownership:**
```
Service A ──reads──> Shared Database <──reads── Service B
```
This creates tight coupling:
- If Service A changes the schema, Service B breaks
- Services can't be deployed independently
- Database becomes a bottleneck
- Changes require coordination across teams

**The Solution With Data Ownership:**
```
Service A ──owns──> Database A
Service B ──owns──> Database B
Service A ──events──> Service B (async communication)
```
- Each service has its own database
- Services communicate via events
- Independent deployment and evolution

### 3. **Clarifies Data Access Patterns**

The matrix answers critical questions:

**Question**: "How does Workflow Service know if a user is a member of an organization?"

**Answer from Matrix**:
- Workflow Service does NOT query Organization Service's database
- Workflow Service maintains a **membership cache** (from events)
- Cache is updated when `MemberAdded` or `MemberRemoved` events are received
- If cache miss: **Fail closed** (reject request for security)

**Question**: "How does Workflow Service enforce plan limits?"

**Answer from Matrix**:
- Workflow Service does NOT query Billing Service's database
- Workflow Service maintains an **entitlements cache** (from events)
- Cache is updated when `EntitlementsUpdated` events are received
- If cache miss: **Fail open** (allow with default limits for availability)

### 4. **Defines Caching Strategy**

The matrix shows:
- **What data is cached** (and why)
- **Where caches live** (which service)
- **How caches are updated** (via events)
- **Cache consistency model** (eventually consistent)

**Example from our matrix:**

| Data Entity | Owner | Cached In | Update Strategy |
|------------|-------|-----------|-----------------|
| Membership | Organization Service | Workflow Service | Event-driven (MemberAdded/Removed) |
| Entitlements | Billing Service | Workflow Service | Event-driven (EntitlementsUpdated) |

### 5. **Prevents Architectural Violations**

When a developer asks: *"Can I just query the organization table from workflow service?"*

**The matrix says NO** - and explains why:
- Organization Service owns organizations
- Workflow Service must use cached membership data
- If cache is stale, that's acceptable (eventual consistency)

### 6. **Guides Event Design**

The matrix helps determine:
- **What events need to be published** (when data changes)
- **What events need to be consumed** (to update caches)
- **Event payload requirements** (what data consumers need)

**Example:**
- Organization Service publishes `MemberAdded` event
- Workflow Service consumes it to update membership cache
- Event must include: `organizationId`, `userId`, `role` (needed for cache)

## How It's Used in Our Project

### Our Data Ownership Matrix Structure

```markdown
| Data Entity | Owner Service | Access Pattern | Replication Strategy |
|------------|---------------|----------------|---------------------|
| User | Identity Service | Direct read/write | None - source of truth |
| Organization | Organization Service | Direct read/write | Cached in Workflow Service |
| Membership | Organization Service | Direct read/write | Cached in Workflow Service |
| Entitlement | Billing Service | Direct read/write | Cached in Workflow Service |
| Project | Workflow Service | Direct read/write | None |
| Task | Workflow Service | Direct read/write | None |
```

### Real-World Example: Creating a Task

**Scenario**: User wants to create a task in a project.

**Step-by-step using the Data Ownership Matrix:**

1. **Workflow Service receives request**
   - User ID: `user-123`
   - Organization ID: `org-456`
   - Project ID: `project-789`

2. **Verify membership** (using cached data, NOT direct DB query)
   ```
   ❌ WRONG: SELECT * FROM organizations.memberships WHERE user_id = 'user-123'
   ✅ CORRECT: Check membership_cache table in Workflow Service
   ```
   - Matrix says: Membership is owned by Organization Service
   - Workflow Service uses its own cache (updated via events)

3. **Check entitlements** (using cached data, NOT direct DB query)
   ```
   ❌ WRONG: SELECT * FROM billing.entitlements WHERE organization_id = 'org-456'
   ✅ CORRECT: Check entitlements_cache table in Workflow Service
   ```
   - Matrix says: Entitlements are owned by Billing Service
   - Workflow Service uses its own cache (updated via events)

4. **Create task** (direct write to own database)
   ```
   ✅ CORRECT: INSERT INTO workflow.tasks ...
   ```
   - Matrix says: Tasks are owned by Workflow Service
   - Direct write is allowed

5. **Publish event** (notify other services)
   ```
   ✅ CORRECT: Publish TaskCreated event
   ```
   - Analytics Service consumes it (for metrics)
   - Audit Service consumes it (for logging)

## Benefits of Data Ownership Matrix

### 1. **Clear Boundaries**
- Developers know exactly what they can and cannot do
- No ambiguity about data access

### 2. **Prevents Technical Debt**
- Stops "quick fixes" that violate architecture
- Prevents database coupling before it happens

### 3. **Enables Independent Evolution**
- Services can change their schemas without breaking others
- Services can be refactored independently

### 4. **Improves Performance**
- Services use local caches (fast)
- No cross-service database queries (slow)
- Event-driven updates (async, non-blocking)

### 5. **Enhances Security**
- Clear data isolation
- Services can't accidentally access sensitive data
- Multi-tenancy enforced at service level

### 6. **Facilitates Team Autonomy**
- Teams know their data boundaries
- Teams can work independently
- Less coordination needed

## Common Anti-Patterns Prevented

### ❌ Anti-Pattern 1: Direct Database Access

**Bad:**
```typescript
// In Workflow Service
const membership = await organizationDb.query(
  'SELECT * FROM memberships WHERE user_id = $1',
  [userId]
);
```

**Why it's bad:**
- Violates service boundaries
- Creates tight coupling
- Breaks independent deployment

**Good (using matrix):**
```typescript
// In Workflow Service
const membership = await cacheRepository.getMembership(organizationId, userId);
// Cache updated via MemberAdded event
```

### ❌ Anti-Pattern 2: Shared Database

**Bad:**
```
All services → Shared PostgreSQL database
```

**Why it's bad:**
- Single point of failure
- Schema changes affect all services
- Can't scale independently

**Good (using matrix):**
```
Identity Service → identity database
Organization Service → organization database
Workflow Service → workflow database
// Each service has its own database
```

### ❌ Anti-Pattern 3: Synchronous Data Fetching

**Bad:**
```typescript
// In Workflow Service
const entitlements = await billingService.getEntitlements(organizationId);
// Synchronous HTTP call
```

**Why it's bad:**
- Creates dependency chain
- If Billing Service is down, Workflow Service fails
- Slow (network latency)

**Good (using matrix):**
```typescript
// In Workflow Service
const entitlements = await cacheRepository.getEntitlements(organizationId);
// Local cache, updated via events
// Fast and resilient
```

## Cache Consistency Trade-offs

The matrix explicitly documents trade-offs:

### Membership Cache (Security-Critical)
- **Strategy**: Fail closed
- **Reason**: Security - can't allow unauthorized access
- **Trade-off**: May reject valid requests if cache is stale
- **Acceptable**: Better to be secure than available

### Entitlements Cache (Availability-Critical)
- **Strategy**: Fail open
- **Reason**: Availability - can't block users if billing is down
- **Trade-off**: May allow operations that exceed limits temporarily
- **Acceptable**: Better to be available than strict

## How to Use the Matrix

### For Developers

1. **Before writing code**, check the matrix:
   - "Do I need data from another service?"
   - "Who owns this data?"
   - "How should I access it?"

2. **When designing features**, reference the matrix:
   - "What events do I need to publish?"
   - "What events do I need to consume?"
   - "What caches do I need to maintain?"

### For Architects

1. **When adding new services**, update the matrix:
   - "What data does this service own?"
   - "What data does it need from others?"
   - "How will it access that data?"

2. **When reviewing code**, check against matrix:
   - "Is this service accessing data it shouldn't?"
   - "Are caches being updated correctly?"
   - "Are events being published for data changes?"

### For Operations

1. **When deploying**, use matrix to understand:
   - "Which databases need backups?"
   - "Which services depend on which databases?"
   - "What happens if a database goes down?"

## Summary

The **Data Ownership Matrix** is not just documentation—it's an **architectural contract** that:

1. ✅ **Enforces boundaries** - Prevents services from coupling via databases
2. ✅ **Clarifies access patterns** - Shows how services get data they need
3. ✅ **Defines caching strategy** - Documents what's cached and why
4. ✅ **Prevents violations** - Stops architectural anti-patterns
5. ✅ **Enables independence** - Allows services to evolve separately
6. ✅ **Improves performance** - Promotes local caches over remote queries
7. ✅ **Enhances security** - Enforces data isolation

**Without a data ownership matrix**, teams will inevitably:
- Create database coupling
- Build synchronous dependencies
- Violate service boundaries
- Create technical debt

**With a data ownership matrix**, teams have:
- Clear guidelines
- Enforced boundaries
- Independent services
- Scalable architecture

---

**Key Takeaway**: The Data Ownership Matrix is the **single source of truth** for answering the question: *"Who owns this data, and how do I access it?"*
