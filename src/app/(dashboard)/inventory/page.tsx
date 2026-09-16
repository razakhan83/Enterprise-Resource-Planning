import { db } from "@/db";
import { products, productBatches, parties } from "@/db/schema";
import { formatCurrency, formatDate } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const batchesWithDetails = await db
    .select({
      id: productBatches.id,
      productId: productBatches.productId,
      productName: products.name,
      supplierName: parties.name,
      receivedDate: productBatches.receivedDate,
      originalQty: productBatches.originalQty,
      remainingQty: productBatches.remainingQty,
      landedCost: productBatches.landedCost,
      childUnit: products.childUnit,
    })
    .from(productBatches)
    .innerJoin(products, eq(productBatches.productId, products.id))
    .innerJoin(parties, eq(productBatches.supplierId, parties.id));

  return (
    <div className="flex flex-col h-full gap-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900">
                FIFO Inventory & Inward Batches
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-0.5">
                Active warehouse batches sorted chronologically for First-In, First-Out depletion.
              </CardDescription>
            </div>
            <Badge variant="neutral" className="font-mono text-xs">
              {batchesWithDetails.length} Active Lots
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Description</TableHead>
                <TableHead>Vendor / Supplier</TableHead>
                <TableHead className="w-40">Received Date</TableHead>
                <TableHead className="w-32 text-right">Inward Qty</TableHead>
                <TableHead className="w-32 text-right">Remaining Qty</TableHead>
                <TableHead className="w-36 text-right">Landed Cost / Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchesWithDetails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-zinc-400 text-xs">
                    No active inward inventory lots found.
                  </TableCell>
                </TableRow>
              ) : (
                batchesWithDetails.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-xs text-zinc-900">{b.productName}</TableCell>
                    <TableCell className="text-xs text-zinc-600">{b.supplierName}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {formatDate(b.receivedDate)}
                    </TableCell>
                    <TableCell className="font-mono text-right text-xs text-zinc-600">
                      {b.originalQty} {b.childUnit}s
                    </TableCell>
                    <TableCell className="font-mono text-right font-semibold text-xs text-zinc-900">
                      {b.remainingQty} {b.childUnit}s
                    </TableCell>
                    <TableCell className="font-mono text-right font-semibold text-xs text-zinc-900">
                      {formatCurrency(b.landedCost)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
