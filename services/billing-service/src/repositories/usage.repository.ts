import { pool } from '../config/database';
import { Usage, TrackUsageInput } from '../types/billing.types';

export class UsageRepository {
  async track(input: TrackUsageInput, periodStart: Date, periodEnd: Date): Promise<Usage> {
    const result = await pool.query(
      `INSERT INTO usage (
        organization_id, metric_name, metric_value, period_start, period_end
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        input.organizationId,
        input.metricName,
        input.metricValue || 1,
        periodStart,
        periodEnd,
      ]
    );

    return this.mapRowToUsage(result.rows[0]);
  }

  async getUsage(
    organizationId: string,
    metricName: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(SUM(metric_value), 0) as total
       FROM usage
       WHERE organization_id = $1
         AND metric_name = $2
         AND period_start >= $3
         AND period_end <= $4`,
      [organizationId, metricName, periodStart, periodEnd]
    );

    return parseInt(result.rows[0].total) || 0;
  }

  async getUsageByOrganization(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Record<string, number>> {
    const result = await pool.query(
      `SELECT metric_name, SUM(metric_value) as total
       FROM usage
       WHERE organization_id = $1
         AND period_start >= $2
         AND period_end <= $3
       GROUP BY metric_name`,
      [organizationId, periodStart, periodEnd]
    );

    const usage: Record<string, number> = {};
    for (const row of result.rows) {
      usage[row.metric_name] = parseInt(row.total) || 0;
    }

    return usage;
  }

  private mapRowToUsage(row: any): Usage {
    return {
      id: row.id,
      organizationId: row.organization_id,
      subscriptionId: row.subscription_id,
      metricName: row.metric_name,
      metricValue: row.metric_value,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      recordedAt: row.recorded_at,
    };
  }
}
