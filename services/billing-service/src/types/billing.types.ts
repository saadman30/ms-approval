export interface Plan {
  id: string;
  name: string;
  description?: string;
  billingPeriod: 'monthly' | 'yearly';
  priceAmount: number;
  priceCurrency: string;
  maxProjects?: number;
  maxTasks?: number;
  maxMembers?: number;
  features: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Entitlement {
  organizationId: string;
  subscriptionId: string;
  planId: string;
  maxProjects?: number;
  maxTasks?: number;
  maxMembers?: number;
  features: string[];
  updatedAt: Date;
}

export interface Usage {
  id: string;
  organizationId: string;
  subscriptionId?: string;
  metricName: string;
  metricValue: number;
  periodStart: Date;
  periodEnd: Date;
  recordedAt: Date;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  billingPeriod: 'monthly' | 'yearly';
  priceAmount: number;
  priceCurrency?: string;
  maxProjects?: number;
  maxTasks?: number;
  maxMembers?: number;
  features?: string[];
}

export interface CreateSubscriptionInput {
  organizationId: string;
  planId: string;
}

export interface TrackUsageInput {
  organizationId: string;
  metricName: string;
  metricValue?: number;
}
