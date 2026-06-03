import { Router } from 'express';
import { getClient, query } from '../db.js';

const router = Router();

// 1. FETCH BASELINE POOL: Serves all batches to populate UI dropdown selectors
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM batches ORDER BY created_at DESC');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to retrieve batch assets pool.' });
  }
});

// 2. REGISTER NEW ROOT NODE: Creates an absolute parent shipment entry
router.post('/register', async (req, res) => {
  const { sku, batch_number, total_quantity, unit, current_facility, username } = req.body;
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const userRes = await client.query('SELECT id FROM users WHERE username = $1', [username || 'operator_alpha']);
    const userId = userRes.rows[0]?.id || 1;

    const batchRes = await client.query(
      `INSERT INTO batches (sku, batch_number, total_quantity, unit, current_facility) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [sku, batch_number, total_quantity, unit || 'kg', current_facility]
    );
    
    const newBatch = batchRes.rows[0];

    await client.query(
      `INSERT INTO logistics_events (batch_id, event_type, facility, logged_by, metadata) 
       VALUES ($1, 'sourced', $2, $3, $4)`,
      [newBatch.id, current_facility, userId, JSON.stringify({ origin: 'Direct UI Entry Registration' })]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, batch: newBatch });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Failed to register new root shipment.', details: error.message });
  } finally {
    client.release();
  }
});

// 3. SECURED TRANSACTION SPLIT CONTROLLER
router.post('/split', async (req, res) => {
  const { parentBatchId, children, loggedByUserId } = req.body;
  const userId = loggedByUserId || 1; 

  if (!parentBatchId || !Array.isArray(children) || children.length === 0) {
    return res.status(400).json({ error: 'Invalid parameters. Missing layout properties.' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const parentRes = await client.query(
      'SELECT * FROM batches WHERE id = $1 FOR UPDATE',
      [parentBatchId]
    );

    if (parentRes.rows.length === 0) {
      throw new Error('Parent batch not found.');
    }

    const parentBatch = parentRes.rows[0];
    const totalChildAllocatedQuantity = children.reduce((sum, child) => sum + Number(child.quantity), 0);

    if (Number(parentBatch.total_quantity) < totalChildAllocatedQuantity) {
      return res.status(400).json({ 
        error: `Insufficient parent quantity. Has ${parentBatch.total_quantity}, demands ${totalChildAllocatedQuantity}.` 
      });
    }

    const newParentQuantity = Number(parentBatch.total_quantity) - totalChildAllocatedQuantity;
    await client.query(
      'UPDATE batches SET total_quantity = $1 WHERE id = $2',
      [newParentQuantity, parentBatchId]
    );

    const createdChildren = [];

    for (const child of children) {
      const { sku, batchNumber, quantity, facility, unit } = child;

      const childInsertRes = await client.query(
        `INSERT INTO batches (sku, batch_number, total_quantity, unit, current_facility)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [sku, batchNumber, quantity, unit || parentBatch.unit, facility]
      );
      const newChild = childInsertRes.rows[0];
      createdChildren.push(newChild);

      await client.query(
        `INSERT INTO batch_lineage (parent_batch_id, child_batch_id, split_quantity)
         VALUES ($1, $2, $3)`,
        [parentBatchId, newChild.id, quantity]
      );

      await client.query(
        `INSERT INTO logistics_events (batch_id, event_type, facility, logged_by, metadata)
         VALUES ($1, 'manufactured', $2, $3, $4)`,
        [newChild.id, facility, userId, JSON.stringify({ parent_source_id: parentBatchId })]
      );
    }

    await client.query(
      `INSERT INTO logistics_events (batch_id, event_type, facility, logged_by, metadata)
       VALUES ($1, 'split', $2, $3, $4)`,
      [
        parentBatchId, 
        parentBatch.current_facility, 
        userId, 
        JSON.stringify({ split_to_children: createdChildren.map(c => c.id), total_split_deducted: totalChildAllocatedQuantity })
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, parentRemainingQuantity: newParentQuantity, children: createdChildren });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Split execution failed and was rolled back:', err);
    return res.status(500).json({ error: 'Transaction aborted.', details: err.message });
  } finally {
    client.release();
  }
});

// 4. DOWNSTREAM RECURSIVE ENGINE: Tracks descendant hierarchies and their split quantities
router.get('/trace/:id', async (req, res) => {
  const targetId = req.params.id;

  const recursiveTraceQuery = `
    WITH RECURSIVE lineage_tree AS (
        SELECT b.id, b.sku, b.batch_number, b.total_quantity, b.unit, b.current_facility, b.created_at,
               0 AS generation_depth,
               NULL::INT AS directly_derived_from_parent,
               0::NUMERIC AS edge_split_quantity
        FROM batches b
        WHERE b.id = $1

        UNION ALL

        SELECT child.id, child.sku, child.batch_number, child.total_quantity, child.unit, child.current_facility, child.created_at,
               tree.generation_depth + 1,
               bl.parent_batch_id,
               bl.split_quantity::NUMERIC
        FROM batches child
        JOIN batch_lineage bl ON child.id = bl.child_batch_id
        JOIN lineage_tree tree ON bl.parent_batch_id = tree.id
    )
    SELECT id, sku, batch_number, total_quantity, unit, current_facility, created_at, generation_depth, directly_derived_from_parent, edge_split_quantity FROM lineage_tree ORDER BY generation_depth ASC, id ASC;
  `;

  try {
    const traceRes = await query(recursiveTraceQuery, [targetId]);
    
    if (traceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Specified target batch context cannot be evaluated.' });
    }

    return res.status(200).json({
      lineageNodes: traceRes.rows
    });
  } catch (err) {
    console.error('Error executing query:', err);
    return res.status(500).json({ error: 'Database tracking compilation failed.', details: err.message });
  }
});

export default router;