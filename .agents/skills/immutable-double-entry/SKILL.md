---
name: immutable-double-entry
description: Enforce Debit == Credit and strictly prohibit DELETE/UPDATE on ledger records.
---

# Immutable Double-Entry Standard

## Objective
Preserve auditability and financial integrity by enforcing immutable double-entry accounting across all financial vouchers, invoices, payments, and adjustments.

## Mandatory Rules
1. **Zero UPDATE and Zero DELETE Policy**:
   - `UPDATE` and `DELETE` queries on `ledger_transactions` are strictly forbidden.
   - Once a transaction is posted, it is permanent.
   - Corrections, cancellations, or returns must be posted as offsetting Debit Notes, Credit Notes, or Reversal Journal Vouchers.

2. **Strict Double-Entry Balancing (`Debit == Credit`)**:
   - Every financial transaction must be completely balanced:
     `Sum(Debits) == Sum(Credits)`
   - Examples:
     - **Registered Party Sale**:
       - Debit: `Party Account` (Net Receivable)
       - Debit: `KASR_DISCOUNT_EXPENSE` (Discount/Kasr allowed)
       - Credit: `SALES_REVENUE` (Gross Invoice Amount)
     - **Walk-in Cash Sale**:
       - Debit: `SYSTEM_CASH` (Cash Received)
       - Debit: `KASR_DISCOUNT_EXPENSE` (Discount/Kasr allowed)
       - Credit: `SALES_REVENUE` (Gross Invoice Amount)
     - **Cash Receipt from Party**:
       - Debit: `SYSTEM_CASH`
       - Credit: `Party Account`

3. **Atomic Party Balance Updates**:
   - When a ledger transaction is created, the corresponding `parties.current_balance` must be updated atomically within the same database transaction.
