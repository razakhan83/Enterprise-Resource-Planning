"use client";

import React, { useState, useEffect } from "react";
import { getInventoryMasterData } from "@/actions/inventory";
import { formatCurrency, formatDate } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCreateDialog } from "@/components/inventory/ProductCreateDialog";
import { Plus, Search, Layers, Box } from "lucide-react";

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    const res = await getInventoryMasterData();
    if (res.success) {
      setProducts(res.products || []);
      setBatches(res.batches || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredBatches = batches.filter(
    (b) =>
      b.productName.toLowerCase().includes(search.toLowerCase()) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <Card className="border-zinc-200 shadow-xs flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900">
                Inventory & Products Master
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-0.5">
                Dual-unit wholesale catalog, standard selling rates, and FIFO batch tracking.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setProductDialogOpen(true)}
                className="h-8 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium flex items-center space-x-1"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span>Add New Product</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by SKU or name..."
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="catalog" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-100 bg-zinc-50/50">
              <TabsList className="bg-zinc-100 p-0.5 h-8 border border-zinc-200">
                <TabsTrigger value="catalog" className="text-xs font-semibold px-3 h-7">
                  <Box className="h-3.5 w-3.5 mr-1.5" />
                  Product Master ({products.length})
                </TabsTrigger>
                <TabsTrigger value="batches" className="text-xs font-semibold px-3 h-7">
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  Active FIFO Batches ({batches.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: PRODUCT MASTER & DEFAULT RATES */}
            <TabsContent value="catalog" className="flex-1 overflow-auto m-0 p-0">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-xs text-zinc-400">
                  Loading catalog...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs text-zinc-500">
                  No products found matching &ldquo;{search}&rdquo;.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28 font-mono">SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="w-36">Packaging Ratio</TableHead>
                      <TableHead className="w-36 text-right">Default Rate (Base)</TableHead>
                      <TableHead className="w-36 text-right">Default Rate (Bulk)</TableHead>
                      <TableHead className="w-44 text-right">Current Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p) => {
                      const baseRate = Number(p.defaultSaleRate || 0);
                      const bulkRate = baseRate * (p.conversionRate || 1);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs text-zinc-600 font-semibold">
                            {p.sku || "-"}
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-zinc-900">
                            {p.name}
                          </TableCell>
                          <TableCell className="text-xs text-zinc-600">
                            <span className="font-medium text-zinc-900">1 {p.parentUnit}</span>
                            <span className="text-zinc-400"> = </span>
                            <span className="font-mono text-zinc-700">{p.conversionRate} {p.childUnit}s</span>
                          </TableCell>
                          <TableCell className="font-mono text-right text-xs font-semibold text-zinc-900">
                            {formatCurrency(baseRate)} / {p.childUnit}
                          </TableCell>
                          <TableCell className="font-mono text-right text-xs text-zinc-600">
                            {formatCurrency(bulkRate)} / {p.parentUnit}
                          </TableCell>
                          <TableCell className="font-mono text-right text-xs">
                            <span className="font-bold text-zinc-900">
                              {p.totalParentStock} {p.parentUnit}s
                            </span>
                            {p.looseChildStock > 0 && (
                              <span className="text-zinc-500 text-[11px] ml-1">
                                + {p.looseChildStock} {p.childUnit}s
                              </span>
                            )}
                            <div className="text-[10px] text-zinc-400">
                              ({p.totalChildStock} total {p.childUnit}s)
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* TAB 2: FIFO BATCHES */}
            <TabsContent value="batches" className="flex-1 overflow-auto m-0 p-0">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-xs text-zinc-400">
                  Loading batches...
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs text-zinc-500">
                  No active FIFO batch lots available.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Description</TableHead>
                      <TableHead>Vendor / Supplier</TableHead>
                      <TableHead className="w-36">Received Date</TableHead>
                      <TableHead className="w-32 text-right">Inward Qty</TableHead>
                      <TableHead className="w-32 text-right">Remaining Qty</TableHead>
                      <TableHead className="w-36 text-right">Landed Cost / Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-xs text-zinc-900">
                          {b.productName}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600">{b.supplierName}</TableCell>
                        <TableCell className="font-mono text-xs text-zinc-500">
                          {formatDate(b.receivedDate)}
                        </TableCell>
                        <TableCell className="font-mono text-right text-xs text-zinc-600">
                          {b.originalQty} {b.childUnit}s
                        </TableCell>
                        <TableCell className="font-mono text-right font-bold text-xs text-zinc-900">
                          {b.remainingQty} {b.childUnit}s
                        </TableCell>
                        <TableCell className="font-mono text-right font-semibold text-xs text-zinc-900">
                          {formatCurrency(b.landedCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ProductCreateDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
