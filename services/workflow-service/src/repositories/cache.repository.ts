import { pool } from '../config/database';
import { MembershipCache, EntitlementsCache } from '../types/workflow.types';

export class CacheRepository {
  // Membership cache
  async upsertMembership(membership: MembershipCache): Promise<void> {
    await pool.query(
      `INSERT INTO membership_cache (organization_id, user_id, role, cached_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, cached_at = CURRENT_TIMESTAMP`,
      [membership.organizationId, membership.userId, membership.role]
    );
  }

  async getMembership(organizationId: string, userId: string): Promise<MembershipCache | null> {
    const result = await pool.query(
      `SELECT * FROM membership_cache
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      organizationId: result.rows[0].organization_id,
      userId: result.rows[0].user_id,
      role: result.rows[0].role,
      cachedAt: result.rows[0].cached_at,
    };
  }

  async deleteMembership(organizationId: string, userId: string): Promise<void> {
    await pool.query(
      'DELETE FROM membership_cache WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );
  }

  // Entitlements cache
  async upsertEntitlements(entitlements: EntitlementsCache): Promise<void> {
    await pool.query(
      `INSERT INTO entitlements_cache (
        organization_id, max_projects, max_tasks, max_members, features, cached_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (organization_id)
      DO UPDATE SET
        max_projects = EXCLUDED.max_projects,
        max_tasks = EXCLUDED.max_tasks,
        max_members = EXCLUDED.max_members,
        features = EXCLUDED.features,
        cached_at = CURRENT_TIMESTAMP`,
      [
        entitlements.organizationId,
        entitlements.maxProjects,
        entitlements.maxTasks,
        entitlements.maxMembers,
        entitlements.features,
      ]
    );
  }

  async getEntitlements(organizationId: string): Promise<EntitlementsCache | null> {
    const result = await pool.query(
      'SELECT * FROM entitlements_cache WHERE organization_id = $1',
      [organizationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      organizationId: result.rows[0].organization_id,
      maxProjects: result.rows[0].max_projects,
      maxTasks: result.rows[0].max_tasks,
      maxMembers: result.rows[0].max_members,
      features: result.rows[0].features || [],
      cachedAt: result.rows[0].cached_at,
    };
  }

  async deleteEntitlements(organizationId: string): Promise<void> {
    await pool.query(
      'DELETE FROM entitlements_cache WHERE organization_id = $1',
      [organizationId]
    );
  }
}
