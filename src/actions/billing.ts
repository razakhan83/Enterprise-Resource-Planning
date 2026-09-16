"use server";

import { db } from "@/db";
import {
  productBatches,
  salesInvoices,
  salesItems,
  parties,
  ledgerTransactions,
  products,
  storeSettings,
} from "@/db/schema";
import { eq, inArray, sql, desc } from "drizzle-orm";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

export type PosItemInput = {
  productId: string;
  productName: string;
  unitType: "PARENT" | "CHILD";
  qty: number;
  rate: string;
};

export type CreateSaleInvoiceParams = {
  partyId: string | null; // null represents Cash Walk-in (Tijori)
  items: PosItemInput[];
  discountAmount: string; // Kasr / Round-off
  isPakkaBill: boolean; // false = EST (Kacha), true = TAX (Pakka)
  biltyNumber?: string;
  transporterName?: string;
  freightTerms?: string; // 'PAID' | 'TO-PAY'
};

export type BillingResult = {
  success: boolean;
  invoiceId?: string;
  invoiceNo?: string;
  totalAmount?: string;
  discountAmount?: string;
  netAmount?: string;
  error?: string;
};

/**
 * Loads data required for the counter POS interface
 */
export async function getPosInitialData() {
  try {
    // 1. Fetch products with current live stock
    const allProducts = await db.select().from(products);
    const batches = await db
      .select({
        productId: productBatches.productId,
        remainingQty: productBatches.remainingQty,
      })
      .from(productBatches)
      .where(sql`${productBatches.remainingQty} > 0`);

    const stockMap = new Map<string, number>();
    for (const b of batches) {
      stockMap.set(b.productId, (stockMap.get(b.productId) || 0) + b.remainingQty);
    }

    const productsWithStock = allProducts.map((p) => ({
      ...p,
      stockChildUnits: stockMap.get(p.id) || 0,
      stockParentUnits: Math.floor((stockMap.get(p.id) || 0) / p.conversionRate),
    }));

    // 2. Fetch parties eligible for sales (Customers and Dual parties)
    const partyList = await db
      .select()
      .from(parties)
      .where(sql`${parties.type} IN ('CUSTOMER', 'DUAL')`);

    // 3. Fetch Store Settings
    const settings = await db.query.storeSettings.findFirst({
      where: eq(storeSettings.id, "default"),
    });

    // 4. Fetch Recent Invoices
    const recent = await db
      .select({
        id: salesInvoices.id,
        invoiceNo: salesInvoices.invoiceNo,
        partyName: parties.name,
        totalAmount: salesInvoices.totalAmount,
        discountAmount: salesInvoices.discountAmount,
        netAmount: salesInvoices.netAmount,
        isPakkaBill: salesInvoices.isPakkaBill,
        isVoided: salesInvoices.isVoided,
        voidReason: salesInvoices.voidReason,
        createdAt: salesInvoices.createdAt,
      })
      .from(salesInvoices)
      .leftJoin(parties, eq(salesInvoices.partyId, parties.id))
      .orderBy(desc(salesInvoices.createdAt))
      .limit(15);

    return {
      products: productsWithStock,
      parties: partyList,
      settings,
      recentInvoices: recent,
    };
  } catch (error: any) {
    console.error("Error fetching POS data:", error);
    return {
      products: [],
      parties: [],
      settings: null,
      recentInvoices: [],
      error: error.message,
    };
  }
}

/**
 * Creates an atomic sale invoice with FIFO inventory deduction and immutable double-entry ledger postings.
 */
export async function createSaleInvoice(
  params: CreateSaleInvoiceParams
): Promise<BillingResult> {
  const {
    partyId,
    items,
    discountAmount = "0.00",
    isPakkaBill,
    biltyNumber,
    transporterName,
    freightTerms,
  } = params;

  if (!items || items.length === 0) {
    return { success: false, error: "Cannot create invoice with zero items." };
  }

  try {
    return await db.transaction(async (tx) => {
      let totalAmount = new Decimal(0);
      const discount = new Decimal(discountAmount || 0);
      const invoiceId = crypto.randomUUID();

      // 1. Generate Atomic Dual-Stream Sequence
      const seqName = isPakkaBill ? "pakka_invoice_seq" : "kacha_invoice_seq";
      const prefix = isPakkaBill ? "TAX" : "EST";
      const seqRes = await tx.execute(sql.raw(`SELECT nextval('${seqName}') AS next_val`));
      const nextNum = (seqRes.rows[0] as any).next_val;
      const invoiceNo = `${prefix}-${nextNum.toString().padStart(5, "0")}`;

      // 2. Pre-fetch product conversions (Avoid N+1 queries)
      const productIds = items.map((i) => i.productId);
      const productsData = await tx
        .select({
          id: products.id,
          name: products.name,
          conversionRate: products.conversionRate,
        })
        .from(products)
        .where(inArray(products.id, productIds));

      const productMap = new Map(productsData.map((p) => [p.id, p]));

      const lineItemsToInsert: Array<{
        invoiceId: string;
        productId: string;
        batchId: string;
        qtyConsumed: number;
        unitTypeSold: "PARENT" | "CHILD";
        saleRate: string;
        costSnapshot: string;
      }> = [];

      // 3. FIFO Batch Deductions with PostgreSQL Row-Level Locking (FOR UPDATE)
      for (const item of items) {
        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new Error(`Product ${item.productId} not found.`);
        }

        const convRate = prod.conversionRate;
        const qtyInChildUnits =
          item.unitType === "PARENT" ? item.qty * convRate : item.qty;
        let remainingToDeduct = qtyInChildUnits;

        const rateDecimal = new Decimal(item.rate);
        totalAmount = totalAmount.plus(rateDecimal.mul(item.qty));

        // Fetch open batches with FOR UPDATE lock
        const openBatches = await tx.execute(sql`
          SELECT id, remaining_qty, landed_cost 
          FROM ${productBatches} 
          WHERE product_id = ${item.productId} AND remaining_qty > 0 
          ORDER BY received_date ASC 
          FOR UPDATE
        `);

        for (const batch of openBatches.rows as any[]) {
          if (remainingToDeduct <= 0) break;

          const available = Number(batch.remaining_qty);
          const deduct = Math.min(available, remainingToDeduct);

          // Update batch remaining quantity
          await tx
            .update(productBatches)
            .set({ remainingQty: available - deduct })
            .where(eq(productBatches.id, batch.id));

          // Buffer line item for insertion after invoice record is created
          lineItemsToInsert.push({
            invoiceId,
            productId: item.productId,
            batchId: batch.id,
            qtyConsumed: deduct,
            unitTypeSold: item.unitType,
            saleRate: item.rate,
            costSnapshot: batch.landed_cost,
          });

          remainingToDeduct -= deduct;
        }

        if (remainingToDeduct > 0) {
          throw new Error(
            `Insufficient stock for '${prod.name}'. Needed: ${qtyInChildUnits}, shortage: ${remainingToDeduct} units.`
          );
        }
      }

      const netAmount = totalAmount.minus(discount);
      if (netAmount.isNegative()) {
        throw new Error("Discount cannot exceed the total invoice amount.");
      }

      // Check credit limit enforcement if party is specified
      const currentStoreSettings = await tx.query.storeSettings.findFirst({
        where: eq(storeSettings.id, "default"),
      });

      if (partyId && currentStoreSettings?.enableCreditLimitEnforcement) {
        const partyRecord = await tx.query.parties.findFirst({
          where: eq(parties.id, partyId),
        });
        if (partyRecord && Number(partyRecord.creditLimit) > 0) {
          const currentBal = new Decimal(partyRecord.currentBalance);
          const projectedBal = currentBal.plus(netAmount);
          const limit = new Decimal(partyRecord.creditLimit);
          if (projectedBal.greaterThan(limit)) {
            throw new Error(
              `Credit limit exceeded! Balance would reach Rs. ${projectedBal.toFixed(2)}, which exceeds allowed ceiling of Rs. ${limit.toFixed(2)}.`
            );
          }
        }
      }

      // 4. Create Parent Invoice Record FIRST to satisfy Foreign Key Constraint
      await tx.insert(salesInvoices).values({
        id: invoiceId,
        partyId,
        invoiceNo,
        totalAmount: totalAmount.toFixed(2),
        discountAmount: discount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        biltyNumber: biltyNumber || null,
        transporterName: transporterName || null,
        freightTerms: freightTerms || null,
        isPakkaBill,
      });

      // 5. Insert Child Line Items
      for (const lineItem of lineItemsToInsert) {
        await tx.insert(salesItems).values(lineItem);
      }

      // 5. System Reserve Accounts & Immutable Double-Entry Postings
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties} 
        WHERE system_role IN ('SYSTEM_CASH', 'SALES_REVENUE', 'KASR_DISCOUNT_EXPENSE')
      `);

      const sysMap = new Map((sysAccs.rows as any[]).map((r) => [r.system_role, r.id]));
      const cashAcc = sysMap.get("SYSTEM_CASH");
      const revenueAcc = sysMap.get("SALES_REVENUE");
      const kasrAcc = sysMap.get("KASR_DISCOUNT_EXPENSE");

      if (!cashAcc || !revenueAcc || !kasrAcc) {
        throw new Error("Critical system accounts are unseeded. Please run seed script.");
      }

      const effectivePartyId = partyId || cashAcc;

      // ENTRY 1: Debit Party / Cash Drawer (Net Amount)
      await tx.insert(ledgerTransactions).values({
        partyId: effectivePartyId,
        type: "SALE",
        referenceId: invoiceId,
        debit: netAmount.toFixed(2),
        credit: "0.00",
        particulars: `Sales against Invoice ${invoiceNo}`,
      });

      await tx
        .update(parties)
        .set({
          currentBalance: sql`current_balance + ${netAmount.toFixed(2)}`,
        })
        .where(eq(parties.id, effectivePartyId));

      // ENTRY 2: Debit Kasr / Discount Expense (if discount > 0)
      if (discount.greaterThan(0)) {
        await tx.insert(ledgerTransactions).values({
          partyId: kasrAcc,
          type: "JOURNAL",
          referenceId: invoiceId,
          debit: discount.toFixed(2),
          credit: "0.00",
          particulars: `Kasr allowed on Invoice ${invoiceNo}`,
        });

        await tx
          .update(parties)
          .set({
            currentBalance: sql`current_balance + ${discount.toFixed(2)}`,
          })
          .where(eq(parties.id, kasrAcc));
      }

      // ENTRY 3: Credit Sales Revenue (Gross Amount)
      await tx.insert(ledgerTransactions).values({
        partyId: revenueAcc,
        type: "SALE",
        referenceId: invoiceId,
        debit: "0.00",
        credit: totalAmount.toFixed(2),
        particulars: `Sales Revenue from Invoice ${invoiceNo}`,
      });

      await tx
        .update(parties)
        .set({
          currentBalance: sql`current_balance + ${totalAmount.toFixed(2)}`,
        })
        .where(eq(parties.id, revenueAcc));

      // Double-entry validation: Debit (Net + Kasr) == Credit (Total) holds strictly.

      return {
        success: true,
        invoiceId,
        invoiceNo,
        totalAmount: totalAmount.toFixed(2),
        discountAmount: discount.toFixed(2),
        netAmount: netAmount.toFixed(2),
      };
    });
  } catch (err: any) {
    console.error("Sale invoice creation failed:", err);
    return {
      success: false,
      error: err.message || "Failed to process sale invoice.",
    };
  }
}

export interface VoidInvoiceResult {
  success: boolean;
  invoiceNo?: string;
  error?: string;
}

export async function voidSaleInvoice(
  invoiceId: string,
  reason?: string
): Promise<VoidInvoiceResult> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Fetch and row-lock the invoice
      const invRes = await tx.execute(sql`
        SELECT * FROM ${salesInvoices}
        WHERE id = ${invoiceId}
        FOR UPDATE
      `);

      if (invRes.rows.length === 0) {
        throw new Error("Invoice not found.");
      }

      const invoice = invRes.rows[0] as any;
      if (invoice.is_voided) {
        throw new Error(`Invoice ${invoice.invoice_no} has already been voided.`);
      }

      // 2. Fetch sales items to reverse stock
      const items = await tx.execute(sql`
        SELECT * FROM ${salesItems}
        WHERE invoice_id = ${invoiceId}
      `);

      // 3. Reverse stock deduction back into batches with FOR UPDATE
      for (const it of items.rows as any[]) {
        const batchRes = await tx.execute(sql`
          SELECT id, remaining_qty FROM ${productBatches}
          WHERE id = ${it.batch_id}
          FOR UPDATE
        `);

        if (batchRes.rows.length > 0) {
          const currentBatch = batchRes.rows[0] as any;
          await tx
            .update(productBatches)
            .set({ remainingQty: Number(currentBatch.remaining_qty) + Number(it.qty_consumed) })
            .where(eq(productBatches.id, it.batch_id));
        }
      }

      // 4. Double-Entry Reversal Postings
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties}
        WHERE system_role IN ('SYSTEM_CASH', 'SALES_REVENUE', 'KASR_DISCOUNT_EXPENSE')
      `);

      const sysMap = new Map((sysAccs.rows as any[]).map((r) => [r.system_role, r.id]));
      const cashAcc = sysMap.get("SYSTEM_CASH");
      const revenueAcc = sysMap.get("SALES_REVENUE");
      const kasrAcc = sysMap.get("KASR_DISCOUNT_EXPENSE");

      if (!cashAcc || !revenueAcc || !kasrAcc) {
        throw new Error("System ledger accounts missing.");
      }

      const effectivePartyId = invoice.party_id || cashAcc;
      const netAmount = new Decimal(invoice.net_amount);
      const discount = new Decimal(invoice.discount_amount);
      const totalAmount = new Decimal(invoice.total_amount);

      // Reversal Entry 1: Credit Party/Cash (reducing receivable / cash balance)
      await tx.insert(ledgerTransactions).values({
        partyId: effectivePartyId,
        type: "CREDIT_NOTE",
        referenceId: invoiceId,
        debit: "0.00",
        credit: netAmount.toFixed(2),
        particulars: `Void / Reversal of Invoice ${invoice.invoice_no}: ${reason || "Customer Cancellation"}`,
      });

      await tx
        .update(parties)
        .set({
          currentBalance: sql`current_balance - ${netAmount.toFixed(2)}`,
        })
        .where(eq(parties.id, effectivePartyId));

      // Reversal Entry 2: Credit Kasr Expense (if discount > 0)
      if (discount.greaterThan(0)) {
        await tx.insert(ledgerTransactions).values({
          partyId: kasrAcc,
          type: "JOURNAL",
          referenceId: invoiceId,
          debit: "0.00",
          credit: discount.toFixed(2),
          particulars: `Reversal of Kasr on Voided Invoice ${invoice.invoice_no}`,
        });

        await tx
          .update(parties)
          .set({
            currentBalance: sql`current_balance - ${discount.toFixed(2)}`,
          })
          .where(eq(parties.id, kasrAcc));
      }

      // Reversal Entry 3: Debit Sales Revenue (Gross Amount reversal)
      await tx.insert(ledgerTransactions).values({
        partyId: revenueAcc,
        type: "JOURNAL",
        referenceId: invoiceId,
        debit: totalAmount.toFixed(2),
        credit: "0.00",
        particulars: `Sales Revenue Nullification on Voided Invoice ${invoice.invoice_no}`,
      });

      await tx
        .update(parties)
        .set({
          currentBalance: sql`current_balance - ${totalAmount.toFixed(2)}`,
        })
        .where(eq(parties.id, revenueAcc));

      // 5. Mark invoice as voided
      await tx
        .update(salesInvoices)
        .set({
          isVoided: true,
          voidedAt: new Date(),
          voidReason: reason || "Voided by operator",
        })
        .where(eq(salesInvoices.id, invoiceId));

      revalidatePath("/billing");
      revalidatePath("/ledgers");
      revalidatePath("/inventory");

      return {
        success: true,
        invoiceNo: invoice.invoice_no,
      };
    });
  } catch (err: any) {
    console.error("Failed to void invoice:", err);
    return {
      success: false,
      error: err.message || "Failed to void invoice.",
    };
  }
}

export async function getRecentInvoices() {
  try {
    const recent = await db
      .select({
        id: salesInvoices.id,
        invoiceNo: salesInvoices.invoiceNo,
        partyName: parties.name,
        totalAmount: salesInvoices.totalAmount,
        discountAmount: salesInvoices.discountAmount,
        netAmount: salesInvoices.netAmount,
        isPakkaBill: salesInvoices.isPakkaBill,
        isVoided: salesInvoices.isVoided,
        voidReason: salesInvoices.voidReason,
        createdAt: salesInvoices.createdAt,
      })
      .from(salesInvoices)
      .leftJoin(parties, eq(salesInvoices.partyId, parties.id))
      .orderBy(desc(salesInvoices.createdAt))
      .limit(15);

    return { success: true, invoices: recent };
  } catch (err: any) {
    console.error("Failed to fetch recent invoices:", err);
    return { success: false, invoices: [], error: err.message };
  }
}

