import { Kafka } from 'kafkajs';
import { createLogger } from '@microservice-learning/observability';
import { NotificationService } from '../services/notification.service';
import {
  InvitationSentEventSchema,
  PasswordResetRequestedEventSchema,
  TaskAssignedEventSchema,
} from '@microservice-learning/events';

const logger = createLogger({ serviceName: 'notification-service' });

export class EventConsumer {
  private consumer: any;
  private kafka: Kafka;
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
    this.kafka = new Kafka({
      clientId: 'notification-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'notification-service-group' });
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
    await this.consumer.subscribe({
      topics: [
        'organization.invitation.sent',
        'identity.password.reset-requested',
        'workflow.task.assigned',
      ],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        try {
          const event = JSON.parse(message.value.toString());

          switch (topic) {
            case 'organization.invitation.sent':
              await this.handleInvitationSent(event);
              break;
            case 'identity.password.reset-requested':
              await this.handlePasswordResetRequested(event);
              break;
            case 'workflow.task.assigned':
              await this.handleTaskAssigned(event);
              break;
          }
        } catch (error) {
          logger.error({ error, topic, partition }, 'Failed to process event');
          // TODO: Send to dead-letter queue
        }
      },
    });
  }

  private async handleInvitationSent(event: any): Promise<void> {
    try {
      const validated = InvitationSentEventSchema.parse(event);

      // Note: We don't have userId here, only email
      // In production, you'd look up the user by email or send to email directly
      await this.notificationService.createNotification(
        {
          userId: validated.data.inviteeEmail, // Using email as identifier for now
          organizationId: validated.data.organizationId,
          type: 'email',
          channel: 'invitation',
          title: 'Organization Invitation',
          body: `You have been invited to join an organization. Click here to accept: ${process.env.APP_URL || 'http://localhost:3000'}/invitations/${validated.data.invitationToken}`,
          metadata: {
            invitationToken: validated.data.invitationToken,
            role: validated.data.role,
          },
        },
        validated.eventId
      );

      logger.info({ eventId: validated.eventId }, 'Processed InvitationSent event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle InvitationSent event');
    }
  }

  private async handlePasswordResetRequested(event: any): Promise<void> {
    try {
      const validated = PasswordResetRequestedEventSchema.parse(event);

      await this.notificationService.createNotification(
        {
          userId: validated.data.userId,
          type: 'email',
          channel: 'password_reset',
          title: 'Password Reset Request',
          body: `You requested a password reset. Use this token: ${validated.data.resetToken}`,
          metadata: {
            resetToken: validated.data.resetToken,
          },
        },
        validated.eventId
      );

      logger.info({ eventId: validated.eventId }, 'Processed PasswordResetRequested event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle PasswordResetRequested event');
    }
  }

  private async handleTaskAssigned(event: any): Promise<void> {
    try {
      const validated = TaskAssignedEventSchema.parse(event);

      await this.notificationService.createNotification(
        {
          userId: validated.data.assignedTo,
          organizationId: validated.data.organizationId,
          type: 'in_app',
          channel: 'task_assigned',
          title: 'Task Assigned',
          body: `You have been assigned to task: ${validated.data.taskId}`,
          metadata: {
            taskId: validated.data.taskId,
            projectId: validated.data.projectId,
            assignedBy: validated.data.assignedBy,
          },
        },
        validated.eventId
      );

      logger.info({ eventId: validated.eventId }, 'Processed TaskAssigned event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle TaskAssigned event');
    }
  }
}
