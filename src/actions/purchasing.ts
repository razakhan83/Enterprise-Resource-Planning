"use server";

import { db } from "@/db";
import {
  purchaseInvoices,
  purchaseItems,
  productBatches,
  parties,
  ledgerTransactions,
  products,
  warehouses,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import Decimal from "decimal.js";

export type PurchaseItemInput = {
  productId: string;
  unitType: "PARENT" | "CHILD";
  qty: number;
  purchaseRate: string;
};

export type CreatePurchaseInvoiceParams = {
  supplierId: string;
  items: PurchaseItemInput[];
  freightAmount: string; // Freight & transport costs
  warehouseId?: string;
  biltyNumber?: string;
  transporterName?: string;
  isPaidImmediate?: boolean; // Cash settlement upon unloading
};

export async function getPurchaseInitialData() {
  try {
    const suppliers = await db
      .select()
      .from(parties)
      .where(sql`${parties.type} IN ('SUPPLIER', 'DUAL')`);

    const allProducts = await db.select().from(products);
    const allWarehouses = await db.select().from(warehouses);

    return {
      suppliers,
      products: allProducts,
      warehouses: allWarehouses,
    };
  } catch (error: any) {
    console.error("Error fetching purchase initial data:", error);
    return {
      suppliers: [],
      products: [],
      warehouses: [],
      error: error.message,
    };
  }
}

export type PurchaseResult = {
  success: boolean;
  purchaseId?: string;
  invoiceNo?: string;
  netAmount?: string;
  error?: string;
};

export async function createPurchaseInvoice(
  params: CreatePurchaseInvoiceParams
): Promise<PurchaseResult> {
  const {
    supplierId,
    items,
    freightAmount = "0.00",
    warehouseId,
    biltyNumber,
    transporterName,
    isPaidImmediate = false,
  } = params;

  if (!items || items.length === 0) {
    return { success: false, error: "Purchase invoice must have at least one item." };
  }

  try {
    return await db.transaction(async (tx) => {
      const freightDecimal = new Decimal(freightAmount || 0);
      const purchaseId = crypto.randomUUID();

      // 1. Generate Atomic Sequence PUR-xxxxx
      const seqRes = await tx.execute(
        sql.raw("SELECT nextval('purchase_invoice_seq') AS next_val")
      );
      const nextNum = (seqRes.rows[0] as any).next_val;
      const invoiceNo = `PUR-${nextNum.toString().padStart(5, "0")}`;

      // 2. Pre-fetch product conversion rates (N+1 query elimination)
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

      // 3. First pass: Compute raw subtotal
      let rawTotal = new Decimal(0);
      const itemTotals: Decimal[] = [];

      for (const item of items) {
        const lineVal = new Decimal(item.purchaseRate).mul(item.qty);
        itemTotals.push(lineVal);
        rawTotal = rawTotal.plus(lineVal);
      }

      const netAmount = rawTotal.plus(freightDecimal);

      // 4. Create Parent Purchase Invoice Record
      await tx.insert(purchaseInvoices).values({
        id: purchaseId,
        supplierId,
        invoiceNo,
        totalAmount: rawTotal.toFixed(2),
        freightAmount: freightDecimal.toFixed(2),
        netAmount: netAmount.toFixed(2),
        biltyNumber: biltyNumber || null,
        transporterName: transporterName || null,
        warehouseId: warehouseId || null,
        isPaidImmediate,
      });

      // 5. Create Batches & Purchase Items with Landed Freight Cost allocated
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const prod = productMap.get(item.productId);
        if (!prod) throw new Error(`Product ${item.productId} not found.`);

        const convRate = prod.conversionRate;
        const totalChildUnits =
          item.unitType === "PARENT" ? item.qty * convRate : item.qty;

        // Pro-rata freight allocation based on line value proportion
        let allocatedFreight = new Decimal(0);
        if (rawTotal.greaterThan(0) && freightDecimal.greaterThan(0)) {
          const ratio = itemTotals[i].div(rawTotal);
          allocatedFreight = freightDecimal.mul(ratio);
        }

        const totalLineCost = itemTotals[i].plus(allocatedFreight);
        const landedUnitCost = totalLineCost.div(totalChildUnits).toFixed(2);

        // Create new Inward Batch in product_batches
        const batchId = crypto.randomUUID();
        await tx.insert(productBatches).values({
          id: batchId,
          productId: item.productId,
          supplierId,
          warehouseId: warehouseId || null,
          receivedDate: new Date(),
          originalQty: totalChildUnits,
          remainingQty: totalChildUnits,
          landedCost: landedUnitCost,
        });

        // Create Purchase Item record
        await tx.insert(purchaseItems).values({
          purchaseId,
          productId: item.productId,
          batchId,
          qtyReceived: totalChildUnits,
          unitType: item.unitType,
          purchaseRate: item.purchaseRate,
          landedUnitCost,
        });
      }

      // 6. System Reserve Accounts & Immutable Double-Entry Postings
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties} 
        WHERE system_role IN ('INVENTORY_ASSET', 'SYSTEM_CASH')
      `);
      const sysMap = new Map((sysAccs.rows as any[]).map((r) => [r.system_role, r.id]));
      const inventoryAssetAcc = sysMap.get("INVENTORY_ASSET");
      const cashAcc = sysMap.get("SYSTEM_CASH");

      if (!inventoryAssetAcc || !cashAcc) {
        throw new Error("System accounts INVENTORY_ASSET or SYSTEM_CASH missing.");
      }

      // ENTRY 1: Debit Inventory Asset (Asset Increase)
      await tx.insert(ledgerTransactions).values({
        partyId: inventoryAssetAcc,
        type: "PURCHASE",
        referenceId: purchaseId,
        debit: netAmount.toFixed(2),
        credit: "0.00",
        particulars: `Inventory Received via ${invoiceNo}`,
      });
      await tx
        .update(parties)
        .set({ currentBalance: sql`current_balance + ${netAmount.toFixed(2)}` })
        .where(eq(parties.id, inventoryAssetAcc));

      // ENTRY 2: Credit Supplier (Accounts Payable Liability Increase)
      await tx.insert(ledgerTransactions).values({
        partyId: supplierId,
        type: "PURCHASE",
        referenceId: purchaseId,
        debit: "0.00",
        credit: netAmount.toFixed(2),
        particulars: `Purchase Inward Bill ${invoiceNo}`,
      });
      // In accounts payable, credit increases the vendor payable balance
      await tx
        .update(parties)
        .set({ currentBalance: sql`current_balance - ${netAmount.toFixed(2)}` })
        .where(eq(parties.id, supplierId));

      // ENTRY 3: If cash paid immediately at counter/unloading
      if (isPaidImmediate) {
        // Debit Supplier (Clear Payable)
        await tx.insert(ledgerTransactions).values({
          partyId: supplierId,
          type: "PAYMENT",
          referenceId: purchaseId,
          debit: netAmount.toFixed(2),
          credit: "0.00",
          particulars: `Cash Paid upon Delivery for ${invoiceNo}`,
        });
        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance + ${netAmount.toFixed(2)}` })
          .where(eq(parties.id, supplierId));

        // Credit Cash-in-Hand Drawer (Cash Outflow)
        await tx.insert(ledgerTransactions).values({
          partyId: cashAcc,
          type: "PAYMENT",
          referenceId: purchaseId,
          debit: "0.00",
          credit: netAmount.toFixed(2),
          particulars: `Cash Outflow for Purchase ${invoiceNo}`,
        });
        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance - ${netAmount.toFixed(2)}` })
          .where(eq(parties.id, cashAcc));
      }

      return {
        success: true,
        purchaseId,
        invoiceNo,
        netAmount: netAmount.toFixed(2),
      };
    });
  } catch (err: any) {
    console.error("Purchase creation failed:", err);
    return { success: false, error: err.message || "Failed to process purchase invoice." };
  }
}
