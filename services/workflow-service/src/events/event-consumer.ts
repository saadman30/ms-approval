import { Kafka } from 'kafkajs';
import { createLogger } from '@microservice-learning/observability';
import { CacheRepository } from '../repositories/cache.repository';
import {
  MemberAddedEventSchema,
  MemberRemovedEventSchema,
  RoleChangedEventSchema,
  EntitlementsUpdatedEventSchema,
  OrganizationDeletedEventSchema,
} from '@microservice-learning/events';
import { ProjectRepository } from '../repositories/project.repository';

const logger = createLogger({ serviceName: 'workflow-service' });

export class EventConsumer {
  private consumer: any;
  private kafka: Kafka;
  private cacheRepository: CacheRepository;
  private projectRepository: ProjectRepository;

  constructor(cacheRepository: CacheRepository, projectRepository: ProjectRepository) {
    this.cacheRepository = cacheRepository;
    this.projectRepository = projectRepository;
    this.kafka = new Kafka({
      clientId: 'workflow-service-consumer',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
    });

    this.consumer = this.kafka.consumer({ groupId: 'workflow-service-group' });
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
        'organization.member.added',
        'organization.member.removed',
        'organization.role.changed',
        'billing.entitlements.updated',
        'organization.deleted',
      ],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: any) => {
        try {
          const event = JSON.parse(message.value.toString());

          switch (topic) {
            case 'organization.member.added':
              await this.handleMemberAdded(event);
              break;
            case 'organization.member.removed':
              await this.handleMemberRemoved(event);
              break;
            case 'organization.role.changed':
              await this.handleRoleChanged(event);
              break;
            case 'billing.entitlements.updated':
              await this.handleEntitlementsUpdated(event);
              break;
            case 'organization.deleted':
              await this.handleOrganizationDeleted(event);
              break;
          }
        } catch (error) {
          logger.error({ error, topic, partition }, 'Failed to process event');
          // TODO: Send to dead-letter queue
        }
      },
    });
  }

  private async handleMemberAdded(event: any): Promise<void> {
    try {
      const validated = MemberAddedEventSchema.parse(event);
      
      await this.cacheRepository.upsertMembership({
        organizationId: validated.data.organizationId,
        userId: validated.data.userId,
        role: validated.data.role,
        cachedAt: new Date(),
      });

      logger.info({ organizationId: validated.data.organizationId, userId: validated.data.userId }, 'Membership cached');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle MemberAdded event');
    }
  }

  private async handleMemberRemoved(event: any): Promise<void> {
    try {
      const validated = MemberRemovedEventSchema.parse(event);
      
      await this.cacheRepository.deleteMembership(
        validated.data.organizationId,
        validated.data.userId
      );

      logger.info({ organizationId: validated.data.organizationId, userId: validated.data.userId }, 'Membership removed from cache');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle MemberRemoved event');
    }
  }

  private async handleRoleChanged(event: any): Promise<void> {
    try {
      const validated = RoleChangedEventSchema.parse(event);
      
      await this.cacheRepository.upsertMembership({
        organizationId: validated.data.organizationId,
        userId: validated.data.userId,
        role: validated.data.newRole,
        cachedAt: new Date(),
      });

      logger.info({ organizationId: validated.data.organizationId, userId: validated.data.userId }, 'Membership role updated in cache');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle RoleChanged event');
    }
  }

  private async handleEntitlementsUpdated(event: any): Promise<void> {
    try {
      const validated = EntitlementsUpdatedEventSchema.parse(event);
      
      await this.cacheRepository.upsertEntitlements({
        organizationId: validated.data.organizationId,
        maxProjects: validated.data.entitlements.maxProjects,
        maxTasks: validated.data.entitlements.maxTasks,
        maxMembers: validated.data.entitlements.maxMembers,
        features: validated.data.entitlements.features,
        cachedAt: new Date(),
      });

      logger.info({ organizationId: validated.data.organizationId }, 'Entitlements cached');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle EntitlementsUpdated event');
    }
  }

  private async handleOrganizationDeleted(event: any): Promise<void> {
    try {
      const validated = OrganizationDeletedEventSchema.parse(event);
      
      // Archive all projects for this organization
      const projects = await this.projectRepository.findByOrganization(validated.data.organizationId);
      
      for (const project of projects) {
        await this.projectRepository.archive(project.id);
      }

      // Clear caches
      await this.cacheRepository.deleteEntitlements(validated.data.organizationId);
      // Note: Membership cache will be cleaned up by MemberRemoved events

      logger.info({ organizationId: validated.data.organizationId }, 'Organization deleted - projects archived');
    } catch (error) {
      logger.error({ error, event }, 'Failed to handle OrganizationDeleted event');
    }
  }
}
