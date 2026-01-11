import { pool } from '../config/database';
import { TaskMetrics, SubscriptionAnalytics, UsageDashboard } from '../types/analytics.types';

export class AnalyticsRepository {
  // Task metrics
  async upsertTaskMetrics(metrics: Partial<TaskMetrics>): Promise<TaskMetrics> {
    const result = await pool.query(
      `INSERT INTO task_metrics (
        organization_id, project_id, date, tasks_created, tasks_completed,
        tasks_in_progress, avg_completion_time_hours
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (organization_id, project_id, date)
      DO UPDATE SET
        tasks_created = task_metrics.tasks_created + EXCLUDED.tasks_created,
        tasks_completed = task_metrics.tasks_completed + EXCLUDED.tasks_completed,
        tasks_in_progress = task_metrics.tasks_in_progress + EXCLUDED.tasks_in_progress,
        avg_completion_time_hours = EXCLUDED.avg_completion_time_hours,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        metrics.organizationId,
        metrics.projectId,
        metrics.date,
        metrics.tasksCreated || 0,
        metrics.tasksCompleted || 0,
        metrics.tasksInProgress || 0,
        metrics.avgCompletionTimeHours,
      ]
    );

    return this.mapRowToTaskMetrics(result.rows[0]);
  }

  async getTaskMetrics(organizationId: string, startDate: Date, endDate: Date): Promise<TaskMetrics[]> {
    const result = await pool.query(
      `SELECT * FROM task_metrics
       WHERE organization_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date DESC`,
      [organizationId, startDate, endDate]
    );

    return result.rows.map(row => this.mapRowToTaskMetrics(row));
  }

  // Subscription analytics
  async upsertSubscriptionAnalytics(analytics: Partial<SubscriptionAnalytics>): Promise<SubscriptionAnalytics> {
    const result = await pool.query(
      `INSERT INTO subscription_analytics (
        organization_id, plan_id, plan_name, subscription_status,
        active_users, projects_count, tasks_count, period_start, period_end
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (organization_id, period_start)
      DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        plan_name = EXCLUDED.plan_name,
        subscription_status = EXCLUDED.subscription_status,
        active_users = EXCLUDED.active_users,
        projects_count = EXCLUDED.projects_count,
        tasks_count = EXCLUDED.tasks_count,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        analytics.organizationId,
        analytics.planId,
        analytics.planName,
        analytics.subscriptionStatus,
        analytics.activeUsers || 0,
        analytics.projectsCount || 0,
        analytics.tasksCount || 0,
        analytics.periodStart,
        analytics.periodEnd,
      ]
    );

    return this.mapRowToSubscriptionAnalytics(result.rows[0]);
  }

  async getSubscriptionAnalytics(organizationId: string): Promise<SubscriptionAnalytics | null> {
    const result = await pool.query(
      `SELECT * FROM subscription_analytics
       WHERE organization_id = $1
       ORDER BY period_start DESC
       LIMIT 1`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSubscriptionAnalytics(result.rows[0]);
  }

  // Usage dashboards
  async upsertUsageMetric(usage: Partial<UsageDashboard>): Promise<UsageDashboard> {
    const result = await pool.query(
      `INSERT INTO usage_dashboards (organization_id, metric_date, metric_name, metric_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, metric_date, metric_name)
       DO UPDATE SET
         metric_value = usage_dashboards.metric_value + EXCLUDED.metric_value,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        usage.organizationId,
        usage.metricDate,
        usage.metricName,
        usage.metricValue || 0,
      ]
    );

    return this.mapRowToUsageDashboard(result.rows[0]);
  }

  async getUsageMetrics(organizationId: string, startDate: Date, endDate: Date): Promise<UsageDashboard[]> {
    const result = await pool.query(
      `SELECT * FROM usage_dashboards
       WHERE organization_id = $1 AND metric_date >= $2 AND metric_date <= $3
       ORDER BY metric_date DESC, metric_name ASC`,
      [organizationId, startDate, endDate]
    );

    return result.rows.map(row => this.mapRowToUsageDashboard(row));
  }

  private mapRowToTaskMetrics(row: any): TaskMetrics {
    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      date: row.date,
      tasksCreated: row.tasks_created,
      tasksCompleted: row.tasks_completed,
      tasksInProgress: row.tasks_in_progress,
      avgCompletionTimeHours: row.avg_completion_time_hours ? parseFloat(row.avg_completion_time_hours) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToSubscriptionAnalytics(row: any): SubscriptionAnalytics {
    return {
      id: row.id,
      organizationId: row.organization_id,
      planId: row.plan_id,
      planName: row.plan_name,
      subscriptionStatus: row.subscription_status,
      activeUsers: row.active_users,
      projectsCount: row.projects_count,
      tasksCount: row.tasks_count,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToUsageDashboard(row: any): UsageDashboard {
    return {
      id: row.id,
      organizationId: row.organization_id,
      metricDate: row.metric_date,
      metricName: row.metric_name,
      metricValue: row.metric_value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
