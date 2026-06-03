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

// --- VISUAL COMPONENT: HORIZONTAL WORKFLOW NODE GRAPH ---
const WorkflowNodeGroup = ({ node, isLastChild = false, onNodeClick }) => {
  if (!node) return null;
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onNodeClick) onNodeClick(node);
  };

  return (
    <div className="flex items-center gap-12 relative font-sans">
      
      {/* INDIVIDUAL NODE ELEMENT CARD */}
      <div className="relative flex items-center">
        {/* Input Target Anchor Circle */}
        {node.directly_derived_from_parent && (
          <div className="w-3 h-3 bg-neutral-950 border-2 border-red-600 rounded-full absolute -left-1.5 z-10 shadow-[0_0_8px_#dc2626]" />
        )}

        <div 
          onClick={handleClick}
          className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 w-72 shadow-2xl hover:border-red-600/60 hover:shadow-[0_0_25px_rgba(220,38,38,0.15)] transition-all duration-300 cursor-pointer"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono font-bold text-neutral-100 flex items-center gap-2 tracking-wider">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              {node.batch_number}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 text-red-500 border border-neutral-800/80 font-semibold tracking-widest">
              {node.sku}
            </span>
          </div>
          
          <div className="space-y-2 mt-4 text-xs tracking-wide">
            <div className="text-neutral-200 font-light">
              <span className="text-neutral-500 font-mono text-[10px] mr-1">FACILITY //</span> {node.current_facility}
            </div>
            <div className="text-neutral-200 font-light">
              <span className="text-neutral-500 font-mono text-[10px] mr-1">QUANTITY //</span>{' '}
              <span className="text-red-400 font-bold font-mono">
                {parseFloat(node.total_quantity).toFixed(2)} {node.unit || 'kg'}
              </span>
            </div>
          </div>
        </div>

        {/* Output Source Anchor Circle */}
        {hasChildren && (
          <div className="w-3 h-3 bg-red-600 border-2 border-neutral-950 rounded-full absolute -right-1.5 z-10 shadow-[0_0_8px_#dc2626]" />
        )}
      </div>

      {/* OUTBOUND CONNECTING RAIL CORES */}
      {hasChildren && (
        <div className="flex flex-col justify-center relative space-y-5 py-2 border-l border-dashed border-neutral-800 pl-12 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-12 before:h-px before:bg-neutral-800">
          {node.children.map((child, index) => (
            <WorkflowNodeGroup 
              key={child.id} 
              node={child} 
              isLastChild={index === node.children.length - 1} 
              onNodeClick={onNodeClick}
            />
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
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null); // NEW: for clicked node display

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

  const totalAllocatedToFormInputs = childSplits.reduce((sum, child) => sum + (parseFloat(child.quantity) || 0), 0);
  const remainingBalance = parentDetails ? parseFloat(parentDetails.total_quantity) - totalAllocatedToFormInputs : 0;

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

  // Handler for node clicks
  const handleNodeClick = (node) => {
    setSelectedNodeInfo(node);
  };

  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-neutral-100 font-sans antialiased selection:bg-red-600/30 tracking-wide">
      
      {/* CENTERED HEADER BRAND LOGO */}
      <header className="w-full text-center mb-12 border-b border-neutral-900 pb-6">
        <div className="inline-flex flex-col items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-600 rounded-sm rotate-45 shadow-[0_0_12px_#dc2626]" />
            <h1 className="text-3xl font-bold uppercase tracking-[0.25em] font-sans text-neutral-50">CustodyChain</h1>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-neutral-500 mt-2">
            Immutable Graph Ledger // System Workspace
          </p>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* CONFIGURATORS SIDE PANEL */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* REGISTRATION BLOCK */}
          <section className="bg-neutral-900 border border-neutral-800/60 rounded-lg p-6 shadow-2xl">
            <h2 className="text-xs font-bold tracking-[0.15em] text-neutral-400 uppercase mb-5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-neutral-400 rounded-none rotate-45" />
              Register Shipment
            </h2>
            <form onSubmit={handleRegisterShipment} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono tracking-widest text-neutral-500 mb-1">SKU REFERENCE</label>
                <input required type="text" className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-100 focus:border-red-600 outline-none font-mono" placeholder="e.g. PREMIUM-MATCHA" value={newShipment.sku} onChange={e => setNewShipment({...newShipment, sku: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono tracking-widest text-neutral-500 mb-1">BATCH IDENTIFIER</label>
                  <input required type="text" className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-100 focus:border-red-600 outline-none font-mono" placeholder="e.g. B-MTC-001" value={newShipment.batch_number} onChange={e => setNewShipment({...newShipment, batch_number: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] font-mono tracking-widest text-neutral-500 mb-1">INITIAL QUANTITY</label>
                  <input required type="number" step="any" className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-100 focus:border-red-600 outline-none font-mono" placeholder="0.00" value={newShipment.total_quantity} onChange={e => setNewShipment({...newShipment, total_quantity: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-mono tracking-widest text-neutral-500 mb-1">ORIGIN / DISPATCH HUB</label>
                <input required type="text" className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-100 focus:border-red-600 outline-none" placeholder="e.g. Kyoto Export Warehouse" value={newShipment.current_facility} onChange={e => setNewShipment({...newShipment, current_facility: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-950 font-bold uppercase tracking-wider text-xs py-2.5 rounded transition-all duration-200">
                Deploy Root Node
              </button>
            </form>
          </section>

          {/* SPLIT CONTROLLER BLOCK */}
          <section className="bg-neutral-900 border border-neutral-800/60 rounded-lg p-6 shadow-2xl">
            <h2 className="text-xs font-bold tracking-[0.15em] text-red-500 uppercase mb-5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-600 rounded-none rotate-45" />
              Split Node Controller
            </h2>

            <div className="mb-4">
              <label className="block text-[9px] font-mono tracking-widest text-neutral-500 mb-1">SELECT CANVAS FOCUS NODE</label>
              <select className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-xs text-neutral-200 focus:border-red-600 outline-none font-mono" value={selectedParentId} onChange={e => setSelectedParentId(e.target.value)}>
                <option value="">-- Choose target block --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} [{b.sku}]
                  </option>
                ))}
              </select>
            </div>

            {parentDetails && (
              <div className="grid grid-cols-2 gap-4 bg-neutral-950 border border-neutral-800/40 rounded p-3 mb-4 text-[10px] font-mono tracking-wider">
                <div>
                  <div className="text-neutral-500">BASE ALLOCATION</div>
                  <div className="text-xs font-bold text-neutral-200 mt-0.5">{parseFloat(parentDetails.total_quantity).toFixed(2)} {parentDetails.unit}</div>
                </div>
                <div>
                  <div className="text-neutral-500">CANVAS UNALLOCATED</div>
                  <div className={`text-xs font-bold mt-0.5 ${remainingBalance < 0 ? 'text-red-500' : 'text-neutral-200'}`}>
                    {remainingBalance.toFixed(2)} {parentDetails.unit}
                  </div>
                </div>
              </div>
            )}

            {selectedParentId && (
              <form onSubmit={handleCommitSplit} className="space-y-4">
                <div className="flex justify-between items-center border-t border-neutral-800 pt-3">
                  <span className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase">Downstream Branches</span>
                  <button type="button" onClick={addChildRow} className="bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-red-500 text-[10px] px-3 py-1 font-mono rounded transition-colors tracking-wider">
                    + ADD OUTPUT
                  </button>
                </div>

                {childSplits.map((child, idx) => (
                  <div key={idx} className="bg-neutral-950 border border-neutral-800 rounded p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-mono tracking-widest text-neutral-500">BRANCH ID</label>
                        <input required type="text" className="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-neutral-100 outline-none focus:border-red-600 font-mono" placeholder="e.g. B-CHLD-01" value={child.batchNumber} onChange={e => {
                          const updated = [...childSplits];
                          updated[idx].batchNumber = e.target.value;
                          setChildSplits(updated);
                        }} />
                      </div>
                      <div>
                        <label className="text-[9px] font-mono tracking-widest text-neutral-500">QUANTITY</label>
                        <input required type="number" step="any" className="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-neutral-100 outline-none focus:border-red-600 font-mono" placeholder="0" value={child.quantity} onChange={e => {
                          const updated = [...childSplits];
                          updated[idx].quantity = e.target.value;
                          setChildSplits(updated);
                        }} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono tracking-widest text-neutral-500">ROUTING TARGET FACILITY</label>
                      <input required type="text" className="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-xs text-neutral-100 outline-none focus:border-red-600" placeholder="e.g. Berlin Logistics Yard" value={child.facility} onChange={e => {
                        const updated = [...childSplits];
                        updated[idx].facility = e.target.value;
                        setChildSplits(updated);
                      }} />
                    </div>
                  </div>
                ))}

                {childSplits.length > 0 && (
                  <button type="submit" className="w-full bg-red-700 hover:bg-red-600 text-white font-bold uppercase tracking-wider text-xs py-2.5 rounded shadow-lg transition-colors duration-150">
                    Execute Flow Split
                  </button>
                )}
              </form>
            )}
          </section>

          {/* NEW: NODE INSPECTOR (VISUAL UPGRADE) */}
          {selectedNodeInfo && (
            <section className="bg-neutral-900 border border-red-600/30 rounded-lg p-6 shadow-2xl">
              <h2 className="text-xs font-bold tracking-[0.15em] text-red-500 uppercase mb-5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-none rotate-45" />
                Node Inspector (Clicked Node)
              </h2>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">BATCH</span>
                  <span className="text-neutral-100 font-bold">{selectedNodeInfo.batch_number}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">SKU</span>
                  <span className="text-neutral-100">{selectedNodeInfo.sku}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">FACILITY</span>
                  <span className="text-neutral-100">{selectedNodeInfo.current_facility}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-500">QUANTITY</span>
                  <span className="text-red-400 font-bold">{parseFloat(selectedNodeInfo.total_quantity).toFixed(2)} {selectedNodeInfo.unit || 'kg'}</span>
                </div>
                {selectedNodeInfo.directly_derived_from_parent && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">PARENT ID</span>
                    <span className="text-neutral-400">{selectedNodeInfo.directly_derived_from_parent}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {error && <div className="bg-red-950/30 border border-red-900 text-neutral-200 rounded p-4 text-xs font-mono">{error}</div>}
          {success && <div className="bg-neutral-900 border border-neutral-800 rounded p-4 text-xs font-mono text-neutral-200">{success}</div>}
        </div>

        {/* WORKFLOW CANVAS WORKSPACE */}
        <div className="xl:col-span-8">
          <section className="bg-neutral-900 border border-neutral-800/50 rounded-lg p-6 min-h-[650px] relative overflow-hidden flex flex-col shadow-2xl">
            <div className="mb-6">
              <h2 className="text-xs font-bold tracking-[0.15em] text-neutral-400 uppercase flex items-center gap-2">
                Execution Flow Workspace
              </h2>
              <p className="text-xs text-neutral-500 mt-1">Horizontal lineage mapping visualization canvas. Click any node to inspect its details.</p>
            </div>

            {/* DOT MATRIX BACKDROP CANVAS */}
            <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded p-8 overflow-auto flex items-center relative shadow-inner min-h-[500px] style-grid-pattern">
              {lineageTree ? (
                <div className="relative inline-block">
                  <WorkflowNodeGroup node={lineageTree} onNodeClick={handleNodeClick} />
                </div>
              ) : (
                <div className="mx-auto text-center font-mono text-[11px] text-neutral-600 tracking-widest uppercase">
                  <div>// CANVAS_IDLE_READY</div>
                  <div className="text-[10px] mt-1 text-neutral-500 font-sans tracking-wide lowercase">select a target block to parse diagram map pipeline.</div>
                </div>
              )}
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}