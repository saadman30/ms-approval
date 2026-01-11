# Why Caching is Needed for Membership and Entitlements

## The Problem: Frequent Cross-Service Data Needs

### Scenario: User Creates a Task

Every time a user creates a task, Workflow Service needs to answer two critical questions:

1. **"Is this user a member of this organization?"** (Security check)
2. **"Does this organization have permission to create more tasks?"** (Plan limit check)

### Without Caching (The Bad Way)

```typescript
// ❌ BAD: Synchronous HTTP calls every time
async function createTask(userId, organizationId, projectId) {
  // Call 1: Check membership
  const membership = await http.get(
    `http://organization-service/orgs/${organizationId}/members/${userId}`
  );
  if (!membership) {
    throw new Error('Not a member');
  }
  
  // Call 2: Check entitlements
  const entitlements = await http.get(
    `http://billing-service/entitlements/${organizationId}`
  );
  if (entitlements.maxTasks <= currentTaskCount) {
    throw new Error('Task limit reached');
  }
  
  // Finally create the task
  return await taskRepository.create(...);
}
```

**Problems with this approach:**

1. **Performance Issues**
   - 2 network round-trips per task creation
   - Each call: ~50-200ms latency
   - Total overhead: 100-400ms per request
   - If creating 100 tasks: 10-40 seconds of network overhead!

2. **Availability Issues**
   - If Organization Service is down → Can't create tasks
   - If Billing Service is down → Can't create tasks
   - Single point of failure for critical operations

3. **Scalability Issues**
   - Every task creation = 2 API calls
   - 1000 tasks/hour = 2000 API calls to other services
   - Overwhelms Organization and Billing services
   - Creates cascading failures

4. **Latency Issues**
   - User waits for 2 network calls before task is created
   - Poor user experience
   - High latency = unhappy users

## The Solution: Caching

### With Caching (The Good Way)

```typescript
// ✅ GOOD: Local cache lookups (fast!)
async function createTask(userId, organizationId, projectId) {
  // Check 1: Local cache (0.1ms)
  const membership = await cacheRepository.getMembership(organizationId, userId);
  if (!membership) {
    throw new Error('Not a member');
  }
  
  // Check 2: Local cache (0.1ms)
  const entitlements = await cacheRepository.getEntitlements(organizationId);
  if (entitlements.maxTasks <= currentTaskCount) {
    throw new Error('Task limit reached');
  }
  
  // Create task immediately
  return await taskRepository.create(...);
}
```

**Benefits:**

1. **Performance**
   - Cache lookup: ~0.1ms (database query)
   - vs Network call: ~50-200ms
   - **500-2000x faster!**

2. **Availability**
   - Works even if Organization/Billing services are down
   - Uses last known good state
   - Service continues operating

3. **Scalability**
   - No load on source services
   - Can handle high request volumes
   - Independent scaling

4. **User Experience**
   - Fast response times
   - No waiting for network calls
   - Smooth user experience

## Why These Specific Data Types?

### 1. Membership Data (Security-Critical)

**Why cache it?**

- **Checked on EVERY operation**: Every task creation, update, deletion
- **High frequency**: Thousands of checks per hour
- **Security requirement**: Must verify membership before allowing operations
- **Read-heavy**: Mostly reads, rarely changes

**Example frequency:**
```
User creates 10 tasks → 10 membership checks
User updates 5 tasks → 5 membership checks
User deletes 2 tasks → 2 membership checks
Total: 17 membership checks for one user session
```

Without caching: 17 network calls to Organization Service  
With caching: 17 local database queries (much faster!)

**Cache Update Strategy:**
```
Organization Service publishes: MemberAdded event
  ↓
Workflow Service consumes event
  ↓
Updates membership_cache table
  ↓
Future requests use cached data
```

### 2. Entitlements Data (Availability-Critical)

**Why cache it?**

- **Checked on EVERY resource creation**: Projects, tasks
- **Plan limit enforcement**: Must check before allowing creation
- **High frequency**: Every create operation
- **Availability requirement**: Can't block users if billing is down

**Example frequency:**
```
Organization creates 5 projects → 5 entitlement checks
Organization creates 50 tasks → 50 entitlement checks
Total: 55 entitlement checks per organization
```

Without caching: 55 network calls to Billing Service  
With caching: 55 local database queries (much faster!)

**Cache Update Strategy:**
```
Billing Service publishes: EntitlementsUpdated event
  ↓
Workflow Service consumes event
  ↓
Updates entitlements_cache table
  ↓
Future requests use cached data
```

## Cache Consistency: Eventual Consistency

### The Trade-off

**Question**: "What if the cache is stale?"

**Answer**: That's acceptable! The system is **eventually consistent**.

### How It Works

```
Time 0: User removed from organization
  ↓
Organization Service: Publishes MemberRemoved event
  ↓
Time 0.1s: Event in Kafka
  ↓
Time 0.2s: Workflow Service consumes event
  ↓
Time 0.3s: Cache updated
```

**Maximum staleness**: ~1 second (usually much less)

**Is this acceptable?**
- ✅ Yes, for most operations
- ✅ Better than blocking on network calls
- ✅ System continues operating

### Cache Invalidation

**Membership Cache:**
- Invalidated on: `MemberRemoved`, `RoleChanged` events
- Strategy: **Fail closed** (reject if cache miss - security critical)

**Entitlements Cache:**
- Invalidated on: `EntitlementsUpdated`, `SubscriptionCancelled` events
- Strategy: **Fail open** (allow with defaults if cache miss - availability critical)

## Real-World Performance Comparison

### Scenario: 1000 task creations per hour

**Without Caching:**
```
1000 tasks × 2 API calls = 2000 network calls
Average latency: 100ms per call
Total overhead: 200 seconds (3.3 minutes)
Load on Organization Service: 1000 requests/hour
Load on Billing Service: 1000 requests/hour
```

**With Caching:**
```
1000 tasks × 2 cache lookups = 2000 database queries
Average latency: 0.1ms per query
Total overhead: 0.2 seconds
Load on Organization Service: ~10 events/hour (only on changes)
Load on Billing Service: ~5 events/hour (only on changes)
```

**Improvement:**
- **1000x faster** (0.2s vs 200s)
- **100x less load** on source services
- **Better availability** (works if services are down)

## Why Not Cache Everything?

### What We DON'T Cache

**User Data:**
- ❌ Not cached in other services
- ✅ Accessed via events only when needed
- Reason: Rarely needed, changes frequently

**Project/Task Data:**
- ❌ Not cached elsewhere
- ✅ Owned by Workflow Service
- Reason: No other service needs it frequently

### What We DO Cache

**Membership:**
- ✅ Cached in Workflow Service
- Reason: Checked on every operation

**Entitlements:**
- ✅ Cached in Workflow Service
- Reason: Checked on every resource creation

## Cache Implementation Details

### Membership Cache Structure

```sql
CREATE TABLE membership_cache (
  organization_id UUID,
  user_id UUID,
  role VARCHAR(50),
  cached_at TIMESTAMP,
  PRIMARY KEY (organization_id, user_id)
);
```

**Update Flow:**
```
1. Organization Service: User added
2. Publishes: MemberAdded event
3. Workflow Service: Receives event
4. Updates: membership_cache table
5. Future requests: Use cache
```

### Entitlements Cache Structure

```sql
CREATE TABLE entitlements_cache (
  organization_id UUID PRIMARY KEY,
  max_projects INTEGER,
  max_tasks INTEGER,
  max_members INTEGER,
  features TEXT[],
  cached_at TIMESTAMP
);
```

**Update Flow:**
```
1. Billing Service: Subscription activated
2. Publishes: EntitlementsUpdated event
3. Workflow Service: Receives event
4. Updates: entitlements_cache table
5. Future requests: Use cache
```

## Failure Scenarios

### What Happens if Cache is Stale?

**Membership Cache Miss:**
```typescript
// Cache miss - user not in cache
const membership = await cacheRepository.getMembership(orgId, userId);
if (!membership) {
  // Fail closed: Reject request (security)
  throw new Error('Not a member');
}
```

**Why fail closed?**
- Security is more important than availability
- Better to reject a valid request than allow unauthorized access
- Cache will be updated soon via events

**Entitlements Cache Miss:**
```typescript
// Cache miss - entitlements not in cache
const entitlements = await cacheRepository.getEntitlements(orgId);
if (!entitlements) {
  // Fail open: Use default limits (availability)
  entitlements = { maxTasks: 100, maxProjects: 10 };
}
```

**Why fail open?**
- Availability is more important than strict limits
- Better to allow operations than block users
- Cache will be updated soon via events

## Cache TTL and Refresh

### TTL (Time To Live)

**Current Strategy:**
- TTL: 1 hour
- But: Event-driven invalidation (usually much faster)

**Why 1 hour?**
- Safety net if events are delayed
- Maximum acceptable staleness
- Rarely needed (events update cache quickly)

### Refresh Strategy

**Event-Driven (Primary):**
- Cache updated immediately when events arrive
- Usually < 1 second delay

**TTL-Based (Fallback):**
- If no events received for 1 hour
- Cache considered stale
- Next request triggers refresh (if needed)

## Summary: Why Caching is Essential

### For Membership

1. **Performance**: Checked on every operation (high frequency)
2. **Security**: Must verify membership before allowing operations
3. **Availability**: Service must work even if Organization Service is down
4. **Scalability**: Reduces load on Organization Service by 100x

### For Entitlements

1. **Performance**: Checked on every resource creation (high frequency)
2. **Plan Limits**: Must enforce subscription limits
3. **Availability**: Service must work even if Billing Service is down
4. **Scalability**: Reduces load on Billing Service by 100x

### The Alternative (Without Caching)

- ❌ Slow: 100-400ms overhead per operation
- ❌ Unreliable: Fails if other services are down
- ❌ Not scalable: Overwhelms source services
- ❌ Poor UX: Users wait for network calls

### With Caching

- ✅ Fast: 0.1ms cache lookups
- ✅ Reliable: Works with stale cache
- ✅ Scalable: Independent of source services
- ✅ Great UX: Instant responses

**Bottom Line**: Caching is not optional—it's **essential** for performance, availability, and scalability in a microservices architecture.
