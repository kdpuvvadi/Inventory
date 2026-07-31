# Inventory Management System

Modern inventory management for engineering, automation, and manufacturing — track every physical item from purchase through project assignment with full auditability.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | [PocketBase](https://pocketbase.io) (SQLite, auth, realtime, file storage) |
| Frontend | React 19, TypeScript, Vite |
| UI | Tailwind CSS v4, shadcn/ui |
| Data | TanStack Query, TanStack Table, React Hook Form, Zod |
| Charts | Recharts |

## Features

- **Dashboard** — stock KPIs, charts, recent transactions, pending POs
- **Products** — asset tags, barcodes/QR, manufacturers, suppliers, categories, status lifecycle
- **Inventory** — quantities only change via stock transactions; low-stock filters
- **Projects** — assign/return products with automatic stock movements
- **Purchase orders** — draft → ordered → receive → close
- **Stock transactions** — immutable movement history
- **Manufacturing** — BOM management
- **Reports** — inventory, purchase, and project reports with CSV export
- **Users & roles** — Administrator, Inventory Manager, Purchase, Sales, Store Keeper, Read Only
- **Realtime** — PocketBase subscriptions keep lists and dashboard current
- **Themes** — light, dark, and system

## Project structure

```
Inventory/
├── frontend/                 # React (Vite) source
├── pocketbase/               # Schema, seed, entrypoint
├── Dockerfile                # PocketBase + Vite → pb_public
├── composeyml        # Local build & run (single service)
├── composetest.yml   # Smoke tests
├── composedeploy.yml # Deploy from GHCR
├── .github/workflows/ci.yml
├── .env.example
├── spec.md
└── README.md
```

## Prerequisites

- Node.js 20+ (local development)
- Docker + Docker Compose (containerized run)
- PocketBase binary for non-Docker local backend (see below)

## Docker (recommended)

Single container: PocketBase serves the API **and** the Vite SPA from `pb_public` (no nginx). Layout matches images like [kdpuvvadi/pocketbase](https://github.com/kdpuvvadi/pocketbase) (`--publicDir`, `--hooksDir`, `--dir`).

### Quick start with Compose

```powershell
cp .env.example .env
docker compose up --build
```

| URL | Purpose |
|-----|---------|
| http://localhost:8090 | Application (SPA from `pb_public`) |
| http://localhost:8090/_/ | PocketBase Admin UI |
| http://localhost:8090/api/ | REST API |

Default Admin UI credentials (from `.env.example`):

- Email: `admin@inventory.local`
- Password: `Admin123456!`

On first launch the container **imports `pb_schema.json` automatically** (creates all app collections). Set `PB_AUTO_SEED=true` to also load sample data. Marker file: `pb_data/.schema_imported`.

### Smoke test

```powershell
docker compose -f composeyml -f composetest.yml up --build --abort-on-container-exit --exit-code-from smoke
docker compose -f composeyml -f composetest.yml down -v
```

### Deploy from published image

```powershell
$env:INVENTORY_IMAGE="ghcr.io/<owner>/<repo>:latest"
$env:PB_ADMIN_EMAIL="admin@inventory.local"
$env:PB_ADMIN_PASSWORD="change-me"
docker compose -f composedeploy.yml pull
docker compose -f composedeploy.yml up -d
```

### Image layout

```
/usr/src/app/
  pocketbase
  pb_public/     # Vite dist (index.html, assets)
  pb_data/       # SQLite + uploads (volume)
  pb_hooks/      # optional JS hooks
  pb_schema.json
  entrypoint.sh
```

Build args: `VERSION` (PocketBase), `VITE_POCKETBASE_URL` (leave empty for same-origin).

## CI/CD (GitHub Actions)

On every pull request and push to `main`:

1. Install frontend deps, typecheck, and production build
2. Run Docker Compose smoke tests

On push to `main` only:

3. Build and push one image to GHCR: `ghcr.io/<owner>/<repo>` (`latest`, branch, SHA)

Packages use `GITHUB_TOKEN` (enable **Read and write** permissions for workflows if publish fails).

## Local development (without Docker)

### 1. Start PocketBase

```powershell
cd pocketbase
.\pocketbase.exe serve
```

Open the Admin UI: [http://127.0.0.1:8090/_/](http://127.0.0.1:8090/_/)

On first run, create a Superuser account.

### 2. Create a Superuser (first run)

```powershell
cd pocketbase
.\pocketbase.exe superuser upsert admin@inventory.local Admin123456!
```

### 3. Import collections

Via Admin UI: **Settings → Import collections** → `pocketbase/pb_schema.json`

Or via script (PocketBase must be running):

```powershell
cd pocketbase
npm install
$env:PB_ADMIN_EMAIL="admin@inventory.local"
$env:PB_ADMIN_PASSWORD="Admin123456!"
npm run import-schema
```

### 4. Seed sample data (optional)

```powershell
cd pocketbase
$env:PB_ADMIN_EMAIL="admin@inventory.local"
$env:PB_ADMIN_PASSWORD="Admin123456!"
npm run seed
```

Seeded app login:

- Email: `admin@company.com`
- Password: `Admin123456!`
- Role: `administrator`

### 5. Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

Copy `frontend/.env.example` to `frontend/.env` if you need a custom PocketBase URL:

```
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

## Scripts

### Frontend (`frontend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

### PocketBase (`pocketbase/`)

| Command | Description |
|---------|-------------|
| `.\pocketbase.exe serve` | Start API on `:8090` |
| `npm run seed` | Seed demo data (requires admin env vars) |
| `npm run import-schema` | Import `pb_schema.json` via Admin API |

### Docker

| Command | Description |
|---------|-------------|
| `docker compose up --build` | Build and run (UI + API on `:8090`) |
| `docker compose down -v` | Stop and remove volumes |
| Compose + `composetest.yml` | Health + SPA smoke tests |

## Roles

| Role | Capabilities |
|------|----------------|
| Administrator | Full access including user management |
| Inventory Manager | Inventory, products, projects, transactions |
| Purchase | Purchase orders and suppliers |
| Sales | Customers, projects, sales-related views |
| Store Keeper | Stock receipts and inventory operations |
| Read Only | View only |

API rules enforce `read_only` cannot create/update; deletes are limited to administrators and inventory managers. Stock transactions and audit logs are immutable.

## Core business rules

1. **Never edit inventory quantities directly** — use Adjust Stock, PO receive, stock intake, or project assign/return.
2. **Project assignment** moves stock from available → reserved and sets product status to `assigned`.
3. **Project return** reverses that movement.
4. **Every movement** writes a `stock_transactions` row with before/after quantities.
5. **Audit logs** capture create/update/delete metadata where implemented.

## Production build

```powershell
cd frontend
npm run build
```

Serve `frontend/dist` locally with `npm run preview`, or use the Docker image (PocketBase serves the SPA from `pb_public`). Leave `VITE_POCKETBASE_URL` empty for same-origin. See [PocketBase going to production](https://pocketbase.io/docs/going-to-production/).

## More backend detail

See [`pocketbase/setup.md`](pocketbase/setup.md).

## License

Private / internal use unless otherwise specified.
