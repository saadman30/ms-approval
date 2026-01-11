-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  price_amount DECIMAL(10, 2) NOT NULL,
  price_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  max_projects INTEGER,
  max_tasks INTEGER,
  max_members INTEGER,
  features TEXT[], -- Array of feature names
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plans_active ON plans(active);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Entitlements cache table (denormalized for fast access)
CREATE TABLE IF NOT EXISTS entitlements (
  organization_id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id),
  plan_id UUID REFERENCES plans(id),
  max_projects INTEGER,
  max_tasks INTEGER,
  max_members INTEGER,
  features TEXT[],
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entitlements_organization_id ON entitlements(organization_id);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id),
  metric_name VARCHAR(100) NOT NULL, -- e.g., 'projects_created', 'tasks_created'
  metric_value INTEGER NOT NULL DEFAULT 1,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_organization_id ON usage(organization_id);
CREATE INDEX idx_usage_period ON usage(period_start, period_end);
CREATE INDEX idx_usage_metric ON usage(metric_name);
