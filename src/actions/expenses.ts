"use server";

import { db } from "@/db";
import {
  expenses,
  bankAccounts,
  parties,
  ledgerTransactions,
} from "@/db/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

export type ExpenseCategory =
  | "RENT"
  | "ELECTRICITY"
  | "SALARIES"
  | "MEALS_TEA"
  | "TRANSPORT_FREIGHT"
  | "MAINTENANCE"
  | "OTHER";

export interface ExpenseFilters {
  category?: string;
  paidFrom?: "ALL" | "CASH" | "BANK";
  startDate?: string;
  endDate?: string;
}

export interface CreateExpenseParams {
  category: ExpenseCategory;
  amount: string;
  paidFrom: "CASH" | "BANK";
  bankAccountId?: string;
  description: string;
  expenseDate?: string;
}

export async function getExpensesInitialData() {
  try {
    const banks = await db.select().from(bankAccounts);
    return {
      success: true,
      banks,
      categories: [
        { value: "RENT", label: "Shop / Godown Rent" },
        { value: "ELECTRICITY", label: "Electricity & Utilities" },
        { value: "SALARIES", label: "Staff Salaries & Daily Wages" },
        { value: "MEALS_TEA", label: "Meals, Tea & Hospitality" },
        { value: "TRANSPORT_FREIGHT", label: "Local Transport & Fuel" },
        { value: "MAINTENANCE", label: "Repairs & Maintenance" },
        { value: "OTHER", label: "Miscellaneous Overhead" },
      ],
    };
  } catch (error: any) {
    console.error("Failed to load expenses initial data:", error);
    return { success: false, banks: [], categories: [], error: error.message };
  }
}

export async function getExpensesList(filters: ExpenseFilters = {}) {
  try {
    const conditions: any[] = [];

    if (filters.category && filters.category !== "ALL") {
      conditions.push(eq(expenses.category, filters.category));
    }

    if (filters.paidFrom && filters.paidFrom !== "ALL") {
      conditions.push(eq(expenses.paidFrom, filters.paidFrom));
    }

    if (filters.startDate) {
      conditions.push(gte(expenses.expenseDate, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(expenses.expenseDate, end));
    }

    const rows = await db
      .select({
        id: expenses.id,
        category: expenses.category,
        amount: expenses.amount,
        paidFrom: expenses.paidFrom,
        bankAccountId: expenses.bankAccountId,
        bankName: bankAccounts.bankName,
        accountNumber: bankAccounts.accountNumber,
        description: expenses.description,
        expenseDate: expenses.expenseDate,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .leftJoin(bankAccounts, eq(expenses.bankAccountId, bankAccounts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expenses.expenseDate))
      .limit(300);

    // Summary calculations
    let totalExpenseVal = new Decimal(0);
    let cashExpenseVal = new Decimal(0);
    let bankExpenseVal = new Decimal(0);
    let todayExpenseVal = new Decimal(0);

    const todayStr = new Date().toISOString().slice(0, 10);

    for (const r of rows) {
      const amt = new Decimal(r.amount || 0);
      totalExpenseVal = totalExpenseVal.plus(amt);

      if (r.paidFrom === "CASH") {
        cashExpenseVal = cashExpenseVal.plus(amt);
      } else {
        bankExpenseVal = bankExpenseVal.plus(amt);
      }

      const expDateStr = new Date(r.expenseDate).toISOString().slice(0, 10);
      if (expDateStr === todayStr) {
        todayExpenseVal = todayExpenseVal.plus(amt);
      }
    }

    return {
      success: true,
      expenses: rows,
      summary: {
        totalExpense: totalExpenseVal.toFixed(2),
        cashExpense: cashExpenseVal.toFixed(2),
        bankExpense: bankExpenseVal.toFixed(2),
        todayExpense: todayExpenseVal.toFixed(2),
        count: rows.length,
      },
    };
  } catch (error: any) {
    console.error("Failed to load expenses list:", error);
    return {
      success: false,
      error: error.message || "Failed to load expenses",
      expenses: [],
      summary: {
        totalExpense: "0.00",
        cashExpense: "0.00",
        bankExpense: "0.00",
        todayExpense: "0.00",
        count: 0,
      },
    };
  }
}

export type CreateExpenseResult =
  | { success: true; message: string; expenseId: string }
  | { success: false; error: string };

export async function createExpense(
  params: CreateExpenseParams
): Promise<CreateExpenseResult> {
  const { category, amount, paidFrom, bankAccountId, description, expenseDate } = params;

  const amtDecimal = new Decimal(amount || 0);
  if (amtDecimal.lessThanOrEqualTo(0)) {
    return { success: false, error: "Expense amount must be greater than zero." };
  }

  if (!description || description.trim().length === 0) {
    return { success: false, error: "Expense description is required for audit." };
  }

  if (paidFrom === "BANK" && !bankAccountId) {
    return { success: false, error: "Please select the paying bank account." };
  }

  try {
    return await db.transaction(async (tx) => {
      const amtStr = amtDecimal.toFixed(2);
      const expenseId = crypto.randomUUID();
      const expDate = expenseDate ? new Date(expenseDate) : new Date();

      // 1. Insert expense record
      await tx.insert(expenses).values({
        id: expenseId,
        category,
        amount: amtStr,
        paidFrom,
        bankAccountId: paidFrom === "BANK" ? bankAccountId : null,
        description: description.trim(),
        expenseDate: expDate,
      });

      // 2. Resolve Double-Entry Accounts
      const sysAccs = await tx.execute(sql`
        SELECT id, system_role FROM ${parties} 
        WHERE system_role IN ('SYSTEM_CASH', 'OPERATING_EXPENSE')
      `);
      const sysMap = new Map((sysAccs.rows as any[]).map((r) => [r.system_role, r.id]));
      const cashAcc = sysMap.get("SYSTEM_CASH");
      const expenseAcc = sysMap.get("OPERATING_EXPENSE");

      if (!cashAcc) throw new Error("SYSTEM_CASH account unseeded.");

      // If OPERATING_EXPENSE party doesn't exist, create or fallback to cashAcc for balance
      let debitAccId = expenseAcc;
      if (!debitAccId) {
        // Find any expense account or create temporary system expense holder
        const [expParty] = await tx
          .select({ id: parties.id })
          .from(parties)
          .where(eq(parties.systemRole, "OPERATING_EXPENSE"));
        debitAccId = expParty?.id;
      }

      let creditAccId = cashAcc;
      if (paidFrom === "BANK") {
        const bank = await tx.query.bankAccounts.findFirst({
          where: eq(bankAccounts.id, bankAccountId!),
        });
        if (!bank || !bank.systemPartyId) {
          throw new Error("Selected bank account has no linked system ledger account.");
        }
        creditAccId = bank.systemPartyId;

        // Decrement bank balance
        await tx
          .update(bankAccounts)
          .set({ currentBalance: sql`current_balance - ${amtStr}` })
          .where(eq(bankAccounts.id, bankAccountId!));
      }

      // If we have an expense party account, post double entry
      if (debitAccId) {
        const memo = `Operating Expense [${category}]: ${description.trim()}`;

        // Debit Expense
        await tx.insert(ledgerTransactions).values({
          partyId: debitAccId,
          type: "PAYMENT",
          referenceId: expenseId,
          debit: amtStr,
          credit: "0.00",
          particulars: memo,
        });

        // Credit Cash or Bank Account
        await tx.insert(ledgerTransactions).values({
          partyId: creditAccId,
          type: "PAYMENT",
          referenceId: expenseId,
          debit: "0.00",
          credit: amtStr,
          particulars: memo,
        });
      }

      revalidatePath("/expenses");
      revalidatePath("/reports");
      revalidatePath("/ledgers");

      return {
        success: true,
        message: `Expense of Rs. ${amtStr} recorded under ${category}.`,
        expenseId,
      };
    });
  } catch (error: any) {
    console.error("Failed to create expense:", error);
    return { success: false, error: error.message || "Failed to record expense." };
  }
}
