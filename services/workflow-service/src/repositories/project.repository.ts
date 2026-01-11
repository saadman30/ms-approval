import { pool } from '../config/database';
import { Project, CreateProjectInput } from '../types/workflow.types';

export class ProjectRepository {
  async create(input: CreateProjectInput): Promise<Project> {
    const result = await pool.query(
      `INSERT INTO projects (organization_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.organizationId, input.name, input.description, input.createdBy]
    );

    return this.mapRowToProject(result.rows[0]);
  }

  async findById(id: string): Promise<Project | null> {
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND status != \'deleted\'',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }

  async findByOrganization(organizationId: string): Promise<Project[]> {
    const result = await pool.query(
      `SELECT * FROM projects
       WHERE organization_id = $1 AND status != 'deleted'
       ORDER BY created_at DESC`,
      [organizationId]
    );

    return result.rows.map(row => this.mapRowToProject(row));
  }

  async countByOrganization(organizationId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM projects
       WHERE organization_id = $1 AND status = 'active'`,
      [organizationId]
    );

    return parseInt(result.rows[0].count) || 0;
  }

  async archive(id: string): Promise<Project> {
    const result = await pool.query(
      `UPDATE projects
       SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return this.mapRowToProject(result.rows[0]);
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    };
  }
}
