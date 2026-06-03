# ChainCustody

ChainCustody is a full-stack supply chain tracking platform designed to map, split, and trace material lineages across global logistics networks. By modeling supply chains as a **Directed Acyclic Graph (DAG)** in a relational database, the platform tracks parent-to-child batch conversions (e.g., splitting bulk raw materials into processed, consumer-ready retail packages) with immutable, append-only historical audit logs.

---

## Key Features

* **Recursive DAG Lineage Parsing**: Uses PostgreSQL Recursive Common Table Expressions (CTEs) to climb up lineage trees and instantly resolve the entire historical ancestry of any child node.
* **Atomic Multi-Batch Allocation**: Implements explicit backend database transaction isolation (`BEGIN`/`COMMIT`/`ROLLBACK`) to protect volume allocations from concurrency bugs and data race conditions.
* **Immutable Ledger Enforcement**: Employs low-level PL/pgSQL database triggers to block unauthorized mutation or deletion of historical event logs.
* **Dynamic Split Controls**: An interactive frontend dashboard that dynamically visualizes real-time unallocated volume limits and downstream lineage routes.

---

## Technology Stack

### Frontend UI
* **React** (Scaffolded with Vite)
* **Tailwind CSS v4** (Native compilation pipeline via `@tailwindcss/vite`)

### Backend API
* **Node.js** with **Express.js**
* **node-postgres (pg)** (Direct non-ORM pooling client)

### Database Layer
* **PostgreSQL** (Relational graph mapping schema)

---

## Project Structure

```text
chaincustody/
├── backend/
│   ├── config/          # Database connection pooling
│   ├── routes/          # Express API endpoints (batch routing & transactions)
│   ├── server.js        # Server entry point
│   └── package.json
│
├── frontend-app/
│   ├── src/
│   │   ├── BatchSplitForm.jsx   # Interactive parent-to-child split manager
│   │   ├── TraceTimeline.jsx    # Recursive ledger history display
│   │   ├── App.jsx              # Application root layout
│   │   └── index.css            # Tailwind directives
│   ├── vite.config.js   # Vite + Tailwind compiler setup
│   └── package.json
│
└── seed.sql             # Comprehensive supply chain test dataset
```

## Local Development Setup
1. Database Initialization
Ensure you have PostgreSQL running locally, then create a database named chaincustody. Initialize and seed the schema by running the following command in your terminal:

```PowerShell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d chaincustody -f seed.sql
```
### 2. Configure and Run the Backend API

Navigate to the backend folder, install dependencies, and start the development engine:

```Bash
cd backend
npm install
npm start
```
The secure backend microservice will launch and listen natively on port 5000.


### 3. Configure and Run the Frontend UI

Open a new terminal window, navigate to the React frontend folder, install dependencies, and launch the Vite compilation server:

```Bash
cd frontend-app
npm install
npm run dev
```
The front-end application will compile and open instantly on http://localhost:5173/ (or http://localhost:5174/).

###Core API Endpoints
```
GET /api/batches
```
Fetches all active tracking nodes along with their current locations and calculated available volumes to populate dropdown selectors.
```
GET /api/batches/trace/:id
```
Triggers the recursive CTE database query to output the complete chronological lineage log trail and parentage mapping for the target batch ID.
```
POST /api/batches/split
```
Handles the atomic ledger allocation. Accepts parent IDs alongside an array of target child nodes, performs validation checks on balances, and executes structural row creations within a protected database transaction.

### License
Distributed under the MIT License. See LICENSE for more information.
