import { pool } from '../config/database';
import { Membership, CreateMembershipInput } from '../types/organization.types';

export class MembershipRepository {
  async create(input: CreateMembershipInput): Promise<Membership> {
    const result = await pool.query(
      `INSERT INTO memberships (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.organizationId, input.userId, input.role]
    );

    return this.mapRowToMembership(result.rows[0]);
  }

  async findById(id: string): Promise<Membership | null> {
    const result = await pool.query(
      'SELECT * FROM memberships WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMembership(result.rows[0]);
  }

  async findByOrganizationAndUser(
    organizationId: string,
    userId: string
  ): Promise<Membership | null> {
    const result = await pool.query(
      `SELECT * FROM memberships
       WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [organizationId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToMembership(result.rows[0]);
  }

  async findByOrganization(organizationId: string): Promise<Membership[]> {
    const result = await pool.query(
      `SELECT * FROM memberships
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [organizationId]
    );

    return result.rows.map(row => this.mapRowToMembership(row));
  }

  async findByUser(userId: string): Promise<Membership[]> {
    const result = await pool.query(
      `SELECT * FROM memberships
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [userId]
    );

    return result.rows.map(row => this.mapRowToMembership(row));
  }

  async updateRole(id: string, newRole: string): Promise<Membership> {
    const result = await pool.query(
      `UPDATE memberships SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [newRole, id]
    );

    return this.mapRowToMembership(result.rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    await pool.query(
      `UPDATE memberships SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
  }

  async softDeleteByOrganizationAndUser(
    organizationId: string,
    userId: string
  ): Promise<void> {
    await pool.query(
      `UPDATE memberships SET deleted_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [organizationId, userId]
    );
  }

  private mapRowToMembership(row: any): Membership {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
