# VASPMap // Smart Wallet-to-VASP Forensic Intelligence Platform

A modern, production-grade cyber-forensics frontend designed for **Smart Wallet-to-VASP Mapping Using Blockchain Transaction Analysis**.

Built with **React**, **Vite**, **Tailwind CSS**, **Lucide Icons**, **Recharts**, **Cytoscape.js**, and **Axios**.

---

## Architecture & Principles

- **Zero Static/Mock Data Policy**: The application operates with 100% dynamic API data. When the backend has not yet processed data, elegant empty states, loading skeletons, and connection notices are rendered rather than fabricated numbers or placeholder addresses.
- **Pure Presentation Layer**: All blockchain data analysis, heuristic clustering, and VASP attributions originate from the Django REST API.
- **Configurable Service Layer**: Configurable through `.env` (`VITE_API_BASE_URL`) or in-app via the **Settings** view.
- **Forensic Distinction**: Explicitly differentiates between **Observed Evidence** (hard on-chain facts) and **System-Generated Attribution** (probabilistic heuristics).

---

## Core Sections

1. **Dashboard (`/`)**:
   - Dynamic KPI cards (Total Investigations, Wallets Analyzed, Transactions Analyzed, VASP Matches).
   - Recharts analytics (Attribution Confidence Distribution, Analyzed Transaction Volume).
   - Recent investigations table with direct inspection links.
2. **New Investigation (`/new-investigation`)**:
   - Form with input address, network selector (fetched dynamically from backend), depth hops, and forensic analysis modules (contract tracing, VASP clustering, mempool inspection).
   - Progressive telemetry progress indicators during backend processing.
3. **Wallet Investigation (`/wallet`)**:
   - Inflow/outflow breakdown, current balances, transaction metrics, assessed risk ratings, counterparties, and mapped VASP interactions.
4. **Transaction Telemetry (`/transactions`)**:
   - Filterable, searchable, and sortable transaction ledger with pagination and a side drawer for deep transaction inspection.
5. **VASP Intelligence (`/vasps`)**:
   - Heuristic candidate scoring, confidence ratings, and clear side-by-side evidence separation.
6. **Blockchain Graph (`/graph`)**:
   - **Cytoscape.js** interactive topological graph.
   - Force-directed (CoSE), hierarchical, circle, and grid layouts.
   - Zoom, pan, fit-to-screen, reset, and side inspector panel for nodes and transfer edges.
7. **Investigation Reports (`/reports`)**:
   - Backend report generation, viewing of formal dossiers, and export/download (JSON/PDF).
8. **Settings (`/settings`)**:
   - Live API base URL configuration with a "Test Connection" button that measures backend latency.
   - Django Token / Bearer Key management.
   - Supported network registry.

---

## Django REST API Specification

The frontend connects to the following DRF endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/api/health/` or `/api/status/` | `GET` | Health check & latency verification |
| `/api/auth/login/` | `POST` | DRF Token / JWT authentication |
| `/api/auth/logout/` | `POST` | Invalidate active session |
| `/api/auth/user/` | `GET` | Retrieve logged-in investigator profile |
| `/api/dashboard/stats/` | `GET` | Aggregate KPIs and chart data points |
| `/api/investigations/` | `GET`, `POST` | List & create wallet investigations |
| `/api/investigations/<id>/` | `GET`, `DELETE` | Retrieve or remove investigation dossier |
| `/api/wallets/<address>/` | `GET` | Wallet balances, risk rating, and metrics |
| `/api/wallets/<address>/counterparties/` | `GET` | Direct interacting addresses |
| `/api/wallets/<address>/inflow-outflow/` | `GET` | Balance timeline and directional flows |
| `/api/wallets/<address>/vasp-interactions/` | `GET` | Mapped VASP candidates for this address |
| `/api/transactions/` | `GET` | Paginated transaction ledger with filters |
| `/api/transactions/<tx_hash>/` | `GET` | Detailed single transaction inspection |
| `/api/vasps/` | `GET` | VASP registry list |
| `/api/vasps/attributions/` | `GET` | Mapped VASP attribution scores & evidence |
| `/api/graph/` | `GET` | Topological `{ nodes: [], edges: [] }` graph |
| `/api/reports/` | `GET`, `POST` | List & generate formal case reports |
| `/api/reports/<id>/export/` | `GET` | Export report blob (format=json/pdf) |
| `/api/config/networks/` | `GET` | List supported blockchain networks |

---

## Setup & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default:
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

### 3. Launch Vite Dev Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
Output will be generated in `dist/`.

---

## Django Backend CORS Configuration Note

In your Django `settings.py`, ensure `django-cors-headers` is configured to allow requests from the Vite frontend:

```python
INSTALLED_APPS = [
    ...
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    ...
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```
