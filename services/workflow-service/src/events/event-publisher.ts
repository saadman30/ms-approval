import { Kafka } from 'kafkajs';
import { DomainEvent } from '@microservice-learning/events';
import { createLogger } from '@microservice-learning/observability';

const logger = createLogger({ serviceName: 'workflow-service' });

export class EventPublisher {
  private producer: any;
  private kafka: Kafka;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'workflow-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    });

    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    logger.info('Kafka producer connected');
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    logger.info('Kafka producer disconnected');
  }

  async publish(topic: string, event: DomainEvent): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: event.organizationId || event.userId || event.eventId,
            value: JSON.stringify(event),
            headers: {
              'event-type': event.eventType,
              'event-version': event.eventVersion,
              'correlation-id': event.correlationId,
              ...(event.traceId && { 'trace-id': event.traceId }),
            },
          },
        ],
      });

      logger.info({ topic, eventType: event.eventType, eventId: event.eventId }, 'Event published');
    } catch (error) {
      logger.error({ error, topic, eventType: event.eventType }, 'Failed to publish event');
      throw error;
    }
  }
}
