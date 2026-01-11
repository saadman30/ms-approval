import { pool } from '../config/database';
import { User, CreateUserInput, UpdateUserInput } from '../types/user.types';

export class UserRepository {
  async create(input: CreateUserInput): Promise<User> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const userResult = await client.query(
        `INSERT INTO users (email, first_name, last_name)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.email, input.firstName, input.lastName]
      );
      
      await client.query('COMMIT');
      return this.mapRowToUser(userResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(result.rows[0]);
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(input.firstName);
    }
    if (input.lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(input.lastName);
    }
    if (input.emailVerified !== undefined) {
      updates.push(`email_verified = $${paramCount++}`);
      values.push(input.emailVerified);
    }
    if (input.mfaEnabled !== undefined) {
      updates.push(`mfa_enabled = $${paramCount++}`);
      values.push(input.mfaEnabled);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return this.mapRowToUser(result.rows[0]);
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      emailVerified: row.email_verified,
      mfaEnabled: row.mfa_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
