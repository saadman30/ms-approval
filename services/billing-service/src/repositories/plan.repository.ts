import { pool } from '../config/database';
import { Plan, CreatePlanInput } from '../types/billing.types';

export class PlanRepository {
  async create(input: CreatePlanInput): Promise<Plan> {
    const result = await pool.query(
      `INSERT INTO plans (
        name, description, billing_period, price_amount, price_currency,
        max_projects, max_tasks, max_members, features
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.name,
        input.description,
        input.billingPeriod,
        input.priceAmount,
        input.priceCurrency || 'USD',
        input.maxProjects,
        input.maxTasks,
        input.maxMembers,
        input.features || [],
      ]
    );

    return this.mapRowToPlan(result.rows[0]);
  }

  async findById(id: string): Promise<Plan | null> {
    const result = await pool.query(
      'SELECT * FROM plans WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPlan(result.rows[0]);
  }

  async findActive(): Promise<Plan[]> {
    const result = await pool.query(
      'SELECT * FROM plans WHERE active = TRUE ORDER BY price_amount ASC'
    );

    return result.rows.map(row => this.mapRowToPlan(row));
  }

  async update(id: string, updates: Partial<CreatePlanInput>): Promise<Plan> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.maxProjects !== undefined) {
      updateFields.push(`max_projects = $${paramCount++}`);
      values.push(updates.maxProjects);
    }
    if (updates.maxTasks !== undefined) {
      updateFields.push(`max_tasks = $${paramCount++}`);
      values.push(updates.maxTasks);
    }
    if (updates.maxMembers !== undefined) {
      updateFields.push(`max_members = $${paramCount++}`);
      values.push(updates.maxMembers);
    }
    if (updates.features !== undefined) {
      updateFields.push(`features = $${paramCount++}`);
      values.push(updates.features);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE plans SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return this.mapRowToPlan(result.rows[0]);
  }

  private mapRowToPlan(row: any): Plan {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      billingPeriod: row.billing_period,
      priceAmount: parseFloat(row.price_amount),
      priceCurrency: row.price_currency,
      maxProjects: row.max_projects,
      maxTasks: row.max_tasks,
      maxMembers: row.max_members,
      features: row.features || [],
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
