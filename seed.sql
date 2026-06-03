-- ====================================================================
-- CHILL CLEAN SLATE RESET (Optional, uncomment if initializing fresh)
-- ====================================================================
-- DROP TABLE IF EXISTS logistics_events CASCADE;
-- DROP TABLE IF EXISTS batch_lineage CASCADE;
-- DROP TABLE IF EXISTS batches CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ====================================================================
-- 1. SCHEMA DEFINITION
-- ====================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator'
);

CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    sku TEXT NOT NULL,
    batch_number TEXT UNIQUE NOT NULL,
    total_quantity NUMERIC(12,2) NOT NULL CHECK (total_quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    current_facility TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_lineage (
    parent_batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
    child_batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
    split_quantity NUMERIC(12,2) NOT NULL CHECK (split_quantity > 0),
    PRIMARY KEY (parent_batch_id, child_batch_id)
);

CREATE TABLE IF NOT EXISTS logistics_events (
    id SERIAL PRIMARY KEY,
    batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    facility TEXT NOT NULL,
    logged_by INT REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 2. LEDGER IMMUTABILITY SECURITY TRIGGER
-- ====================================================================
CREATE OR REPLACE FUNCTION enforce_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutability Violation: Mutations or deletions are strictly prohibited on the logistics_events ledger.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_ledger ON logistics_events;
CREATE TRIGGER trg_protect_ledger
BEFORE UPDATE OR DELETE ON logistics_events
FOR EACH ROW EXECUTE FUNCTION enforce_ledger_immutability();

-- ====================================================================
-- 3. SEED SELECTION DATA POOLS
-- ====================================================================

-- Seed System Operators
INSERT INTO users (id, username, role) VALUES 
(1, 'operator_alpha', 'Logistics Specialist'),
(2, 'operator_beta', 'Quality Controller')
ON CONFLICT (id) DO NOTHING;

-- Disable immutability trigger temporarily to allow seed injection
ALTER TABLE logistics_events DISABLE TRIGGER trg_protect_ledger;

-- --------------------------------------------------------------------
-- STREAM A: COFFEE CHAIN LINEAGE (Multi-generational tree)
-- --------------------------------------------------------------------
-- Generation 0: Absolute Root Parent
INSERT INTO batches (id, sku, batch_number, total_quantity, unit, current_facility) 
VALUES (101, 'RAW-COFFEE-01', 'B-COF-BR-001', 150.00, 'kg', 'Santos Processing Hub') ON CONFLICT (id) DO NOTHING;

-- Generation 1: Intermediate Splits (Processed Beans)
INSERT INTO batches (id, sku, batch_number, total_quantity, unit, current_facility) VALUES 
(102, 'ROAST-COF-MED', 'B-COF-ROAST-A', 400.00, 'kg', 'Antwerp Roastery Facility'),
(105, 'ROAST-COF-DRK', 'B-COF-ROAST-B', 350.00, 'kg', 'Rotterdam Packaging Plant')
ON CONFLICT (id) DO NOTHING;

-- Generation 2: Retail Ends (Grandchildren nodes spawned from Roasted splits)
INSERT INTO batches (id, sku, batch_number, total_quantity, unit, current_facility) VALUES 
(106, 'COF-PACK-250G', 'B-COF-RETAIL-01', 25.00, 'kg', 'Hamburg Distribution Center'),
(107, 'COF-PACK-250G', 'B-COF-RETAIL-02', 25.00, 'kg', 'In Transit - Nordics Route'),
(108, 'ROAST-COF-DRK', 'B-COF-LOC-GX', 50.00, 'kg', 'Karachi Freight Depot')
ON CONFLICT (id) DO NOTHING;

-- Establish Coffee Structural Lineage DAG Connections
INSERT INTO batch_lineage (parent_batch_id, child_batch_id, split_quantity) VALUES 
(101, 102, 400.00), -- 400kg split to Roast A
(101, 105, 450.00), -- 450kg split to Roast B
(102, 106, 25.00),   -- 25kg retail pack from Roast A
(102, 107, 25.00),   -- 25kg retail pack from Roast A
(105, 108, 50.00)    -- 50kg localized allocation from Roast B
ON CONFLICT DO NOTHING;

-- Log Coffee Chain Ledger History
INSERT INTO logistics_events (id, batch_id, event_type, facility, logged_by, metadata) VALUES 
(1, 101, 'sourced', 'Santos Processing Hub', 1, '{"origin": "Brazil Cerrado Farms", "moisture_level": "11.2%"}'),
(2, 102, 'manufactured', 'Antwerp Roastery Facility', 1, '{"roast_profile": "Medium Roast", "duration_minutes": 14}'),
(3, 105, 'manufactured', 'Rotterdam Packaging Plant', 2, '{"roast_profile": "Dark Roast", "target_density": "0.42"}'),
(4, 101, 'split', 'Santos Processing Hub', 1, '{"split_to_children": [102, 105], "total_split_deducted": 850.00}'),
(5, 106, 'manufactured', 'Hamburg Distribution Center', 2, '{"packaging": "Vacuum Sealed Foil Packs"}'),
(6, 107, 'manufactured', 'In Transit - Nordics Route', 1, '{"shipping_carrier": "EuroFreight Logistics"}'),
(7, 102, 'split', 'Antwerp Roastery Facility', 1, '{"split_to_children": [106, 107], "total_split_deducted": 50.00}'),
(8, 108, 'manufactured', 'Karachi Freight Depot', 2, '{"customs_status": "Cleared"}'),
(9, 105, 'split', 'Rotterdam Packaging Plant', 2, '{"split_to_children": [108], "total_split_deducted": 50.00}')
ON CONFLICT (id) DO NOTHING;


-- --------------------------------------------------------------------
-- STREAM B: COCOA CHAIN LINEAGE (Single-stage active split)
-- --------------------------------------------------------------------
-- Generation 0: Absolute Root Parent
INSERT INTO batches (id, sku, batch_number, total_quantity, unit, current_facility) 
VALUES (103, 'COCOA-GH-05', 'B-CC-GH-4041', 800.00, 'kg', 'Tema Port Export Zone') ON CONFLICT (id) DO NOTHING;

-- Log Cocoa Chain Ledger History
INSERT INTO logistics_events (id, batch_id, event_type, facility, logged_by, metadata) VALUES 
(10, 103, 'sourced', 'Tema Port Export Zone', 1, '{"origin": "Ghana Western Region Cooperative", "grade": "A", "fermentation_days": 6}')
ON CONFLICT (id) DO NOTHING;


-- --------------------------------------------------------------------
-- STREAM C: MATCHA CHAIN LINEAGE (Single-stage active split)
-- --------------------------------------------------------------------
-- Generation 0: Absolute Root Parent
INSERT INTO batches (id, sku, batch_number, total_quantity, unit, current_facility) 
VALUES (104, 'MATCHA-KYOTO', 'B-MTC-KY-772', 150.00, 'kg', 'Kyoto Processing Plant') ON CONFLICT (id) DO NOTHING;

-- Log Matcha Chain Ledger History
INSERT INTO logistics_events (id, batch_id, event_type, facility, logged_by, metadata) VALUES 
(11, 104, 'sourced', 'Kyoto Processing Plant', 2, '{"origin": "Uji Tea Farms, Kyoto", "harvest_season": "First Flush", "shade_grown_days": 21}')
ON CONFLICT (id) DO NOTHING;


-- Re-enable immutability trigger protection safety checks
ALTER TABLE logistics_events ENABLE TRIGGER trg_protect_ledger;

-- --------------------------------------------------------------------
-- 4. FAST-FORWARD AUTO-INCREMENT TRACKER SEQUENCES
-- --------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('batches', 'id'), COALESCE(MAX(id), 1)) FROM batches;
SELECT setval(pg_get_serial_sequence('logistics_events', 'id'), COALESCE(MAX(id), 1)) FROM logistics_events;