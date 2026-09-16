import { db } from "./index";
import { parties, products, productBatches } from "./schema";
import { sql } from "drizzle-orm";

async function verify() {
  console.log("--> Verifying Parties in Neon DB...");
  const allParties = await db.select().from(parties);
  console.log("Parties found:", allParties.length);
  for (const party of allParties) {
    console.log(`- ${party.name} (${party.type}, role: ${party.systemRole || 'N/A'}, balance: Rs. ${party.currentBalance})`);
  }

  console.log("\n--> Verifying Sequences...");
  const kachaSeq = await db.execute(sql`SELECT nextval('kacha_invoice_seq') as next_kacha`);
  const pakkaSeq = await db.execute(sql`SELECT nextval('pakka_invoice_seq') as next_pakka`);
  console.log("Next Kacha Seq:", kachaSeq.rows[0]);
  console.log("Next Pakka Seq:", pakkaSeq.rows[0]);

  console.log("\n--> Verifying Products & Batches...");
  const allProducts = await db.select().from(products);
  const allBatches = await db.select().from(productBatches);
  console.log(`Products: ${allProducts.length}, Batches: ${allBatches.length}`);
  if (allProducts[0]) {
    console.log(`Product: ${allProducts[0].name} | 1 ${allProducts[0].parentUnit} = ${allProducts[0].conversionRate} ${allProducts[0].childUnit}`);
  }
  if (allBatches[0]) {
    console.log(`Batch: Qty: ${allBatches[0].remainingQty}/${allBatches[0].originalQty} | Landed Cost: Rs. ${allBatches[0].landedCost}`);
  }
  process.exit(0);
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
