import { pool } from '../config/database';
import { NotificationDelivery } from '../types/notification.types';

export class DeliveryRepository {
  async create(eventId: string, channel: string, notificationId?: string): Promise<NotificationDelivery> {
    const result = await pool.query(
      `INSERT INTO notification_deliveries (event_id, notification_id, channel, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [eventId, notificationId, channel]
    );

    return this.mapRowToDelivery(result.rows[0]);
  }

  async findByEventId(eventId: string): Promise<NotificationDelivery | null> {
    const result = await pool.query(
      'SELECT * FROM notification_deliveries WHERE event_id = $1',
      [eventId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDelivery(result.rows[0]);
  }

  async markAsSent(id: string): Promise<void> {
    await pool.query(
      `UPDATE notification_deliveries
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await pool.query(
      `UPDATE notification_deliveries
       SET status = 'failed', last_error = $1, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [error, id]
    );
  }

  async markAsRetrying(id: string): Promise<void> {
    await pool.query(
      `UPDATE notification_deliveries
       SET status = 'retrying', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  async getPendingDeliveries(limit: number = 100): Promise<NotificationDelivery[]> {
    const result = await pool.query(
      `SELECT * FROM notification_deliveries
       WHERE status IN ('pending', 'retrying')
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => this.mapRowToDelivery(row));
  }

  private mapRowToDelivery(row: any): NotificationDelivery {
    return {
      id: row.id,
      eventId: row.event_id,
      notificationId: row.notification_id,
      channel: row.channel,
      status: row.status,
      attempts: row.attempts,
      lastError: row.last_error,
      sentAt: row.sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
