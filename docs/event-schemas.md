# Event Schema Definitions

All events follow this base structure:
```typescript
interface BaseEvent {
  eventId: string;          // UUID
  eventType: string;        // e.g., "OrganizationCreated"
  eventVersion: string;     // e.g., "v1"
  timestamp: string;        // ISO 8601
  source: string;           // Service name
  correlationId: string;    // For tracing
  traceId?: string;         // OpenTelemetry trace ID
  userId?: string;          // Actor (if applicable)
  organizationId?: string;  // Tenant context (if applicable)
  metadata?: Record<string, any>;
}
```

## Identity Service Events

### UserRegistered (v1)
```typescript
interface UserRegisteredEvent extends BaseEvent {
  eventType: "UserRegistered";
  eventVersion: "v1";
  data: {
    userId: string;
    email: string;
    registeredAt: string;
  };
}
```

### UserLoggedIn (v1)
```typescript
interface UserLoggedInEvent extends BaseEvent {
  eventType: "UserLoggedIn";
  eventVersion: "v1";
  data: {
    userId: string;
    sessionId: string;
    loginAt: string;
    ipAddress?: string;
  };
}
```

### UserLoggedOut (v1)
```typescript
interface UserLoggedOutEvent extends BaseEvent {
  eventType: "UserLoggedOut";
  eventVersion: "v1";
  data: {
    userId: string;
    sessionId: string;
    logoutAt: string;
  };
}
```

### PasswordResetRequested (v1)
```typescript
interface PasswordResetRequestedEvent extends BaseEvent {
  eventType: "PasswordResetRequested";
  eventVersion: "v1";
  data: {
    userId: string;
    email: string;
    resetToken: string;  // Hashed token reference
    requestedAt: string;
  };
}
```

## Organization Service Events

### OrganizationCreated (v1)
```typescript
interface OrganizationCreatedEvent extends BaseEvent {
  eventType: "OrganizationCreated";
  eventVersion: "v1";
  data: {
    organizationId: string;
    name: string;
    createdBy: string;  // userId
    createdAt: string;
  };
}
```

### OrganizationDeleted (v1)
```typescript
interface OrganizationDeletedEvent extends BaseEvent {
  eventType: "OrganizationDeleted";
  eventVersion: "v1";
  data: {
    organizationId: string;
    deletedBy: string;  // userId
    deletedAt: string;
  };
}
```

### MemberAdded (v1)
```typescript
interface MemberAddedEvent extends BaseEvent {
  eventType: "MemberAdded";
  eventVersion: "v1";
  data: {
    organizationId: string;
    userId: string;
    role: string;
    addedBy: string;  // userId
    addedAt: string;
  };
}
```

### MemberRemoved (v1)
```typescript
interface MemberRemovedEvent extends BaseEvent {
  eventType: "MemberRemoved";
  eventVersion: "v1";
  data: {
    organizationId: string;
    userId: string;
    removedBy: string;  // userId
    removedAt: string;
  };
}
```

### RoleChanged (v1)
```typescript
interface RoleChangedEvent extends BaseEvent {
  eventType: "RoleChanged";
  eventVersion: "v1";
  data: {
    organizationId: string;
    userId: string;
    oldRole: string;
    newRole: string;
    changedBy: string;  // userId
    changedAt: string;
  };
}
```

### InvitationSent (v1)
```typescript
interface InvitationSentEvent extends BaseEvent {
  eventType: "InvitationSent";
  eventVersion: "v1";
  data: {
    organizationId: string;
    inviteeEmail: string;
    role: string;
    invitationToken: string;
    sentBy: string;  // userId
    sentAt: string;
    expiresAt: string;
  };
}
```

## Billing Service Events

### SubscriptionActivated (v1)
```typescript
interface SubscriptionActivatedEvent extends BaseEvent {
  eventType: "SubscriptionActivated";
  eventVersion: "v1";
  data: {
    organizationId: string;
    subscriptionId: string;
    planId: string;
    planName: string;
    activatedAt: string;
    billingPeriod: string;  // "monthly" | "yearly"
  };
}
```

### SubscriptionChanged (v1)
```typescript
interface SubscriptionChangedEvent extends BaseEvent {
  eventType: "SubscriptionChanged";
  eventVersion: "v1";
  data: {
    organizationId: string;
    subscriptionId: string;
    oldPlanId: string;
    newPlanId: string;
    changedAt: string;
    effectiveAt: string;
  };
}
```

### SubscriptionCancelled (v1)
```typescript
interface SubscriptionCancelledEvent extends BaseEvent {
  eventType: "SubscriptionCancelled";
  eventVersion: "v1";
  data: {
    organizationId: string;
    subscriptionId: string;
    cancelledAt: string;
    effectiveAt: string;  // When subscription actually ends
  };
}
```

### EntitlementsUpdated (v1)
```typescript
interface EntitlementsUpdatedEvent extends BaseEvent {
  eventType: "EntitlementsUpdated";
  eventVersion: "v1";
  data: {
    organizationId: string;
    entitlements: {
      maxProjects: number;
      maxTasks: number;
      maxMembers: number;
      features: string[];  // e.g., ["advanced_workflows", "api_access"]
    };
    updatedAt: string;
  };
}
```

## Workflow Service Events

### ProjectCreated (v1)
```typescript
interface ProjectCreatedEvent extends BaseEvent {
  eventType: "ProjectCreated";
  eventVersion: "v1";
  data: {
    organizationId: string;
    projectId: string;
    name: string;
    createdBy: string;  // userId
    createdAt: string;
  };
}
```

### ProjectArchived (v1)
```typescript
interface ProjectArchivedEvent extends BaseEvent {
  eventType: "ProjectArchived";
  eventVersion: "v1";
  data: {
    organizationId: string;
    projectId: string;
    archivedBy: string;  // userId
    archivedAt: string;
  };
}
```

### TaskCreated (v1)
```typescript
interface TaskCreatedEvent extends BaseEvent {
  eventType: "TaskCreated";
  eventVersion: "v1";
  data: {
    organizationId: string;
    projectId: string;
    taskId: string;
    title: string;
    createdBy: string;  // userId
    createdAt: string;
  };
}
```

### TaskUpdated (v1)
```typescript
interface TaskUpdatedEvent extends BaseEvent {
  eventType: "TaskUpdated";
  eventVersion: "v1";
  data: {
    organizationId: string;
    projectId: string;
    taskId: string;
    updatedFields: string[];  // e.g., ["title", "description"]
    updatedBy: string;  // userId
    updatedAt: string;
  };
}
```

### TaskAssigned (v1)
```typescript
interface TaskAssignedEvent extends BaseEvent {
  eventType: "TaskAssigned";
  eventVersion: "v1";
  data: {
    organizationId: string;
    projectId: string;
    taskId: string;
    assignedTo: string;  // userId
    assignedBy: string;  // userId
    assignedAt: string;
  };
}
```

### TaskStatusChanged (v1)
```typescript
interface TaskStatusChangedEvent extends BaseEvent {
  eventType: "TaskStatusChanged";
  eventVersion: "v1";
  data: {
    organizationId: string;
    projectId: string;
    taskId: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;  // userId
    changedAt: string;
  };
}
```

## Event Versioning Strategy

- **v1**: Initial version
- **v2+**: Breaking changes require new version
- Consumers must handle multiple versions
- Backward compatibility maintained for at least 2 versions
- Deprecation notice in metadata for old versions

## Event Ordering & Idempotency

- Events are ordered within a partition key (organizationId or userId)
- Consumers must be idempotent (check eventId before processing)
- Event replay supported via eventId deduplication
