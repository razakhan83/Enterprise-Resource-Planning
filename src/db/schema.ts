import { pgTable, text, timestamp, integer, boolean, numeric, uuid, index, pgEnum } from "drizzle-orm/pg-core";

export const partyTypeEnum = pgEnum("party_type", ["CUSTOMER", "SUPPLIER", "DUAL", "SYSTEM_ACCOUNT"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "SALE",
  "PURCHASE",
  "PAYMENT",
  "RECEIPT",
  "CONTRA",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "JOURNAL"
]);
export const chequeStatusEnum = pgEnum("cheque_status", ["RECEIVED", "DEPOSITED", "CLEARED", "BOUNCED"]);

// Helper for strict PostgreSQL NUMERIC(14, 2) financial precision
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 }).default("0.00");

export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: partyTypeEnum("type").notNull(),
  systemRole: text("system_role").unique(), // e.g. 'SYSTEM_CASH', 'SALES_REVENUE', 'KASR_DISCOUNT_EXPENSE', 'INVENTORY_ASSET', 'STOCK_WASTAGE_LOSS'
  phone: text("phone"),
  address: text("address"),
  creditLimit: money("credit_limit").notNull(),
  currentBalance: money("current_balance").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isRetailCounter: boolean("is_retail_counter").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  parentUnit: text("parent_unit").notNull(), // e.g. Carton, Bora
  childUnit: text("child_unit").notNull(),   // e.g. Piece, KG, Coil
  conversionRate: integer("conversion_rate").notNull(), // Number of child units in 1 parent unit
  defaultSaleRate: money("default_sale_rate").notNull(), // Standard selling rate per child unit
  isConsignment: boolean("is_consignment").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productBatches = pgTable("product_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  supplierId: uuid("supplier_id").references(() => parties.id).notNull(), // Vendor tracking for margin matrix
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  receivedDate: timestamp("received_date").notNull(),
  originalQty: integer("original_qty").notNull(), // Stored strictly in child units
  remainingQty: integer("remaining_qty").notNull(), // Locks apply here (child units)
  landedCost: money("landed_cost").notNull(), // Landed purchase + freight per child unit
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  fifoIdx: index("fifo_idx").on(table.productId, table.remainingQty, table.receivedDate),
}));

export const purchaseInvoices = pgTable("purchase_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").references(() => parties.id).notNull(),
  invoiceNo: text("invoice_no").unique().notNull(), // PUR-00001
  totalAmount: money("total_amount").notNull(),
  freightAmount: money("freight_amount").notNull(),
  netAmount: money("net_amount").notNull(),
  biltyNumber: text("bilty_number"),
  transporterName: text("transporter_name"),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  isPaidImmediate: boolean("is_paid_immediate").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id").references(() => purchaseInvoices.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => productBatches.id).notNull(),
  qtyReceived: integer("qty_received").notNull(), // In child units
  unitType: text("unit_type").notNull(), // PARENT | CHILD
  purchaseRate: money("purchase_rate").notNull(),
  landedUnitCost: money("landed_unit_cost").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salesInvoices = pgTable("sales_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id").references(() => parties.id), // Nullable for Cash Walk-ins
  invoiceNo: text("invoice_no").unique().notNull(), // Dual-stream sequence: EST-xxxx or TAX-xxxx
  totalAmount: money("total_amount").notNull(),
  discountAmount: money("discount_amount").notNull(), // Kasr / Round-off
  netAmount: money("net_amount").notNull(),
  biltyNumber: text("bilty_number"),
  transporterName: text("transporter_name"),
  freightTerms: text("freight_terms"), // PAID vs TO-PAY
  isPakkaBill: boolean("is_pakka_bill").default(false).notNull(),
  isVoided: boolean("is_voided").default(false).notNull(),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salesItems = pgTable("sales_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").references(() => salesInvoices.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => productBatches.id).notNull(),
  qtyConsumed: integer("qty_consumed").notNull(), // Stored normalized in child units
  unitTypeSold: text("unit_type_sold").notNull(), // 'PARENT' | 'CHILD'
  saleRate: money("sale_rate").notNull(), // Transactional billing rate
  costSnapshot: money("cost_snapshot").notNull(), // Landed cost snapshot for exact margin calculation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ledgerTransactions = pgTable("ledger_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id").references(() => parties.id).notNull(), // References actual party or SYSTEM_ACCOUNT
  type: transactionTypeEnum("type").notNull(),
  referenceId: uuid("reference_id"), // links to Invoice, Voucher, or Chalan
  debit: money("debit").notNull(),
  credit: money("credit").notNull(),
  particulars: text("particulars").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  bankName: text("bank_name").notNull(), // e.g. Meezan Bank, HBL, Bank Alfalah
  accountNumber: text("account_number").notNull(),
  currentBalance: money("current_balance").notNull(),
  systemPartyId: uuid("system_party_id").references(() => parties.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cheques = pgTable("cheques", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id").references(() => parties.id).notNull(),
  bankName: text("bank_name").notNull(),
  chequeNumber: text("cheque_number").notNull(),
  amount: money("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: chequeStatusEnum("status").default("RECEIVED").notNull(),
  clearedDate: timestamp("cleared_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const warehouseTransfers = pgTable("warehouse_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id).notNull(),
  toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  batchId: uuid("batch_id").references(() => productBatches.id).notNull(),
  qtyMoved: integer("qty_moved").notNull(),
  transferChalanNo: text("transfer_chalan_no").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const operatingExpenses = pgTable("operating_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(), // Rent, Electricity, Salaries, Meals/Tea, Stock Wastage
  amount: money("amount").notNull(),
  notes: text("notes"),
  paymentMethod: text("payment_method").notNull(), // CASH | BANK
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const storeSettings = pgTable("store_settings", {
  id: text("id").primaryKey().default("default"),
  businessName: text("business_name").default("Trading Co.").notNull(),
  tagline: text("tagline"),
  phonePrimary: text("phone_primary"),
  phoneSecondary: text("phone_secondary"),
  email: text("email"),
  address: text("address"),
  ntnNumber: text("ntn_number"),
  strnNumber: text("strn_number"),
  fbrPosIntegrated: boolean("fbr_pos_integrated").default(false).notNull(),
  defaultInvoiceFormat: text("default_invoice_format").default("THERMAL_80MM").notNull(), // THERMAL_80MM | PDF_A4 | PDF_A5
  invoicePrefixEstimate: text("invoice_prefix_estimate").default("EST").notNull(),
  invoicePrefixTax: text("invoice_prefix_tax").default("TAX").notNull(),
  thermalPaperWidth: text("thermal_paper_width").default("80mm").notNull(), // 58mm | 80mm
  thermalPrinterHeader: text("thermal_printer_header"),
  thermalPrinterFooter: text("thermal_printer_footer").default("Exchange within 3 days with bill. No cash refund.").notNull(),
  defaultWarehouseId: uuid("default_warehouse_id").references(() => warehouses.id),
  enableCreditLimitEnforcement: boolean("enable_credit_limit_enforcement").default(false).notNull(),
  roundOffThreshold: money("round_off_threshold").default("5.00").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
