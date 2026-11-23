-- Migration: 005_auth_demo_and_client_management.sql
-- Description: Adds is_demo flags, indexes, and provisions Demo Workspace & sample showcase data

-- 1. Add is_demo flag to users and tenants if not exists
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- 2. Create index on users email for high-speed login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 3. Create Demo Tenant (if not exists)
INSERT INTO tenants (id, company_name, slug, industry, email, phone, website, is_active, is_demo)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'LoomLead Interactive Demo',
    'loomlead-demo',
    'B2B SaaS & Agency',
    'demo@loomlead.com',
    '+91 98765 43210',
    'https://loomlead-ec191.web.app',
    TRUE,
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create Demo Subscription on Free/Demo Plan
INSERT INTO subscriptions (tenant_id, plan_id, status, billing_cycle, starts_at, expires_at)
SELECT 
    '00000000-0000-0000-0000-000000000002',
    p.id,
    'active',
    'monthly',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '365 days'
FROM plans p
WHERE p.code = 'free'
LIMIT 1
ON CONFLICT DO NOTHING;

-- 5. Create Demo User
INSERT INTO users (id, tenant_id, name, email, password_hash, role, status, is_demo)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'Demo Explorer',
    'demo@loomlead.com',
    '$2a$10$wT8KjK9.YFm90YhQn8vCze04Lrk7KxH1v1YpWn8qYpWn8qYpWn8qY', -- bcrypt placeholder
    'demo',
    'active',
    TRUE
)
ON CONFLICT (id) DO UPDATE SET role = 'demo', is_demo = TRUE;

-- 6. Seed Showcase Sample Leads for Demo Mode if none exist for Demo Tenant
INSERT INTO leads (tenant_id, name, phone, normalized_phone, email, company_name, category, source, status, score, score_value, budget_value, next_followup_at, created_at)
SELECT 
    '00000000-0000-0000-0000-000000000002',
    'Aarav Singhania',
    '+91 98200 11223',
    '+919820011223',
    'aarav@apextech.in',
    'Apex Tech Ventures',
    'Software & IT',
    'Google Maps',
    'Contacted',
    'Hot',
    88,
    75000,
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE tenant_id = '00000000-0000-0000-0000-000000000002');

INSERT INTO leads (tenant_id, name, phone, normalized_phone, email, company_name, category, source, status, score, score_value, budget_value, next_followup_at, created_at)
SELECT 
    '00000000-0000-0000-0000-000000000002',
    'Dr. Priya Deshmukh',
    '+91 97654 32109',
    '+919765432109',
    'priya@dentacare.com',
    'DentaCare Multispeciality',
    'Healthcare & Dental',
    'Google Maps',
    'New',
    'Warm',
    64,
    45000,
    CURRENT_TIMESTAMP + INTERVAL '4 hours',
    CURRENT_TIMESTAMP
WHERE (SELECT COUNT(*) FROM leads WHERE tenant_id = '00000000-0000-0000-0000-000000000002') < 2;

INSERT INTO leads (tenant_id, name, phone, normalized_phone, email, company_name, category, source, status, score, score_value, budget_value, next_followup_at, created_at)
SELECT 
    '00000000-0000-0000-0000-000000000002',
    'Rohan Kulkarni',
    '+91 98901 23456',
    '+919890123456',
    'rohan@zenithfit.co',
    'Zenith Fitness & Crossfit',
    'Gyms & Fitness',
    'Direct Outreach',
    'Won',
    'Hot',
    95,
    120000,
    NULL,
    CURRENT_TIMESTAMP
WHERE (SELECT COUNT(*) FROM leads WHERE tenant_id = '00000000-0000-0000-0000-000000000002') < 3;
