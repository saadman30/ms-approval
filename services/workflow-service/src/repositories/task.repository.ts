import { pool } from '../config/database';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types/workflow.types';

export class TaskRepository {
  async create(input: CreateTaskInput): Promise<Task> {
    const result = await pool.query(
      `INSERT INTO tasks (organization_id, project_id, title, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.organizationId, input.projectId, input.title, input.description, input.createdBy]
    );

    return this.mapRowToTask(result.rows[0]);
  }

  async findById(id: string): Promise<Task | null> {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTask(result.rows[0]);
  }

  async findByProject(projectId: string): Promise<Task[]> {
    const result = await pool.query(
      `SELECT * FROM tasks
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    return result.rows.map(row => this.mapRowToTask(row));
  }

  async findByOrganization(organizationId: string): Promise<Task[]> {
    const result = await pool.query(
      `SELECT * FROM tasks
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    );

    return result.rows.map(row => this.mapRowToTask(row));
  }

  async countByOrganization(organizationId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM tasks
       WHERE organization_id = $1 AND status != 'cancelled'`,
      [organizationId]
    );

    return parseInt(result.rows[0].count) || 0;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(input.description);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(input.status);
      if (input.status === 'done') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      } else if (input.status !== 'done') {
        updates.push(`completed_at = NULL`);
      }
    }
    if (input.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(input.assignedTo);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return this.mapRowToTask(result.rows[0]);
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      assignedTo: row.assigned_to,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }
}
