-- =====================================================================
-- Migration: 002_sequence_drip_engine.sql
-- Description: Multi-Step Sequence (Drip) Engine for LoomLead CRM
-- Tables: sequences, sequence_steps, sequence_senders, enrollments, message_log
-- =====================================================================

-- 1. Sequences Table
CREATE TABLE IF NOT EXISTS sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'active', 'paused', 'draft', 'archived'
    daily_limit INTEGER NOT NULL DEFAULT 100,
    send_window_start VARCHAR(10) NOT NULL DEFAULT '09:00', -- HH:mm 24-hr format
    send_window_end VARCHAR(10) NOT NULL DEFAULT '18:00',   -- HH:mm 24-hr format
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sequences_tenant ON sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON sequences(status);

-- 2. Sequence Steps Table
CREATE TABLE IF NOT EXISTS sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 1,
    day_offset INTEGER NOT NULL DEFAULT 1, -- Day offset relative to sequence start (e.g. Day 1, Day 3, Day 5)
    minute_offset INTEGER DEFAULT NULL,    -- Optional granular minute offset for rapid testing / simulation
    channel VARCHAR(50) NOT NULL,          -- 'email', 'whatsapp'
    template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
    subject VARCHAR(255),
    body_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sequence_step_order UNIQUE (sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_seq ON sequence_steps(sequence_id);

-- 3. Sender Accounts Table (Multiple Sender Emails with Rotation & Daily Caps)
CREATE TABLE IF NOT EXISTS sequence_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    daily_cap INTEGER NOT NULL DEFAULT 50,
    sent_today INTEGER NOT NULL DEFAULT 0,
    last_sent_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_sender_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_sequence_senders_tenant ON sequence_senders(tenant_id);

-- 4. Sequence Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    current_step INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'replied', 'completed', 'stopped', 'failed'
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_lead ON enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status_next_run ON enrollments(status, next_run_at);

-- 5. Sequence Message Log Table
CREATE TABLE IF NOT EXISTS message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
    step_id UUID REFERENCES sequence_steps(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL, -- 'email', 'whatsapp'
    sender_email VARCHAR(255),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    body_content TEXT,
    status VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
    provider_message_id VARCHAR(255),
    error TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_log_tenant ON message_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_log_enrollment ON message_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_message_log_lead ON message_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_message_log_sent_at ON message_log(sent_at);
