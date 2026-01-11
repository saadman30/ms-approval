import { z } from 'zod';

// Base event schema
export const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  eventVersion: z.string(),
  timestamp: z.string().datetime(),
  source: z.string(),
  correlationId: z.string().uuid(),
  traceId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;

// Identity Service Events
export const UserRegisteredEventSchema = BaseEventSchema.extend({
  eventType: z.literal('UserRegistered'),
  eventVersion: z.literal('v1'),
  data: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    registeredAt: z.string().datetime(),
  }),
});

export const UserLoggedInEventSchema = BaseEventSchema.extend({
  eventType: z.literal('UserLoggedIn'),
  eventVersion: z.literal('v1'),
  data: z.object({
    userId: z.string().uuid(),
    sessionId: z.string().uuid(),
    loginAt: z.string().datetime(),
    ipAddress: z.string().optional(),
  }),
});

export const UserLoggedOutEventSchema = BaseEventSchema.extend({
  eventType: z.literal('UserLoggedOut'),
  eventVersion: z.literal('v1'),
  data: z.object({
    userId: z.string().uuid(),
    sessionId: z.string().uuid(),
    logoutAt: z.string().datetime(),
  }),
});

export const PasswordResetRequestedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('PasswordResetRequested'),
  eventVersion: z.literal('v1'),
  data: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    resetToken: z.string(),
    requestedAt: z.string().datetime(),
  }),
});

// Organization Service Events
export const OrganizationCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('OrganizationCreated'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    name: z.string(),
    createdBy: z.string().uuid(),
    createdAt: z.string().datetime(),
  }),
});

export const OrganizationDeletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('OrganizationDeleted'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    deletedBy: z.string().uuid(),
    deletedAt: z.string().datetime(),
  }),
});

export const MemberAddedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('MemberAdded'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.string(),
    addedBy: z.string().uuid(),
    addedAt: z.string().datetime(),
  }),
});

export const MemberRemovedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('MemberRemoved'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    removedBy: z.string().uuid(),
    removedAt: z.string().datetime(),
  }),
});

export const RoleChangedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('RoleChanged'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    oldRole: z.string(),
    newRole: z.string(),
    changedBy: z.string().uuid(),
    changedAt: z.string().datetime(),
  }),
});

export const InvitationSentEventSchema = BaseEventSchema.extend({
  eventType: z.literal('InvitationSent'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    inviteeEmail: z.string().email(),
    role: z.string(),
    invitationToken: z.string(),
    sentBy: z.string().uuid(),
    sentAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),
});

// Billing Service Events
export const SubscriptionActivatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('SubscriptionActivated'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    planId: z.string().uuid(),
    planName: z.string(),
    activatedAt: z.string().datetime(),
    billingPeriod: z.enum(['monthly', 'yearly']),
  }),
});

export const SubscriptionChangedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('SubscriptionChanged'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    oldPlanId: z.string().uuid(),
    newPlanId: z.string().uuid(),
    changedAt: z.string().datetime(),
    effectiveAt: z.string().datetime(),
  }),
});

export const SubscriptionCancelledEventSchema = BaseEventSchema.extend({
  eventType: z.literal('SubscriptionCancelled'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    subscriptionId: z.string().uuid(),
    cancelledAt: z.string().datetime(),
    effectiveAt: z.string().datetime(),
  }),
});

export const EntitlementsUpdatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('EntitlementsUpdated'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    entitlements: z.object({
      maxProjects: z.number(),
      maxTasks: z.number(),
      maxMembers: z.number(),
      features: z.array(z.string()),
    }),
    updatedAt: z.string().datetime(),
  }),
});

// Workflow Service Events
export const ProjectCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('ProjectCreated'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string(),
    createdBy: z.string().uuid(),
    createdAt: z.string().datetime(),
  }),
});

export const ProjectArchivedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('ProjectArchived'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    projectId: z.string().uuid(),
    archivedBy: z.string().uuid(),
    archivedAt: z.string().datetime(),
  }),
});

export const TaskCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('TaskCreated'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    title: z.string(),
    createdBy: z.string().uuid(),
    createdAt: z.string().datetime(),
  }),
});

export const TaskUpdatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('TaskUpdated'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    updatedFields: z.array(z.string()),
    updatedBy: z.string().uuid(),
    updatedAt: z.string().datetime(),
  }),
});

export const TaskAssignedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('TaskAssigned'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    assignedTo: z.string().uuid(),
    assignedBy: z.string().uuid(),
    assignedAt: z.string().datetime(),
  }),
});

export const TaskStatusChangedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('TaskStatusChanged'),
  eventVersion: z.literal('v1'),
  data: z.object({
    organizationId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    oldStatus: z.string(),
    newStatus: z.string(),
    changedBy: z.string().uuid(),
    changedAt: z.string().datetime(),
  }),
});

// Union type for all events
export type DomainEvent =
  | z.infer<typeof UserRegisteredEventSchema>
  | z.infer<typeof UserLoggedInEventSchema>
  | z.infer<typeof UserLoggedOutEventSchema>
  | z.infer<typeof PasswordResetRequestedEventSchema>
  | z.infer<typeof OrganizationCreatedEventSchema>
  | z.infer<typeof OrganizationDeletedEventSchema>
  | z.infer<typeof MemberAddedEventSchema>
  | z.infer<typeof MemberRemovedEventSchema>
  | z.infer<typeof RoleChangedEventSchema>
  | z.infer<typeof InvitationSentEventSchema>
  | z.infer<typeof SubscriptionActivatedEventSchema>
  | z.infer<typeof SubscriptionChangedEventSchema>
  | z.infer<typeof SubscriptionCancelledEventSchema>
  | z.infer<typeof EntitlementsUpdatedEventSchema>
  | z.infer<typeof ProjectCreatedEventSchema>
  | z.infer<typeof ProjectArchivedEventSchema>
  | z.infer<typeof TaskCreatedEventSchema>
  | z.infer<typeof TaskUpdatedEventSchema>
  | z.infer<typeof TaskAssignedEventSchema>
  | z.infer<typeof TaskStatusChangedEventSchema>;

// Event topic mapping
export const EVENT_TOPICS = {
  USER_REGISTERED: 'identity.user.registered',
  USER_LOGGED_IN: 'identity.user.logged-in',
  USER_LOGGED_OUT: 'identity.user.logged-out',
  PASSWORD_RESET_REQUESTED: 'identity.password.reset-requested',
  ORGANIZATION_CREATED: 'organization.created',
  ORGANIZATION_DELETED: 'organization.deleted',
  MEMBER_ADDED: 'organization.member.added',
  MEMBER_REMOVED: 'organization.member.removed',
  ROLE_CHANGED: 'organization.role.changed',
  INVITATION_SENT: 'organization.invitation.sent',
  SUBSCRIPTION_ACTIVATED: 'billing.subscription.activated',
  SUBSCRIPTION_CHANGED: 'billing.subscription.changed',
  SUBSCRIPTION_CANCELLED: 'billing.subscription.cancelled',
  ENTITLEMENTS_UPDATED: 'billing.entitlements.updated',
  PROJECT_CREATED: 'workflow.project.created',
  PROJECT_ARCHIVED: 'workflow.project.archived',
  TASK_CREATED: 'workflow.task.created',
  TASK_UPDATED: 'workflow.task.updated',
  TASK_ASSIGNED: 'workflow.task.assigned',
  TASK_STATUS_CHANGED: 'workflow.task.status-changed',
} as const;

// Helper to create event
export function createEvent<T extends BaseEvent>(
  eventType: T['eventType'],
  eventVersion: T['eventVersion'],
  data: T extends { data: infer D } ? D : never,
  metadata: {
    source: string;
    correlationId: string;
    traceId?: string;
    userId?: string;
    organizationId?: string;
  }
): T {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    eventVersion,
    timestamp: new Date().toISOString(),
    source: metadata.source,
    correlationId: metadata.correlationId,
    traceId: metadata.traceId,
    userId: metadata.userId,
    organizationId: metadata.organizationId,
    data,
  } as T;
}
