# ENTERPRISE TRADER ERP — MASTER IMPLEMENTATION PLAN & ROADMAP

Comprehensive architectural blueprint, database schema specification, phase-wise implementation roadmap, and live status tracker for the Enterprise Trade ERP system.

---

## 1. System Architecture Map

```text
c:\Users\razak\Main Projects\ERP\
├── .agents/
│   └── skills/                           # Strict anti-AI domain engineering rules
│       ├── financial-precision.md
│       ├── drizzle-acid-transactions.md
│       ├── fifo-inventory-engine.md
│       ├── immutable-double-entry.md
│       └── keyboard-first-pos-ui.md
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                # Enterprise dark/neutral dashboard wrapper
│   │   │   ├── billing/
│   │   │   │   ├── page.tsx              # Keyboard-first POS counter interface
│   │   │   │   └── slip/                 # 80mm Pure CSS thermal receipt view
│   │   │   ├── parties/
│   │   │   │   └── page.tsx              # Unified customer, supplier & contra ledger directory
│   │   │   ├── inventory/
│   │   │   │   └── page.tsx              # Batch-wise FIFO stock, consignment & godown views
│   │   │   ├── ledgers/
│   │   │   │   └── page.tsx              # General ledger, cashbook (tijori) & bank records
│   │   │   └── reports/
│   │   │       └── page.tsx              # Supplier gross margin matrix & aging buckets
│   │   └── api/
│   │       └── v1/                       # Headless REST/webhook endpoints for e-commerce sync
│   ├── actions/
│   │   ├── billing.ts                    # createSaleInvoice with atomic FOR UPDATE locks
│   │   ├── inventory.ts                  # Stock inward, landed freight cost allocation, wastage
│   │   └── ledgers.ts                    # Vouchers, contra settlements & cheque lifecycle
│   ├── db/
│   │   ├── index.ts                      # Neon Serverless WebSocket Pool client
│   │   ├── schema.ts                     # NUMERIC(14,2) hardened Drizzle schema
│   │   ├── seed.ts                       # Atomic sequences & system accounts seeder
│   │   └── verify.ts                     # Live verification & health check runner
│   ├── store/
│   │   └── posStore.ts                   # Zustand store with keyboard shortcuts & cart state
│   ├── ui/
│   │   ├── table.tsx                     # High-density data grid with skeleton fallbacks
│   │   ├── modal.tsx                     # Keyboard-navigable dialogs
│   │   └── badge.tsx                     # Semantic status badges
│   └── utils/
│       ├── decimal.ts                    # Floating-point-free decimal.js wrappers
│       └── format.ts                     # Rs. 0.00 currency & date formatters
├── drizzle.config.ts                     # Drizzle Kit schema dialect configuration
├── IMPLEMENTATION_PLAN.md                # This master tracking document
└── package.json                          # Core dependencies and scripts
```

---

## 2. Hardened Database Schema Reference

The database enforces PostgreSQL `NUMERIC(14, 2)` across all financial figures. JavaScript floating-point calculations are strictly forbidden.

### Core Tables Summary
- `parties`: Unified directory for Customers, Suppliers, Dual-purpose entities, and System Accounts (`SYSTEM_CASH`, `SALES_REVENUE`, `KASR_DISCOUNT_EXPENSE`).
- `products`: Product master with multi-unit configuration (`parent_unit`, `child_unit`, `conversion_rate`) and consignment status (`is_consignment`).
- `product_batches`: FIFO batch inventory with `remaining_qty` (child units), `landed_cost` (freight included), compound index `(product_id, remaining_qty, received_date)`, and mandatory `supplier_id` link for gross margin tracking.
- `sales_invoices`: Invoices with dual-stream sequence support (`EST-xxxx` for Kacha slips, `TAX-xxxx` for Pakka tax invoices), transport logistics (Bilty number, transporter name, freight terms), and discount/kasr capture.
- `sales_items`: Line items with normalized `qty_consumed` in child units, `unit_type_sold` (`PARENT` vs `CHILD`), sales rate, and locked `cost_snapshot`.
- `ledger_transactions`: Immutable double-entry financial ledger (`debit`, `credit`, `particulars`). Zero `UPDATE` or `DELETE` statements allowed.

---

## 3. Phase-Wise Implementation Roadmap

### Milestone 1: Foundation & Database Scaffolding
- [x] Initialize Next.js 15 App Router project with TypeScript.
- [x] Install core dependencies: `drizzle-orm`, `@neondatabase/serverless`, `zod`, `decimal.js`, `zustand`, `@tabler/icons-react`, `drizzle-kit`, `tsx`, `ws`, `dotenv`.
- [x] Configure `.env.local` and `.env` with Neon serverless database URL.
- [x] Create hardened `src/db/schema.ts` with exact `NUMERIC(14, 2)` precision.
- [x] Push schema to Neon using `drizzle-kit push`.
- [x] Create atomic PostgreSQL sequences (`kacha_invoice_seq`, `pakka_invoice_seq`).
- [x] Seed reserve system accounts: `SYSTEM_CASH` (Tijori), `SALES_REVENUE`, `KASR_DISCOUNT_EXPENSE`.
- [x] Seed sample market suppliers (Jodia Bazar), customers (Badami Bagh), and products.
- [x] Verify live database state via `src/db/verify.ts`.

### Milestone 2: Keyboard-First POS UI & State Engine
- [x] Implement `src/store/posStore.ts` using Zustand for fast counter sales.
- [x] Build global keyboard shortcuts listener (`F2` Counter, `F3` Party Directory, `F4` Purchase, `F7` Payment, `Ctrl+Enter` Commit & Print, `Esc` Reset).
- [x] Build high-density counter POS screen (`src/app/(dashboard)/billing/page.tsx`).
- [x] Implement Tabular Cell Navigation (`Item -> Unit Toggle -> Qty -> Rate -> Discount -> Enter`).
- [x] Implement Walk-in Cash mode vs Registered Party modal with running balance alert.
- [x] Implement Pakka (TAX) vs Kacha (EST) 1-click toggle.
- [x] Implement pure CSS `@media print` 80mm thermal receipt generator (`/billing/slip` and receipt modal).

### Milestone 3: Inventory & Atomic Billing Engine
- [x] Implement `createSaleInvoice` Server Action in `src/actions/billing.ts`.
- [x] Enforce PostgreSQL ACID transaction with Row-Level Locking (`FOR UPDATE`) on open batches.
- [x] Implement multi-batch consumption (FIFO split across batches).
- [x] Snapshot exact landed purchase cost on each `sales_items` line.
- [x] Post double-entry records:
  - Debit: Customer ledger (or `SYSTEM_CASH` for walk-ins).
  - Debit: `KASR_DISCOUNT_EXPENSE` (if kasr/discount applied).
  - Credit: `SALES_REVENUE` (total invoice value).
- [x] Concurrency and foreign key ordering verification: Tested directly via `test_sale.ts` and automated browser session.

### Milestone 4: Double-Entry Financial Ledgers & Contra Settlements
- [x] Unified Party Ledger view with debit/credit balance running total (`/parties` & `/ledgers`).
- [x] Cash-in-Hand and multi-bank account registers (`bank_accounts`, `SYSTEM_CASH`, `BANK_MEEZAN`).
- [x] Recovery & Supplier Payment Vouchers with Raast/IBFT references (`/vouchers`).
- [x] Contra / Barter Settlement Voucher netting purchases against deliveries (`settleContraBarterVoucher`).
- [x] Cheque lifecycle schema model (`cheques`).
- [x] Gate Pass / Delivery Chalan generation hiding rates/prices for warehouse dispatch (`GatePass.tsx`).

### Milestone 5: Executive Business Intelligence & Margin Matrix
- [x] Supplier-wise Gross Margin Matrix (`/reports` - aggregated sales vs landed batch costs).
- [x] Real-time loss-making and profitable vendor categorization badges.
- [x] Trading Net Profit Statement (Gross Revenue - COGS - Overheads).
- [x] Customer debt aging buckets (0-30 days, 31-60 days, 61-90+ days).
- [x] 1-Click WhatsApp payment reminder link generator with pre-filled balance and bank metadata.

---

## 4. Module Status Tracking Checklist

| Module | Status | Verification Detail |
| :--- | :---: | :--- |
| **Neon PostgreSQL Connection** | `DONE` | Connection verified via Pool & WebSocket |
| **Drizzle Schema & Migrations** | `DONE` | Deployed via `drizzle-kit push` (Phase 2 schema active) |
| **Atomic Invoice Sequences** | `DONE` | `kacha_invoice_seq`, `pakka_invoice_seq`, `purchase_invoice_seq`, `transfer_chalan_seq` live |
| **System Accounts Seeding** | `DONE` | `SYSTEM_CASH`, `SALES_REVENUE`, `KASR_DISCOUNT_EXPENSE`, `INVENTORY_ASSET`, `STOCK_WASTAGE_LOSS` seeded |
| **Initial Market Demo Data** | `DONE` | Suppliers, customers, products, and batches active |
| **POS Keyboard Shortcuts & Store** | `DONE` | Zustand store with global F2/F3/F4/F7 & Ctrl+Enter |
| **High-Density POS UI (shadcn/ui)** | `DONE` | Clean enterprise 2-column workspace on `/billing` |
| **80mm Thermal Receipt Generator** | `DONE` | Pure CSS `@media print` 80mm slip validated with carry-forward |
| **Warehouse Gate Pass Chalan** | `DONE` | Rates/prices hidden delivery slip (`GatePass.tsx`) |
| **Atomic FIFO Billing Action** | `DONE` | `FOR UPDATE` lock, double-entry ledger verified on Neon |
| **Purchasing & Inward Batches (F4)** | `DONE` | Freight pro-rata allocation to landed unit cost verified (`/purchases`) |
| **Vouchers & Settlements (F7)** | `DONE` | Recovery, disbursement, and contra vouchers verified (`/vouchers`) |
| **Multi-Warehouse & Spoilage** | `DONE` | Godown transfer and wastage loss deduction verified |
| **Supplier Margin Matrix** | `DONE` | Vendor-wise gross margins live on `/reports` |
| **P&L Net Profit Statement** | `DONE` | Trading margin less operating expenses live on `/reports` |
| **Overdue Aging & WhatsApp Alerts** | `DONE` | 30/60/90 days debt aging with WhatsApp links live on `/reports` |
