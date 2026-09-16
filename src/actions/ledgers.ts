"use server";

import { db } from "@/db";
import {
  ledgerTransactions,
  parties,
  storeSettings,
  salesInvoices,
  purchaseInvoices,
} from "@/db/schema";
import { eq, sql, and, gte, lte, lt } from "drizzle-orm";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

export interface LedgersQueryFilter {
  partyId?: string;
  dateRangePreset?: "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL" | "CUSTOM";
  startDate?: string;
  endDate?: string;
}

export async function getLedgersData(filter: LedgersQueryFilter = {}) {
  try {
    const { partyId, dateRangePreset = "ALL", startDate, endDate } = filter;

    // 1. Fetch all parties for the selector
    const partyList = await db
      .select({
        id: parties.id,
        name: parties.name,
        type: parties.type,
        currentBalance: parties.currentBalance,
        phone: parties.phone,
        address: parties.address,
      })
      .from(parties)
      .orderBy(parties.name);

    // 2. Fetch store settings for statement print headers
    const settings = await db.query.storeSettings.findFirst({
      where: eq(storeSettings.id, "default"),
    });

    // 3. Determine Date Boundary
    let startBoundary: Date | null = null;
    let endBoundary: Date | null = null;
    const now = new Date();

    if (dateRangePreset === "TODAY") {
      startBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (dateRangePreset === "YESTERDAY") {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startBoundary = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0);
      endBoundary = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
    } else if (dateRangePreset === "THIS_WEEK") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startBoundary = new Date(now.setDate(diff));
      startBoundary.setHours(0, 0, 0, 0);
      endBoundary = new Date();
      endBoundary.setHours(23, 59, 59, 999);
    } else if (dateRangePreset === "THIS_MONTH") {
      startBoundary = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endBoundary = new Date();
      endBoundary.setHours(23, 59, 59, 999);
    } else if (dateRangePreset === "CUSTOM") {
      if (startDate) startBoundary = new Date(`${startDate}T00:00:00`);
      if (endDate) endBoundary = new Date(`${endDate}T23:59:59.999`);
    }

    // 4. Calculate Opening Balance if a specific party is selected
    let openingBalance = new Decimal(0);
    if (partyId && partyId !== "ALL" && startBoundary) {
      const priorTxs = await db
        .select({
          debit: ledgerTransactions.debit,
          credit: ledgerTransactions.credit,
        })
        .from(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.partyId, partyId),
            lt(ledgerTransactions.createdAt, startBoundary)
          )
        );

      for (const tx of priorTxs) {
        openingBalance = openingBalance.plus(tx.debit).minus(tx.credit);
      }
    }

    // 5. Query matching transactions
    const conditions = [];
    if (partyId && partyId !== "ALL") {
      conditions.push(eq(ledgerTransactions.partyId, partyId));
    }
    if (startBoundary) {
      conditions.push(gte(ledgerTransactions.createdAt, startBoundary));
    }
    if (endBoundary) {
      conditions.push(lte(ledgerTransactions.createdAt, endBoundary));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rawTransactions = await db
      .select({
        id: ledgerTransactions.id,
        partyId: ledgerTransactions.partyId,
        partyName: parties.name,
        partyType: parties.type,
        systemRole: parties.systemRole,
        type: ledgerTransactions.type,
        referenceId: ledgerTransactions.referenceId,
        salesInvoiceNo: salesInvoices.invoiceNo,
        purchaseInvoiceNo: purchaseInvoices.invoiceNo,
        debit: ledgerTransactions.debit,
        credit: ledgerTransactions.credit,
        particulars: ledgerTransactions.particulars,
        createdAt: ledgerTransactions.createdAt,
      })
      .from(ledgerTransactions)
      .innerJoin(parties, eq(ledgerTransactions.partyId, parties.id))
      .leftJoin(salesInvoices, eq(ledgerTransactions.referenceId, salesInvoices.id))
      .leftJoin(purchaseInvoices, eq(ledgerTransactions.referenceId, purchaseInvoices.id))
      .where(whereClause)
      .orderBy(sql`${ledgerTransactions.createdAt} ASC`);

    // 6. Compute running balances and totals
    let currentRunning = new Decimal(openingBalance);
    let totalPeriodDebit = new Decimal(0);
    let totalPeriodCredit = new Decimal(0);
    let totalInvoiced = new Decimal(0);
    let totalRecovered = new Decimal(0);

    const transactionsWithBalance = rawTransactions.map((tx) => {
      const d = new Decimal(tx.debit || 0);
      const c = new Decimal(tx.credit || 0);
      totalPeriodDebit = totalPeriodDebit.plus(d);
      totalPeriodCredit = totalPeriodCredit.plus(c);
      currentRunning = currentRunning.plus(d).minus(c);

      if (tx.type === "SALE") {
        totalInvoiced = totalInvoiced.plus(d);
      }
      if (tx.type === "RECEIPT" || tx.type === "PAYMENT") {
        totalRecovered = totalRecovered.plus(c.greaterThan(0) ? c : d);
      }

      const voucherNo =
        tx.salesInvoiceNo ||
        tx.purchaseInvoiceNo ||
        (tx.referenceId ? tx.referenceId.slice(0, 8).toUpperCase() : "-");

      return {
        ...tx,
        voucherNo,
        runningBalance: currentRunning.toFixed(2),
      };
    });

    const closingBalance = currentRunning;

    return {
      success: true,
      parties: partyList,
      transactions: transactionsWithBalance,
      openingBalance: openingBalance.toFixed(2),
      totalDebit: totalPeriodDebit.toFixed(2),
      totalCredit: totalPeriodCredit.toFixed(2),
      totalInvoiced: totalInvoiced.toFixed(2),
      totalRecovered: totalRecovered.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
      settings,
    };
  } catch (error: any) {
    console.error("Failed to query ledgers:", error);
    return {
      success: false,
      parties: [],
      transactions: [],
      openingBalance: "0.00",
      totalDebit: "0.00",
      totalCredit: "0.00",
      totalInvoiced: "0.00",
      totalRecovered: "0.00",
      closingBalance: "0.00",
      settings: null,
      error: error.message,
    };
  }
}

export interface AdminAdjustmentParams {
  partyId: string;
  type: "DEBIT_NOTE" | "CREDIT_NOTE";
  amount: string;
  reason: string;
}

export type AdminAdjustmentResult =
  | { success: true; message: string; error?: never }
  | { success: false; error: string; message?: never };

export async function postAdminAdjustmentVoucher(
  params: AdminAdjustmentParams
): Promise<AdminAdjustmentResult> {
  const { partyId, type, amount, reason } = params;

  if (!partyId) return { success: false, error: "Party is required." };
  if (!reason || reason.trim().length === 0) {
    return { success: false, error: "Audit reason / remarks are required." };
  }

  const amtDecimal = new Decimal(amount || 0);
  if (amtDecimal.lessThanOrEqualTo(0)) {
    return { success: false, error: "Adjustment amount must be greater than zero." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Fetch party
      const party = await tx.query.parties.findFirst({
        where: eq(parties.id, partyId),
      });
      if (!party) throw new Error("Target party account not found.");

      const voucherId = crypto.randomUUID();
      const amtStr = amtDecimal.toFixed(2);

      // System balancing accounts
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties}
        WHERE system_role IN ('SALES_REVENUE', 'KASR_DISCOUNT_EXPENSE')
      `);
      const sysMap = new Map((sysAccs.rows as any[]).map((r) => [r.system_role, r.id]));
      const revenueAcc = sysMap.get("SALES_REVENUE");
      const kasrAcc = sysMap.get("KASR_DISCOUNT_EXPENSE");

      if (!revenueAcc || !kasrAcc) {
        throw new Error("System adjustment accounts unseeded.");
      }

      if (type === "DEBIT_NOTE") {
        // Increase party receivable:
        // Debit: Party (amtStr)
        // Credit: SALES_REVENUE (amtStr)
        await tx.insert(ledgerTransactions).values([
          {
            partyId,
            type: "DEBIT_NOTE",
            referenceId: voucherId,
            debit: amtStr,
            credit: "0.00",
            particulars: `Admin Debit Note Adjustment: ${reason.trim()}`,
          },
          {
            partyId: revenueAcc,
            type: "DEBIT_NOTE",
            referenceId: voucherId,
            debit: "0.00",
            credit: amtStr,
            particulars: `Balancing Entry for Debit Note (${party.name}): ${reason.trim()}`,
          },
        ]);

        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance + ${amtStr}` })
          .where(eq(parties.id, partyId));
      } else {
        // Decrease party receivable (credit note/rebate/discount):
        // Debit: KASR_DISCOUNT_EXPENSE (amtStr)
        // Credit: Party (amtStr)
        await tx.insert(ledgerTransactions).values([
          {
            partyId: kasrAcc,
            type: "CREDIT_NOTE",
            referenceId: voucherId,
            debit: amtStr,
            credit: "0.00",
            particulars: `Balancing Entry for Credit Note (${party.name}): ${reason.trim()}`,
          },
          {
            partyId,
            type: "CREDIT_NOTE",
            referenceId: voucherId,
            debit: "0.00",
            credit: amtStr,
            particulars: `Admin Credit Note Adjustment: ${reason.trim()}`,
          },
        ]);

        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance - ${amtStr}` })
          .where(eq(parties.id, partyId));
      }

      revalidatePath("/ledgers");
      revalidatePath("/parties");
      revalidatePath("/billing");

      return { success: true, message: `Admin ${type} adjustment of Rs. ${amtStr} posted.` };
    });
  } catch (error: any) {
    console.error("Failed to post admin adjustment voucher:", error);
    return { success: false, error: error.message || "Failed to post adjustment." };
  }
}
