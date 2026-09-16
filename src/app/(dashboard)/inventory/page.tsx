"use client";

import React, { useState, useEffect } from "react";
import {
  getInventoryMasterData,
  getProductMovementHistory,
} from "@/actions/inventory";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import {
  Plus,
  Search,
  Layers,
  Box,
  Pencil,
  History,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
} from "lucide-react";

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalProducts: 0,
    totalStockValue: "0.00",
    activeLotsCount: 0,
    lowStockCount: 0,
  });
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  // Lineage Drawer State
  const [lineageProduct, setLineageProduct] = useState<any | null>(null);
  const [lineageData, setLineageData] = useState<any | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const res = await getInventoryMasterData();
    if (res.success) {
      setProducts(res.products || []);
      setBatches(res.batches || []);
      if (res.summary) setSummary(res.summary);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenLineage = async (prod: any) => {
    setLineageProduct(prod);
    setLineageLoading(true);
    const res = await getProductMovementHistory(prod.id);
    if (res.success) {
      setLineageData(res);
    }
    setLineageLoading(false);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredBatches = batches.filter(
    (b) =>
      b.productName.toLowerCase().includes(search.toLowerCase()) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(search.toLowerCase())) ||
      (b.inwardInvoiceNo && b.inwardInvoiceNo.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto select-none">
      {/* 1. TOP SUMMARY BADGES */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Total Stock Valuation</span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {formatCurrency(summary.totalStockValue)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Active Inward Lots</span>
              <span className="text-xl font-bold font-mono text-blue-700">
                {summary.activeLotsCount}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-700">
              <Layers className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Low Stock Alert</span>
              <span className="text-xl font-bold font-mono text-amber-700">
                {summary.lowStockCount} Products
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Master SKUs</span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {summary.totalProducts} Items
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Package className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. MAIN CARD */}
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
                onClick={() => {
                  setProductToEdit(null);
                  setProductDialogOpen(true);
                }}
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
                    <TableRow className="bg-zinc-50/70">
                      <TableHead className="w-28 font-mono">SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="w-36">Packaging Ratio</TableHead>
                      <TableHead className="w-36 text-right">Default Rate (Base)</TableHead>
                      <TableHead className="w-36 text-right">Default Rate (Bulk)</TableHead>
                      <TableHead className="w-40 text-right">Current Stock</TableHead>
                      <TableHead className="w-36 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p) => {
                      const baseRate = Number(p.defaultSaleRate || 0);
                      const bulkRate = baseRate * (p.conversionRate || 1);
                      const isLowStock = p.totalChildStock <= 10;

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs text-zinc-600 font-semibold">
                            {p.sku || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-xs text-zinc-900 flex items-center space-x-1.5">
                              <span>{p.name}</span>
                              {isLowStock && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0">Low Stock</Badge>
                              )}
                            </div>
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
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setProductToEdit(p);
                                  setProductDialogOpen(true);
                                }}
                                className="h-7 px-2 text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                                title="Edit Rate & Packaging"
                              >
                                <Pencil className="h-3.5 w-3.5 mr-0.5" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenLineage(p)}
                                className="h-7 px-2 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50 border-blue-200"
                                title="Trace Piece-by-Piece Movement"
                              >
                                <History className="h-3.5 w-3.5 mr-0.5" />
                                <span>Trace</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* TAB 2: FIFO BATCHES WITH INWARD INVOICE AND COSTING */}
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
                    <TableRow className="bg-zinc-50/70">
                      <TableHead>Product Description</TableHead>
                      <TableHead>Vendor / Supplier</TableHead>
                      <TableHead className="w-28 font-mono">Inward Bill #</TableHead>
                      <TableHead className="w-28">Warehouse</TableHead>
                      <TableHead className="w-28">Received Date</TableHead>
                      <TableHead className="w-24 text-right">Inward Qty</TableHead>
                      <TableHead className="w-24 text-right">Available</TableHead>
                      <TableHead className="w-28 text-right">Purchase Rate</TableHead>
                      <TableHead className="w-28 text-right">Landed Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-xs text-zinc-900">
                          {b.productName}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600">{b.supplierName}</TableCell>
                        <TableCell className="font-mono text-xs text-blue-700 font-semibold">
                          {b.inwardInvoiceNo || "Direct / Seeding"}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600">
                          {b.warehouseName || "Main Godown"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-500">
                          {formatDate(b.receivedDate)}
                        </TableCell>
                        <TableCell className="font-mono text-right text-xs text-zinc-600">
                          {b.originalQty} {b.childUnit}s
                        </TableCell>
                        <TableCell className="font-mono text-right font-bold text-xs text-zinc-900">
                          {b.remainingQty} {b.childUnit}s
                        </TableCell>
                        <TableCell className="font-mono text-right text-xs text-zinc-600">
                          {formatCurrency(b.purchaseRate || b.landedCost)}
                        </TableCell>
                        <TableCell className="font-mono text-right font-semibold text-xs text-emerald-800">
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

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        productToEdit={productToEdit}
        onSuccess={() => loadData()}
      />

      {/* 3. PRODUCT PIECE-BY-PIECE MOVEMENT LINEAGE DIALOG */}
      <Dialog
        open={Boolean(lineageProduct)}
        onOpenChange={(open) => !open && setLineageProduct(null)}
      >
        <DialogContent className="max-w-4xl bg-white p-6 shadow-2xl max-h-[85vh] flex flex-col">
          {lineageLoading || !lineageData ? (
            <div className="py-20 text-center text-xs text-zinc-400">
              Tracing piece-level inventory movements...
            </div>
          ) : (
            <>
              <DialogHeader className="border-b border-zinc-100 pb-3 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-base font-bold text-zinc-900 flex items-center space-x-2">
                      <History className="h-4 w-4 text-blue-600 mr-1" />
                      <span>Stock Movement & Piece Lineage: {lineageProduct?.name}</span>
                    </DialogTitle>
                    <div className="text-xs text-zinc-500 mt-1 flex items-center space-x-3">
                      <span>SKU: <strong className="font-mono text-zinc-800">{lineageProduct?.sku || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Total In Stock: <strong className="font-mono text-zinc-900">{lineageProduct?.totalChildStock} {lineageProduct?.childUnit}s</strong></span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-3 space-y-5">
                {/* SECTION 1: INWARD LOTS */}
                <div>
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block mb-2">
                    1. Inward Supplier Batches & Purchase Cost History ({lineageData.inwardLots.length})
                  </span>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50 text-xs">
                        <TableHead>Inward Date</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="font-mono">Inward Bill #</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Original Qty</TableHead>
                        <TableHead className="text-right">Remaining Qty</TableHead>
                        <TableHead className="text-right">Landed Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineageData.inwardLots.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs text-zinc-400 py-4">
                            No inward batches logged.
                          </TableCell>
                        </TableRow>
                      ) : (
                        lineageData.inwardLots.map((lot: any) => (
                          <TableRow key={lot.batchId} className="text-xs">
                            <TableCell className="font-mono text-zinc-600">{formatDate(lot.receivedDate)}</TableCell>
                            <TableCell className="font-medium text-zinc-900">{lot.supplierName}</TableCell>
                            <TableCell className="font-mono text-blue-700 font-semibold">{lot.inwardInvoiceNo || "-"}</TableCell>
                            <TableCell>{lot.warehouseName || "Main"}</TableCell>
                            <TableCell className="text-right font-mono">{lot.originalQty}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-zinc-900">{lot.remainingQty}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-emerald-800">{formatCurrency(lot.landedCost)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* SECTION 2: OUTWARD SALES TRACE */}
                <div>
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block mb-2">
                    2. Outward Sales Trace (Customer Billing & Piece Consumption) ({lineageData.salesTrace.length})
                  </span>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50 text-xs">
                        <TableHead>Sold Date</TableHead>
                        <TableHead className="font-mono">Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-center">Units Picked</TableHead>
                        <TableHead className="text-right">Landed Cost</TableHead>
                        <TableHead className="text-right">Sale Rate</TableHead>
                        <TableHead className="text-right">Margin / Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineageData.salesTrace.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs text-zinc-400 py-4">
                            No outward sales recorded for this product yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        lineageData.salesTrace.map((sale: any) => (
                          <TableRow key={sale.itemId} className="text-xs">
                            <TableCell className="font-mono text-zinc-600">{formatDate(sale.soldDate)}</TableCell>
                            <TableCell className="font-mono font-bold text-zinc-900">{sale.invoiceNo}</TableCell>
                            <TableCell className="font-medium text-zinc-900">{sale.customerName}</TableCell>
                            <TableCell className="text-center font-mono">
                              {sale.qtyConsumed} ({sale.unitTypeSold})
                            </TableCell>
                            <TableCell className="text-right font-mono text-zinc-500">{formatCurrency(sale.costSnapshot)}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-zinc-900">{formatCurrency(sale.saleRate)}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${sale.isLoss ? "text-red-700" : "text-emerald-700"}`}>
                              {sale.isLoss ? "-" : "+"}{formatCurrency(sale.marginRs)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* SECTION 3: WAREHOUSE TRANSFERS */}
                <div>
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block mb-2">
                    3. Inter-Godown Stock Transfers ({lineageData.transfersTrace.length})
                  </span>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50 text-xs">
                        <TableHead>Transfer Date</TableHead>
                        <TableHead className="font-mono">Chalan #</TableHead>
                        <TableHead>From Godown</TableHead>
                        <TableHead>To Godown</TableHead>
                        <TableHead className="text-right">Qty Moved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineageData.transfersTrace.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-zinc-400 py-4">
                            No warehouse transfers logged for this product.
                          </TableCell>
                        </TableRow>
                      ) : (
                        lineageData.transfersTrace.map((trn: any) => (
                          <TableRow key={trn.id} className="text-xs">
                            <TableCell className="font-mono text-zinc-600">{formatDate(trn.createdAt)}</TableCell>
                            <TableCell className="font-mono font-semibold text-purple-700">{trn.transferChalanNo}</TableCell>
                            <TableCell>{trn.fromWarehouseName}</TableCell>
                            <TableCell>{trn.toWarehouseName}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{trn.qtyMoved}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
