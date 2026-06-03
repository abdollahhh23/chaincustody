import React, { useState, useEffect } from 'react';

// --- HELPER UTILITY: BUILD DOWNSTREAM TREE ARCHITECTURE ---
const buildDownstreamTree = (nodes, rootId) => {
  if (!nodes || nodes.length === 0) return null;

  const map = {};
  nodes.forEach(node => {
    map[node.id] = { ...node, children: [] };
  });

  let rootNode = map[rootId];

  nodes.forEach(node => {
    const currentMappedNode = map[node.id];
    const parentId = node.directly_derived_from_parent;

    if (parentId && map[parentId] && node.id !== parseInt(rootId)) {
      map[parentId].children.push(currentMappedNode);
    }
  });

  return rootNode || map[rootId];
};

// --- VISUAL COMPONENT: NESTED TREE COMPONENT ---
const NestedTreeRenderNode = ({ node }) => {
  if (!node) return null;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="relative my-2 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm max-w-xl hover:border-emerald-500/40 transition-colors">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            {node.batch_number}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-800">
            {node.sku}
          </span>
        </div>
        <div className="text-sm font-medium text-slate-300 mt-2">
          Facility Location: <span className="text-slate-400 font-normal">{node.current_facility}</span>
        </div>
        <div className="text-xs font-mono text-slate-400 mt-1">
          Active Stock Weight: <span className="text-emerald-400 font-bold">{parseFloat(node.total_quantity).toFixed(2)} {node.unit || 'kg'}</span>
        </div>
      </div>

      {hasChildren && (
        <div className="ml-6 border-l-2 border-slate-800/80 pl-4 mt-2 space-y-2 relative">
          {node.children.map((child) => (
            <NestedTreeRenderNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN INTEGRATED APPLICATION ---
export default function App() {
  const [batches, setBatches] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [parentDetails, setParentDetails] = useState(null);
  const [lineageTree, setLineageTree] = useState(null);
  const [flatNodesPool, setFlatNodesPool] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [childSplits, setChildSplits] = useState([]);
  const [newShipment, setNewShipment] = useState({
    sku: '',
    batch_number: '',
    total_quantity: '',
    unit: 'kg',
    current_facility: ''
  });

  const fetchBatches = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/batches');
      const data = await res.json();
      setBatches(data);
    } catch (err) {
      setError('Could not connect to backend server pool.');
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedParentId) {
      const match = batches.find(b => b.id === parseInt(selectedParentId));
      setParentDetails(match || null);
      fetchLineageTree(selectedParentId);
    } else {
      setParentDetails(null);
      setLineageTree(null);
      setFlatNodesPool([]);
    }
  }, [selectedParentId, batches]);

  const fetchLineageTree = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/batches/trace/${id}`);
      const data = await res.json();
      
      if (data && data.lineageNodes) {
        setFlatNodesPool(data.lineageNodes);
        const structuralTree = buildDownstreamTree(data.lineageNodes, id);
        setLineageTree(structuralTree);
      } else {
        setLineageTree(null);
        setFlatNodesPool([]);
      }
    } catch (err) {
      console.error('Error fetching structural ancestral lineage tree:', err);
    }
  };

  // Sum up quantities split off to immediate direct children inside the database
  const totalDbChildrenDeducted = flatNodesPool.reduce((sum, node) => {
    if (node.directly_derived_from_parent === parseInt(selectedParentId)) {
      return sum + (parseFloat(node.edge_split_quantity) || 0);
    }
    return sum;
  }, 0);

  // Sum up current uncommitted values typed into the active UI form rows
  const totalAllocatedToFormInputs = childSplits.reduce((sum, child) => sum + (parseFloat(child.quantity) || 0), 0);
  
  // FIXED BALANCING EQUATION: Subtracts both database children and form inputs from the total quantity
  const remainingBalance = parentDetails 
    ? parseFloat(parentDetails.total_quantity) - totalDbChildrenDeducted - totalAllocatedToFormInputs 
    : 0;

  const addChildRow = () => {
    setChildSplits([...childSplits, { sku: parentDetails?.sku || '', batchNumber: '', quantity: '0', facility: '' }]);
  };

  const handleCommitSplit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (remainingBalance < 0) {
      setError('Aborting: Total allocated child volumes exceed parent available thresholds.');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/batches/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentBatchId: parseInt(selectedParentId),
          children: childSplits.map(c => ({
            sku: c.sku,
            batchNumber: c.batchNumber,
            quantity: parseFloat(c.quantity),
            facility: c.facility
          }))
        })
      });

      if (!res.ok) throw new Error('Transaction aborted by server constraints.');

      setSuccess('Split transaction committed and secured successfully!');
      setChildSplits([]);
      await fetchBatches();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegisterShipment = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch('http://localhost:5000/api/batches/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newShipment,
          total_quantity: parseFloat(newShipment.total_quantity)
        })
      });

      if (!res.ok) throw new Error('Failed to register root shipment node.');

      setSuccess(`Root shipment ${newShipment.batch_number} added cleanly to tracking ledger.`);
      setNewShipment({ sku: '', batch_number: '', total_quantity: '', unit: 'kg', current_facility: '' });
      await fetchBatches();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100 font-sans antialiased">
      <header className="max-w-6xl mx-auto mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-emerald-400">ChainCustody Node Manager</h1>
        <p className="text-sm text-slate-400 mt-1">Execute multi-level immutable splits and register new tracking roots.</p>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Register New Root Shipment
            </h2>
            <form onSubmit={handleRegisterShipment} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">SKU REFERENCE</label>
                <input required type="text" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 outline-none" placeholder="e.g. PREMIUM-MATCHA" value={newShipment.sku} onChange={e => setNewShipment({...newShipment, sku: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">BATCH IDENTIFIER</label>
                  <input required type="text" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 outline-none" placeholder="e.g. B-MTC-001" value={newShipment.batch_number} onChange={e => setNewShipment({...newShipment, batch_number: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">INITIAL QUANTITY</label>
                  <input required type="number" step="any" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 outline-none" placeholder="0.00" value={newShipment.total_quantity} onChange={e => setNewShipment({...newShipment, total_quantity: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">ORIGIN / CURRENT FACILITY</label>
                <input required type="text" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 outline-none" placeholder="e.g. Kyoto Export Warehouse" value={newShipment.current_facility} onChange={e => setNewShipment({...newShipment, current_facility: e.target.value})} />
              </div>
              <button type="submit" className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm py-2 rounded shadow transition-colors">
                Initialize Parent Shipment Node
              </button>
            </form>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              ChainCustody Node Split Controller
            </h2>

            <div className="mb-4">
              <label className="block text-xs font-mono text-slate-400 mb-1">SELECT ACTIVE TARGET NODE</label>
              <select className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none" value={selectedParentId} onChange={e => setSelectedParentId(e.target.value)}>
                <option value="">-- Choose Target Batch Node --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} ({b.sku}) - Available: {parseFloat(b.total_quantity).toFixed(2)} {b.unit}
                  </option>
                ))}
              </select>
            </div>

            {parentDetails && (
              <div className="grid grid-cols-2 gap-4 bg-slate-950 border border-slate-800 rounded-lg p-4 mb-4 text-xs font-mono">
                <div>
                  <div className="text-slate-500">STARTING STOCK</div>
                  <div className="text-sm font-bold text-slate-300 mt-0.5">{parseFloat(parentDetails.total_quantity).toFixed(2)} {parentDetails.unit}</div>
                </div>
                <div>
                  <div className="text-slate-500">REALTIME REMAINING</div>
                  <div className={`text-sm font-bold mt-0.5 ${remainingBalance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {remainingBalance.toFixed(2)} {parentDetails.unit}
                  </div>
                </div>
              </div>
            )}

            {selectedParentId && (
              <form onSubmit={handleCommitSplit} className="space-y-4">
                <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                  <span className="text-xs font-semibold text-slate-400">Target Lineage Outputs Mapping</span>
                  <button type="button" onClick={addChildRow} className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 text-xs px-2.5 py-1 rounded transition-colors">
                    + Add Child Split
                  </button>
                </div>

                {childSplits.map((child, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 relative">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-mono text-slate-500">CHILD IDENTIFIER</label>
                        <input required type="text" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 outline-none" placeholder="e.g. B-CHLD-XYZ" value={child.batchNumber} onChange={e => {
                          const updated = [...childSplits];
                          updated[idx].batchNumber = e.target.value;
                          setChildSplits(updated);
                        }} />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-500">VOLUME ALLOCATION ({parentDetails?.unit})</label>
                        <input required type="number" step="any" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 outline-none" placeholder="0" value={child.quantity} onChange={e => {
                          const updated = [...childSplits];
                          updated[idx].quantity = e.target.value;
                          setChildSplits(updated);
                        }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-slate-500">DESTINATION DISPATCH HUB</label>
                      <input required type="text" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 outline-none" placeholder="e.g. London Logistics Hub" value={child.facility} onChange={e => {
                        const updated = [...childSplits];
                        updated[idx].facility = e.target.value;
                        setChildSplits(updated);
                      }} />
                    </div>
                  </div>
                ))}

                {childSplits.length > 0 && (
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2 rounded shadow transition-colors mt-2">
                    Commit Immutable Split Chain Link
                  </button>
                )}
              </form>
            )}
          </section>

          {error && <div className="bg-red-950/50 border border-red-800/80 rounded-lg p-4 text-xs font-mono text-red-400">{error}</div>}
          {success && <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-lg p-4 text-xs font-mono text-emerald-400">{success}</div>}
        </div>

        <div className="lg:col-span-7">
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl min-h-[500px]">
            <h2 className="text-lg font-semibold text-slate-200 mb-2">Hierarchical Ancestry Tree</h2>
            <p className="text-xs text-slate-400 mb-6">Real-time structured top-down lineage maps generated dynamically from tracking pools.</p>

            {lineageTree ? (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/50 overflow-x-auto">
                <NestedTreeRenderNode node={lineageTree} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center h-80 border border-dashed border-slate-800 rounded-xl bg-slate-950/30 text-slate-500">
                <div className="text-sm font-mono">No target selected</div>
                <div className="text-xs mt-1 max-w-xs">Select an active tracking node from the drop-down menu to view its top-down structural split layout.</div>
              </div>
            )}
          </section>
        </div>

      </main>
    </div>
  );
}