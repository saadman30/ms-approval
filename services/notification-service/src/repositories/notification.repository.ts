import { pool } from '../config/database';
import { Notification, CreateNotificationInput } from '../types/notification.types';

export class NotificationRepository {
  async create(input: CreateNotificationInput): Promise<Notification> {
    const result = await pool.query(
      `INSERT INTO notifications (
        user_id, organization_id, type, channel, title, body, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        input.userId,
        input.organizationId,
        input.type,
        input.channel,
        input.title,
        input.body,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );

    return this.mapRowToNotification(result.rows[0]);
  }

  async findById(id: string): Promise<Notification | null> {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToNotification(result.rows[0]);
  }

  async findByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => this.mapRowToNotification(row));
  }

  async markAsRead(id: string): Promise<void> {
    await pool.query(
      `UPDATE notifications
       SET read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  private mapRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      type: row.type,
      channel: row.channel,
      title: row.title,
      body: row.body,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      read: row.read,
      readAt: row.read_at,
      sentAt: row.sent_at,
      createdAt: row.created_at,
    };
  }
}
