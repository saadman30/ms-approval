import { pool } from '../config/database';
import { Entitlement } from '../types/billing.types';

export class EntitlementRepository {
  async upsert(entitlement: Entitlement): Promise<Entitlement> {
    const result = await pool.query(
      `INSERT INTO entitlements (
        organization_id, subscription_id, plan_id,
        max_projects, max_tasks, max_members, features
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (organization_id)
      DO UPDATE SET
        subscription_id = EXCLUDED.subscription_id,
        plan_id = EXCLUDED.plan_id,
        max_projects = EXCLUDED.max_projects,
        max_tasks = EXCLUDED.max_tasks,
        max_members = EXCLUDED.max_members,
        features = EXCLUDED.features,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        entitlement.organizationId,
        entitlement.subscriptionId,
        entitlement.planId,
        entitlement.maxProjects,
        entitlement.maxTasks,
        entitlement.maxMembers,
        entitlement.features,
      ]
    );

    return this.mapRowToEntitlement(result.rows[0]);
  }

  async findByOrganizationId(organizationId: string): Promise<Entitlement | null> {
    const result = await pool.query(
      'SELECT * FROM entitlements WHERE organization_id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntitlement(result.rows[0]);
  }

  async deleteByOrganizationId(organizationId: string): Promise<void> {
    await pool.query(
      'DELETE FROM entitlements WHERE organization_id = $1',
      [organizationId]
    );
  }

  private mapRowToEntitlement(row: any): Entitlement {
    return {
      organizationId: row.organization_id,
      subscriptionId: row.subscription_id,
      planId: row.plan_id,
      maxProjects: row.max_projects,
      maxTasks: row.max_tasks,
      maxMembers: row.max_members,
      features: row.features || [],
      updatedAt: row.updated_at,
    };
  }
}
