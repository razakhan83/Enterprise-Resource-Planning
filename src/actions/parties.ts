"use server";

import { db } from "@/db";
import { parties, ledgerTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";

export interface CreatePartyParams {
  name: string;
  type: "CUSTOMER" | "SUPPLIER" | "DUAL";
  phone?: string;
  address?: string;
  creditLimit?: string;
  openingBalance?: string;
  balanceType?: "DEBIT" | "CREDIT";
}

export async function getPartiesList() {
  try {
    const list = await db
      .select()
      .from(parties)
      .where(sql`${parties.type} != 'SYSTEM_ACCOUNT'`)
      .orderBy(parties.name);

    return { success: true, parties: list };
  } catch (error: any) {
    console.error("Failed to get parties list:", error);
    return { success: false, parties: [], error: error.message };
  }
}

export interface CreatePartyResult {
  success: boolean;
  party?: any;
  error?: string;
}

export async function createParty(params: CreatePartyParams): Promise<CreatePartyResult> {
  const {
    name,
    type,
    phone,
    address,
    creditLimit = "0.00",
    openingBalance = "0.00",
    balanceType = "DEBIT",
  } = params;

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Party name is required." };
  }

  const opBalDecimal = new Decimal(openingBalance || 0);
  const creditLimitDecimal = new Decimal(creditLimit || 0);

  let initialBalance = new Decimal(0);
  if (opBalDecimal.greaterThan(0)) {
    if (balanceType === "DEBIT") {
      initialBalance = opBalDecimal;
    } else {
      initialBalance = opBalDecimal.negated();
    }
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Ensure OPENING_BALANCE_EQUITY system account exists
      let equityAccount = await tx.query.parties.findFirst({
        where: eq(parties.systemRole, "OPENING_BALANCE_EQUITY"),
      });

      if (!equityAccount) {
        const [insertedEquity] = await tx
          .insert(parties)
          .values({
            name: "Opening Balance Equity",
            type: "SYSTEM_ACCOUNT",
            systemRole: "OPENING_BALANCE_EQUITY",
            currentBalance: "0.00",
            creditLimit: "0.00",
          })
          .onConflictDoNothing({ target: parties.systemRole })
          .returning();

        equityAccount =
          insertedEquity ||
          (await tx.query.parties.findFirst({
            where: eq(parties.systemRole, "OPENING_BALANCE_EQUITY"),
          }));
      }

      // 2. Insert new party
      const [newParty] = await tx
        .insert(parties)
        .values({
          name: name.trim(),
          type,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          creditLimit: creditLimitDecimal.toFixed(2),
          currentBalance: initialBalance.toFixed(2),
        })
        .returning();

      // 3. If opening balance > 0, atomically post double-entry transaction
      if (opBalDecimal.greaterThan(0) && equityAccount) {
        const opAmount = opBalDecimal.toFixed(2);
        const journalRef = crypto.randomUUID();

        if (balanceType === "DEBIT") {
          // Party Debit (Receivable) == Equity Credit
          await tx.insert(ledgerTransactions).values([
            {
              partyId: newParty.id,
              type: "JOURNAL",
              referenceId: journalRef,
              debit: opAmount,
              credit: "0.00",
              particulars: `Opening Balance Receivable`,
            },
            {
              partyId: equityAccount.id,
              type: "JOURNAL",
              referenceId: journalRef,
              debit: "0.00",
              credit: opAmount,
              particulars: `Opening Balance Equity Offset for ${newParty.name}`,
            },
          ]);

          // Update equity account balance
          await tx
            .update(parties)
            .set({ currentBalance: sql`current_balance - ${opAmount}` })
            .where(eq(parties.id, equityAccount.id));
        } else {
          // Equity Debit == Party Credit (Payable)
          await tx.insert(ledgerTransactions).values([
            {
              partyId: equityAccount.id,
              type: "JOURNAL",
              referenceId: journalRef,
              debit: opAmount,
              credit: "0.00",
              particulars: `Opening Balance Equity Offset for ${newParty.name}`,
            },
            {
              partyId: newParty.id,
              type: "JOURNAL",
              referenceId: journalRef,
              debit: "0.00",
              credit: opAmount,
              particulars: `Opening Balance Payable`,
            },
          ]);

          // Update equity account balance
          await tx
            .update(parties)
            .set({ currentBalance: sql`current_balance + ${opAmount}` })
            .where(eq(parties.id, equityAccount.id));
        }
      }

      revalidatePath("/parties");
      revalidatePath("/billing");
      revalidatePath("/ledgers");

      return {
        success: true,
        party: newParty,
      };
    });
  } catch (error: any) {
    console.error("Failed to create party:", error);
    return { success: false, error: error.message };
  }
}
