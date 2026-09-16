"use server";

import { db } from "@/db";
import {
  salesInvoices,
  salesItems,
  productBatches,
  products,
  parties,
  ledgerTransactions,
  bankAccounts,
  warehouses,
} from "@/db/schema";
import { eq, and, sql, desc, inArray, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

export interface InvoiceFilters {
  search?: string;
  partyId?: string;
  billType?: "ALL" | "PAKKA" | "ESTIMATE";
  paymentStatus?: "ALL" | "PAID" | "PARTIAL" | "UNPAID";
  startDate?: string;
  endDate?: string;
}

export async function getInvoicesList(filters: InvoiceFilters = {}) {
  try {
    const conditions: any[] = [];

    if (filters.partyId && filters.partyId !== "ALL") {
      conditions.push(eq(salesInvoices.partyId, filters.partyId));
    }

    if (filters.billType === "PAKKA") {
      conditions.push(eq(salesInvoices.isPakkaBill, true));
    } else if (filters.billType === "ESTIMATE") {
      conditions.push(eq(salesInvoices.isPakkaBill, false));
    }

    if (filters.startDate) {
      conditions.push(gte(salesInvoices.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(salesInvoices.createdAt, end));
    }

    const rows = await db
      .select({
        id: salesInvoices.id,
        invoiceNo: salesInvoices.invoiceNo,
        partyId: salesInvoices.partyId,
        partyName: parties.name,
        partyPhone: parties.phone,
        totalAmount: salesInvoices.totalAmount,
        discountAmount: salesInvoices.discountAmount,
        netAmount: salesInvoices.netAmount,
        paidAmount: salesInvoices.paidAmount,
        biltyNumber: salesInvoices.biltyNumber,
        transporterName: salesInvoices.transporterName,
        freightTerms: salesInvoices.freightTerms,
        isPakkaBill: salesInvoices.isPakkaBill,
        isVoided: salesInvoices.isVoided,
        voidReason: salesInvoices.voidReason,
        adminNotes: salesInvoices.adminNotes,
        createdAt: salesInvoices.createdAt,
      })
      .from(salesInvoices)
      .leftJoin(parties, eq(salesInvoices.partyId, parties.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(salesInvoices.createdAt))
      .limit(200);

    // Apply in-memory search if specified
    let filtered = rows;
    if (filters.search && filters.search.trim().length > 0) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.invoiceNo.toLowerCase().includes(q) ||
          (r.partyName && r.partyName.toLowerCase().includes(q)) ||
          (r.partyPhone && r.partyPhone.includes(q)) ||
          (r.biltyNumber && r.biltyNumber.toLowerCase().includes(q))
      );
    }

    // Apply paymentStatus filter
    if (filters.paymentStatus && filters.paymentStatus !== "ALL") {
      filtered = filtered.filter((r) => {
        const net = new Decimal(r.netAmount || 0);
        const paid = new Decimal(r.paidAmount || 0);
        if (filters.paymentStatus === "PAID") {
          return paid.greaterThanOrEqualTo(net);
        } else if (filters.paymentStatus === "PARTIAL") {
          return paid.greaterThan(0) && paid.lessThan(net);
        } else if (filters.paymentStatus === "UNPAID") {
          return paid.lessThanOrEqualTo(0);
        }
        return true;
      });
    }

    // Calculate metrics
    let totalInvoicedVal = new Decimal(0);
    let totalCollectedVal = new Decimal(0);
    let totalDueVal = new Decimal(0);

    for (const r of filtered) {
      if (!r.isVoided) {
        const net = new Decimal(r.netAmount || 0);
        const paid = new Decimal(r.paidAmount || 0);
        const due = Decimal.max(0, net.minus(paid));

        totalInvoicedVal = totalInvoicedVal.plus(net);
        totalCollectedVal = totalCollectedVal.plus(paid);
        totalDueVal = totalDueVal.plus(due);
      }
    }

    return {
      success: true,
      invoices: filtered.map((r) => {
        const net = new Decimal(r.netAmount || 0);
        const paid = new Decimal(r.paidAmount || 0);
        const balanceDue = Decimal.max(0, net.minus(paid)).toFixed(2);
        return {
          ...r,
          partyName: r.partyName || "Cash Customer (Walk-in)",
          balanceDue,
        };
      }),
      summary: {
        totalCount: filtered.length,
        totalInvoiced: totalInvoicedVal.toFixed(2),
        totalCollected: totalCollectedVal.toFixed(2),
        totalDue: totalDueVal.toFixed(2),
      },
    };
  } catch (error: any) {
    console.error("Failed to load invoices list:", error);
    return { success: false, error: error.message || "Failed to load invoices", invoices: [], summary: { totalCount: 0, totalInvoiced: "0.00", totalCollected: "0.00", totalDue: "0.00" } };
  }
}

export type InvoiceDetailsResult =
  | {
      success: true;
      invoice: any;
      items: any[];
      banks: any[];
      products: any[];
      warehouses: any[];
    }
  | {
      success: false;
      error: string;
      invoice?: never;
      items?: never;
      banks?: never;
      products?: never;
      warehouses?: never;
    };

export async function getInvoiceDetails(invoiceId: string): Promise<InvoiceDetailsResult> {
  try {
    const [invoice] = await db
      .select({
        id: salesInvoices.id,
        invoiceNo: salesInvoices.invoiceNo,
        partyId: salesInvoices.partyId,
        partyName: parties.name,
        partyPhone: parties.phone,
        partyAddress: parties.address,
        partyBalance: parties.currentBalance,
        totalAmount: salesInvoices.totalAmount,
        discountAmount: salesInvoices.discountAmount,
        netAmount: salesInvoices.netAmount,
        paidAmount: salesInvoices.paidAmount,
        biltyNumber: salesInvoices.biltyNumber,
        transporterName: salesInvoices.transporterName,
        freightTerms: salesInvoices.freightTerms,
        isPakkaBill: salesInvoices.isPakkaBill,
        isVoided: salesInvoices.isVoided,
        voidedAt: salesInvoices.voidedAt,
        voidReason: salesInvoices.voidReason,
        adminNotes: salesInvoices.adminNotes,
        createdAt: salesInvoices.createdAt,
      })
      .from(salesInvoices)
      .leftJoin(parties, eq(salesInvoices.partyId, parties.id))
      .where(eq(salesInvoices.id, invoiceId));

    if (!invoice) {
      return { success: false, error: "Invoice not found." };
    }

    const items = await db
      .select({
        id: salesItems.id,
        productId: salesItems.productId,
        productName: products.name,
        productSku: products.sku,
        parentUnit: products.parentUnit,
        childUnit: products.childUnit,
        conversionRate: products.conversionRate,
        batchId: salesItems.batchId,
        batchLandedCost: productBatches.landedCost,
        batchRemainingQty: productBatches.remainingQty,
        qtyConsumed: salesItems.qtyConsumed, // in child units
        unitTypeSold: salesItems.unitTypeSold,
        saleRate: salesItems.saleRate,
        costSnapshot: salesItems.costSnapshot,
        createdAt: salesItems.createdAt,
      })
      .from(salesItems)
      .innerJoin(products, eq(salesItems.productId, products.id))
      .innerJoin(productBatches, eq(salesItems.batchId, productBatches.id))
      .where(eq(salesItems.invoiceId, invoiceId));

    // Also fetch associated bank accounts for settlement dropdown
    const banks = await db.select().from(bankAccounts);
    // Also fetch products and warehouses for barter adjustment
    const allProducts = await db.select().from(products);
    const allWarehouses = await db.select().from(warehouses);

    const net = new Decimal(invoice.netAmount || 0);
    const paid = new Decimal(invoice.paidAmount || 0);
    const balanceDue = Decimal.max(0, net.minus(paid)).toFixed(2);

    return {
      success: true,
      invoice: {
        ...invoice,
        partyName: invoice.partyName || "Cash Customer (Walk-in)",
        balanceDue,
      },
      items,
      banks,
      products: allProducts,
      warehouses: allWarehouses,
    };
  } catch (error: any) {
    console.error("Failed to load invoice details:", error);
    return { success: false, error: error.message || "Failed to load invoice details" };
  }
}

export async function updateInvoiceAdminNotes(invoiceId: string, newNote: string) {
  if (!newNote || newNote.trim().length === 0) {
    return { success: false, error: "Note cannot be empty." };
  }

  try {
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const formattedEntry = `[${timestamp}]: ${newNote.trim()}`;

    const [current] = await db
      .select({ adminNotes: salesInvoices.adminNotes })
      .from(salesInvoices)
      .where(eq(salesInvoices.id, invoiceId));

    const updatedNotes = current?.adminNotes
      ? `${current.adminNotes}\n${formattedEntry}`
      : formattedEntry;

    await db
      .update(salesInvoices)
      .set({ adminNotes: updatedNotes })
      .where(eq(salesInvoices.id, invoiceId));

    revalidatePath("/invoices");
    revalidatePath("/billing");

    return { success: true, adminNotes: updatedNotes };
  } catch (error: any) {
    console.error("Failed to append admin note:", error);
    return { success: false, error: error.message || "Failed to append admin note." };
  }
}

export type SettlePaymentResult =
  | { success: true; message: string; newPaidAmount: string; balanceDue: string }
  | { success: false; error: string };

export async function settleInvoicePayment(params: {
  invoiceId: string;
  amount: string;
  paymentMethod: "CASH" | "BANK";
  bankAccountId?: string;
  referenceNo?: string;
  notes?: string;
}): Promise<SettlePaymentResult> {
  const { invoiceId, amount, paymentMethod, bankAccountId, referenceNo, notes } = params;

  const payAmt = new Decimal(amount || 0);
  if (payAmt.lessThanOrEqualTo(0)) {
    return { success: false, error: "Payment amount must be greater than zero." };
  }

  if (paymentMethod === "BANK" && !bankAccountId) {
    return { success: false, error: "Please select a destination bank account." };
  }

  try {
    return await db.transaction(async (tx) => {
      // Row lock on invoice
      const [invoice] = await tx
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, invoiceId))
        .for("update");

      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.isVoided) throw new Error("Cannot accept payment on a voided invoice.");

      const net = new Decimal(invoice.netAmount);
      const curPaid = new Decimal(invoice.paidAmount);
      const remainingDue = net.minus(curPaid);

      if (remainingDue.lessThanOrEqualTo(0)) {
        throw new Error("This invoice is already fully paid.");
      }

      if (payAmt.greaterThan(remainingDue)) {
        throw new Error(
          `Payment amount (Rs. ${payAmt.toFixed(2)}) exceeds remaining balance due of Rs. ${remainingDue.toFixed(2)}.`
        );
      }

      const newPaid = curPaid.plus(payAmt).toFixed(2);
      const payAmtStr = payAmt.toFixed(2);

      // Settle double-entry if this belongs to a registered party
      if (invoice.partyId) {
        const sysAccs = await tx.execute(sql`
          SELECT id, system_role FROM ${parties} 
          WHERE system_role = 'SYSTEM_CASH'
        `);
        const cashAcc = (sysAccs.rows as any[])[0]?.id;

        let depositAccId: string;
        if (paymentMethod === "BANK") {
          const bank = await tx.query.bankAccounts.findFirst({
            where: eq(bankAccounts.id, bankAccountId!),
          });
          if (!bank || !bank.systemPartyId) {
            throw new Error("Selected bank account has no linked system ledger account.");
          }
          depositAccId = bank.systemPartyId;

          // Increment bank balance
          await tx
            .update(bankAccounts)
            .set({ currentBalance: sql`current_balance + ${payAmtStr}` })
            .where(eq(bankAccounts.id, bankAccountId!));
        } else {
          if (!cashAcc) throw new Error("System Cash Account not seeded.");
          depositAccId = cashAcc;
        }

        const memo = `Receipt for Invoice ${invoice.invoiceNo}${referenceNo ? ` [Ref: ${referenceNo}]` : ""}${notes ? ` - ${notes}` : ""}`;

        // Entry 1: Debit Cash/Bank
        await tx.insert(ledgerTransactions).values({
          partyId: depositAccId,
          type: "RECEIPT",
          referenceId: invoice.id,
          debit: payAmtStr,
          credit: "0.00",
          particulars: memo,
        });

        // Entry 2: Credit Party (Decreases Party Receivable)
        await tx.insert(ledgerTransactions).values({
          partyId: invoice.partyId,
          type: "RECEIPT",
          referenceId: invoice.id,
          debit: "0.00",
          credit: payAmtStr,
          particulars: memo,
        });

        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance - ${payAmtStr}` })
          .where(eq(parties.id, invoice.partyId));
      }

      const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const paymentLog = `[Payment ${paymentMethod} on ${timestamp}]: Collected Rs. ${payAmtStr}${referenceNo ? ` (Ref: ${referenceNo})` : ""}.`;
      const updatedNotes = invoice.adminNotes
        ? `${invoice.adminNotes}\n${paymentLog}`
        : paymentLog;

      await tx
        .update(salesInvoices)
        .set({
          paidAmount: newPaid,
          adminNotes: updatedNotes,
        })
        .where(eq(salesInvoices.id, invoiceId));

      revalidatePath("/invoices");
      revalidatePath("/billing");
      revalidatePath("/ledgers");
      revalidatePath("/parties");

      return {
        success: true,
        message: `Payment of Rs. ${payAmtStr} recorded successfully.`,
        newPaidAmount: newPaid,
        balanceDue: net.minus(new Decimal(newPaid)).toFixed(2),
      };
    });
  } catch (error: any) {
    console.error("Failed to settle invoice payment:", error);
    return { success: false, error: error.message || "Failed to record payment." };
  }
}

export type SalesReturnResult =
  | { success: true; message: string; refundAmount: string; newNetAmount: string }
  | { success: false; error: string };

export async function processSalesReturn(params: {
  invoiceId: string;
  returnItems: {
    salesItemId: string;
    returnQtyChildUnits: number;
  }[];
  reason: string;
}): Promise<SalesReturnResult> {
  const { invoiceId, returnItems, reason } = params;

  if (!returnItems || returnItems.length === 0) {
    return { success: false, error: "No items selected for return." };
  }

  if (!reason || reason.trim().length === 0) {
    return { success: false, error: "A clear return reason is required for the audit trail." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock invoice
      const [invoice] = await tx
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, invoiceId))
        .for("update");

      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.isVoided) throw new Error("Cannot process return on a voided invoice.");

      let totalReturnValue = new Decimal(0);
      const lineSummaryLogs: string[] = [];

      // 2. Process each return item
      for (const ret of returnItems) {
        if (ret.returnQtyChildUnits <= 0) continue;

        const [item] = await tx
          .select({
            id: salesItems.id,
            productId: salesItems.productId,
            batchId: salesItems.batchId,
            qtyConsumed: salesItems.qtyConsumed,
            unitTypeSold: salesItems.unitTypeSold,
            saleRate: salesItems.saleRate,
            productName: products.name,
            conversionRate: products.conversionRate,
            childUnit: products.childUnit,
          })
          .from(salesItems)
          .innerJoin(products, eq(salesItems.productId, products.id))
          .where(eq(salesItems.id, ret.salesItemId));

        if (!item) throw new Error(`Sales item ${ret.salesItemId} not found.`);

        if (ret.returnQtyChildUnits > item.qtyConsumed) {
          throw new Error(
            `Return qty (${ret.returnQtyChildUnits} ${item.childUnit}s) exceeds original billed quantity of ${item.qtyConsumed} units for '${item.productName}'.`
          );
        }

        // Lock & restore batch inventory
        const [batch] = await tx
          .select()
          .from(productBatches)
          .where(eq(productBatches.id, item.batchId))
          .for("update");

        if (!batch) throw new Error(`Originating batch for '${item.productName}' not found.`);

        await tx
          .update(productBatches)
          .set({
            remainingQty: sql`remaining_qty + ${ret.returnQtyChildUnits}`,
          })
          .where(eq(productBatches.id, item.batchId));

        // Calculate credit value per child unit
        const ratePerChild =
          item.unitTypeSold === "PARENT"
            ? new Decimal(item.saleRate).div(item.conversionRate)
            : new Decimal(item.saleRate);

        const lineReturnVal = ratePerChild.mul(ret.returnQtyChildUnits);
        totalReturnValue = totalReturnValue.plus(lineReturnVal);

        lineSummaryLogs.push(
          `${ret.returnQtyChildUnits} ${item.childUnit}s of '${item.productName}' @ Rs. ${ratePerChild.toFixed(2)}`
        );
      }

      if (totalReturnValue.lessThanOrEqualTo(0)) {
        throw new Error("Return value must be greater than zero.");
      }

      const returnAmtStr = totalReturnValue.toFixed(2);
      const voucherId = crypto.randomUUID();
      const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");

      // 3. Post double-entry adjustment
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties} 
        WHERE system_role IN ('SYSTEM_CASH', 'SALES_REVENUE')
      `);
      const sysMap = new Map((sysAccs.rows as any[]).map((r) => [r.system_role, r.id]));
      const cashAcc = sysMap.get("SYSTEM_CASH");
      const revenueAcc = sysMap.get("SALES_REVENUE");

      if (!revenueAcc || !cashAcc) {
        throw new Error("System revenue/cash accounts unseeded.");
      }

      const effectivePartyId = invoice.partyId || cashAcc;
      const memo = `Sales Return Voucher against ${invoice.invoiceNo}: ${reason.trim()} (${lineSummaryLogs.join(", ")})`;

      // Debit Sales Revenue (reduces recorded revenue)
      await tx.insert(ledgerTransactions).values({
        partyId: revenueAcc,
        type: "CREDIT_NOTE",
        referenceId: voucherId,
        debit: returnAmtStr,
        credit: "0.00",
        particulars: `Reversal of Sales Revenue: ${memo}`,
      });

      // Credit Customer (reduces customer receivable) OR Credit Cash (refund from drawer)
      await tx.insert(ledgerTransactions).values({
        partyId: effectivePartyId,
        type: "CREDIT_NOTE",
        referenceId: voucherId,
        debit: "0.00",
        credit: returnAmtStr,
        particulars: memo,
      });

      // If registered customer, decrease running balance
      if (invoice.partyId) {
        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance - ${returnAmtStr}` })
          .where(eq(parties.id, invoice.partyId));
      }

      // Update invoice netAmount and admin notes
      const newNet = Decimal.max(0, new Decimal(invoice.netAmount).minus(totalReturnValue)).toFixed(2);
      const returnNote = `[Sales Return on ${timestamp}]: Returned goods worth Rs. ${returnAmtStr}. Reason: ${reason.trim()}.\n  Items: ${lineSummaryLogs.join("; ")}`;
      const updatedNotes = invoice.adminNotes
        ? `${invoice.adminNotes}\n${returnNote}`
        : returnNote;

      await tx
        .update(salesInvoices)
        .set({
          netAmount: newNet,
          adminNotes: updatedNotes,
        })
        .where(eq(salesInvoices.id, invoiceId));

      revalidatePath("/invoices");
      revalidatePath("/billing");
      revalidatePath("/inventory");
      revalidatePath("/ledgers");
      revalidatePath("/parties");

      return {
        success: true,
        message: `Sales return of Rs. ${returnAmtStr} processed successfully. Stock returned to batch.`,
        refundAmount: returnAmtStr,
        newNetAmount: newNet,
      };
    });
  } catch (error: any) {
    console.error("Failed to process sales return:", error);
    return { success: false, error: error.message || "Failed to process sales return." };
  }
}

export type BarterAdjustmentResult =
  | { success: true; message: string; newNetAmount: string }
  | { success: false; error: string };

export async function addInInvoiceBarterAdjustment(params: {
  invoiceId: string;
  productId: string;
  warehouseId: string;
  unitType: "PARENT" | "CHILD";
  qty: number;
  agreedValue: string;
  reason: string;
}): Promise<BarterAdjustmentResult> {
  const { invoiceId, productId, warehouseId, unitType, qty, agreedValue, reason } = params;

  const valDecimal = new Decimal(agreedValue || 0);
  if (valDecimal.lessThanOrEqualTo(0) || qty <= 0) {
    return { success: false, error: "Quantity and agreed exchange value must be greater than zero." };
  }

  try {
    return await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(salesInvoices)
        .where(eq(salesInvoices.id, invoiceId))
        .for("update");

      if (!invoice) throw new Error("Invoice not found.");
      if (invoice.isVoided) throw new Error("Cannot adjust a voided invoice.");

      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId));

      if (!product) throw new Error("Exchange product item not found.");

      const childUnits = unitType === "PARENT" ? qty * product.conversionRate : qty;
      const unitLandedCost = valDecimal.div(childUnits).toFixed(2);
      const valStr = valDecimal.toFixed(2);
      const batchNumber = `EXC-${Math.floor(100000 + Math.random() * 900000)}`;

      // System account for inventory supplier (use customer if exists or system)
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties} 
        WHERE system_role = 'SYSTEM_CASH'
      `);
      const sysCash = (sysAccs.rows as any[])[0]?.id;
      const supplierPartyId = invoice.partyId || sysCash;

      // 1. Create inward stock lot in product_batches
      await tx.insert(productBatches).values({
        productId,
        supplierId: supplierPartyId,
        warehouseId,
        originalQty: childUnits,
        remainingQty: childUnits,
        landedCost: unitLandedCost,
        receivedDate: new Date(),
      });

      // 2. Record contra credit on customer khata (or cash offset)
      if (invoice.partyId) {
        const memo = `In-Invoice Barter Contra: Received ${qty} ${unitType === "PARENT" ? product.parentUnit : product.childUnit} of '${product.name}' against ${invoice.invoiceNo}: ${reason || "Exchange Goods Inward"}`;

        await tx.insert(ledgerTransactions).values({
          partyId: invoice.partyId,
          type: "CONTRA",
          referenceId: invoice.id,
          debit: "0.00",
          credit: valStr,
          particulars: memo,
        });

        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance - ${valStr}` })
          .where(eq(parties.id, invoice.partyId));
      }

      // 3. Offset invoice net amount
      const newNet = Decimal.max(0, new Decimal(invoice.netAmount).minus(valDecimal)).toFixed(2);
      const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const barterLog = `[Barter / Goods Inward on ${timestamp}]: Accepted ${qty} ${unitType === "PARENT" ? product.parentUnit : product.childUnit} of '${product.name}' valued at Rs. ${valStr}. Lot #${batchNumber}.`;
      const updatedNotes = invoice.adminNotes
        ? `${invoice.adminNotes}\n${barterLog}`
        : barterLog;

      await tx
        .update(salesInvoices)
        .set({
          netAmount: newNet,
          adminNotes: updatedNotes,
        })
        .where(eq(salesInvoices.id, invoiceId));

      revalidatePath("/invoices");
      revalidatePath("/inventory");
      revalidatePath("/billing");
      revalidatePath("/ledgers");
      revalidatePath("/parties");

      return {
        success: true,
        message: `Inward lot #${batchNumber} created (${childUnits} units). Invoice adjusted by Rs. ${valStr}.`,
        newNetAmount: newNet,
      };
    });
  } catch (error: any) {
    console.error("Failed to add in-invoice barter adjustment:", error);
    return { success: false, error: error.message || "Failed to process exchange adjustment." };
  }
}
