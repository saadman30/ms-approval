export interface Notification {
  id: string;
  userId: string;
  organizationId?: string;
  type: 'email' | 'in_app' | 'webhook';
  channel: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  sentAt: Date;
  createdAt: Date;
}

export interface NotificationDelivery {
  id: string;
  eventId: string;
  notificationId?: string;
  channel: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastError?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  organizationId?: string;
  type: 'email' | 'in_app' | 'webhook';
  channel: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}
