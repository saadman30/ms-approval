import { pool } from '../config/database';
import { Organization, CreateOrganizationInput } from '../types/organization.types';

export class OrganizationRepository {
  async create(input: CreateOrganizationInput): Promise<Organization> {
    const result = await pool.query(
      `INSERT INTO organizations (name, created_by)
       VALUES ($1, $2)
       RETURNING *`,
      [input.name, input.createdBy]
    );

    return this.mapRowToOrganization(result.rows[0]);
  }

  async findById(id: string): Promise<Organization | null> {
    const result = await pool.query(
      'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToOrganization(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<Organization[]> {
    const result = await pool.query(
      `SELECT o.* FROM organizations o
       INNER JOIN memberships m ON o.id = m.organization_id
       WHERE m.user_id = $1 AND m.deleted_at IS NULL AND o.deleted_at IS NULL`,
      [userId]
    );

    return result.rows.map(row => this.mapRowToOrganization(row));
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await pool.query(
      `UPDATE organizations SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
  }

  private mapRowToOrganization(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }
}
