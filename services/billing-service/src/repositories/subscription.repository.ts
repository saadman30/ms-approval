import { pool } from '../config/database';
import { Subscription, CreateSubscriptionInput } from '../types/billing.types';

export class SubscriptionRepository {
  async create(input: CreateSubscriptionInput, periodStart: Date, periodEnd: Date): Promise<Subscription> {
    const result = await pool.query(
      `INSERT INTO subscriptions (
        organization_id, plan_id, current_period_start, current_period_end
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [input.organizationId, input.planId, periodStart, periodEnd]
    );

    return this.mapRowToSubscription(result.rows[0]);
  }

  async findById(id: string): Promise<Subscription | null> {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSubscription(result.rows[0]);
  }

  async findByOrganizationId(organizationId: string): Promise<Subscription | null> {
    const result = await pool.query(
      `SELECT * FROM subscriptions
       WHERE organization_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSubscription(result.rows[0]);
  }

  async updatePlan(id: string, newPlanId: string, periodStart: Date, periodEnd: Date): Promise<Subscription> {
    const result = await pool.query(
      `UPDATE subscriptions
       SET plan_id = $1, current_period_start = $2, current_period_end = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [newPlanId, periodStart, periodEnd, id]
    );

    return this.mapRowToSubscription(result.rows[0]);
  }

  async cancel(id: string, cancelAtPeriodEnd: boolean = false): Promise<Subscription> {
    const result = await pool.query(
      `UPDATE subscriptions
       SET status = CASE WHEN $1 THEN status ELSE 'cancelled' END,
           cancelled_at = CASE WHEN $1 THEN cancelled_at ELSE CURRENT_TIMESTAMP END,
           cancel_at_period_end = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [cancelAtPeriodEnd, id]
    );

    return this.mapRowToSubscription(result.rows[0]);
  }

  async expire(id: string): Promise<void> {
    await pool.query(
      `UPDATE subscriptions
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  private mapRowToSubscription(row: any): Subscription {
    return {
      id: row.id,
      organizationId: row.organization_id,
      planId: row.plan_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelledAt: row.cancelled_at,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
