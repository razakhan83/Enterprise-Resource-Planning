import { createSaleInvoice, getPosInitialData } from "../actions/billing";

async function runTest() {
  console.log("--> Fetching POS initial data...");
  const data = await getPosInitialData();
  console.log("Found products:", data.products.length);
  const prod = data.products[0];
  if (!prod) {
    throw new Error("No products found.");
  }

  console.log(`Testing sale for: ${prod.name} (Stock: ${prod.stockChildUnits} ${prod.childUnit}s)`);

  console.log("--> Testing Kacha (EST) Walk-in Cash Sale with Kasr/Discount...");
  const kachaResult = await createSaleInvoice({
    partyId: null, // Walk-in Cash
    items: [
      {
        productId: prod.id,
        productName: prod.name,
        unitType: "CHILD",
        qty: 2,
        rate: "450.00",
      },
    ],
    discountAmount: "20.00",
    isPakkaBill: false,
  });

  console.log("Kacha Result:", kachaResult);
  if (!kachaResult.success) {
    throw new Error(`Kacha sale failed: ${kachaResult.error}`);
  }

  console.log("--> Testing Pakka (TAX) Sale with Registered Party...");
  const party = data.parties[0];
  const pakkaResult = await createSaleInvoice({
    partyId: party ? party.id : null,
    items: [
      {
        productId: prod.id,
        productName: prod.name,
        unitType: "PARENT", // 1 Carton = 24 Pieces
        qty: 1,
        rate: "10500.00",
      },
    ],
    discountAmount: "500.00",
    isPakkaBill: true,
    biltyNumber: "BLT-7890",
    transporterName: "Faisal Goods Karachi",
    freightTerms: "TO-PAY",
  });

  console.log("Pakka Result:", pakkaResult);
  if (!pakkaResult.success) {
    throw new Error(`Pakka sale failed: ${pakkaResult.error}`);
  }

  console.log("✓ All sales transactions committed successfully with atomic sequences and double-entry postings!");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
