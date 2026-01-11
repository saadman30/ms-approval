import { Kafka } from 'kafkajs';
import { createLogger } from '@microservice-learning/observability';
import { BillingService } from '../services/billing.service';
import { OrganizationCreatedEventSchema } from '@microservice-learning/events';

const logger = createLogger({ serviceName: 'billing-service' });

export class EventConsumer {
  private consumer: any;
  private kafka: Kafka;
  private billingService: BillingService;

  constructor(billingService: BillingService) {
    this.billingService = billingService;
    this.kafka = new Kafka({
      clientId: 'billing-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'billing-service-group' });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    logger.info('Kafka consumer connected');
  }

  async disconnect(): Promise<void> {
    await this.consumer.dissubscribe();
    await this.consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }

  async subscribe(): Promise<void> {
    // Subscribe to organization events
    await this.consumer.subscribe({
      topics: ['organization.created'],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        try {
          const event = JSON.parse(message.value.toString());

          if (topic === 'organization.created') {
            await this.handleOrganizationCreated(event);
          }
        } catch (error) {
          logger.error({ error, topic, partition }, 'Failed to process event');
          // TODO: Send to dead-letter queue
        }
      },
    });
  }

  private async handleOrganizationCreated(event: any): Promise<void> {
    try {
      // Validate event schema
      const validated = OrganizationCreatedEventSchema.parse(event);

      // For now, skip auto-creating subscription
      // In production, you might want to create a free/trial plan subscription
      // This would require exposing planRepository or adding a method to BillingService
      logger.info({ organizationId: validated.data.organizationId }, 'Received OrganizationCreated event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle OrganizationCreated event');
      // Don't throw - log and continue (at-least-once delivery)
    }
  }
}
