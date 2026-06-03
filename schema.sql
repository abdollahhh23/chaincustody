-- Create custom ENUM types

CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE event_type_enum AS ENUM ('sourced', 'manufactured', 'split', 'in_transit', 'delivered');

-- 1. Users Table

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Batches Table
CREATE TABLE batches (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    total_quantity NUMERIC(12, 4) NOT NULL CHECK (total_quantity >= 0),
    unit VARCHAR(20) NOT NULL,
    current_facility VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Batch Lineage Table (DAG Mapping Table)
CREATE TABLE batch_lineage (
    parent_batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
    child_batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
    split_quantity NUMERIC(12, 4) NOT NULL CHECK (split_quantity > 0),
    PRIMARY KEY (parent_batch_id, child_batch_id),
    CONSTRAINT no_self_reference CHECK (parent_batch_id != child_batch_id)
);

-- 4. Logistics Events Table (The Ledger)
CREATE TABLE logistics_events (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    event_type event_type_enum NOT NULL,
    facility VARCHAR(150) NOT NULL,
    logged_by INT NOT NULL REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for High Performance Read Operations
CREATE INDEX idx_batches_sku_number ON batches(sku, batch_number);
CREATE INDEX idx_lineage_child ON batch_lineage(child_batch_id);
CREATE INDEX idx_events_batch_id ON logistics_events(batch_id);
CREATE INDEX idx_events_metadata_gin ON logistics_events USING gin (metadata);

-- 5. Immutability Trigger Implementation
CREATE OR REPLACE FUNCTION enforce_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutability Violation: Mutations or deletions are strictly prohibited on the logistics_events ledger.';
    RETURN NULL; -- Execution halts completely here
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_protect_ledger_logs
BEFORE UPDATE OR DELETE ON logistics_events
FOR EACH ROW
EXECUTE FUNCTION enforce_ledger_immutability();
