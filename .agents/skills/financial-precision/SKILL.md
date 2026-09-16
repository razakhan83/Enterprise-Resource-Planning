---
name: financial-precision
description: Enforce NUMERIC(14,2), decimal.js, and zero floating-point errors.
---

# Financial Precision Standard

## Objective
Enforce extreme arithmetic precision across all financial tables, server actions, calculations, and UI displays in the ERP system. Floating-point errors in currency or ledger balances will cause accounting mismatches and are strictly forbidden.

## Mandatory Rules
1. **Database Schema Enforcement**:
   - All financial columns (rates, subtotals, totals, discounts, taxes, debit, credit, balances) MUST use PostgreSQL `NUMERIC(14, 2)`.
   - Never use `FLOAT`, `DOUBLE PRECISION`, or `REAL` for any monetary fields.

2. **Server-Side Arithmetic Execution**:
   - NEVER use native JavaScript operators (`+`, `-`, `*`, `/`) directly on currency values.
   - All calculations in Server Actions and utilities MUST be performed using `decimal.js`.
   - Always convert results back to fixed 2-decimal strings (`.toFixed(2)`) before persisting to the database.

3. **Client-Side Display Formatting**:
   - All currency values presented on screens, invoices, and ledgers MUST be formatted with 2 decimal places and the standard prefix:
     `Rs. 1,250.00`
   - Zero amounts must render as `Rs. 0.00`.
