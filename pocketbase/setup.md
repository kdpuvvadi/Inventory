# PocketBase Backend Setup — Inventory Management

This folder contains the PocketBase schema, seed script, and setup instructions for the Inventory Management application.

## Prerequisites

- [PocketBase](https://pocketbase.io/docs/) v0.22+ (tested with v0.25+)
- Node.js 18+ (for the seed script only)

## 1. Download PocketBase

Download the latest release for your platform from [GitHub Releases](https://github.com/pocketbase/pocketbase/releases).

**Windows (PowerShell):**

```powershell
cd C:\Data\add\code\Inventory\pocketbase
Invoke-WebRequest -Uri "https://github.com/pocketbase/pocketbase/releases/download/v0.25.9/pocketbase_0.25.9_windows_amd64.zip" -OutFile pocketbase.zip
Expand-Archive pocketbase.zip -DestinationPath . -Force
Remove-Item pocketbase.zip
```

**Linux / macOS:**

```bash
cd pocketbase
# Adjust URL for your OS/arch from the releases page
curl -L -o pocketbase.zip "https://github.com/pocketbase/pocketbase/releases/download/v0.25.9/pocketbase_0.25.9_linux_amd64.zip"
unzip pocketbase.zip
chmod +x pocketbase
```

## 2. Start PocketBase

```bash
./pocketbase serve
```

On Windows:

```powershell
.\pocketbase.exe serve
```

The Admin UI is available at **http://127.0.0.1:8090/_/**

Data is stored in `pb_data/` (gitignored).

## 3. Create Superuser (Admin)

On first launch, PocketBase prompts you to create a superuser account in the terminal or browser.

Alternatively:

```bash
./pocketbase superuser create admin@inventory.local YourSecurePassword123
```

## 4. Import Collections Schema

**Option A — Admin UI**

1. Open **http://127.0.0.1:8090/_/**
2. Log in with your superuser credentials
3. Go to **Settings → Import collections**
4. Select `pb_schema.json` from this folder
5. Confirm the import

**Option B — Script**

```powershell
npm install
$env:PB_ADMIN_EMAIL="admin@inventory.local"
$env:PB_ADMIN_PASSWORD="YourSecurePassword123"
npm run import-schema
```

This creates/updates all collections:

| Collection | Purpose |
|---|---|
| `users` | Auth users with roles |
| `manufacturers`, `suppliers`, `customers` | Master data |
| `categories`, `warehouses`, `products` | Catalog & locations |
| `inventory` | Stock levels per warehouse |
| `projects`, `project_assignments` | Project tracking |
| `purchase_orders`, `purchase_order_items` | Procurement |
| `stock_transactions` | Immutable stock ledger |
| `audit_logs` | Immutable audit trail |
| `boms`, `bom_items` | Bill of materials |
| `app_settings` | Application configuration |

> **Note:** Importing updates the built-in `users` collection with the `role` field and API rules. Use PocketBase v0.23+ format (`fields` array, not legacy `schema`).

## 5. Create First Application User

Superusers manage the database; application users live in the `users` collection.

1. In Admin UI, open **Collections → users**
2. Click **New record**
3. Fill in:
   - **email:** `admin@company.com`
   - **password:** (secure password)
   - **name:** `System Administrator`
   - **role:** `administrator`
   - **verified:** checked
4. Save

Or use the seed script (step 6), which creates this user automatically.

## 6. Configure App Settings

1. Open **Collections → app_settings**
2. Create one record:

| Field | Example value |
|---|---|
| `company_name` | Acme Inventory Co. |
| `currency` | USD |
| `low_stock_threshold` | 10 |
| `theme_default` | light |

The seed script also creates this record.

## 7. Seed Sample Data (Optional)

```bash
cd pocketbase
npm install
```

Set environment variables (or edit defaults in `seed.js`):

```bash
# Linux / macOS
export PB_URL=http://127.0.0.1:8090
export PB_ADMIN_EMAIL=admin@inventory.local
export PB_ADMIN_PASSWORD=YourSecurePassword123

# Windows PowerShell
$env:PB_URL="http://127.0.0.1:8090"
$env:PB_ADMIN_EMAIL="admin@inventory.local"
$env:PB_ADMIN_PASSWORD="YourSecurePassword123"
```

Run the seed:

```bash
npm run seed
```

This creates sample manufacturers, suppliers, customers, categories, products, inventory, a warehouse, a project, app settings, and an administrator user.

## 8. Connect the Frontend

The React frontend reads the PocketBase URL from `VITE_POCKETBASE_URL`. Default: `http://127.0.0.1:8090`.

```bash
# frontend/.env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

Start the frontend (`npm run dev` in `frontend/`) and log in with the application user (not the superuser).

## API Rules Summary

| Action | Rule |
|---|---|
| List / View | Any authenticated user |
| Create / Update | Authenticated, role ≠ `read_only` |
| Delete | `administrator` or `inventory_manager` |
| Users list | `administrator` only |
| `stock_transactions` | Create only (immutable) |
| `audit_logs` | List/view: `administrator`; create: any auth user |

## User Roles

| Role | Access |
|---|---|
| `administrator` | Full access, user management |
| `inventory_manager` | Full data access, can delete |
| `purchase` | Create/update procurement records |
| `sales` | Create/update sales-related records |
| `store_keeper` | Warehouse operations |
| `read_only` | View only |

## Troubleshooting

- **Import creates collections but no fields:** Ensure PocketBase v0.23+ and that `pb_schema.json` uses `fields` (not legacy `schema`).
- **Relation errors on import:** Import the full `pb_schema.json` at once so collection IDs resolve.
- **Seed auth fails:** Use superuser credentials (`_superusers`), not an application `users` record.
- **CORS issues:** PocketBase allows all origins by default in dev; configure in Admin UI → Settings if needed.
