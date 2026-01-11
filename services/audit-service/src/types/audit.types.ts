export interface AuditLog {
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: string;
  source: string;
  correlationId: string;
  traceId?: string;
  userId?: string;
  organizationId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface AuditQuery {
  userId?: string;
  organizationId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
