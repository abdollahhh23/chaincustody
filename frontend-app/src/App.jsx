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

// --- VISUAL COMPONENT: n8n NODE-FLOW GRAPH DESIGN ---
// Recursively maps supply-chain lineage as an automation workflow diagram
const WorkflowNodeGroup = ({ node, isLastChild = false }) => {
  if (!node) return null;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex items-center gap-12 relative">
      
      {/* INDIVIDUAL NODE ELEMENT CARD */}
      <div className="relative flex items-center">
        {/* Input Target Anchor Circle (hidden for master roots) */}
        {node.directly_derived_from_parent && (
          <div className="w-3 h-3 bg-slate-950 border-2 border-indigo-500 rounded-full absolute -left-1.5 z-10 shadow-[0_0_6px_#6366f1]" />
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-72 shadow-xl hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all duration-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              {node.batch_number}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800/60">
              {node.sku}
            </span>
          </div>
          
          <div className="space-y-1.5 mt-3 text-xs">
            <div className="text-slate-400">
              <span className="text-slate-500 font-mono">FACILITY:</span> {node.current_facility}
            </div>
            <div className="text-slate-400">
              <span className="text-slate-500 font-mono">VOLUME:</span>{' '}
              <span className="text-indigo-400 font-bold font-mono">
                {parseFloat(node.total_quantity).toFixed(2)} {node.unit || 'kg'}
              </span>
            </div>
          </div>
        </div>

        {/* Output Source Anchor Circle */}
        {hasChildren && (
          <div className="w-3 h-3 bg-indigo-500 border-2 border-slate-950 rounded-full absolute -right-1.5 z-10 shadow-[0_0_6px_#6366f1]" />
        )}
      </div>

      {/* RENDER FORWARD OUTBOUND WIRES AND SPLIT SEGMENTATIONS */}
      {hasChildren && (
        <div className="flex flex-col justify-center relative space-y-4 py-2 border-l-2 border-dashed border-slate-800 pl-12 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-12 before:h-0.5 before:bg-slate-800">
          {node.children.map((child, index) => (
            <WorkflowNodeGroup 
              key={child.id} 
              node={child} 
              isLastChild={index === node.children.length - 1} 
            />
          ))}
        </div>
      )}

    </div>
  );
};

// --- MAIN INTEGRATED APPLICATION APPLICATION GRAPH PANELS ---
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

  const totalDbChildrenDeducted = flatNodesPool.reduce((sum, node) => {
    if (node.directly_derived_from_parent === parseInt(selectedParentId)) {
      return sum + (parseFloat(node.edge_split_quantity) || 0);
    }
    return sum;
  }, 0);

  const totalAllocatedToFormInputs = childSplits.reduce((sum, child) => sum + (parseFloat(child.quantity) || 0), 0);
  
  const remainingBalance = parentDetails 
    ? parseFloat(parentDetails.total_quantity) - totalAllocatedToFormInputs 
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
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100 font-sans antialiased selection:bg-indigo-500/30">
      <header className="max-w-[1600px] mx-auto mb-8 border-b border-slate-900 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-indigo-400">ChainCustody Workflow Node Canvas</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage supply-chain splits as functional execution node workflows.</p>
        </div>
        <div className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded text-slate-400">
          Environment: Local Dev Pool
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN PANEL: FORM CONFIGURATORS */}
        <div className="xl:col-span-4 space-y-6">
          
          <section className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 shadow-2xl backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Register New Root Shipment
            </h2>
            <form onSubmit={handleRegisterShipment} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">SKU REFERENCE</label>
                <input required type="text" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none" placeholder="e.g. PREMIUM-MATCHA" value={newShipment.sku} onChange={e => setNewShipment({...newShipment, sku: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">BATCH IDENTIFIER</label>
                  <input required type="text" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none" placeholder="e.g. B-MTC-001" value={newShipment.batch_number} onChange={e => setNewShipment({...newShipment, batch_number: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">INITIAL QUANTITY</label>
                  <input required type="number" step="any" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none" placeholder="0.00" value={newShipment.total_quantity} onChange={e => setNewShipment({...newShipment, total_quantity: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">ORIGIN / DISPATCH HUB</label>
                <input required type="text" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 outline-none" placeholder="e.g. Kyoto Export Warehouse" value={newShipment.current_facility} onChange={e => setNewShipment({...newShipment, current_facility: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2 rounded shadow-lg transition-all duration-150">
                Deploy Root Node
              </button>
            </form>
          </section>

          <section className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 shadow-2xl backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Node Split Configuration
            </h2>

            <div className="mb-4">
              <label className="block text-[10px] font-mono text-slate-500 mb-1">SELECT CANVAS FOCUS NODE</label>
              <select className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none" value={selectedParentId} onChange={e => setSelectedParentId(e.target.value)}>
                <option value="">-- Choose target block --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} [{b.sku}]
                  </option>
                ))}
              </select>
            </div>

            {parentDetails && (
              <div className="grid grid-cols-2 gap-4 bg-slate-950 border border-slate-900 rounded-lg p-3 mb-4 text-[10px] font-mono">
                <div>
                  <div className="text-slate-500">BASE ALLOCATION</div>
                  <div className="text-xs font-bold text-slate-300 mt-0.5">{parseFloat(parentDetails.total_quantity).toFixed(2)} {parentDetails.unit}</div>
                </div>
                <div>
                  <div className="text-slate-500">CANVAS UNALLOCATED</div>
                  <div className={`text-xs font-bold mt-0.5 ${remainingBalance < 0 ? 'text-red-400' : 'text-indigo-400'}`}>
                    {remainingBalance.toFixed(2)} {parentDetails.unit}
                  </div>
                </div>
              </div>
            )}

            {selectedParentId && (
              <form onSubmit={handleCommitSplit} className="space-y-4">
                <div className="flex justify-between items-center border-t border-slate-800/60 pt-3">
                  <span className="text-[10px] font-mono text-slate-400">Target Lineage Mapping</span>
                  <button type="button" onClick={addChildRow} className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-indigo-400 text-xs px-2.5 py-1 rounded transition-colors">
                    + Add Output Branch
                  </button>
                </div>

                {childSplits.map((child, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-mono text-slate-500">BRANCH ID</label>
                        <input required type="text" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 outline-none focus:border-indigo-500" placeholder="e.g. B-CHLD-01" value={child.batchNumber} onChange={e => {
                          const updated = [...childSplits];
                          updated[idx].batchNumber = e.target.value;
                          setChildSplits(updated);
                        }} />
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-slate-500">QUANTITY</label>
                        <input required type="number" step="any" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 outline-none focus:border-indigo-500" placeholder="0" value={child.quantity} onChange={e => {
                          const updated = [...childSplits];
                          updated[idx].quantity = e.target.value;
                          setChildSplits(updated);
                        }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-500">ROUTING TARGET FACILITY</label>
                      <input required type="text" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 outline-none focus:border-indigo-500" placeholder="e.g. Berlin Logistics Yard" value={child.facility} onChange={e => {
                        const updated = [...childSplits];
                        updated[idx].facility = e.target.value;
                        setChildSplits(updated);
                      }} />
                    </div>
                  </div>
                ))}

                {childSplits.length > 0 && (
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 rounded shadow-lg transition-colors mt-2">
                    Execute Flow Split
                  </button>
                )}
              </form>
            )}
          </section>

          {error && <div className="bg-red-950/40 border border-red-900 rounded-lg p-4 text-xs font-mono text-red-400">{error}</div>}
          {success && <div className="bg-emerald-950/40 border border-emerald-900 rounded-lg p-4 text-xs font-mono text-emerald-400">{success}</div>}
        </div>

        {/* RIGHT COLUMN PANEL: INFINITE WORKFLOW CANVAS */}
        <div className="xl:col-span-8">
          <section className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 min-h-[650px] relative overflow-hidden flex flex-col">
            <div className="mb-6">
              <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase flex items-center gap-2">
                Execution Flow Workspace
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Horizontal relational graph showing deployment lineages.</p>
            </div>

            {/* GRID GRAPH BACKDROP CANVAS */}
            <div className="flex-1 bg-slate-950/70 border border-slate-900/60 rounded-xl p-8 overflow-auto flex items-center relative shadow-inner min-h-[500px] style-grid-pattern">
              {lineageTree ? (
                <div className="relative inline-block">
                  <WorkflowNodeGroup node={lineageTree} />
                </div>
              ) : (
                <div className="mx-auto text-center font-mono text-xs text-slate-600 max-w-sm">
                  <div>// CANVAS_IDLE</div>
                  <div className="text-[11px] mt-1 text-slate-500">Select an active tracking target to generate its horizontal execution node chain map.</div>
                </div>
              )}
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}