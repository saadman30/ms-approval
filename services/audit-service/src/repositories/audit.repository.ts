import { pool } from '../config/database';
import { AuditLog, AuditQuery } from '../types/audit.types';
import { BaseEvent } from '@microservice-learning/events';

export class AuditRepository {
  async create(event: BaseEvent, action: string, resourceType: string, resourceId?: string): Promise<AuditLog> {
    const result = await pool.query(
      `INSERT INTO audit_logs (
        event_id, event_type, event_version, source, correlation_id, trace_id,
        user_id, organization_id, action, resource_type, resource_id, details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        event.eventId,
        event.eventType,
        event.eventVersion,
        event.source,
        event.correlationId,
        event.traceId,
        event.userId,
        event.organizationId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(event),
      ]
    );

    return this.mapRowToAuditLog(result.rows[0]);
  }

  async query(query: AuditQuery): Promise<AuditLog[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (query.userId) {
      conditions.push(`user_id = $${paramCount++}`);
      values.push(query.userId);
    }
    if (query.organizationId) {
      conditions.push(`organization_id = $${paramCount++}`);
      values.push(query.organizationId);
    }
    if (query.resourceType) {
      conditions.push(`resource_type = $${paramCount++}`);
      values.push(query.resourceType);
    }
    if (query.resourceId) {
      conditions.push(`resource_id = $${paramCount++}`);
      values.push(query.resourceId);
    }
    if (query.action) {
      conditions.push(`action = $${paramCount++}`);
      values.push(query.action);
    }
    if (query.startDate) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(query.startDate);
    }
    if (query.endDate) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(query.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    const result = await pool.query(
      `SELECT * FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      [...values, limit, offset]
    );

    return result.rows.map(row => this.mapRowToAuditLog(row));
  }

  async findByEventId(eventId: string): Promise<AuditLog | null> {
    const result = await pool.query(
      'SELECT * FROM audit_logs WHERE event_id = $1',
      [eventId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAuditLog(result.rows[0]);
  }

  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      eventVersion: row.event_version,
      source: row.source,
      correlationId: row.correlation_id,
      traceId: row.trace_id,
      userId: row.user_id,
      organizationId: row.organization_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details ? JSON.parse(row.details) : {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    };
  }
}
