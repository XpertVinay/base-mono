-- Migration: 013_property_portfolio_multitenancy.sql
-- Adds multi-tenant isolation, rentable units, floorplans, dynamic pricing, and ownership splits to property domain

-- 1. Ensure property schema exists
CREATE SCHEMA IF NOT EXISTS property;

-- 2. Base property table multi-tenancy
CREATE TABLE IF NOT EXISTS property.properties (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64),
    owner_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    property_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'VACANT',
    address JSONB NOT NULL,
    area_sq_ft NUMERIC(10, 2) NOT NULL,
    amenities JSONB DEFAULT '[]',
    emergency_contact JSONB NOT NULL,
    emergency_float_limit NUMERIC(12, 2) NOT NULL DEFAULT 5000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE property.properties ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON property.properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_tenant_status ON property.properties(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON property.properties(owner_id);

-- 3. Rentable Units table
CREATE TABLE IF NOT EXISTS property.units (
    id VARCHAR(36) PRIMARY KEY,
    property_id VARCHAR(36) NOT NULL REFERENCES property.properties(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64),
    unit_number VARCHAR(50) NOT NULL,
    floor INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'VACANT',
    rent_amount NUMERIC(12, 2) NOT NULL,
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    area_sq_ft NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_property_unit_number UNIQUE (property_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_property ON property.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_tenant ON property.units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON property.units(tenant_id, status);

-- 4. Architectural Floorplans
CREATE TABLE IF NOT EXISTS property.floorplans (
    id VARCHAR(36) PRIMARY KEY,
    property_id VARCHAR(36) NOT NULL REFERENCES property.properties(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64),
    name VARCHAR(100) NOT NULL,
    bedrooms INT NOT NULL DEFAULT 1,
    bathrooms NUMERIC(3, 1) NOT NULL DEFAULT 1.0,
    area_sq_ft NUMERIC(10, 2) NOT NULL,
    base_rent NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_floorplans_property ON property.floorplans(property_id);
CREATE INDEX IF NOT EXISTS idx_floorplans_tenant ON property.floorplans(tenant_id);

-- 5. Dynamic Seasonal Pricing Matrices
CREATE TABLE IF NOT EXISTS property.pricing_matrices (
    id VARCHAR(36) PRIMARY KEY,
    property_id VARCHAR(36) NOT NULL REFERENCES property.properties(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64),
    season_name VARCHAR(100) NOT NULL,
    multiplier NUMERIC(5, 4) NOT NULL DEFAULT 1.0000,
    effective_from DATE NOT NULL,
    effective_to DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_property ON property.pricing_matrices(property_id);
CREATE INDEX IF NOT EXISTS idx_pricing_tenant ON property.pricing_matrices(tenant_id);

-- 6. Multi-Owner Equity Splits Ledger (Must sum to 100.00%)
CREATE TABLE IF NOT EXISTS property.ownership_splits (
    id VARCHAR(36) PRIMARY KEY,
    property_id VARCHAR(36) NOT NULL REFERENCES property.properties(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64),
    owner_id VARCHAR(36) NOT NULL,
    share_percentage NUMERIC(5, 2) NOT NULL,
    disbursement_account VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ownership_property ON property.ownership_splits(property_id);
CREATE INDEX IF NOT EXISTS idx_ownership_tenant ON property.ownership_splits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ownership_owner ON property.ownership_splits(owner_id);
