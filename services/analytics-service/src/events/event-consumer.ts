import { Kafka } from 'kafkajs';
import { createLogger } from '@microservice-learning/observability';
import { AnalyticsService } from '../services/analytics.service';

const logger = createLogger({ serviceName: 'analytics-service' });

export class EventConsumer {
  private consumer: any;
  private kafka: Kafka;
  private analyticsService: AnalyticsService;

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
    this.kafka = new Kafka({
      clientId: 'analytics-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'analytics-service-group' });
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
        'workflow.task.created',
        'workflow.task.status-changed',
        'workflow.project.created',
        'billing.subscription.activated',
        'billing.subscription.changed',
      ],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        try {
          const event = JSON.parse(message.value.toString());

          switch (topic) {
            case 'workflow.task.created':
              await this.analyticsService.processTaskCreated(event);
              break;
            case 'workflow.task.status-changed':
              await this.analyticsService.processTaskStatusChanged(event);
              break;
            case 'workflow.project.created':
              await this.analyticsService.processProjectCreated(event);
              break;
            case 'billing.subscription.activated':
              await this.analyticsService.processSubscriptionActivated(event);
              break;
            case 'billing.subscription.changed':
              await this.analyticsService.processSubscriptionChanged(event);
              break;
          }
        } catch (error) {
          logger.error({ error, topic, partition }, 'Failed to process event');
          // Don't throw - continue processing other events
        }
      },
    });
  }
}
