import { Kafka } from 'kafkajs';
import { createLogger } from '@microservice-learning/observability';
import { AuditService } from '../services/audit.service';
import { BaseEvent } from '@microservice-learning/events';

const logger = createLogger({ serviceName: 'audit-service' });

export class EventConsumer {
  private consumer: any;
  private kafka: Kafka;
  private auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
    this.kafka = new Kafka({
      clientId: 'audit-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'audit-service-group' });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    logger.info('Kafka consumer connected');
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }

  async subscribe(): Promise<void> {
    // Subscribe to all topics (audit service consumes all events)
    await this.consumer.subscribe({
      topics: [
        'identity.user.registered',
        'identity.user.logged-in',
        'identity.user.logged-out',
        'identity.password.reset-requested',
        'organization.created',
        'organization.deleted',
        'organization.member.added',
        'organization.member.removed',
        'organization.role.changed',
        'organization.invitation.sent',
        'billing.subscription.activated',
        'billing.subscription.changed',
        'billing.subscription.cancelled',
        'billing.entitlements.updated',
        'workflow.project.created',
        'workflow.project.archived',
        'workflow.task.created',
        'workflow.task.updated',
        'workflow.task.assigned',
        'workflow.task.status-changed',
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
          // Don't throw - continue processing other events
          // In production, send to dead-letter queue
        }
      },
    });
  }
}
