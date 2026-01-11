import { pool } from '../config/database';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
}

export class SessionRepository {
  async create(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const sessionId = randomUUID();

    const result = await pool.query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sessionId, userId, refreshTokenHash, ipAddress, userAgent, expiresAt]
    );

    return this.mapRowToSession(result.rows[0]);
  }

  async findById(id: string): Promise<Session | null> {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSession(result.rows[0]);
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    // We need to check all sessions and compare hashes
    // In production, consider storing a token identifier separately
    const result = await pool.query(
      'SELECT * FROM sessions WHERE expires_at > CURRENT_TIMESTAMP'
    );

    for (const row of result.rows) {
      const match = await bcrypt.compare(refreshToken, row.refresh_token_hash);
      if (match) {
        return this.mapRowToSession(row);
      }
    }

    return null;
  }

  async updateLastAccessed(id: string): Promise<void> {
    await pool.query(
      'UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  async delete(id: string): Promise<void> {
    await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  async deleteExpired(): Promise<void> {
    await pool.query('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
  }

  private mapRowToSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      refreshTokenHash: row.refresh_token_hash,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
    };
  }
}
