import { NotificationRepository } from '../repositories/notification.repository';
import { DeliveryRepository } from '../repositories/delivery.repository';
import { CreateNotificationInput } from '../types/notification.types';
import { createLogger } from '@microservice-learning/observability';

const logger = createLogger({ serviceName: 'notification-service' });

export class NotificationService {
  constructor(
    private notificationRepository: NotificationRepository,
    private deliveryRepository: DeliveryRepository
  ) {}

  async createNotification(input: CreateNotificationInput, eventId: string): Promise<void> {
    // Check for duplicate (idempotency)
    const existing = await this.deliveryRepository.findByEventId(eventId);
    if (existing) {
      logger.info({ eventId }, 'Notification already processed (idempotent)');
      return;
    }

    // Create notification
    const notification = await this.notificationRepository.create(input);

    // Create delivery record
    await this.deliveryRepository.create(eventId, input.type, notification.id);

    // Send notification based on type
    try {
      await this.sendNotification(notification, input.type);
      await this.deliveryRepository.markAsSent(
        (await this.deliveryRepository.findByEventId(eventId))!.id
      );
    } catch (error: any) {
      logger.error({ error, notificationId: notification.id }, 'Failed to send notification');
      const delivery = await this.deliveryRepository.findByEventId(eventId);
      if (delivery) {
        if (delivery.attempts < 3) {
          await this.deliveryRepository.markAsRetrying(delivery.id);
        } else {
          await this.deliveryRepository.markAsFailed(delivery.id, error.message);
        }
      }
      throw error;
    }
  }

  private async sendNotification(notification: any, type: string): Promise<void> {
    switch (type) {
      case 'email':
        await this.sendEmail(notification);
        break;
      case 'in_app':
        // Already stored in database
        break;
      case 'webhook':
        await this.sendWebhook(notification);
        break;
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  private async sendEmail(notification: any): Promise<void> {
    // TODO: Integrate with email service (SendGrid, SES, etc.)
    logger.info({ notificationId: notification.id, email: notification.userId }, 'Sending email notification');
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendWebhook(notification: any): Promise<void> {
    // TODO: Send webhook to configured endpoint
    logger.info({ notificationId: notification.id }, 'Sending webhook notification');
    // Simulate webhook sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async getNotificationsForUser(userId: string, limit: number = 50) {
    return this.notificationRepository.findByUserId(userId, limit);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.notificationRepository.markAsRead(notificationId);
  }
}
