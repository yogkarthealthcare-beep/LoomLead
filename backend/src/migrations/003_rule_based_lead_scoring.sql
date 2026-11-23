-- =====================================================================
-- Migration: 003_rule_based_lead_scoring.sql
-- Description: Rule-Based Lead Scoring Engine (0-100) per Tenant
-- Adds scoring_configs table and score breakdown & engagement fields to leads
-- =====================================================================

-- 1. Create Scoring Configs Table
CREATE TABLE IF NOT EXISTS scoring_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Default B2B Lead Scoring',
    config JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_scoring_configs_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_scoring_configs_tenant ON scoring_configs(tenant_id);

-- 2. Extend Leads Table with Scoring Attributes and Engagement Metrics
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS google_rating NUMERIC(3, 2) DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS score_value INTEGER DEFAULT 50,
    ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{"total_score": 50, "bucket": "Warm", "factors": []}'::jsonb,
    ADD COLUMN IF NOT EXISTS email_opens INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS email_clicks INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS whatsapp_replies INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_score_value ON leads(score_value);
CREATE INDEX IF NOT EXISTS idx_leads_google_rating ON leads(google_rating);
CREATE INDEX IF NOT EXISTS idx_leads_review_count ON leads(review_count);

-- 3. Seed Default Tenant Scoring Config for Existing Tenants
INSERT INTO scoring_configs (tenant_id, name, config)
SELECT id, 'Default Web Agency & B2B Scoring', '{
  "weights": {
    "no_website": 25,
    "has_website": 5,
    "rating_min_4": 20,
    "rating_min_4_5": 5,
    "reviews_min_20": 15,
    "reviews_min_50": 5,
    "has_phone": 10,
    "has_email": 10,
    "category_match": 10,
    "whatsapp_reply": 15,
    "email_open": 5,
    "email_click": 10,
    "recency_days_7": 10,
    "recency_days_30": 5
  },
  "rules": {
    "target_categories": ["Real Estate", "Coaching", "Hospital", "Dental Clinic", "Interior Designer", "Business & Commercial", "IT & Software"],
    "web_agency_combo": {
      "enabled": true,
      "bonus_points": 15,
      "conditions": {
        "no_website": true,
        "min_rating": 4.0,
        "min_reviews": 20
      }
    }
  },
  "thresholds": {
    "hot": 70,
    "warm": 40
  }
}'::jsonb
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
