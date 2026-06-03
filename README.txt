ChainCustody - Distributed Supply Chain Traceability Platform
===========================================================

This package contains the core decoupled codebase for running the ChainCustody platform.

Directory Content Layout:
- /schema.sql                  : PostgreSQL Database Layer setup scripts (Table maps, structural views, indexes, and ledger triggers)
- /backend/server.js           : Core Express app orchestration initialization gateway
- /backend/db.js               : Dynamic PostgreSQL connection pooling config using node-pg client
- /backend/routes/batch.js     : Atomic split transaction controllers and recursive ancestry trace CTE queries
- /frontend/BatchSplitForm.jsx : Interactive dynamic React split operational sub-view
- /frontend/TraceTimeline.jsx  : Recursive visualization chronological timeline presentation component

How to Run the Platform Ecosystem:

1. Database Layer Setup (PostgreSQL)
   - Ensure a local PostgreSQL server is active.
   - Run the initial environment provisioning scripts against your targeted cluster context:
     psql -U postgres -d your_db_name -f schema.sql

2. Backend Node API Microservice Engine Setup
   - Navigate to the backend space directory:
     cd backend
   - Restore node dependencies from manifest allocations:
     npm install
   - Configure variables mapping (Default fallback context targets: postgresql://postgres:postgres@localhost:5432/chaincustody)
     export DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
   - Boot up the API microservice runtime server context:
     npm start
   - Service context listening loop operates natively on port: http://localhost:5000

3. Frontend React Execution Instructions
   - The provided views are structured components written matching Tailwind CSS declarations.
   - Drop the BatchSplitForm.jsx and TraceTimeline.jsx files right into your React source code directory (e.g., src/components/).
   - Ensure Tailwind CSS configuration directives are fully configured within your React build system framework.
