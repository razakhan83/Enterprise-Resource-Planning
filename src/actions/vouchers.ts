"use server";

import { db } from "@/db";
import {
  parties,
  ledgerTransactions,
  bankAccounts,
  cheques,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Decimal from "decimal.js";

export type PaymentReceiptVoucherParams = {
  voucherType: "RECEIPT" | "PAYMENT";
  partyId: string;
  amount: string;
  paymentMethod: "CASH" | "BANK";
  bankAccountId?: string;
  referenceNo?: string; // Raast ID, IBFT ref, Cheque no
  particulars: string;
};

export type ContraSettlementParams = {
  partyId: string; // Dual Party
  nettedAmount: string; // Amount being netted off against each other
  cashDifference: string; // Residual difference
  differenceAction: "RECEIVE_CASH" | "PAY_CASH" | "NONE";
  particulars: string;
};

export type VoucherResult = {
  success: boolean;
  voucherId?: string;
  amount?: string;
  error?: string;
};

export type ContraResult = {
  success: boolean;
  contraId?: string;
  error?: string;
};

export async function getVouchersInitialData() {
  try {
    const allParties = await db.select().from(parties);
    const banks = await db.select().from(bankAccounts);
    return {
      parties: allParties,
      banks,
    };
  } catch (error: any) {
    console.error("Error fetching voucher data:", error);
    return { parties: [], banks: [], error: error.message };
  }
}

/**
 * Post atomic payment or receipt voucher (Recovery / Dues Settlement)
 */
export async function postPaymentReceiptVoucher(
  params: PaymentReceiptVoucherParams
): Promise<VoucherResult> {
  const {
    voucherType,
    partyId,
    amount,
    paymentMethod,
    bankAccountId,
    referenceNo,
    particulars,
  } = params;

  const amtDecimal = new Decimal(amount || 0);
  if (amtDecimal.lessThanOrEqualTo(0)) {
    return { success: false, error: "Amount must be greater than zero." };
  }

  try {
    return await db.transaction(async (tx) => {
      const voucherId = crypto.randomUUID();

      // Determine the settlement account (Cash Drawer vs Bank Account)
      let settlementPartyId: string;

      if (paymentMethod === "BANK" && bankAccountId) {
        const bank = await tx.query.bankAccounts.findFirst({
          where: eq(bankAccounts.id, bankAccountId),
        });
        if (!bank || !bank.systemPartyId) {
          throw new Error("Selected bank account is missing a system ledger mapping.");
        }
        settlementPartyId = bank.systemPartyId;
      } else {
        const cashAcc = await tx.execute(sql`
          SELECT id FROM ${parties} WHERE system_role = 'SYSTEM_CASH' LIMIT 1
        `);
        if (cashAcc.rows.length === 0) throw new Error("SYSTEM_CASH account missing.");
        settlementPartyId = cashAcc.rows[0].id as string;
      }

      const memo = referenceNo
        ? `${particulars} [Ref: ${referenceNo}]`
        : particulars;

      if (voucherType === "RECEIPT") {
        // Customer Recovery: Cash/Bank comes IN (Debit), Party Receivable goes DOWN (Credit)
        // 1. Debit Cash / Bank Account
        await tx.insert(ledgerTransactions).values({
          partyId: settlementPartyId,
          type: "RECEIPT",
          referenceId: voucherId,
          debit: amtDecimal.toFixed(2),
          credit: "0.00",
          particulars: `Recovery Received from Party: ${memo}`,
        });
        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance + ${amtDecimal.toFixed(2)}` })
          .where(eq(parties.id, settlementPartyId));

        // 2. Credit Customer Party Ledger
        await tx.insert(ledgerTransactions).values({
          partyId,
          type: "RECEIPT",
          referenceId: voucherId,
          debit: "0.00",
          credit: amtDecimal.toFixed(2),
          particulars: `Payment Received: ${memo}`,
        });
        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance - ${amtDecimal.toFixed(2)}` })
          .where(eq(parties.id, partyId));
      } else {
        // Supplier Dues Payment: Party Payable goes DOWN (Debit), Cash/Bank goes OUT (Credit)
        // 1. Debit Supplier Party Ledger
        await tx.insert(ledgerTransactions).values({
          partyId,
          type: "PAYMENT",
          referenceId: voucherId,
          debit: amtDecimal.toFixed(2),
          credit: "0.00",
          particulars: `Payment Issued to Vendor: ${memo}`,
        });
        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance + ${amtDecimal.toFixed(2)}` })
          .where(eq(parties.id, partyId));

        // 2. Credit Cash / Bank Account
        await tx.insert(ledgerTransactions).values({
          partyId: settlementPartyId,
          type: "PAYMENT",
          referenceId: voucherId,
          debit: "0.00",
          credit: amtDecimal.toFixed(2),
          particulars: `Disbursement Outflow: ${memo}`,
        });
        await tx
          .update(parties)
          .set({ currentBalance: sql`current_balance - ${amtDecimal.toFixed(2)}` })
          .where(eq(parties.id, settlementPartyId));
      }

      return { success: true, voucherId, amount: amtDecimal.toFixed(2) };
    });
  } catch (err: any) {
    console.error("Voucher posting failed:", err);
    return { success: false, error: err.message || "Failed to post voucher." };
  }
}

/**
 * Contra / Barter Settlement: Netting off purchases and deliveries for a dual-purpose party
 */
export async function settleContraBarterVoucher(
  params: ContraSettlementParams
): Promise<ContraResult> {
  const {
    partyId,
    nettedAmount,
    cashDifference = "0.00",
    differenceAction,
    particulars,
  } = params;

  const netDecimal = new Decimal(nettedAmount || 0);
  const diffDecimal = new Decimal(cashDifference || 0);

  if (netDecimal.lessThanOrEqualTo(0)) {
    return { success: false, error: "Netted contra amount must be greater than zero." };
  }

  try {
    return await db.transaction(async (tx) => {
      const contraId = crypto.randomUUID();

      // Balanced journal contra entry
      await tx.insert(ledgerTransactions).values({
        partyId,
        type: "CONTRA",
        referenceId: contraId,
        debit: netDecimal.toFixed(2),
        credit: netDecimal.toFixed(2),
        particulars: `Contra Barter Settlement: Netting purchase against deliveries (${particulars})`,
      });

      // If there is residual cash exchanged to clear remainder
      if (diffDecimal.greaterThan(0) && differenceAction !== "NONE") {
        const cashAcc = await tx.execute(sql`
          SELECT id FROM ${parties} WHERE system_role = 'SYSTEM_CASH' LIMIT 1
        `);
        const cashId = cashAcc.rows[0].id as string;

        if (differenceAction === "RECEIVE_CASH") {
          // Receive cash from party for difference
          await tx.insert(ledgerTransactions).values({
            partyId: cashId,
            type: "RECEIPT",
            referenceId: contraId,
            debit: diffDecimal.toFixed(2),
            credit: "0.00",
            particulars: `Contra Cash Differential Received: ${particulars}`,
          });
          await tx
            .update(parties)
            .set({ currentBalance: sql`current_balance + ${diffDecimal.toFixed(2)}` })
            .where(eq(parties.id, cashId));

          await tx.insert(ledgerTransactions).values({
            partyId,
            type: "RECEIPT",
            referenceId: contraId,
            debit: "0.00",
            credit: diffDecimal.toFixed(2),
            particulars: `Contra Balance Adjustment: ${particulars}`,
          });
          await tx
            .update(parties)
            .set({ currentBalance: sql`current_balance - ${diffDecimal.toFixed(2)}` })
            .where(eq(parties.id, partyId));
        } else if (differenceAction === "PAY_CASH") {
          // Pay cash to party for difference
          await tx.insert(ledgerTransactions).values({
            partyId,
            type: "PAYMENT",
            referenceId: contraId,
            debit: diffDecimal.toFixed(2),
            credit: "0.00",
            particulars: `Contra Cash Differential Paid: ${particulars}`,
          });
          await tx
            .update(parties)
            .set({ currentBalance: sql`current_balance + ${diffDecimal.toFixed(2)}` })
            .where(eq(parties.id, partyId));

          await tx.insert(ledgerTransactions).values({
            partyId: cashId,
            type: "PAYMENT",
            referenceId: contraId,
            debit: "0.00",
            credit: diffDecimal.toFixed(2),
            particulars: `Contra Balance Adjustment: ${particulars}`,
          });
          await tx
            .update(parties)
            .set({ currentBalance: sql`current_balance - ${diffDecimal.toFixed(2)}` })
            .where(eq(parties.id, cashId));
        }
      }

      return { success: true, contraId };
    });
  } catch (err: any) {
    console.error("Contra settlement failed:", err);
    return { success: false, error: err.message || "Failed to post contra settlement." };
  }
}
