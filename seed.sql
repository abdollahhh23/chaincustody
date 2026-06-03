BEGIN;

-- 1. Lock the parent and child rows involved to prevent race conditions
SELECT * FROM batches WHERE id = 101 FOR UPDATE;

-- 2. Delete the record from the lineage table to free the relationship constraints
DELETE FROM batch_lineage WHERE child_batch_id = 101;

-- 3. Safely drop the target batch asset row
DELETE FROM batches WHERE id = 101;

COMMIT;