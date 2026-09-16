---
name: fifo-inventory-engine
description: Enforce FIFO stock deduction, landed cost, and FOR UPDATE batch locking.
globs: src/actions/billing.ts, src/actions/inventory.ts
---

# FIFO Inventory Engine Standard

## Objective
Enforce strict First-In, First-Out (FIFO) stock allocation for physical wholesale and distribution goods, accurately capturing landed costs and gross profit margins.

## Mandatory Rules
1. **Oldest Open Lot Priority**:
   - Outward stock deductions must sort open batches strictly by `received_date ASC`:
     `WHERE remaining_qty > 0 ORDER BY received_date ASC`
   - Consume from the oldest active lot first before touching newer shipments.

2. **Multi-Batch Split Logic**:
   - When an order line's quantity exceeds the available stock in Batch 1:
     - Consume all remaining units in Batch 1 (setting `remaining_qty = 0`).
     - Split the residual demand into Batch 2 (and subsequent batches if necessary).
     - Each deduction creates a distinct `sales_items` line referencing that exact `batch_id`.

3. **Landed Cost Snapshotting**:
   - The exact purchase landed cost (including allocated freight and handling) from the consumed batch must be frozen into `cost_snapshot` on `sales_items`.
   - Never compute historical profit margins using current product replacement cost; use the frozen snapshot:
     `Gross Profit = (sale_rate - cost_snapshot) * qty_consumed`

4. **Multi-Unit Normalization**:
   - All batch quantities in `product_batches.original_qty` and `remaining_qty` MUST be stored normalized in child units (e.g., Pieces or KGs).
   - If an item is sold as a parent unit (e.g., Carton), convert to child units before deduction:
     `deduct_units = sold_qty * conversion_rate`
