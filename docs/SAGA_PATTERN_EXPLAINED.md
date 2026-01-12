# Saga Pattern Explained

## Table of Contents

1. [Introduction](#introduction)
2. [What is the Saga Pattern?](#what-is-the-saga-pattern)
3. [Why Do We Need Sagas?](#why-do-we-need-sagas)
4. [Types of Sagas](#types-of-sagas)
5. [Saga Pattern in This Project](#saga-pattern-in-this-project)
6. [Organization Deletion Saga: Detailed Example](#organization-deletion-saga-detailed-example)
7. [Compensation Logic](#compensation-logic)
8. [Failure Handling](#failure-handling)
9. [Implementation Details](#implementation-details)
10. [Best Practices](#best-practices)
11. [Future Enhancements](#future-enhancements)

---

## Introduction

In a microservices architecture, business operations often span multiple services. Unlike monolithic applications where you can use ACID transactions across a single database, microservices require a different approach to maintain data consistency across service boundaries.

The **Saga Pattern** is a design pattern that manages distributed transactions by breaking them into a series of local transactions, each with its own compensation action. This document explains how the Saga pattern is implemented in this microservices learning project, using the **Organization Deletion Saga** as a concrete example.

---

## What is the Saga Pattern?

The Saga pattern is a way to manage distributed transactions across multiple microservices. Instead of using a traditional two-phase commit (2PC) which requires locking resources across services, a Saga:

1. **Breaks a transaction into smaller, local transactions** - Each service performs its own local transaction
2. **Uses compensation for rollback** - If any step fails, compensating actions undo previous steps
3. **Maintains eventual consistency** - The system eventually reaches a consistent state, but not immediately

### Key Characteristics

- **No distributed locks** - Each service manages its own data
- **Eventual consistency** - System may be temporarily inconsistent
- **Compensation-based rollback** - Undo operations instead of rollback
- **Idempotent operations** - Steps can be safely retried

---

## Why Do We Need Sagas?

### The Problem: Distributed Transactions

In our microservices architecture, consider what happens when an organization is deleted:

```
┌─────────────────────────────────────────────────────────────┐
│  Organization Deletion Requires Multiple Services:           │
│                                                               │
│  1. Organization Service: Delete organization record        │
│  2. Workflow Service: Archive all projects                  │
│  3. Billing Service: Cancel subscription                    │
│  4. Audit Service: Log the deletion                         │
│                                                               │
│  What if step 2 succeeds but step 3 fails?                  │
│  → We have archived projects but active subscription!       │
└─────────────────────────────────────────────────────────────┘
```

### Why Not Traditional ACID Transactions?

Traditional ACID transactions don't work across microservices because:

1. **No shared database** - Each service has its own database (architectural rule)
2. **Network latency** - Locking resources across network is slow and unreliable
3. **Availability** - One service failure would block all services
4. **Scalability** - Distributed locks don't scale well

### The Saga Solution

Sagas solve this by:
- **Local transactions only** - Each service commits its own changes
- **Compensation on failure** - If a step fails, previous steps are undone
- **Event-driven coordination** - Services communicate via events
- **Eventual consistency** - System eventually becomes consistent

---

## Types of Sagas

There are two main approaches to implementing sagas:

### 1. Choreography-Based Saga (Event-Driven)

**How it works:**
- Each service listens for events and performs its action
- Services publish events when they complete their step
- No central coordinator
- Services decide what to do based on events

**Pros:**
- Decoupled services
- No single point of failure
- Easy to add new participants

**Cons:**
- Harder to understand the flow
- Difficult to track saga state
- Compensation logic scattered

**Example Flow:**
```
Organization Service → publishes "OrganizationDeleted"
    ↓
Workflow Service (listens) → archives projects → publishes "ProjectsArchived"
    ↓
Billing Service (listens) → cancels subscription → publishes "SubscriptionCancelled"
```

### 2. Orchestration-Based Saga (Central Coordinator)

**How it works:**
- A central orchestrator (saga coordinator) manages the flow
- Orchestrator tells each service what to do
- Services report back to orchestrator
- Orchestrator handles compensation

**Pros:**
- Clear flow control
- Centralized saga state
- Easier to understand and debug
- Better compensation handling

**Cons:**
- Single point of failure (orchestrator)
- Additional service to maintain
- More coupling

**Example Flow:**
```
Saga Orchestrator:
  1. Tell Organization Service: "Delete organization"
  2. Wait for confirmation
  3. Tell Workflow Service: "Archive projects"
  4. Wait for confirmation
  5. Tell Billing Service: "Cancel subscription"
  6. Wait for confirmation
```

### Our Project's Approach

**Currently: Choreography-Based** (Event-Driven)

Our project uses a choreography-based approach because:
- It aligns with our event-driven architecture
- Services are already decoupled via events
- No need for an additional orchestrator service
- Simpler to implement initially

**Future Enhancement: Hybrid Approach**

We could enhance this with:
- Saga state tracking in Organization Service
- Compensation events for rollback
- Saga status events for monitoring

---

## Saga Pattern in This Project

### Architectural Context

Our project follows these rules that make sagas necessary:

1. **One Service = One Database** - No shared databases
2. **No Direct Database Access** - Services can't read each other's databases
3. **Event-Driven by Default** - Cross-service communication via events
4. **Eventual Consistency** - System is eventually consistent

### Current Saga Implementation

We have one main saga in the project:

**Organization Deletion Saga**

This saga coordinates the deletion of an organization across multiple services:

```
┌─────────────────────────────────────────────────────────────┐
│                    Organization Deletion Saga                │
│                                                               │
│  Step 1: Organization Service                                 │
│    - Soft delete organization                                │
│    - Soft delete all memberships                            │
│    - Publish: OrganizationDeleted event                      │
│                                                               │
│  Step 2: Workflow Service (Event Consumer)                  │
│    - Archive all projects for organization                  │
│    - Clear entitlements cache                                │
│    - (No event published - passive participant)              │
│                                                               │
│  Step 3: Billing Service (Event Consumer)                    │
│    - Cancel subscription                                     │
│    - Clear entitlements                                     │
│    - Publish: SubscriptionCancelled event                   │
│                                                               │
│  Step 4: Audit Service (Event Consumer)                     │
│    - Log OrganizationDeleted event                          │
│    - (Immutable append-only log)                            │
│                                                               │
│  Note: Currently missing compensation logic                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Organization Deletion Saga: Detailed Example

Let's walk through the Organization Deletion Saga step by step, using actual code from the project.

### Step 1: Organization Service - Initiate Deletion

**Location:** `services/organization-service/src/services/organization.service.ts`

```typescript
async deleteOrganization(
  organizationId: string,
  deletedBy: string,
  correlationId?: string
) {
  // 1. Soft delete organization (local transaction)
  await this.organizationRepository.softDelete(organizationId, deletedBy);

  // 2. Soft delete all memberships (local transaction)
  const memberships = await this.membershipRepository.findByOrganization(
    organizationId
  );
  for (const membership of memberships) {
    await this.membershipRepository.softDelete(membership.id);
  }

  // 3. Publish event to trigger saga
  const event = createEvent(
    'OrganizationDeleted',
    'v1',
    {
      organizationId,
      deletedBy,
      deletedAt: new Date().toISOString(),
    },
    {
      source: 'organization-service',
      correlationId: correlationId || getCorrelationId(),
      userId: deletedBy,
      organizationId,
    }
  );

  await this.eventPublisher.publish('organization.deleted', event);
}
```

**What happens:**
1. Organization is soft-deleted (marked as deleted, not physically removed)
2. All memberships are soft-deleted
3. `OrganizationDeleted` event is published to Kafka topic `organization.deleted`
4. Event includes `correlationId` for tracing the saga

**Event Schema:**
```typescript
// From packages/events/src/index.ts
export const OrganizationDeletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('OrganizationDeleted'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    deletedBy: z.string().uuid(),
    deletedAt: z.string().datetime(),
  }),
});
```

**Key Points:**
- ✅ **Idempotent**: Can be called multiple times safely (soft delete checks `deleted_at IS NULL`)
- ✅ **Local transaction**: All operations in Organization Service's database
- ✅ **Event published**: Triggers other services to participate in saga

### Step 2: Workflow Service - Archive Projects

**Location:** `services/workflow-service/src/events/event-consumer.ts`

```typescript
private async handleOrganizationDeleted(event: any): Promise<void> {
  try {
    const validated = OrganizationDeletedEventSchema.parse(event);
    
    // 1. Archive all projects for this organization
    const projects = await this.projectRepository.findByOrganization(
      validated.data.organizationId
    );
    
    for (const project of projects) {
      await this.projectRepository.archive(project.id);
    }

    // 2. Clear caches
    await this.cacheRepository.deleteEntitlements(
      validated.data.organizationId
    );
    // Note: Membership cache will be cleaned up by MemberRemoved events

    logger.info(
      { organizationId: validated.data.organizationId }, 
      'Organization deleted - projects archived'
    );
  } catch (error) {
    logger.error({ error, event }, 'Failed to handle OrganizationDeleted event');
    // TODO: Send to dead-letter queue
  }
}
```

**What happens:**
1. Workflow Service consumes `OrganizationDeleted` event from Kafka
2. Finds all projects for the organization
3. Archives each project (local transaction in Workflow Service database)
4. Clears entitlements cache
5. Logs the operation

**Key Points:**
- ✅ **Idempotent**: Can process the same event multiple times (archiving is idempotent)
- ✅ **Local transaction**: All operations in Workflow Service's database
- ⚠️ **No compensation**: Currently no way to unarchive if saga fails later
- ⚠️ **No event published**: Doesn't notify other services of completion

**Event Subscription:**
```typescript
// From services/workflow-service/src/events/event-consumer.ts
await this.consumer.subscribe({
  topics: [
    'organization.member.added',
    'organization.member.removed',
    'organization.role.changed',
    'billing.entitlements.updated',
    'organization.deleted',  // ← Subscribed to saga event
  ],
  fromBeginning: false,
});
```

### Step 3: Billing Service - Cancel Subscription

**Current Status:** ⚠️ **Not Yet Implemented**

The Billing Service should consume `OrganizationDeleted` events and cancel subscriptions, but this is currently missing. Here's what it should look like:

**Expected Implementation:**
```typescript
// services/billing-service/src/events/event-consumer.ts
private async handleOrganizationDeleted(event: any): Promise<void> {
  try {
    const validated = OrganizationDeletedEventSchema.parse(event);
    
    // Find active subscription
    const subscription = await this.subscriptionRepository
      .findByOrganizationId(validated.data.organizationId);
    
    if (subscription && !subscription.cancelledAt) {
      // Cancel subscription immediately (not at period end)
      await this.billingService.cancelSubscription(
        subscription.id,
        false, // cancelAtPeriodEnd = false
        validated.correlationId
      );
    }

    logger.info(
      { organizationId: validated.data.organizationId }, 
      'Organization deleted - subscription cancelled'
    );
  } catch (error) {
    logger.error({ error, event }, 'Failed to handle OrganizationDeleted event');
    // TODO: Send to dead-letter queue and trigger compensation
  }
}
```

**What should happen:**
1. Billing Service consumes `OrganizationDeleted` event
2. Finds active subscription for the organization
3. Cancels subscription immediately
4. Publishes `SubscriptionCancelled` event
5. Clears entitlements

**Note:** This needs to be added to the Billing Service event consumer.

### Step 4: Audit Service - Log Deletion

**Location:** `services/audit-service/src/events/event-consumer.ts`

```typescript
async subscribe(): Promise<void> {
  // Subscribe to all topics (audit service consumes all events)
  await this.consumer.subscribe({
    topics: [
      // ... other topics ...
      'organization.deleted',  // ← Subscribed to saga event
      // ... other topics ...
    ],
    fromBeginning: false,
  });

  await this.consumer.run({
    eachMessage: async ({ topic, partition, message }: any) => {
      try {
        const event = JSON.parse(message.value.toString()) as BaseEvent;
        await this.auditService.recordEvent(event);
      } catch (error) {
        logger.error({ error, topic, partition }, 'Failed to process event');
      }
    },
  });
}
```

**What happens:**
1. Audit Service consumes `OrganizationDeleted` event
2. Records the event in append-only audit log
3. Event is immutable (cannot be deleted or modified)

**Key Points:**
- ✅ **Idempotent**: Event deduplication by `eventId`
- ✅ **Immutable**: Audit logs are append-only
- ⚠️ **No compensation**: Audit logs cannot be "undone" (by design)

---

## Compensation Logic

### What is Compensation?

Compensation is the "undo" operation for a saga step. Unlike traditional rollback, compensation doesn't restore the exact previous state—it performs a business operation that semantically undoes the original action.

### Compensation Examples

| Original Action | Compensation Action |
|----------------|-------------------|
| Archive project | Unarchive project |
| Cancel subscription | Reactivate subscription (if within grace period) |
| Delete organization | Restore organization (soft delete → active) |
| Remove member | Re-add member with previous role |

### Current State: Missing Compensation

**Problem:** Our current implementation doesn't have compensation logic. If any step fails after the organization is deleted, we can't rollback.

**Example Failure Scenario:**
```
1. ✅ Organization Service: Organization deleted
2. ✅ Workflow Service: Projects archived
3. ❌ Billing Service: Fails to cancel subscription (service down)
4. ❌ Result: Organization deleted, projects archived, but subscription still active!
```

### How Compensation Should Work

Here's how we should implement compensation:

#### 1. Saga State Tracking

Track the saga state in Organization Service:

```typescript
// services/organization-service/src/repositories/saga.repository.ts
interface SagaState {
  sagaId: string;
  correlationId: string;
  organizationId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'compensating' | 'failed';
  steps: {
    step: string;
    service: string;
    status: 'pending' | 'completed' | 'failed';
    completedAt?: Date;
    compensationData?: any;
  }[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2. Compensation Events

Publish compensation events when a step fails:

```typescript
// Organization Service publishes compensation event
const compensationEvent = createEvent(
  'OrganizationDeletionCompensated',
  'v1',
  {
    organizationId,
    sagaId,
    failedStep: 'billing.cancel_subscription',
    compensationRequired: [
      { service: 'workflow', action: 'unarchive_projects' },
      { service: 'organization', action: 'restore_organization' },
    ],
  },
  {
    source: 'organization-service',
    correlationId,
    organizationId,
  }
);

await this.eventPublisher.publish('organization.deletion.compensated', compensationEvent);
```

#### 3. Compensation Handlers

Each service handles compensation:

```typescript
// services/workflow-service/src/events/event-consumer.ts
private async handleOrganizationDeletionCompensated(event: any): Promise<void> {
  const validated = OrganizationDeletionCompensatedEventSchema.parse(event);
  
  // Unarchive projects
  const projects = await this.projectRepository.findArchivedByOrganization(
    validated.data.organizationId
  );
  
  for (const project of projects) {
    await this.projectRepository.unarchive(project.id);
  }
  
  logger.info(
    { organizationId: validated.data.organizationId }, 
    'Compensation: Projects unarchived'
  );
}
```

#### 4. Saga Orchestration Pattern (Future Enhancement)

For better compensation handling, we could implement an orchestration pattern:

```typescript
// services/organization-service/src/sagas/organization-deletion.saga.ts
export class OrganizationDeletionSaga {
  async execute(organizationId: string, deletedBy: string): Promise<void> {
    const sagaId = randomUUID();
    const sagaState = await this.sagaRepository.create({
      sagaId,
      organizationId,
      status: 'in_progress',
      steps: [
        { step: 'delete_organization', service: 'organization', status: 'pending' },
        { step: 'archive_projects', service: 'workflow', status: 'pending' },
        { step: 'cancel_subscription', service: 'billing', status: 'pending' },
        { step: 'log_audit', service: 'audit', status: 'pending' },
      ],
    });

    try {
      // Step 1: Delete organization
      await this.organizationService.deleteOrganization(organizationId, deletedBy);
      await this.sagaRepository.markStepCompleted(sagaId, 'delete_organization');

      // Step 2: Wait for projects to be archived (or call directly)
      await this.waitForEvent('ProjectsArchived', sagaId, timeout);
      await this.sagaRepository.markStepCompleted(sagaId, 'archive_projects');

      // Step 3: Cancel subscription
      await this.billingService.cancelSubscriptionByOrganization(organizationId);
      await this.sagaRepository.markStepCompleted(sagaId, 'cancel_subscription');

      // Step 4: Audit (always succeeds, no compensation needed)
      await this.sagaRepository.markStepCompleted(sagaId, 'log_audit');

      await this.sagaRepository.updateStatus(sagaId, 'completed');
    } catch (error) {
      await this.compensate(sagaId, error);
    }
  }

  private async compensate(sagaId: string, error: Error): Promise<void> {
    await this.sagaRepository.updateStatus(sagaId, 'compensating');
    
    const sagaState = await this.sagaRepository.findById(sagaId);
    const completedSteps = sagaState.steps.filter(s => s.status === 'completed');

    // Compensate in reverse order
    for (const step of completedSteps.reverse()) {
      try {
        await this.executeCompensation(step);
        await this.sagaRepository.markStepCompensated(sagaId, step.step);
      } catch (compError) {
        // Log compensation failure - may need manual intervention
        logger.error({ sagaId, step, compError }, 'Compensation failed');
      }
    }

    await this.sagaRepository.updateStatus(sagaId, 'failed');
  }
}
```

---

## Failure Handling

### Failure Scenarios

#### Scenario 1: Event Not Delivered

**Problem:** Kafka fails to deliver `OrganizationDeleted` event to Workflow Service.

**Current Behavior:**
- Organization is deleted
- Projects remain active
- Inconsistent state

**Mitigation:**
1. **Idempotent retry**: Organization Service can republish event
2. **Dead-letter queue**: Failed events go to DLQ for manual processing
3. **Reconciliation job**: Periodic job checks for orphaned projects

**Implementation:**
```typescript
// Organization Service: Retry logic
async deleteOrganization(organizationId: string, deletedBy: string) {
  // ... delete organization ...
  
  // Publish with retry
  await this.eventPublisher.publishWithRetry(
    'organization.deleted',
    event,
    { maxRetries: 3, backoff: 'exponential' }
  );
}
```

#### Scenario 2: Service Down During Saga

**Problem:** Workflow Service is down when `OrganizationDeleted` event is published.

**Current Behavior:**
- Event sits in Kafka until service recovers
- Saga continues when service comes back online
- Eventual consistency achieved

**Mitigation:**
1. **Kafka consumer groups**: Events are not lost
2. **Idempotent processing**: Safe to process same event multiple times
3. **Monitoring**: Alert on consumer lag

#### Scenario 3: Partial Failure

**Problem:** Organization deleted, projects archived, but subscription cancellation fails.

**Current Behavior:**
- Inconsistent state (no compensation)

**Mitigation (Future):**
1. **Compensation events**: Trigger rollback
2. **Saga state tracking**: Know which steps completed
3. **Manual intervention**: Admin can trigger compensation

### Best Practices for Failure Handling

1. **Idempotency**: All saga steps must be idempotent
2. **Timeout handling**: Set timeouts for each step
3. **Dead-letter queues**: Failed events go to DLQ
4. **Monitoring**: Track saga completion rates
5. **Alerting**: Alert on saga failures
6. **Manual intervention**: Admin tools for compensation

---

## Implementation Details

### Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Organization Deletion Saga Flow                 │
└─────────────────────────────────────────────────────────────┘

1. API Request
   DELETE /orgs/:id
   ↓
2. Organization Service
   ├─ Soft delete organization (local transaction)
   ├─ Soft delete memberships (local transaction)
   └─ Publish: OrganizationDeleted event
      Topic: organization.deleted
      ↓
3. Kafka Topic: organization.deleted
   ├─→ Workflow Service Consumer
   │   ├─ Archive all projects
   │   ├─ Clear entitlements cache
   │   └─ (No event published)
   │
   ├─→ Billing Service Consumer (TODO)
   │   ├─ Cancel subscription
   │   ├─ Clear entitlements
   │   └─ Publish: SubscriptionCancelled
   │
   └─→ Audit Service Consumer
       └─ Log event (append-only)
```

### Correlation ID Propagation

All events in the saga share the same `correlationId` for tracing:

```typescript
// Organization Service
const correlationId = getCorrelationId(); // e.g., "abc-123"

const event = createEvent('OrganizationDeleted', 'v1', data, {
  correlationId, // ← Same correlationId used throughout saga
  // ...
});

// Workflow Service receives event with same correlationId
// All logs and traces use this correlationId
logger.info({ correlationId: event.correlationId }, 'Processing saga step');
```

### Event Ordering

Events are ordered within a partition key:

```typescript
// Event publisher uses organizationId as partition key
await this.producer.send({
  topic: 'organization.deleted',
  messages: [{
    key: event.organizationId, // ← Ensures ordering for this org
    value: JSON.stringify(event),
  }],
});
```

**Why this matters:**
- Events for the same organization are processed in order
- Prevents race conditions
- Ensures saga steps execute in correct sequence

### Idempotency

All saga steps are idempotent:

```typescript
// Organization Service: Idempotent delete
async softDelete(id: string) {
  await pool.query(
    `UPDATE organizations 
     SET deleted_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND deleted_at IS NULL`, // ← Only if not already deleted
    [id]
  );
}

// Workflow Service: Idempotent archive
async archive(projectId: string) {
  await pool.query(
    `UPDATE projects 
     SET archived = true 
     WHERE id = $1 AND archived = false`, // ← Only if not already archived
    [projectId]
  );
}
```

---

## Best Practices

### 1. Design Saga Steps Carefully

**Do:**
- ✅ Keep steps small and focused
- ✅ Make steps idempotent
- ✅ Use local transactions only
- ✅ Publish events after local transaction commits

**Don't:**
- ❌ Make steps too large (hard to compensate)
- ❌ Use distributed transactions
- ❌ Publish events before local transaction commits

### 2. Implement Proper Compensation

**Do:**
- ✅ Design compensation actions upfront
- ✅ Store compensation data with each step
- ✅ Test compensation scenarios
- ✅ Log all compensation actions

**Don't:**
- ❌ Assume compensation is simple
- ❌ Forget to compensate audit logs (they're immutable)
- ❌ Skip compensation for "safe" operations

### 3. Handle Failures Gracefully

**Do:**
- ✅ Use dead-letter queues for failed events
- ✅ Implement retry logic with exponential backoff
- ✅ Set timeouts for all operations
- ✅ Monitor saga completion rates

**Don't:**
- ❌ Ignore failures
- ❌ Retry indefinitely
- ❌ Block on failures

### 4. Observability

**Do:**
- ✅ Use correlation IDs throughout saga
- ✅ Log each saga step
- ✅ Track saga state
- ✅ Alert on saga failures

**Don't:**
- ❌ Lose traceability
- ❌ Skip logging
- ❌ Ignore monitoring

### 5. Testing

**Do:**
- ✅ Test happy path
- ✅ Test failure scenarios
- ✅ Test compensation
- ✅ Test idempotency
- ✅ Test concurrent sagas

**Don't:**
- ❌ Only test happy path
- ❌ Assume everything works
- ❌ Skip edge cases

---

## Future Enhancements

### 1. Saga Orchestration Service

Create a dedicated saga orchestration service for complex sagas:

```
services/
  └── saga-orchestrator-service/
      ├── src/
      │   ├── sagas/
      │   │   ├── organization-deletion.saga.ts
      │   │   └── plan-downgrade.saga.ts
      │   ├── repositories/
      │   │   └── saga-state.repository.ts
      │   └── services/
      │       └── saga-orchestrator.service.ts
```

### 2. Compensation Events

Implement compensation events for automatic rollback:

```typescript
// Compensation event schema
export const OrganizationDeletionCompensatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('OrganizationDeletionCompensated'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    sagaId: z.string().uuid(),
    failedStep: z.string(),
    compensationRequired: z.array(z.object({
      service: z.string(),
      action: z.string(),
      data: z.record(z.any()),
    })),
  }),
});
```

### 3. Saga State Tracking

Track saga state in a dedicated table:

```sql
CREATE TABLE saga_states (
  id UUID PRIMARY KEY,
  saga_type VARCHAR(100) NOT NULL,
  correlation_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL,
  organization_id UUID,
  steps JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### 4. Saga Monitoring Dashboard

Create a dashboard to monitor saga execution:

- Saga completion rates
- Average saga duration
- Failure rates by step
- Compensation frequency
- Active sagas

### 5. Saga Testing Framework

Create a testing framework for sagas:

```typescript
describe('Organization Deletion Saga', () => {
  it('should complete successfully', async () => {
    await sagaTest
      .givenOrganizationExists(orgId)
      .whenDeleteOrganization(orgId)
      .thenExpectStep('delete_organization', 'completed')
      .thenExpectStep('archive_projects', 'completed')
      .thenExpectStep('cancel_subscription', 'completed')
      .thenExpectSagaStatus('completed');
  });

  it('should compensate on failure', async () => {
    await sagaTest
      .givenOrganizationExists(orgId)
      .givenServiceDown('billing-service')
      .whenDeleteOrganization(orgId)
      .thenExpectCompensation('archive_projects')
      .thenExpectCompensation('delete_organization')
      .thenExpectSagaStatus('compensated');
  });
});
```

---

## Summary

The Saga pattern is essential for managing distributed transactions in microservices. In this project:

1. **Current Implementation**: Choreography-based saga for organization deletion
2. **Key Components**: Event-driven communication, idempotent operations, correlation IDs
3. **Missing Pieces**: Compensation logic, saga state tracking, Billing Service integration
4. **Best Practices**: Idempotency, observability, failure handling, testing

The Organization Deletion Saga demonstrates how multiple services coordinate to achieve a business goal while maintaining service independence and eventual consistency.

---

## References

- [Architecture Guide](./ARCHITECTURE_GUIDE.md) - Overall system architecture
- [Event Schemas](./event-schemas.md) - Event definitions
- [Failure Mode Analysis](./failure-mode-analysis.md) - Failure scenarios
- [Data Ownership Matrix](./data-ownership-matrix.md) - Service data ownership

---

**Last Updated**: 2024-01-01  
**Version**: 1.0.0
