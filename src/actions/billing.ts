"use server";

import { db } from "@/db";
import {
  productBatches,
  salesInvoices,
  salesItems,
  parties,
  ledgerTransactions,
  products,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import Decimal from "decimal.js";

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

    return {
      products: productsWithStock,
      parties: partyList,
    };
  } catch (error: any) {
    console.error("Error fetching POS data:", error);
    return {
      products: [],
      parties: [],
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
