"use server";

import { db } from "@/db";
import {
  salesItems,
  productBatches,
  parties,
  operatingExpenses,
  ledgerTransactions,
} from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import Decimal from "decimal.js";

export async function getReportsData() {
  try {
    // 1. Supplier Margin Matrix
    // Join sales_items -> product_batches -> parties (supplier)
    const marginRows = await db
      .select({
        supplierId: parties.id,
        supplierName: parties.name,
        qtySold: salesItems.qtyConsumed,
        saleRate: salesItems.saleRate,
        costSnapshot: salesItems.costSnapshot,
      })
      .from(salesItems)
      .innerJoin(productBatches, eq(salesItems.batchId, productBatches.id))
      .innerJoin(parties, eq(productBatches.supplierId, parties.id));

    const supplierMap = new Map<
      string,
      {
        name: string;
        unitsSold: number;
        revenue: Decimal;
        cogs: Decimal;
      }
    >();

    let totalRevenue = new Decimal(0);
    let totalCogs = new Decimal(0);

    for (const r of marginRows) {
      const lineRev = new Decimal(r.saleRate).mul(r.qtySold);
      const lineCost = new Decimal(r.costSnapshot).mul(r.qtySold);

      totalRevenue = totalRevenue.plus(lineRev);
      totalCogs = totalCogs.plus(lineCost);

      const existing = supplierMap.get(r.supplierId) || {
        name: r.supplierName,
        unitsSold: 0,
        revenue: new Decimal(0),
        cogs: new Decimal(0),
      };

      existing.unitsSold += Number(r.qtySold);
      existing.revenue = existing.revenue.plus(lineRev);
      existing.cogs = existing.cogs.plus(lineCost);

      supplierMap.set(r.supplierId, existing);
    }

    const supplierMatrix = Array.from(supplierMap.entries()).map(([id, data]) => {
      const marginRs = data.revenue.minus(data.cogs);
      const marginPct = data.revenue.isZero()
        ? 0
        : marginRs.div(data.revenue).mul(100).toNumber();

      return {
        supplierId: id,
        supplierName: data.name,
        unitsSold: data.unitsSold,
        revenue: data.revenue.toFixed(2),
        cogs: data.cogs.toFixed(2),
        grossMarginRs: marginRs.toFixed(2),
        marginPercent: marginPct.toFixed(1),
        isLossMaking: marginRs.isNegative(),
      };
    });

    // 2. Operating Expenses
    const expenses = await db.select().from(operatingExpenses);
    const totalExpenses = expenses.reduce(
      (acc, exp) => acc.plus(new Decimal(exp.amount)),
      new Decimal(0)
    );

    const grossProfit = totalRevenue.minus(totalCogs);
    const netProfit = grossProfit.minus(totalExpenses);

    // 3. Customer Debt Aging Buckets
    const customers = await db
      .select({
        id: parties.id,
        name: parties.name,
        phone: parties.phone,
        currentBalance: parties.currentBalance,
        createdAt: parties.createdAt,
      })
      .from(parties)
      .where(sql`${parties.type} IN ('CUSTOMER', 'DUAL') AND ${parties.currentBalance} > 0`);

    const now = new Date().getTime();
    const agingList = customers.map((c) => {
      const partyAgeDays = Math.floor(
        (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      let bucket: "0_30" | "31_60" | "61_PLUS" = "0_30";
      if (partyAgeDays > 60) {
        bucket = "61_PLUS";
      } else if (partyAgeDays > 30) {
        bucket = "31_60";
      }

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: c.currentBalance,
        ageDays: partyAgeDays,
        bucket,
      };
    });

    return {
      supplierMatrix,
      financialStatement: {
        totalRevenue: totalRevenue.toFixed(2),
        totalCogs: totalCogs.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netProfit: netProfit.toFixed(2),
        expensesBreakdown: expenses.map((e) => ({
          category: e.category,
          amount: e.amount,
          notes: e.notes,
        })),
      },
      agingList,
    };
  } catch (error: any) {
    console.error("Error fetching reports data:", error);
    return {
      supplierMatrix: [],
      financialStatement: {
        totalRevenue: "0.00",
        totalCogs: "0.00",
        grossProfit: "0.00",
        totalExpenses: "0.00",
        netProfit: "0.00",
        expensesBreakdown: [],
      },
      agingList: [],
      error: error.message,
    };
  }
}
