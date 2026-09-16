"use server";

import { db } from "@/db";
import { ledgerTransactions, parties, storeSettings } from "@/db/schema";
import { eq, sql, and, gte, lte, lt } from "drizzle-orm";
import Decimal from "decimal.js";

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
        debit: ledgerTransactions.debit,
        credit: ledgerTransactions.credit,
        particulars: ledgerTransactions.particulars,
        createdAt: ledgerTransactions.createdAt,
      })
      .from(ledgerTransactions)
      .innerJoin(parties, eq(ledgerTransactions.partyId, parties.id))
      .where(whereClause)
      .orderBy(sql`${ledgerTransactions.createdAt} ASC`);

    // 6. Compute running balances
    let currentRunning = new Decimal(openingBalance);
    let totalPeriodDebit = new Decimal(0);
    let totalPeriodCredit = new Decimal(0);

    const transactionsWithBalance = rawTransactions.map((tx) => {
      const d = new Decimal(tx.debit || 0);
      const c = new Decimal(tx.credit || 0);
      totalPeriodDebit = totalPeriodDebit.plus(d);
      totalPeriodCredit = totalPeriodCredit.plus(c);
      currentRunning = currentRunning.plus(d).minus(c);

      return {
        ...tx,
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
      closingBalance: "0.00",
      settings: null,
      error: error.message,
    };
  }
}
