# Enterprise Resource Planning (ERP)

A dedicated, high-performance Trade Management and Accounting ERP built for physical wholesale, distribution, and commercial retail operations (tailored for high-velocity mandi/market traders).

Built with **Next.js 15 (App Router)**, **TypeScript**, **shadcn/ui**, **PostgreSQL (Neon Serverless)**, and **Drizzle ORM**.

---

## Key Features

### 1. Fast Counter POS & Billing (`[F2]`)
- **Keyboard-First Interface**: Complete checkout flow operable without a mouse.
- **Tabular Fast-Entry**: Smooth `Enter` progression (`Item -> Unit -> Qty -> Rate -> Discount -> Add`).
- **Dual-Stream Numbering**: Independent sequences for internal Estimate slips (`EST-xxxxx`) and legal Tax Invoices (`TAX-xxxxx`).
- **Landed Cost & Margin Tracking**: Landed freight cost frozen into each sales line item snapshot.
- **Logistics & Bilty Capture**: Carrier name, Bilty number, and Paid vs. To-Pay freight terms.
- **Pure CSS 80mm Thermal Receipt**: Fast `@media print` thermal slip generation with previous balance carry-forward.

### 2. Purchasing & Inward Batch Engine (`[F4]`)
- Multi-unit purchases (Parent Cartons/Boxes to Child Pieces/KGs).
- Automatic pro-rata freight allocation into unit landed cost (`landed_cost`).
- FIFO open batch creation linked to vendor for profit matrix attribution.
- Double-entry accounts payable and inventory asset postings.

### 3. Financial Vouchers & Contra Settlements (`[F7]`)
- **Customer Recovery Vouchers**: Udhar collection in Cash or Bank (with Raast / IBFT reference).
- **Supplier Payment Vouchers**: Vendor dues settlement.
- **Contra Barter Settlements**: Balanced journal netting customer deliveries against supplier purchases for dual-purpose trading entities, with cash differential handling.

### 4. Multi-Warehouse & Consignment Tracking
- Inter-godown transfers preserving unit landed costs under transfer chalans (`TRN-xxxxx`).
- Wastage, spoilage, and damage write-offs booked directly to loss accounts.
- Warehouse Gate Pass / Delivery Chalan (`GatePass.tsx`) hiding rates and prices for security dispatch.

### 5. Business Intelligence & Executive Analytics
- **Supplier Margin Matrix**: Real-time gross margin calculation (`(Sales - Landed Cost) / Sales × 100`) grouped by vendor.
- **Net Profit Statement**: Trading gross margin less operational overheads (Rent, Electricity, Salaries, Meals).
- **Receivables Debt Aging**: 0-30, 31-60, 61-90+ days aging buckets with 1-click WhatsApp payment reminders.

---

## Technology Stack

- **Framework**: Next.js 15+ (App Router) with React 19 & Turbopack
- **Language**: TypeScript in Strict Mode
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Database**: PostgreSQL (Neon Serverless with WebSocket Pool)
- **ORM**: Drizzle ORM + Drizzle Kit
- **Financial Arithmetic**: `decimal.js` with PostgreSQL `NUMERIC(14, 2)` precision
- **State Management**: Zustand
- **Icons**: Lucide React & Tabler Icons

---

## Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/razakhan83/Enterprise-Resource-Planning.git
cd Enterprise-Resource-Planning
npm install
```

### 2. Configure Environment Variables
Create `.env.local`:
```env
DATABASE_URL="postgresql://username:password@host/neondb?sslmode=require"
```

### 3. Deploy Database Schema & Seed
```bash
# Push schema to PostgreSQL
npx drizzle-kit push

# Initialize sequences and system accounts
npx tsx src/db/seed.ts
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the ERP interface.

---

## Keyboard Shortcuts

| Key | Action |
| :---: | :--- |
| `F2` | Focus Counter POS / Item Search |
| `F3` | Party & Customer Directory |
| `F4` | Inward Purchase Entry |
| `F7` | Financial Vouchers & Cashbook |
| `Ctrl + Enter` | Commit Invoice & Print 80mm Receipt |
| `Esc` | Close Active Dialog / Reset Entry |

---

## License
MIT License
