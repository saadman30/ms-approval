-- Analytics read model tables (event-sourced, eventually consistent)

-- Task throughput metrics
CREATE TABLE IF NOT EXISTS task_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  project_id UUID,
  date DATE NOT NULL,
  tasks_created INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_in_progress INTEGER DEFAULT 0,
  avg_completion_time_hours DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, project_id, date)
);

CREATE INDEX idx_task_metrics_organization_id ON task_metrics(organization_id);
CREATE INDEX idx_task_metrics_date ON task_metrics(date);

-- Subscription analytics
CREATE TABLE IF NOT EXISTS subscription_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  plan_id UUID,
  plan_name VARCHAR(255),
  subscription_status VARCHAR(20),
  active_users INTEGER DEFAULT 0,
  projects_count INTEGER DEFAULT 0,
  tasks_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, period_start)
);

CREATE INDEX idx_subscription_analytics_organization_id ON subscription_analytics(organization_id);
CREATE INDEX idx_subscription_analytics_period ON subscription_analytics(period_start, period_end);

-- Usage dashboards (aggregated)
CREATE TABLE IF NOT EXISTS usage_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, metric_date, metric_name)
);

CREATE INDEX idx_usage_dashboards_organization_id ON usage_dashboards(organization_id);
CREATE INDEX idx_usage_dashboards_date ON usage_dashboards(metric_date);
