import React, { useState, useEffect } from 'react';

export default function TraceTimeline({ batchId = '2' }) {
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/batches/trace/${batchId}`)
      .then(res => {
        if (!res.ok) throw new Error('Tracking pipeline lookup failure.');
        return res.json();
      })
      .then(data => {
        setTraceData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [batchId]);

  if (loading) return <div className="text-center p-10 text-slate-400 animate-pulse">Querying Distributed Graph Ancestry Tree...</div>;
  if (error) return <div className="text-center p-10 text-rose-400 font-medium">Trace Failure: {error}</div>;
  if (!traceData || traceData.historicalLedgerTimeline.length === 0) return <div className="text-center text-slate-500 p-10">No immutable ledger logs trace recorded for this element.</div>;

  return (
    <div className="max-w-3xl mx-auto my-12 p-6 bg-slate-950 text-slate-100 rounded-2xl shadow-xl border border-slate-900">
      <div className="mb-8 border-b border-slate-800 pb-4">
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs uppercase tracking-widest font-mono font-bold px-2.5 py-1 rounded-md">
          Immutable Cryptographic Trail
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white mt-3">ChainCustody Ancestry Ledger View</h2>
        <p className="text-slate-400 text-xs mt-1">
          Showing real-time results from a recursive database trace for Batch ID <span className="font-mono text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded">{batchId}</span>.
        </p>
      </div>

      <div className="mb-8 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">Discovered Ancestor Tree Nodes</h4>
        <div className="flex flex-wrap gap-2">
          {traceData.lineageNodes.map(node => (
            <span key={node.id} className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-xs font-mono">
              ID: {node.id} | <strong className="text-teal-400">{node.batch_number}</strong> ({node.sku})
            </span>
          ))}
        </div>
      </div>

      <div className="relative border-l border-slate-800 ml-4 md:ml-6 space-y-8">
        {traceData.historicalLedgerTimeline.map((event) => {
          const sourceNode = traceData.lineageNodes.find(n => n.id === event.batch_id);

          return (
            <div key={event.id} className="relative pl-6 md:pl-8 group">
              <span className="absolute -left-[11px] top-1 bg-slate-950 border-2 border-emerald-500 rounded-full w-5 h-5 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover:scale-110 transition duration-150">
                <span className="bg-emerald-400 w-1.5 h-1.5 rounded-full"></span>
              </span>

              <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-sm transition duration-200">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-2">
                  <div>
                    <span className="uppercase tracking-wide font-mono text-xs font-extrabold text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded">
                      {event.event_type}
                    </span>
                    <h3 className="text-md font-bold text-slate-200 mt-2">
                      Batch Trace Reference: <span className="font-mono text-slate-400">{sourceNode?.batch_number || `ID: ${event.batch_id}`}</span>
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-850">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-800 pt-3 mt-3 text-xs text-slate-400">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Location / Facility</span>
                    <span className="text-slate-200 font-medium">{event.facility}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">System Operator</span>
                    <span className="text-slate-200 font-mono">@{event.operator_identity}</span>
                  </div>
                  {sourceNode && (
                    <div className="col-span-2 border-t border-slate-850 pt-2 mt-1">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Target Product Context</span>
                      <span className="text-slate-300 font-mono">{sourceNode.sku} ({sourceNode.total_quantity} {sourceNode.unit})</span>
                    </div>
                  )}
                </div>

                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-3 bg-slate-950 rounded-lg p-3 border border-slate-850">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">Audit Ledger Metadata</span>
                    <pre className="text-[11px] font-mono text-teal-400 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
