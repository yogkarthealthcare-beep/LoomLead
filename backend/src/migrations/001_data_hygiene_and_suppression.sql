-- =====================================================================
-- Migration 001: Data Hygiene, Deduplication & Suppression List (DND)
-- =====================================================================

-- 1. Add hygiene columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS normalized_phone VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS normalized_domain VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. Populate sources from existing source if empty
UPDATE leads 
SET sources = ARRAY[source] 
WHERE (sources IS NULL OR array_length(sources, 1) IS NULL) AND source IS NOT NULL;

-- 3. Unique partial index on (tenant_id, normalized_phone)
-- Using partial index so null/empty phone values don't conflict
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_tenant_normalized_phone 
ON leads (tenant_id, normalized_phone) 
WHERE normalized_phone IS NOT NULL AND normalized_phone != '' AND is_deleted = FALSE;

-- 4. Unique partial index on (tenant_id, normalized_domain)
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_tenant_normalized_domain 
ON leads (tenant_id, normalized_domain) 
WHERE normalized_domain IS NOT NULL AND normalized_domain != '' AND is_deleted = FALSE;

-- 5. Create suppression_list table
CREATE TABLE IF NOT EXISTS suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('phone', 'email')),
    value VARCHAR(255) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('stop_keyword', 'unsubscribe', 'manual', 'bounce')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_suppression_tenant_type_value UNIQUE (tenant_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_suppression_tenant_type_val 
ON suppression_list (tenant_id, type, value);
