import { pool } from '../config/database';
import bcrypt from 'bcrypt';

export class CredentialRepository {
  async create(userId: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 10);
    
    await pool.query(
      `INSERT INTO credentials (user_id, password_hash)
       VALUES ($1, $2)`,
      [userId, passwordHash]
    );
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT password_hash FROM credentials WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    return bcrypt.compare(password, result.rows[0].password_hash);
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      `UPDATE credentials SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [passwordHash, userId]
    );
  }

  async delete(userId: string): Promise<void> {
    await pool.query('DELETE FROM credentials WHERE user_id = $1', [userId]);
  }
}
