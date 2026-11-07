-- Migration 009: Multi-Tenant Inventory Ledger & Optimistic Concurrency Control

ALTER TABLE inventory.inventory_items
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default-tenant',
  ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT 'General Supply Item',
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'MAINTENANCE_PARTS',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- Drop old global unique constraint on sku if exists
ALTER TABLE inventory.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_sku_key;

-- Add compound unique constraint on (tenant_id, sku)
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_tenant_sku ON inventory.inventory_items(tenant_id, sku);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_id ON inventory.inventory_items(tenant_id);

-- Inventory reservations audit table
CREATE TABLE IF NOT EXISTS inventory.inventory_reservations (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'RESERVED',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_tenant_product ON inventory.inventory_reservations(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order ON inventory.inventory_reservations(order_id);

