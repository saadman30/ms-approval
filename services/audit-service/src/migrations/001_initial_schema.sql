-- Audit logs table (append-only, immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE, -- From domain event
  event_type VARCHAR(100) NOT NULL,
  event_version VARCHAR(10) NOT NULL,
  source VARCHAR(100) NOT NULL, -- Service name
  correlation_id UUID NOT NULL,
  trace_id UUID,
  user_id UUID,
  organization_id UUID,
  action VARCHAR(100) NOT NULL, -- 'created', 'updated', 'deleted', 'login', etc.
  resource_type VARCHAR(100) NOT NULL, -- 'user', 'organization', 'task', etc.
  resource_id UUID,
  details JSONB, -- Full event data
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_event_id ON audit_logs(event_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);

-- Partitioning by month (for large-scale deployments)
-- CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
