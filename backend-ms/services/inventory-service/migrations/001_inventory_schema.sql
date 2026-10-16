CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.inventory_items (
    product_id VARCHAR(36) PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    available_quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    total_quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventory.inventory_items (product_id, sku, available_quantity, reserved_quantity, total_quantity)
VALUES 
  ('prod-1', 'PROD-SKU-001', 100, 0, 100),
  ('prod-2', 'PROD-SKU-002', 50, 0, 50)
ON CONFLICT (product_id) DO NOTHING;
