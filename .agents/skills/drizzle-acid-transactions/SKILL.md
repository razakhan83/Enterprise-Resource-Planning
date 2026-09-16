---
name: drizzle-acid-transactions
description: Wrap complex financial mutations in db.transaction.
---

# Drizzle ACID Transactions Standard

## Objective
Guarantee database state consistency, prevent race conditions, avoid phantom reads, and eliminate negative stock allocations across all mutations in wholesale counter and warehouse workflows.

## Mandatory Rules
1. **Atomic Wrapping**:
   - Every operation that mutates multiple records (sales billing, stock receipts, contra settlements, cheque clearance) MUST be enclosed within `db.transaction(async (tx) => { ... })`.
   - Never perform uncoordinated independent updates that leave partial state upon failure.

2. **Row-Level Concurrency Locking (`FOR UPDATE`)**:
   - During sales deductions, open inventory batches MUST be fetched using PostgreSQL Row-Level Locking (`FOR UPDATE`).
   - This locks the batch rows until the transaction commits or rolls back, preventing concurrent POS counters from deducting the same inventory simultaneously.

3. **Atomic Sequences for Invoicing**:
   - Never compute invoice numbers using `SELECT COUNT(*)` or `SELECT invoice_no ORDER BY created_at DESC`.
   - Always use native PostgreSQL sequences:
     `SELECT nextval('kacha_invoice_seq')` or `SELECT nextval('pakka_invoice_seq')`.

4. **Deterministic Rollback & Typed Errors**:
   - Throwing an `Error` inside `db.transaction` automatically triggers an ACID rollback.
   - Return clean typed responses `{ success: false, error: string }` or throw descriptive validation exceptions when preconditions fail.
