export interface TaskMetrics {
  id: string;
  organizationId: string;
  projectId?: string;
  date: Date;
  tasksCreated: number;
  tasksCompleted: number;
  tasksInProgress: number;
  avgCompletionTimeHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionAnalytics {
  id: string;
  organizationId: string;
  planId?: string;
  planName?: string;
  subscriptionStatus: string;
  activeUsers: number;
  projectsCount: number;
  tasksCount: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageDashboard {
  id: string;
  organizationId: string;
  metricDate: Date;
  metricName: string;
  metricValue: number;
  createdAt: Date;
  updatedAt: Date;
}
