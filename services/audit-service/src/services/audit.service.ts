import { AuditRepository } from '../repositories/audit.repository';
import { AuditQuery } from '../types/audit.types';
import { BaseEvent } from '@microservice-learning/events';
import { createLogger } from '@microservice-learning/observability';

const logger = createLogger({ serviceName: 'audit-service' });

export class AuditService {
  constructor(private auditRepository: AuditRepository) {}

  async recordEvent(event: BaseEvent): Promise<void> {
    // Check for duplicate (idempotency)
    const existing = await this.auditRepository.findByEventId(event.eventId);
    if (existing) {
      logger.info({ eventId: event.eventId }, 'Event already audited (idempotent)');
      return;
    }

    // Extract action and resource from event type
    const { action, resourceType, resourceId } = this.parseEventType(event.eventType);

    // Record audit log
    await this.auditRepository.create(event, action, resourceType, resourceId);

    logger.info({ eventId: event.eventId, eventType: event.eventType }, 'Event audited');
  }

  async query(query: AuditQuery) {
    return this.auditRepository.query(query);
  }

  private parseEventType(eventType: string): { action: string; resourceType: string; resourceId?: string } {
    // Parse event type to extract action and resource
    // e.g., "UserRegistered" -> action: "created", resourceType: "user"
    // e.g., "TaskAssigned" -> action: "assigned", resourceType: "task"

    const lower = eventType.toLowerCase();

    let action = 'unknown';
    let resourceType = 'unknown';

    if (lower.includes('created')) {
      action = 'created';
    } else if (lower.includes('updated')) {
      action = 'updated';
    } else if (lower.includes('deleted')) {
      action = 'deleted';
    } else if (lower.includes('loggedin')) {
      action = 'login';
    } else if (lower.includes('loggedout')) {
      action = 'logout';
    } else if (lower.includes('assigned')) {
      action = 'assigned';
    } else if (lower.includes('archived')) {
      action = 'archived';
    } else if (lower.includes('cancelled')) {
      action = 'cancelled';
    } else if (lower.includes('activated')) {
      action = 'activated';
    } else if (lower.includes('changed')) {
      action = 'changed';
    } else if (lower.includes('added')) {
      action = 'added';
    } else if (lower.includes('removed')) {
      action = 'removed';
    } else if (lower.includes('sent')) {
      action = 'sent';
    }

    if (lower.includes('user')) {
      resourceType = 'user';
    } else if (lower.includes('organization')) {
      resourceType = 'organization';
    } else if (lower.includes('project')) {
      resourceType = 'project';
    } else if (lower.includes('task')) {
      resourceType = 'task';
    } else if (lower.includes('subscription')) {
      resourceType = 'subscription';
    } else if (lower.includes('plan')) {
      resourceType = 'plan';
    } else if (lower.includes('member')) {
      resourceType = 'membership';
    } else if (lower.includes('invitation')) {
      resourceType = 'invitation';
    } else if (lower.includes('entitlement')) {
      resourceType = 'entitlement';
    }

    return { action, resourceType };
  }
}
