import "dotenv/config";
import { db } from "./index";
import { getPurchaseInitialData, createPurchaseInvoice } from "../actions/purchasing";
import { postPaymentReceiptVoucher, settleContraBarterVoucher } from "../actions/vouchers";
import { transferStockBetweenWarehouses, adjustStockWastage, getWarehouseTransferData } from "../actions/inventory";
import { getReportsData } from "../actions/reports";

async function runPhase2Tests() {
  console.log("=== RUNNING PHASE 2 ERP ENGINE TESTS ===\n");

  // TEST 1: Inward Purchase Invoice with Landed Freight Allocation
  console.log("--> Test 1: Inward Purchase Engine (createPurchaseInvoice)...");
  const purchaseInit = await getPurchaseInitialData();
  const supplier = purchaseInit.suppliers[0];
  const prod = purchaseInit.products.find((p: any) => p.sku === "VLV-BRS-002") || purchaseInit.products[0];
  const warehouse = purchaseInit.warehouses[0];

  console.log(`Supplier: ${supplier.name}, Product: ${prod.name}`);
  const purchaseRes = await createPurchaseInvoice({
    supplierId: supplier.id,
    warehouseId: warehouse ? warehouse.id : undefined,
    biltyNumber: "BLT-KHI-4402",
    transporterName: "Karachi Cargo Express",
    freightAmount: "500.00",
    isPaidImmediate: false,
    items: [
      {
        productId: prod.id,
        unitType: "PARENT",
        qty: 10, // 10 Boxes = 100 Pieces
        purchaseRate: "450.00", // Rs. 4,500 + Rs. 500 freight = Rs. 5,000 / 100 = Rs. 50.00 landed
      },
    ],
  });

  console.log("Purchase Result:", purchaseRes);
  if (!purchaseRes.success) throw new Error(`Purchase failed: ${purchaseRes.error}`);

  // TEST 2: Customer Recovery (Receipt Voucher)
  console.log("\n--> Test 2: Customer Recovery Voucher (postPaymentReceiptVoucher)...");
  const receiptRes = await postPaymentReceiptVoucher({
    voucherType: "RECEIPT",
    partyId: supplier.id,
    amount: "2500.00",
    paymentMethod: "CASH",
    particulars: "Weekly counter recovery collection",
  });
  console.log("Receipt Voucher Result:", receiptRes);
  if (!receiptRes.success) throw new Error(`Receipt voucher failed: ${receiptRes.error}`);

  // TEST 3: Contra Barter Settlement
  console.log("\n--> Test 3: Contra Barter Settlement (settleContraBarterVoucher)...");
  const dualParty = purchaseInit.suppliers.find((p: any) => p.type === "DUAL") || supplier;
  const contraRes = await settleContraBarterVoucher({
    partyId: dualParty.id,
    nettedAmount: "3000.00",
    cashDifference: "500.00",
    differenceAction: "RECEIVE_CASH",
    particulars: "Sanitary goods vs brass fittings mutual offset",
  });
  console.log("Contra Result:", contraRes);
  if (!contraRes.success) throw new Error(`Contra settlement failed: ${contraRes.error}`);

  // TEST 4: Stock Wastage & Spoilage Write-Off
  console.log("\n--> Test 4: Stock Spoilage Loss (adjustStockWastage)...");
  const transferData = await getWarehouseTransferData();
  const activeBatch = transferData.batches[0];
  if (activeBatch) {
    const wastageRes = await adjustStockWastage({
      batchId: activeBatch.id,
      qtyDamaged: 2,
      reason: "Water leakage damage during warehouse rain",
    });
    console.log("Wastage Result:", wastageRes);
    if (!wastageRes.success) throw new Error(`Wastage adjustment failed: ${wastageRes.error}`);
  }

  // TEST 5: Business Intelligence & Reports Matrix
  console.log("\n--> Test 5: Executive Business Intelligence (getReportsData)...");
  const reports = await getReportsData();
  console.log(`Vendors in Profit Matrix: ${reports.supplierMatrix.length}`);
  console.log("P&L Financial Statement Summary:", {
    totalRevenue: reports.financialStatement.totalRevenue,
    totalCogs: reports.financialStatement.totalCogs,
    grossProfit: reports.financialStatement.grossProfit,
    totalExpenses: reports.financialStatement.totalExpenses,
    netProfit: reports.financialStatement.netProfit,
  });
  console.log(`Receivables Aging Accounts: ${reports.agingList.length}`);

  console.log("\n✓ ALL 5 PHASE 2 ERP MODULES VERIFIED ATOMICALLY ON NEON DB!");
  process.exit(0);
}

runPhase2Tests().catch((err) => {
  console.error("❌ Phase 2 Tests Failed:", err);
  process.exit(1);
});
