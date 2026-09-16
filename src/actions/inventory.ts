"use server";

import { db } from "@/db";
import { revalidatePath } from "next/cache";
import {
  productBatches,
  warehouseTransfers,
  warehouses,
  products,
  parties,
  ledgerTransactions,
  operatingExpenses,
  purchaseInvoices,
  purchaseItems,
  salesInvoices,
  salesItems,
} from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
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

export interface StockWastageResult {
  success: boolean;
  lossValue?: string;
  error?: string;
}

/**
 * Stock Wastage / Damage Adjustment booked directly to operational loss
 */
export async function adjustStockWastage(params: {
  batchId: string;
  qtyDamaged: number;
  reason: string;
}): Promise<StockWastageResult> {
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

export interface CreateProductParams {
  name: string;
  sku?: string;
  parentUnit: string;
  childUnit: string;
  conversionRate: number;
  defaultSaleRate: string;
  isConsignment?: boolean;
}

export interface CreateProductResult {
  success: boolean;
  product?: any;
  error?: string;
}

export async function createProduct(params: CreateProductParams): Promise<CreateProductResult> {
  const {
    name,
    sku,
    parentUnit,
    childUnit,
    conversionRate,
    defaultSaleRate,
    isConsignment = false,
  } = params;

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Product name is required." };
  }
  if (!parentUnit || !childUnit) {
    return { success: false, error: "Both Parent Unit and Child Unit are required." };
  }
  if (!conversionRate || conversionRate <= 0) {
    return { success: false, error: "Conversion rate must be at least 1." };
  }

  const rateDecimal = new Decimal(defaultSaleRate || 0);
  if (rateDecimal.lessThan(0)) {
    return { success: false, error: "Default selling rate cannot be negative." };
  }

  try {
    const [newProduct] = await db
      .insert(products)
      .values({
        name: name.trim(),
        sku: sku?.trim() || null,
        parentUnit: parentUnit.trim(),
        childUnit: childUnit.trim(),
        conversionRate,
        defaultSaleRate: rateDecimal.toFixed(2),
        isConsignment,
      })
      .returning();

    return { success: true, product: newProduct };
  } catch (err: any) {
    console.error("Failed to create product:", err);
    return { success: false, error: err.message || "Failed to create product" };
  }
}

export async function getInventoryMasterData() {
  try {
    const allProducts = await db.select().from(products).orderBy(products.name);
    const activeBatches = await db
      .select({
        id: productBatches.id,
        productId: productBatches.productId,
        productName: products.name,
        supplierName: parties.name,
        warehouseName: warehouses.name,
        receivedDate: productBatches.receivedDate,
        originalQty: productBatches.originalQty,
        remainingQty: productBatches.remainingQty,
        landedCost: productBatches.landedCost,
        childUnit: products.childUnit,
        inwardInvoiceNo: purchaseInvoices.invoiceNo,
        purchaseRate: purchaseItems.purchaseRate,
      })
      .from(productBatches)
      .innerJoin(products, eq(productBatches.productId, products.id))
      .innerJoin(parties, eq(productBatches.supplierId, parties.id))
      .leftJoin(warehouses, eq(productBatches.warehouseId, warehouses.id))
      .leftJoin(purchaseItems, eq(productBatches.id, purchaseItems.batchId))
      .leftJoin(purchaseInvoices, eq(purchaseItems.purchaseId, purchaseInvoices.id))
      .orderBy(sql`${productBatches.receivedDate} DESC`);

    // Aggregate stock by product & calculate total stock valuation
    const stockMap = new Map<string, number>();
    let totalStockVal = new Decimal(0);
    let activeLotsCount = 0;

    for (const b of activeBatches) {
      stockMap.set(b.productId, (stockMap.get(b.productId) || 0) + b.remainingQty);
      if (b.remainingQty > 0) {
        activeLotsCount++;
        const batchVal = new Decimal(b.landedCost || 0).mul(b.remainingQty);
        totalStockVal = totalStockVal.plus(batchVal);
      }
    }

    let lowStockCount = 0;
    const productsWithStock = allProducts.map((p) => {
      const childStock = stockMap.get(p.id) || 0;
      const parentStock = p.conversionRate > 0 ? Math.floor(childStock / p.conversionRate) : 0;
      const looseChild = p.conversionRate > 0 ? childStock % p.conversionRate : childStock;
      if (childStock <= 10) lowStockCount++;

      return {
        ...p,
        totalChildStock: childStock,
        totalParentStock: parentStock,
        looseChildStock: looseChild,
      };
    });

    return {
      success: true,
      products: productsWithStock,
      batches: activeBatches,
      summary: {
        totalProducts: allProducts.length,
        totalStockValue: totalStockVal.toFixed(2),
        activeLotsCount,
        lowStockCount,
      },
    };
  } catch (err: any) {
    console.error("Failed to get inventory master data:", err);
    return {
      success: false,
      products: [],
      batches: [],
      summary: { totalProducts: 0, totalStockValue: "0.00", activeLotsCount: 0, lowStockCount: 0 },
      error: err.message,
    };
  }
}

export async function getProductMovementHistory(productId: string) {
  try {
    // 1. Inward Lots
    const inwardLots = await db
      .select({
        batchId: productBatches.id,
        receivedDate: productBatches.receivedDate,
        originalQty: productBatches.originalQty,
        remainingQty: productBatches.remainingQty,
        landedCost: productBatches.landedCost,
        supplierName: parties.name,
        warehouseName: warehouses.name,
        inwardInvoiceNo: purchaseInvoices.invoiceNo,
        purchaseRate: purchaseItems.purchaseRate,
      })
      .from(productBatches)
      .innerJoin(parties, eq(productBatches.supplierId, parties.id))
      .leftJoin(warehouses, eq(productBatches.warehouseId, warehouses.id))
      .leftJoin(purchaseItems, eq(productBatches.id, purchaseItems.batchId))
      .leftJoin(purchaseInvoices, eq(purchaseItems.purchaseId, purchaseInvoices.id))
      .where(eq(productBatches.productId, productId))
      .orderBy(desc(productBatches.receivedDate));

    // 2. Outward Sales Trace (Lot-level piece consumption)
    const salesTrace = await db
      .select({
        itemId: salesItems.id,
        invoiceNo: salesInvoices.invoiceNo,
        soldDate: salesInvoices.createdAt,
        customerName: parties.name,
        batchId: salesItems.batchId,
        qtyConsumed: salesItems.qtyConsumed, // in child units
        unitTypeSold: salesItems.unitTypeSold,
        saleRate: salesItems.saleRate,
        costSnapshot: salesItems.costSnapshot,
      })
      .from(salesItems)
      .innerJoin(salesInvoices, eq(salesItems.invoiceId, salesInvoices.id))
      .leftJoin(parties, eq(salesInvoices.partyId, parties.id))
      .where(eq(salesItems.productId, productId))
      .orderBy(desc(salesInvoices.createdAt))
      .limit(100);

    // 3. Transfers Trace
    const transfersTrace = await db
      .select({
        id: warehouseTransfers.id,
        transferChalanNo: warehouseTransfers.transferChalanNo,
        qtyMoved: warehouseTransfers.qtyMoved,
        createdAt: warehouseTransfers.createdAt,
        fromWarehouseName: sql<string>`w1.name`,
        toWarehouseName: sql<string>`w2.name`,
      })
      .from(warehouseTransfers)
      .innerJoin(sql`warehouses w1`, sql`w1.id = ${warehouseTransfers.fromWarehouseId}`)
      .innerJoin(sql`warehouses w2`, sql`w2.id = ${warehouseTransfers.toWarehouseId}`)
      .where(eq(warehouseTransfers.productId, productId))
      .orderBy(desc(warehouseTransfers.createdAt));

    return {
      success: true,
      inwardLots,
      salesTrace: salesTrace.map((s) => {
        const cost = new Decimal(s.costSnapshot);
        const rate = new Decimal(s.saleRate);
        const marginRs = rate.minus(cost);
        return {
          ...s,
          customerName: s.customerName || "Cash Walk-in",
          marginRs: marginRs.toFixed(2),
          isLoss: marginRs.isNegative(),
        };
      }),
      transfersTrace,
    };
  } catch (err: any) {
    console.error("Failed to get product movement history:", err);
    return { success: false, inwardLots: [], salesTrace: [], transfersTrace: [], error: err.message };
  }
}

export interface UpdateProductParams {
  id: string;
  name?: string;
  sku?: string | null;
  parentUnit?: string;
  childUnit?: string;
  conversionRate?: number;
  defaultSaleRate?: string;
}

export async function updateProduct(params: UpdateProductParams) {
  const { id, name, sku, parentUnit, childUnit, conversionRate, defaultSaleRate } = params;

  if (!id) return { success: false, error: "Product ID is required." };

  try {
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sku !== undefined) updateData.sku = sku?.trim() || null;
    if (parentUnit !== undefined) updateData.parentUnit = parentUnit.trim();
    if (childUnit !== undefined) updateData.childUnit = childUnit.trim();
    if (conversionRate !== undefined) updateData.conversionRate = Number(conversionRate);
    if (defaultSaleRate !== undefined) {
      updateData.defaultSaleRate = new Decimal(defaultSaleRate || 0).toFixed(2);
    }

    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    revalidatePath("/inventory");
    revalidatePath("/billing");
    revalidatePath("/purchases");

    return { success: true, product: updated };
  } catch (err: any) {
    console.error("Failed to update product:", err);
    return { success: false, error: err.message || "Failed to update product" };
  }
}


