import { Router } from 'express';
import { getClient, query } from '../db.js';

const router = Router();

router.post('/split', async (req, res) => {
  const { parentBatchId, children, loggedByUserId } = req.body;

  if (!parentBatchId || !Array.isArray(children) || children.length === 0 || !loggedByUserId) {
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
        [newChild.id, facility, loggedByUserId, JSONBox({ parent_source_id: parentBatchId })]
      );
    }

    await client.query(
      `INSERT INTO logistics_events (batch_id, event_type, facility, logged_by, metadata)
       VALUES ($1, 'split', $2, $3, $4)`,
      [
        parentBatchId, 
        parentBatch.current_facility, 
        loggedByUserId, 
        JSONBox({ split_to_children: createdChildren.map(c => c.id), total_split_deducted: totalChildAllocatedQuantity })
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

router.get('/trace/:id', async (req, res) => {
  const targetId = req.params.id;

  const recursiveTraceQuery = `
    WITH RECURSIVE lineage_tree AS (
        SELECT b.id, b.sku, b.batch_number, b.total_quantity, b.unit, b.current_facility, b.created_at,
               0 AS generation_depth,
               NULL::INT AS directly_derived_from_parent
        FROM batches b
        WHERE b.id = $1

        UNION ALL

        SELECT parent.id, parent.sku, parent.batch_number, parent.total_quantity, parent.unit, parent.current_facility, parent.created_at,
               tree.generation_depth + 1,
               bl.parent_batch_id
        FROM batches parent
        JOIN batch_lineage bl ON parent.id = bl.parent_batch_id
        JOIN lineage_tree tree ON bl.child_batch_id = tree.id
    )
    SELECT DISTINCT ON (id) * FROM lineage_tree ORDER BY id, generation_depth ASC;
  `;

  try {
    const traceRes = await query(recursiveTraceQuery, [targetId]);
    
    if (traceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Specified target batch context cannot be evaluated.' });
    }

    const trackedBatchIds = traceRes.rows.map(item => item.id);
    const eventsRes = await query(
      `SELECT le.*, u.username as operator_identity 
       FROM logistics_events le
       JOIN users u ON le.logged_by = u.id
       WHERE le.batch_id = ANY($1) 
       ORDER BY le.timestamp DESC`,
      [trackedBatchIds]
    );

    return res.status(200).json({
      lineageNodes: traceRes.rows,
      historicalLedgerTimeline: eventsRes.rows
    });
  } catch (err) {
    console.error('Error executing query:', err);
    return res.status(500).json({ error: 'Database tracking compilation failed.', details: err.message });
  }
});

function JSONBox(obj) { return JSON.stringify(obj); }

export default router;
