"use server";

import { db } from "@/db";
import {
  productBatches,
  warehouseTransfers,
  warehouses,
  products,
  parties,
  ledgerTransactions,
  operatingExpenses,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Decimal from "decimal.js";

export async function getWarehouseTransferData() {
  try {
    const allWarehouses = await db.select().from(warehouses);
    const activeBatches = await db
      .select({
        id: productBatches.id,
        productId: productBatches.productId,
        productName: products.name,
        warehouseId: productBatches.warehouseId,
        supplierId: productBatches.supplierId,
        remainingQty: productBatches.remainingQty,
        landedCost: productBatches.landedCost,
        childUnit: products.childUnit,
      })
      .from(productBatches)
      .innerJoin(products, eq(productBatches.productId, products.id))
      .where(sql`${productBatches.remainingQty} > 0`);

    return {
      warehouses: allWarehouses,
      batches: activeBatches,
    };
  } catch (error: any) {
    console.error("Error fetching transfer data:", error);
    return { warehouses: [], batches: [], error: error.message };
  }
}

/**
 * Transfer stock between retail counter and central godowns
 */
export async function transferStockBetweenWarehouses(params: {
  fromWarehouseId: string;
  toWarehouseId: string;
  batchId: string;
  qtyMoved: number;
}) {
  const { fromWarehouseId, toWarehouseId, batchId, qtyMoved } = params;

  if (qtyMoved <= 0) {
    return { success: false, error: "Transfer quantity must be greater than zero." };
  }
  if (fromWarehouseId === toWarehouseId) {
    return { success: false, error: "Source and destination warehouses cannot be the same." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock source batch
      const sourceBatchRes = await tx.execute(sql`
        SELECT * FROM ${productBatches}
        WHERE id = ${batchId} AND remaining_qty >= ${qtyMoved}
        FOR UPDATE
      `);

      if (sourceBatchRes.rows.length === 0) {
        throw new Error("Insufficient stock in the selected batch for transfer.");
      }

      const source = sourceBatchRes.rows[0] as any;

      // Deduct from source batch
      await tx
        .update(productBatches)
        .set({ remainingQty: Number(source.remaining_qty) - qtyMoved })
        .where(eq(productBatches.id, batchId));

      // 2. Create destination batch preserving landed purchase cost
      const newBatchId = crypto.randomUUID();
      await tx.insert(productBatches).values({
        id: newBatchId,
        productId: source.product_id,
        supplierId: source.supplier_id,
        warehouseId: toWarehouseId,
        receivedDate: new Date(),
        originalQty: qtyMoved,
        remainingQty: qtyMoved,
        landedCost: source.landed_cost,
      });

      // 3. Generate Transfer Chalan Sequence
      const seqRes = await tx.execute(
        sql.raw("SELECT nextval('transfer_chalan_seq') AS next_val")
      );
      const chalanNum = (seqRes.rows[0] as any).next_val;
      const transferChalanNo = `TRN-${chalanNum.toString().padStart(5, "0")}`;

      // 4. Record transfer log
      await tx.insert(warehouseTransfers).values({
        fromWarehouseId,
        toWarehouseId,
        productId: source.product_id,
        batchId,
        qtyMoved,
        transferChalanNo,
      });

      return { success: true, transferChalanNo, qtyMoved };
    });
  } catch (err: any) {
    console.error("Warehouse transfer failed:", err);
    return { success: false, error: err.message || "Transfer failed." };
  }
}

/**
 * Stock Wastage / Damage Adjustment booked directly to operational loss
 */
export async function adjustStockWastage(params: {
  batchId: string;
  qtyDamaged: number;
  reason: string;
}) {
  const { batchId, qtyDamaged, reason } = params;

  if (qtyDamaged <= 0) {
    return { success: false, error: "Damaged quantity must be greater than zero." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock batch
      const batchRes = await tx.execute(sql`
        SELECT * FROM ${productBatches}
        WHERE id = ${batchId} AND remaining_qty >= ${qtyDamaged}
        FOR UPDATE
      `);

      if (batchRes.rows.length === 0) {
        throw new Error("Insufficient stock available in this batch.");
      }

      const batch = batchRes.rows[0] as any;
      const landedCost = new Decimal(batch.landed_cost);
      const totalLoss = landedCost.mul(qtyDamaged);

      // Deduct from batch
      await tx
        .update(productBatches)
        .set({ remainingQty: Number(batch.remaining_qty) - qtyDamaged })
        .where(eq(productBatches.id, batchId));

      // Fetch system accounts
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties}
        WHERE system_role IN ('STOCK_WASTAGE_LOSS', 'INVENTORY_ASSET')
      `);
      const sysMap = new Map((sysAccs.rows as any[]).map((r) => [r.system_role, r.id]));
      const lossAcc = sysMap.get("STOCK_WASTAGE_LOSS");
      const assetAcc = sysMap.get("INVENTORY_ASSET");

      if (!lossAcc || !assetAcc) {
        throw new Error("System accounts missing for wastage deduction.");
      }

      const refId = crypto.randomUUID();

      // ENTRY 1: Debit Stock Wastage Loss (Expense Increase)
      await tx.insert(ledgerTransactions).values({
        partyId: lossAcc,
        type: "JOURNAL",
        referenceId: refId,
        debit: totalLoss.toFixed(2),
        credit: "0.00",
        particulars: `Stock Wastage Write-off: ${qtyDamaged} units (${reason})`,
      });
      await tx
        .update(parties)
        .set({ currentBalance: sql`current_balance + ${totalLoss.toFixed(2)}` })
        .where(eq(parties.id, lossAcc));

      // ENTRY 2: Credit Inventory Asset (Asset Decrease)
      await tx.insert(ledgerTransactions).values({
        partyId: assetAcc,
        type: "JOURNAL",
        referenceId: refId,
        debit: "0.00",
        credit: totalLoss.toFixed(2),
        particulars: `Inventory Asset Reduction due to Spoilage / Damage (${reason})`,
      });
      await tx
        .update(parties)
        .set({ currentBalance: sql`current_balance - ${totalLoss.toFixed(2)}` })
        .where(eq(parties.id, assetAcc));

      // Record in operating expenses
      await tx.insert(operatingExpenses).values({
        category: "Stock Wastage & Damage",
        amount: totalLoss.toFixed(2),
        notes: `${qtyDamaged} units written off: ${reason}`,
        paymentMethod: "CASH",
      });

      return { success: true, lossValue: totalLoss.toFixed(2) };
    });
  } catch (err: any) {
    console.error("Stock wastage adjustment failed:", err);
    return { success: false, error: err.message || "Failed to adjust stock wastage." };
  }
}
