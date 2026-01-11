-- Notifications table (for in-app notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,
  type VARCHAR(50) NOT NULL, -- 'email', 'in_app', 'webhook'
  channel VARCHAR(50) NOT NULL, -- 'invitation', 'task_assigned', 'password_reset', etc.
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_organization_id ON notifications(organization_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

-- Notification delivery tracking (for idempotency)
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  notification_id UUID REFERENCES notifications(id),
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_deliveries_event_id ON notification_deliveries(event_id);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status);
