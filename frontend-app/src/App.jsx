import React from 'react';
import BatchSplitForm from './BatchSplitForm';
import TraceTimeline from './TraceTimeline';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <BatchSplitForm />
      <div className="my-12 border-t border-slate-800" />
      <TraceTimeline batchId="101" />
    </div>
  );
}

export default App;