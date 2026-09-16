import "dotenv/config";
import { db } from "./index";
import {
  parties,
  products,
  productBatches,
  warehouses,
  bankAccounts,
  operatingExpenses,
} from "./schema";
import { sql } from "drizzle-orm";

export async function setupSystemAccountsAndSeed() {
  console.log("--> Initializing atomic sequences...");
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS kacha_invoice_seq START 1;`);
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS pakka_invoice_seq START 1;`);
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS purchase_invoice_seq START 1;`);
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS transfer_chalan_seq START 1;`);
  console.log("✓ Sequences ready.");

  console.log("--> Seeding default warehouses...");
  const [shopCounter] = await db
    .insert(warehouses)
    .values({
      name: "Main Retail Counter",
      isRetailCounter: true,
    })
    .onConflictDoNothing()
    .returning();

  const [centralGodown] = await db
    .insert(warehouses)
    .values({
      name: "Central Godown #1",
      isRetailCounter: false,
    })
    .onConflictDoNothing()
    .returning();

  console.log("✓ Warehouses initialized.");

  console.log("--> Seeding system accounts...");
  const systemAccounts = [
    {
      name: "Cash-in-Hand",
      type: "SYSTEM_ACCOUNT" as const,
      systemRole: "SYSTEM_CASH",
      currentBalance: "0.00",
    },
    {
      name: "Sales Revenue",
      type: "SYSTEM_ACCOUNT" as const,
      systemRole: "SALES_REVENUE",
      currentBalance: "0.00",
    },
    {
      name: "Discount / Kasr Expense",
      type: "SYSTEM_ACCOUNT" as const,
      systemRole: "KASR_DISCOUNT_EXPENSE",
      currentBalance: "0.00",
    },
    {
      name: "Inventory on Hand (Asset)",
      type: "SYSTEM_ACCOUNT" as const,
      systemRole: "INVENTORY_ASSET",
      currentBalance: "0.00",
    },
    {
      name: "Stock Wastage & Loss",
      type: "SYSTEM_ACCOUNT" as const,
      systemRole: "STOCK_WASTAGE_LOSS",
      currentBalance: "0.00",
    },
    {
      name: "Meezan Bank - Main Business Account",
      type: "SYSTEM_ACCOUNT" as const,
      systemRole: "BANK_MEEZAN",
      currentBalance: "500000.00",
    },
  ];

  for (const acc of systemAccounts) {
    await db
      .insert(parties)
      .values(acc)
      .onConflictDoNothing({ target: parties.systemRole });
  }
  console.log("✓ System accounts initialized.");

  // Link bank account
  const meezanParty = await db.query.parties.findFirst({
    where: (p, { eq }) => eq(p.systemRole, "BANK_MEEZAN"),
  });

  if (meezanParty) {
    await db
      .insert(bankAccounts)
      .values({
        bankName: "Meezan Bank Limited",
        accountNumber: "0102-0105892341",
        currentBalance: "500000.00",
        systemPartyId: meezanParty.id,
      })
      .onConflictDoNothing();
  }

  console.log("--> Seeding demo supplier, dual party, and customer...");
  // 1. Supplier
  const [supplier] = await db
    .insert(parties)
    .values({
      name: "Al-Madina Traders",
      type: "SUPPLIER",
      phone: "+92 300 1234567",
      address: "Shop #14, Daryalal St, Wholesale Market",
      currentBalance: "0.00",
    })
    .onConflictDoNothing()
    .returning();

  // 2. Dual Party (Customer + Supplier) for Contra Settlements
  await db
    .insert(parties)
    .values({
      name: "Karachi Pipe & Sanitary Store",
      type: "DUAL",
      phone: "+92 333 9988776",
      address: "Plaza 4, Wholesale Timber Market",
      currentBalance: "15000.00",
    })
    .onConflictDoNothing();

  // 3. Regular Registered Customer
  await db
    .insert(parties)
    .values({
      name: "Haji Rafiq & Sons Hardware",
      type: "CUSTOMER",
      phone: "+92 321 7654321",
      address: "Plot 88, Auto & Hardware Market",
      currentBalance: "25000.00",
    })
    .onConflictDoNothing();

  // 4. Products
  const [sampleProduct] = await db
    .insert(products)
    .values({
      name: "Heavy Duty PVC Ball Valve 1-inch",
      sku: "VLV-PVC-001",
      parentUnit: "Carton",
      childUnit: "Piece",
      conversionRate: 24,
      isConsignment: false,
    })
    .onConflictDoNothing()
    .returning();

  const [secondProduct] = await db
    .insert(products)
    .values({
      name: "Brass Gate Valve 3/4-inch",
      sku: "VLV-BRS-002",
      parentUnit: "Box",
      childUnit: "Piece",
      conversionRate: 10,
      isConsignment: false,
    })
    .onConflictDoNothing()
    .returning();

  // 5. Seed some initial operating expenses for Net Profit Statement
  const expenses = [
    { category: "Shop & Warehouse Rent", amount: "45000.00", notes: "Monthly warehouse lease", paymentMethod: "BANK" },
    { category: "Commercial Electricity", amount: "18500.00", notes: "Electric power bill", paymentMethod: "BANK" },
    { category: "Staff Salaries", amount: "65000.00", notes: "Counter sales & loading staff", paymentMethod: "CASH" },
    { category: "Staff Meals & Hospitality", amount: "8200.00", notes: "Tea, drinking water, meals", paymentMethod: "CASH" },
  ];

  for (const exp of expenses) {
    await db.insert(operatingExpenses).values(exp);
  }

  console.log("✓ Seed complete. All Phase 2 foundation data is ready.");
  process.exit(0);
}

setupSystemAccountsAndSeed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
