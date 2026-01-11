import { AnalyticsRepository } from '../repositories/analytics.repository';
import { createLogger } from '@microservice-learning/observability';
import {
  TaskCreatedEventSchema,
  TaskStatusChangedEventSchema,
  ProjectCreatedEventSchema,
  SubscriptionActivatedEventSchema,
  SubscriptionChangedEventSchema,
} from '@microservice-learning/events';

const logger = createLogger({ serviceName: 'analytics-service' });

export class AnalyticsService {
  constructor(private analyticsRepository: AnalyticsRepository) {}

  async processTaskCreated(event: any): Promise<void> {
    try {
      const validated = TaskCreatedEventSchema.parse(event);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.analyticsRepository.upsertTaskMetrics({
        organizationId: validated.data.organizationId,
        projectId: validated.data.projectId,
        date: today,
        tasksCreated: 1,
        tasksCompleted: 0,
        tasksInProgress: 0,
      });

      logger.info({ eventId: validated.eventId }, 'Processed TaskCreated event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to process TaskCreated event');
    }
  }

  async processTaskStatusChanged(event: any): Promise<void> {
    try {
      const validated = TaskStatusChangedEventSchema.parse(event);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updates: any = {
        organizationId: validated.data.organizationId,
        date: today,
      };

      if (validated.data.newStatus === 'done' && validated.data.oldStatus !== 'done') {
        updates.tasksCompleted = 1;
      } else if (validated.data.newStatus === 'in_progress' && validated.data.oldStatus === 'todo') {
        updates.tasksInProgress = 1;
      } else if (validated.data.oldStatus === 'in_progress' && validated.data.newStatus !== 'in_progress') {
        updates.tasksInProgress = -1;
      }

      if (Object.keys(updates).length > 2) {
        await this.analyticsRepository.upsertTaskMetrics(updates);
      }

      logger.info({ eventId: validated.eventId }, 'Processed TaskStatusChanged event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to process TaskStatusChanged event');
    }
  }

  async processProjectCreated(event: any): Promise<void> {
    try {
      const validated = ProjectCreatedEventSchema.parse(event);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.analyticsRepository.upsertUsageMetric({
        organizationId: validated.data.organizationId,
        metricDate: today,
        metricName: 'projects_created',
        metricValue: 1,
      });

      logger.info({ eventId: validated.eventId }, 'Processed ProjectCreated event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to process ProjectCreated event');
    }
  }

  async processSubscriptionActivated(event: any): Promise<void> {
    try {
      const validated = SubscriptionActivatedEventSchema.parse(event);
      const periodStart = new Date(validated.data.activatedAt);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(periodStart);
      if (validated.data.billingPeriod === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      await this.analyticsRepository.upsertSubscriptionAnalytics({
        organizationId: validated.data.organizationId,
        planId: validated.data.planId,
        planName: validated.data.planName,
        subscriptionStatus: 'active',
        activeUsers: 0,
        projectsCount: 0,
        tasksCount: 0,
        periodStart,
        periodEnd,
      });

      logger.info({ eventId: validated.eventId }, 'Processed SubscriptionActivated event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to process SubscriptionActivated event');
    }
  }

  async processSubscriptionChanged(event: any): Promise<void> {
    try {
      const validated = SubscriptionChangedEventSchema.parse(event);
      const periodStart = new Date(validated.data.effectiveAt);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1); // Assume monthly for now

      // Get current analytics to preserve counts
      const current = await this.analyticsRepository.getSubscriptionAnalytics(
        validated.data.organizationId
      );

      await this.analyticsRepository.upsertSubscriptionAnalytics({
        organizationId: validated.data.organizationId,
        planId: validated.data.newPlanId,
        subscriptionStatus: 'active',
        activeUsers: current?.activeUsers || 0,
        projectsCount: current?.projectsCount || 0,
        tasksCount: current?.tasksCount || 0,
        periodStart,
        periodEnd,
      });

      logger.info({ eventId: validated.eventId }, 'Processed SubscriptionChanged event');
    } catch (error) {
      logger.error({ error, event }, 'Failed to process SubscriptionChanged event');
    }
  }

  async getTaskMetrics(organizationId: string, startDate: Date, endDate: Date) {
    return this.analyticsRepository.getTaskMetrics(organizationId, startDate, endDate);
  }

  async getSubscriptionAnalytics(organizationId: string) {
    return this.analyticsRepository.getSubscriptionAnalytics(organizationId);
  }

  async getUsageMetrics(organizationId: string, startDate: Date, endDate: Date) {
    return this.analyticsRepository.getUsageMetrics(organizationId, startDate, endDate);
  }
}
