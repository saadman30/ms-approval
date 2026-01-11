import { pool } from '../config/database';
import { Invitation, CreateInvitationInput } from '../types/organization.types';
import { randomUUID } from 'crypto';

export class InvitationRepository {
  async create(input: CreateInvitationInput, token: string): Promise<Invitation> {
    const result = await pool.query(
      `INSERT INTO invitations (organization_id, invitee_email, role, token, sent_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.organizationId,
        input.inviteeEmail,
        input.role,
        token,
        input.sentBy,
        input.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      ]
    );

    return this.mapRowToInvitation(result.rows[0]);
  }

  async findById(id: string): Promise<Invitation | null> {
    const result = await pool.query(
      'SELECT * FROM invitations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToInvitation(result.rows[0]);
  }

  async findByToken(token: string): Promise<Invitation | null> {
    const result = await pool.query(
      `SELECT * FROM invitations
       WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP
       AND accepted_at IS NULL AND rejected_at IS NULL`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToInvitation(result.rows[0]);
  }

  async findByOrganization(organizationId: string): Promise<Invitation[]> {
    const result = await pool.query(
      `SELECT * FROM invitations
       WHERE organization_id = $1
       ORDER BY sent_at DESC`,
      [organizationId]
    );

    return result.rows.map(row => this.mapRowToInvitation(row));
  }

  async markAccepted(id: string): Promise<void> {
    await pool.query(
      'UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  async markRejected(id: string): Promise<void> {
    await pool.query(
      'UPDATE invitations SET rejected_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  private mapRowToInvitation(row: any): Invitation {
    return {
      id: row.id,
      organizationId: row.organization_id,
      inviteeEmail: row.invitee_email,
      role: row.role,
      token: row.token,
      sentBy: row.sent_by,
      sentAt: row.sent_at,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      rejectedAt: row.rejected_at,
    };
  }
}
