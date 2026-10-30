# VASPMap // Django REST Backend

Production-grade backend for **Smart Wallet-to-VASP Mapping Using Blockchain Transaction Analysis**.

Built with **Python 3.13**, **Django 5.2**, **Django REST Framework**, **SQLite**, **SimpleJWT**, **Pandas**, **NumPy**, and **NetworkX**.

---

## Architectural Principles

1. **Zero Static / Fake Data Policy**:
   - The database contains **only real data** received from configured external blockchain providers, created by user actions, or computed dynamically by the analysis engine.
   - When the database is empty, the dashboard returns real zero counts (`total_investigations: 0`, `wallets_analyzed: 0`, `transactions_analyzed: 0`, `vasp_matches: 0`).
2. **Provider Abstraction**:
   - The blockchain data layer is decoupled into provider adapters (`blockchain/providers/base.py`, `etherscan.py`, `alchemy.py`).
   - Configurable via `BLOCKCHAIN_PROVIDER`, `BLOCKCHAIN_API_KEY`, and `BLOCKCHAIN_API_URL` environment variables.
3. **Statistical & Graph Analytics**:
   - **Pandas & NumPy** calculate descriptive flow metrics (inflow/outflow volumes, counts, variance, frequency).
   - **NetworkX** constructs topological directed graphs (`DiGraph`) up to configurable hop depths and exports them in **Cytoscape.js** JSON format (`{ nodes: [], edges: [] }`).
4. **Explainable Attribution Engine**:
   - Transparent rule-based scoring engine that clearly separates **Observed Evidence** (verified on-chain transfers with known VASP clusters/deposits) from **System-Generated Attribution** (probabilistic heuristics and graph proximity).
   - Scores are computed dynamically and never hardcoded.

---

## Project Structure

```text
backend/
├── manage.py
├── requirements.txt
├── .env.example / .env
│
├── config/                  # Django project settings, URLs, WSGI, ASGI
│   ├── settings.py          # DRF, SimpleJWT, CORS, logging, SQLite
│   └── urls.py              # Root router for /api/
│
├── common/                  # Standardized error responses, pagination, permissions
│   ├── exceptions.py        # Custom DRF exception handler (consistent error envelope)
│   ├── pagination.py        # StandardResultsSetPagination (page_size=15)
│   └── views.py             # Health check & supported networks
│
├── accounts/                # JWT Authentication & user management
│   ├── serializers.py       # CustomTokenObtainPairSerializer, UserSerializer
│   └── views.py             # Login, Token Refresh, Me, Logout
│
├── blockchain/              # Blockchain Provider Architecture & Validation
│   ├── providers/
│   │   ├── base.py          # Abstract BlockchainProvider interface
│   │   ├── etherscan.py     # Etherscan EVM implementation
│   │   ├── alchemy.py       # Alchemy JSON-RPC implementation
│   │   └── factory.py       # Dynamic provider factory
│   ├── validators.py        # EVM, Bitcoin, Solana, Tron address validation
│   └── services.py          # BlockchainDataService (ingestion, deduplication)
│
├── analysis/                # Statistical & Attribution Engines
│   ├── transaction_analyzer.py # Pandas & NumPy statistical metrics
│   ├── fund_flow_analyzer.py   # Flow paths and VASP interaction detection
│   └── attribution_engine.py   # Explainable rule-based scoring engine
│
├── graph/                   # Topological Graph Service
│   ├── builder.py           # NetworkX DiGraph builder & Cytoscape exporter
│   └── views.py             # /api/graph/ endpoint
│
├── wallets/                 # Subject Wallets & Relationships
│   ├── models.py            # Wallet & WalletRelationship models
│   ├── views.py             # Counterparties, inflow/outflow, VASP interactions
│   └── serializers.py
│
├── transactions/            # On-chain Transactions
│   ├── models.py            # Transaction model with deduplication index
│   ├── views.py             # Paginated ledger with direction/asset filtering
│   └── serializers.py
│
├── vasps/                   # VASP Intelligence Registry & Attributions
│   ├── models.py            # VASP, VASPAddress, VASPAttribution models
│   ├── views.py             # VASP registry & attribution queries
│   └── serializers.py
│
├── investigations/          # Investigation Cases & Dashboard
│   ├── models.py            # Investigation model (lifecycle states)
│   ├── services.py          # InvestigationService pipeline orchestrator
│   └── views.py             # InvestigationViewSet & DashboardStatsView
│
└── reports/                 # Formal Forensic Dossiers
    ├── models.py            # Report model
    ├── services.py          # ReportService assembler
    └── views.py             # ReportViewSet with JSON export blob download
```

---

## REST API Specification

### Authentication & System
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health/` | Backend health & provider latency test |
| `GET` | `/api/config/networks/` | Supported blockchain networks list |
| `POST` | `/api/auth/login/` | JWT token login (`{ access, refresh, token, user }`) |
| `POST` | `/api/auth/token/refresh/` | Refresh JWT access token |
| `GET` | `/api/auth/me/` | Authenticated user profile |
| `POST` | `/api/auth/logout/` | End user session |

### Dashboard & Investigations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats/` | Dynamic KPI counts, confidence distribution, volume trends |
| `GET` | `/api/investigations/` | List all investigation cases |
| `POST` | `/api/investigations/` | Dispatch new investigation (`wallet_address`, `blockchain_network`, `depth`, `options`) |
| `GET` | `/api/investigations/<id>/` | Retrieve single investigation case |
| `GET` | `/api/investigations/<id>/status/` | Execution status and lifecycle timestamps |
| `GET` | `/api/investigations/<id>/results/` | Full analysis findings and candidate attributions |
| `GET` | `/api/investigations/<id>/graph/` | NetworkX topological graph for this case |
| `DELETE` | `/api/investigations/<id>/` | Remove investigation dossier |

### Wallets & Transactions
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/wallets/` | List subject wallets in database |
| `GET` | `/api/wallets/<address>/` | Retrieve wallet balance, metrics, risk rating |
| `GET` | `/api/wallets/<address>/counterparties/` | Direct counterparties ranked by volume |
| `GET` | `/api/wallets/<address>/inflow-outflow/` | Inflow/outflow breakdown and timeline |
| `GET` | `/api/wallets/<address>/vasp-interactions/` | Mapped candidate VASP attributions |
| `GET` | `/api/wallets/<address>/transactions/` | Paginated transactions for this wallet |
| `GET` | `/api/transactions/` | Paginated transaction ledger with filters (`wallet`, `direction`, `asset`, `status`, `search`) |
| `GET` | `/api/transactions/<id_or_hash>/` | Single transaction detail with gas fees and raw payload |

### VASP Intelligence & Graph
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/vasps/` | List registered VASP entities |
| `POST` | `/api/vasps/` | Register new VASP entity (Admin) |
| `GET` | `/api/vasps/<id>/addresses/` | List known addresses for a VASP |
| `POST` | `/api/vasps/<id>/addresses/` | Add known cluster address (Admin) |
| `GET` | `/api/vasps/attributions/` | Query candidate attributions by `wallet_address` or `investigation_id` |
| `GET` | `/api/graph/` | Dynamic Cytoscape.js `{ nodes: [], edges: [] }` graph for a wallet |

### Forensic Reports
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reports/` | List generated formal forensic reports |
| `POST` | `/api/reports/` | Generate a new forensic report from actual investigation findings |
| `GET` | `/api/reports/<id>/` | View report dossier details |
| `GET` | `/api/reports/<id>/export/?format=json` | Download report as a JSON file |

---

## Local Setup & Execution

### 1. Activate Virtual Environment
```powershell
.\backend\venv\Scripts\Activate.ps1
```

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
```
Populate your blockchain provider API key:
```env
BLOCKCHAIN_PROVIDER=etherscan
BLOCKCHAIN_API_KEY=YOUR_ETHERSCAN_KEY_HERE
BLOCKCHAIN_API_URL=https://api.etherscan.io/api
```

### 3. Run Database Migrations
```bash
python manage.py migrate
```

### 4. Initialize Superuser / Administrator
```bash
python manage.py init_admin --username admin --password admin1234
```

### 5. Run Automated Tests
```bash
python manage.py test
```
*(All 9 automated test suites pass cleanly)*

### 6. Start the Server
```bash
python manage.py runserver 127.0.0.1:8000
```
Django admin is accessible at `http://127.0.0.1:8000/admin/`.
