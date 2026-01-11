import { PlanRepository } from '../repositories/plan.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { EntitlementRepository } from '../repositories/entitlement.repository';
import { UsageRepository } from '../repositories/usage.repository';
import { EventPublisher } from '../events/event-publisher';
import {
  createEvent,
  SubscriptionActivatedEventSchema,
  SubscriptionChangedEventSchema,
  SubscriptionCancelledEventSchema,
  EntitlementsUpdatedEventSchema,
} from '@microservice-learning/events';
import { getCorrelationId } from '@microservice-learning/observability';
import {
  CreatePlanInput,
  CreateSubscriptionInput,
  TrackUsageInput,
  Entitlement,
} from '../types/billing.types';

export class BillingService {
  constructor(
    private planRepository: PlanRepository,
    private subscriptionRepository: SubscriptionRepository,
    private entitlementRepository: EntitlementRepository,
    private usageRepository: UsageRepository,
    private eventPublisher: EventPublisher
  ) {}

  async createPlan(input: CreatePlanInput) {
    return this.planRepository.create(input);
  }

  async createSubscription(
    input: CreateSubscriptionInput,
    correlationId?: string
  ) {
    const plan = await this.planRepository.findById(input.planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    // Check for existing active subscription
    const existing = await this.subscriptionRepository.findByOrganizationId(
      input.organizationId
    );

    if (existing) {
      throw new Error('Organization already has an active subscription');
    }

    // Calculate billing period
    const periodStart = new Date();
    const periodEnd = new Date();
    if (plan.billingPeriod === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const subscription = await this.subscriptionRepository.create(
      input,
      periodStart,
      periodEnd
    );

    // Create entitlements
    const entitlement: Entitlement = {
      organizationId: input.organizationId,
      subscriptionId: subscription.id,
      planId: plan.id,
      maxProjects: plan.maxProjects,
      maxTasks: plan.maxTasks,
      maxMembers: plan.maxMembers,
      features: plan.features,
      updatedAt: new Date(),
    };

    await this.entitlementRepository.upsert(entitlement);

    // Publish events
    const activatedEvent = createEvent(
      'SubscriptionActivated',
      'v1',
      {
        organizationId: input.organizationId,
        subscriptionId: subscription.id,
        planId: plan.id,
        planName: plan.name,
        activatedAt: subscription.createdAt.toISOString(),
        billingPeriod: plan.billingPeriod,
      },
      {
        source: 'billing-service',
        correlationId: correlationId || getCorrelationId(),
        organizationId: input.organizationId,
      }
    );

    await this.eventPublisher.publish('billing.subscription.activated', activatedEvent);

    const entitlementsEvent = createEvent(
      'EntitlementsUpdated',
      'v1',
      {
        organizationId: input.organizationId,
        entitlements: {
          maxProjects: plan.maxProjects || 0,
          maxTasks: plan.maxTasks || 0,
          maxMembers: plan.maxMembers || 0,
          features: plan.features,
        },
        updatedAt: new Date().toISOString(),
      },
      {
        source: 'billing-service',
        correlationId: correlationId || getCorrelationId(),
        organizationId: input.organizationId,
      }
    );

    await this.eventPublisher.publish('billing.entitlements.updated', entitlementsEvent);

    return { subscription, entitlement };
  }

  async changePlan(
    subscriptionId: string,
    newPlanId: string,
    correlationId?: string
  ) {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const oldPlan = await this.planRepository.findById(subscription.planId);
    const newPlan = await this.planRepository.findById(newPlanId);
    if (!oldPlan || !newPlan) {
      throw new Error('Plan not found');
    }

    // Calculate new period
    const periodStart = new Date();
    const periodEnd = new Date();
    if (newPlan.billingPeriod === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const updated = await this.subscriptionRepository.updatePlan(
      subscriptionId,
      newPlanId,
      periodStart,
      periodEnd
    );

    // Update entitlements
    const entitlement: Entitlement = {
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      planId: newPlan.id,
      maxProjects: newPlan.maxProjects,
      maxTasks: newPlan.maxTasks,
      maxMembers: newPlan.maxMembers,
      features: newPlan.features,
      updatedAt: new Date(),
    };

    await this.entitlementRepository.upsert(entitlement);

    // Publish events
    const changedEvent = createEvent(
      'SubscriptionChanged',
      'v1',
      {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        oldPlanId: oldPlan.id,
        newPlanId: newPlan.id,
        changedAt: updated.updatedAt.toISOString(),
        effectiveAt: periodStart.toISOString(),
      },
      {
        source: 'billing-service',
        correlationId: correlationId || getCorrelationId(),
        organizationId: subscription.organizationId,
      }
    );

    await this.eventPublisher.publish('billing.subscription.changed', changedEvent);

    const entitlementsEvent = createEvent(
      'EntitlementsUpdated',
      'v1',
      {
        organizationId: subscription.organizationId,
        entitlements: {
          maxProjects: newPlan.maxProjects || 0,
          maxTasks: newPlan.maxTasks || 0,
          maxMembers: newPlan.maxMembers || 0,
          features: newPlan.features,
        },
        updatedAt: new Date().toISOString(),
      },
      {
        source: 'billing-service',
        correlationId: correlationId || getCorrelationId(),
        organizationId: subscription.organizationId,
      }
    );

    await this.eventPublisher.publish('billing.entitlements.updated', entitlementsEvent);

    return { subscription: updated, entitlement };
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = false,
    correlationId?: string
  ) {
    const subscription = await this.subscriptionRepository.cancel(
      subscriptionId,
      cancelAtPeriodEnd
    );

    // Publish event
    const event = createEvent(
      'SubscriptionCancelled',
      'v1',
      {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        cancelledAt: subscription.cancelledAt?.toISOString() || new Date().toISOString(),
        effectiveAt: cancelAtPeriodEnd
          ? subscription.currentPeriodEnd.toISOString()
          : new Date().toISOString(),
      },
      {
        source: 'billing-service',
        correlationId: correlationId || getCorrelationId(),
        organizationId: subscription.organizationId,
      }
    );

    await this.eventPublisher.publish('billing.subscription.cancelled', event);

    // If immediate cancellation, remove entitlements
    if (!cancelAtPeriodEnd) {
      await this.entitlementRepository.deleteByOrganizationId(
        subscription.organizationId
      );

      // Publish entitlements cleared event
      const entitlementsEvent = createEvent(
        'EntitlementsUpdated',
        'v1',
        {
          organizationId: subscription.organizationId,
          entitlements: {
            maxProjects: 0,
            maxTasks: 0,
            maxMembers: 0,
            features: [],
          },
          updatedAt: new Date().toISOString(),
        },
        {
          source: 'billing-service',
          correlationId: correlationId || getCorrelationId(),
          organizationId: subscription.organizationId,
        }
      );

      await this.eventPublisher.publish('billing.entitlements.updated', entitlementsEvent);
    }

    return subscription;
  }

  async getEntitlements(organizationId: string): Promise<Entitlement | null> {
    return this.entitlementRepository.findByOrganizationId(organizationId);
  }

  async trackUsage(input: TrackUsageInput) {
    const subscription = await this.subscriptionRepository.findByOrganizationId(
      input.organizationId
    );

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Use current subscription period
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    return this.usageRepository.track(input, periodStart, periodEnd);
  }

  async getUsage(
    organizationId: string,
    metricName: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    return this.usageRepository.getUsage(
      organizationId,
      metricName,
      periodStart,
      periodEnd
    );
  }
}
