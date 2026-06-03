# ChainCustody

ChainCustody is a full-stack supply chain tracking platform designed to map, split, and trace material lineages across global logistics networks. By modeling supply chains as a **Directed Acyclic Graph (DAG)** in a relational database, the platform tracks parent-to-child batch conversions (e.g., splitting bulk raw materials into processed, consumer-ready retail packages) with immutable, append-only historical audit logs.

# Languages
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![SQL](https://img.shields.io/badge/SQL-CC292B?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![PL/pgSQL](https://img.shields.io/badge/PL/pgSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/docs/current/plpgsql.html)
[![PowerShell](https://img.shields.io/badge/PowerShell-5391FE?style=flat&logo=powershell&logoColor=white)](https://learn.microsoft.com/en-us/powershell/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)

# Frontend UI & Tools
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Lucide React](https://img.shields.io/badge/Lucide_React-000000?style=flat&logo=lucide&logoColor=white)](https://lucide.dev/)

# Backend Architecture
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![node-postgres](https://img.shields.io/badge/node--postgres-339933?style=flat&logo=postgresql&logoColor=white)](https://node-postgres.com/)

# Database Layer
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

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
