import React, { useState, useEffect } from 'react';

export default function BatchSplitForm() {
  const [availableBatches] = useState([
    { id: 101, sku: 'RAW-COFFEE-01', batch_number: 'B-COF-9921', total_quantity: 500.00, unit: 'kg', current_facility: 'Antwerp Port Hub' },
    { id: 102, sku: 'RAW-COCOA-05', batch_number: 'B-COC-4412', total_quantity: 250.50, unit: 'kg', current_facility: 'Ghent Processing Plant' }
  ]);

  const [selectedParentId, setSelectedParentId] = useState('');
  const [parentBatch, setParentBatch] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const found = availableBatches.find(b => b.id === parseInt(selectedParentId));
    setParentBatch(found || null);
    setChildren([]);
  }, [selectedParentId, availableBatches]);

  const totalAllocated = children.reduce((sum, child) => sum + (parseFloat(child.quantity) || 0), 0);
  const remainingQuantity = parentBatch ? (parentBatch.total_quantity - totalAllocated) : 0;

  const addChildBatch = () => {
    setChildren([...children, { sku: parentBatch.sku, batchNumber: '', quantity: '', facility: parentBatch.current_facility, unit: parentBatch.unit }]);
  };

  const removeChildBatch = (index) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleChildChange = (index, field, value) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parentBatch || children.length === 0) return;

    if (remainingQuantity < 0) {
      setStatusMessage({ type: 'error', text: 'Error: Combined children volume parameters exceed available resource scope.' });
      return;
    }

    setLoading(true);
    setStatusMessage({ type: '', text: '' });

    try {
      const response = await fetch('http://localhost:5000/api/batches/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentBatchId: parentBatch.id,
          children: children.map(c => ({ ...c, quantity: parseFloat(c.quantity) })),
          loggedByUserId: 1
        })
      });

      const resData = await response.json();

      if (!response.ok) throw new Error(resData.error || 'Server processing fault occurred.');

      setStatusMessage({ type: 'success', text: `Success! Batch split committed to ledger. Parent Remaining: ${resData.parentRemainingQuantity} ${parentBatch.unit}` });
      setChildren([]);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-10 p-8 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800">
      <div className="border-b border-slate-800 pb-4 mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-emerald-400">ChainCustody Node Split Controller</h2>
        <p className="text-slate-400 text-sm mt-1">Execute immutable DAG conversions by creating child batches from authenticated root elements.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select Active Source Node</label>
          <select
            value={selectedParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">-- Choose Parent Lineage Batch --</option>
            {availableBatches.map(b => (
              <option key={b.id} value={b.id}>{b.batch_number} ({b.sku}) - Available: {b.total_quantity} {b.unit}</option>
            ))}
          </select>
        </div>

        {parentBatch && (
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div><span className="text-slate-500 block">Active Parent SKU</span><span className="font-mono text-sm text-slate-200">{parentBatch.sku}</span></div>
            <div><span className="text-slate-500 block">Baseline Available</span><span className="font-mono text-sm text-slate-200">{parentBatch.total_quantity} {parentBatch.unit}</span></div>
            <div><span className="text-slate-500 block">Unallocated Remaining</span><span className={`font-mono text-sm font-bold ${remainingQuantity < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{remainingQuantity.toFixed(2)} {parentBatch.unit}</span></div>
            <div><span className="text-slate-500 block">Origin Location</span><span className="font-mono text-sm text-slate-200 truncate block">{parentBatch.current_facility}</span></div>
          </div>
        )}

        {parentBatch && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium text-slate-300">Target Lineage Child Outputs Mapping</h3>
              <button
                type="button"
                onClick={addChildBatch}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-md transition duration-150"
              >
                + Add Child Batch
              </button>
            </div>

            {children.map((child, index) => (
              <div key={index} className="bg-slate-850 p-4 rounded-lg border border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-3 relative items-end">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">SKU Reference</label>
                  <input
                    type="text" required value={child.sku}
                    onChange={(e) => handleChildChange(index, 'sku', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Batch Key Ident</label>
                  <input
                    type="text" required placeholder="e.g. B-CHLD-01" value={child.batchNumber}
                    onChange={(e) => handleChildChange(index, 'batchNumber', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Volume Allocation ({child.unit})</label>
                  <input
                    type="number" step="0.0001" required placeholder="0.00" value={child.quantity}
                    onChange={(e) => handleChildChange(index, 'quantity', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white font-mono"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Destination Hub</label>
                    <input
                      type="text" required value={child.facility}
                      onChange={(e) => handleChildChange(index, 'facility', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white truncate"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChildBatch(index)}
                    className="bg-rose-950 text-rose-400 hover:bg-rose-900 border border-rose-800 p-2 rounded mt-4 text-xs transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {statusMessage.text && (
          <div className={`p-4 rounded-lg text-sm font-medium ${statusMessage.type === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
            {statusMessage.text}
          </div>
        )}

        {parentBatch && (
          <button
            type="submit"
            disabled={loading || children.length === 0 || remainingQuantity < 0}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white font-semibold py-3 px-4 rounded-lg shadow-lg transition duration-200"
          >
            {loading ? 'Processing Cryptographic Ledger Block...' : 'Commit Immutable Split Chain Link'}
          </button>
        )}
      </form>
    </div>
  );
}
