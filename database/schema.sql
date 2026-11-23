-- =====================================================================
-- LOOMLEAD CRM - POSTGRESQL MULTI-TENANT DATABASE SCHEMA (DDL & SEEDS)
-- Compatible with PostgreSQL 14, 15, 16+
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. SUBSCRIPTION PLANS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- 'free', 'basic', 'medium', 'advanced'
    name VARCHAR(100) NOT NULL,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    price_yearly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    limits_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. TENANTS / COMPANIES (MULTI-TENANCY ROOT)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    industry VARCHAR(100) NOT NULL DEFAULT 'General Sales',
    logo_url TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    address TEXT,
    gst_tax_id VARCHAR(50),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    labels_config JSONB NOT NULL DEFAULT '{"lead":"Lead","pipeline":"Pipeline","deal":"Deal"}'::jsonb,
    theme VARCHAR(20) NOT NULL DEFAULT 'light',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ---------------------------------------------------------------------
-- 3. SUBSCRIPTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    status VARCHAR(50) NOT NULL DEFAULT 'trial', -- 'active', 'expired', 'trial', 'cancelled'
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    last_payment_reference VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

-- ---------------------------------------------------------------------
-- 4. USERS & ROLES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for SuperAdmin
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'staff', -- 'superadmin', 'admin', 'manager', 'staff', 'viewer'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'invited'
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------------------------------------------------------------------
-- 5. PIPELINE STAGES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stages_tenant ON pipeline_stages(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stages_tenant_name ON pipeline_stages(tenant_id, name);

-- ---------------------------------------------------------------------
-- 6. LEADS / CONTACTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    alt_phone VARCHAR(50),
    email VARCHAR(255),
    company_name VARCHAR(255),
    category VARCHAR(100) DEFAULT 'Business & Commercial',
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    source VARCHAR(100) NOT NULL DEFAULT 'Manual Entry', -- 'Google Maps', 'Website', 'Referral', 'Manual Entry', 'Social Media'
    status VARCHAR(50) NOT NULL DEFAULT 'New', -- 'New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'
    score VARCHAR(20) NOT NULL DEFAULT 'Warm', -- 'Hot', 'Warm', 'Cold'
    stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    budget_value NUMERIC(12, 2) DEFAULT 0.00,
    lost_reason TEXT,
    notes TEXT,
    next_followup_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(next_followup_at);

-- ---------------------------------------------------------------------
-- 7. CALL LOGS TABLE (COMPLETE CALL TRACKING)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL DEFAULT 'outbound', -- 'outbound', 'inbound'
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    outcome VARCHAR(50) NOT NULL, -- 'connected', 'busy', 'no_answer', 'wrong_number', 'callback_requested', 'deal_discussed'
    notes TEXT,
    recording_url TEXT,
    call_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_tenant_lead ON call_logs(tenant_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_user ON call_logs(user_id);

-- ---------------------------------------------------------------------
-- 8. TASKS & FOLLOW-UPS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Call', -- 'Call', 'Meeting', 'Email', 'Site Visit'
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'In Progress', 'Completed', 'Cancelled'
    reminder_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to_user_id);

-- ---------------------------------------------------------------------
-- 9. GOOGLE MAPS LEADS EXTRACTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_maps_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    search_keyword VARCHAR(255) NOT NULL,
    location_query VARCHAR(255) NOT NULL,
    place_id VARCHAR(255),
    business_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Business & Commercial',
    phone VARCHAR(50),
    formatted_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    rating NUMERIC(3, 1),
    user_ratings_total INTEGER,
    website_url TEXT,
    google_maps_url TEXT,
    is_imported BOOLEAN NOT NULL DEFAULT FALSE,
    imported_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gmap_tenant ON google_maps_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gmap_place ON google_maps_leads(place_id);

-- ---------------------------------------------------------------------
-- 10. AI AGENT COPILOT SESSIONS & ACTIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    user_prompt TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    intent_detected VARCHAR(100),
    actions_executed JSONB DEFAULT '[]'::jsonb, -- e.g. [{"action": "NAVIGATE", "route": "/leads"}, {"action": "CREATE_TASK", "id": "..."}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_tenant_user ON ai_conversations(tenant_id, user_id);

-- ---------------------------------------------------------------------
-- 11. PRODUCTS / SERVICES CATALOG TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    category VARCHAR(100),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products_services(tenant_id);

-- ---------------------------------------------------------------------
-- 12. QUOTATIONS & ITEMS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    quote_number VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_till DATE NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'accepted', 'rejected', 'expired'
    terms_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- ---------------------------------------------------------------------
-- 13. INVOICES & PAYMENTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'paid', 'pending', 'partial', 'overdue', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL, -- 'upi', 'credit_card', 'net_banking', 'cheque', 'cash'
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transaction_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 14. COMMUNICATION TEMPLATES & LOGS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- 'whatsapp', 'sms', 'email'
    subject VARCHAR(255),
    body_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
    message_content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 15. CUSTOM DYNAMIC FIELDS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- 'text', 'number', 'date', 'dropdown', 'checkbox', 'url'
    module VARCHAR(50) NOT NULL DEFAULT 'leads',
    options JSONB DEFAULT '[]'::jsonb,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL, -- e.g. lead_id
    field_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 16. AUTOMATION RULES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(100) NOT NULL, -- 'lead_created', 'status_changed', 'no_activity_days', 'task_overdue'
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 17. AUDIT TRAIL / LOGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    module VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'export', 'login'
    record_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON audit_logs(tenant_id, created_at);

-- ---------------------------------------------------------------------
-- 18. COUPONS & SUPPORT TICKETS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
    discount_value NUMERIC(10, 2) NOT NULL,
    max_uses INTEGER DEFAULT 100,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- INITIAL SEED DATA
-- =====================================================================

-- 1. Insert 4 Standard Plans
INSERT INTO plans (code, name, price_monthly, price_yearly, limits_json, features_json)
VALUES 
(
    'free',
    'Free Plan',
    0.00,
    0.00,
    '{"max_users": 1, "max_leads": 50, "max_gmap_searches": 5, "max_custom_fields": 0, "max_ai_queries_daily": 5}'::jsonb,
    '{"pipeline": false, "reports": false, "import_export": false, "automation": false, "quotations": false, "invoicing": false, "ai_copilot": true}'::jsonb
),
(
    'basic',
    'Basic Starter',
    999.00,
    9590.00,
    '{"max_users": 3, "max_leads": 1000, "max_gmap_searches": 50, "max_custom_fields": 5, "max_ai_queries_daily": 25}'::jsonb,
    '{"pipeline": true, "reports": false, "import_export": true, "automation": false, "quotations": false, "invoicing": false, "ai_copilot": true}'::jsonb
),
(
    'medium',
    'Medium Pro',
    2999.00,
    28790.00,
    '{"max_users": 10, "max_leads": 10000, "max_gmap_searches": 500, "max_custom_fields": 20, "max_ai_queries_daily": 150}'::jsonb,
    '{"pipeline": true, "reports": true, "import_export": true, "automation": true, "quotations": false, "invoicing": false, "ai_copilot": true}'::jsonb
),
(
    'advanced',
    'Advanced Enterprise',
    7999.00,
    76790.00,
    '{"max_users": 999999, "max_leads": 999999, "max_gmap_searches": 2500, "max_custom_fields": 999, "max_ai_queries_daily": 999999}'::jsonb,
    '{"pipeline": true, "reports": true, "import_export": true, "automation": true, "quotations": true, "invoicing": true, "ai_copilot": true}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- 2. Insert Super Admin User (tenant_id is NULL)
-- Default password: password123 (hashed with bcrypt)
INSERT INTO users (id, tenant_id, name, email, password_hash, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Super Admin',
    'admin@loomlead.com',
    '$2a$10$hsjI2SQ3sY2t9ns5lGm6B.KTk7UO2/eMRJc68A/YYMPNOuXtZ/xra',
    'superadmin',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- 3. Insert Demo Tenant: "Apex Realty Group"
INSERT INTO tenants (id, company_name, slug, industry, email, phone, website, currency, timezone, labels_config)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Apex Realty Group',
    'apex-realty',
    'Real Estate',
    'contact@apexrealty.com',
    '+91 98765 43210',
    'https://apexrealty.example.com',
    'INR',
    'Asia/Kolkata',
    '{"lead": "Buyer / Investor", "pipeline": "Property Pipeline", "deal": "Booking"}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- 4. Subscription for Demo Tenant (Medium Plan)
INSERT INTO subscriptions (id, tenant_id, plan_id, status, billing_cycle, starts_at, expires_at)
VALUES (
    '33333333-3333-3333-3333-333333333331',
    '11111111-1111-1111-1111-111111111111',
    3, -- Medium Pro
    'active',
    'monthly',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '30 days'
) ON CONFLICT (id) DO NOTHING;

-- 5. Insert Users for Demo Tenant
INSERT INTO users (id, tenant_id, name, email, password_hash, role, status)
VALUES 
(
    '22222222-2222-2222-2222-222222222221',
    '11111111-1111-1111-1111-111111111111',
    'Vikram Mehta',
    'vikram@apexrealty.com',
    '$2a$10$hsjI2SQ3sY2t9ns5lGm6B.KTk7UO2/eMRJc68A/YYMPNOuXtZ/xra',
    'admin',
    'active'
),
(
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Pooja Sharma',
    'pooja@apexrealty.com',
    '$2a$10$hsjI2SQ3sY2t9ns5lGm6B.KTk7UO2/eMRJc68A/YYMPNOuXtZ/xra',
    'manager',
    'active'
),
(
    '22222222-2222-2222-2222-222222222223',
    '11111111-1111-1111-1111-111111111111',
    'Amit Verma',
    'amit@apexrealty.com',
    '$2a$10$hsjI2SQ3sY2t9ns5lGm6B.KTk7UO2/eMRJc68A/YYMPNOuXtZ/xra',
    'staff',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- 6. Insert Default Pipeline Stages for Demo Tenant
INSERT INTO pipeline_stages (tenant_id, name, order_index, color_hex, is_won, is_lost)
VALUES
('11111111-1111-1111-1111-111111111111', 'New Inquiry', 1, '#3b82f6', FALSE, FALSE),
('11111111-1111-1111-1111-111111111111', 'Contacted / Pitch', 2, '#6366f1', FALSE, FALSE),
('11111111-1111-1111-1111-111111111111', 'Site Visit / Demo', 3, '#eab308', FALSE, FALSE),
('11111111-1111-1111-1111-111111111111', 'Proposal Sent', 4, '#8b5cf6', FALSE, FALSE),
('11111111-1111-1111-1111-111111111111', 'Negotiation', 5, '#f97316', FALSE, FALSE),
('11111111-1111-1111-1111-111111111111', 'Booking Won', 6, '#10b981', TRUE, FALSE),
('11111111-1111-1111-1111-111111111111', 'Lost Deal', 7, '#ef4444', FALSE, TRUE)
ON CONFLICT (tenant_id, name) DO NOTHING;
