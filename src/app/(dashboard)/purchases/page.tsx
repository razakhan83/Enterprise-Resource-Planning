"use client";

import React, { useState, useEffect } from "react";
import {
  getPurchaseInitialData,
  createPurchaseInvoice,
  PurchaseItemInput,
} from "@/actions/purchasing";
import { formatCurrency } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Truck, Plus, Trash2, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import Decimal from "decimal.js";

type LineItemState = {
  productId: string;
  productName: string;
  unitType: "PARENT" | "CHILD";
  parentUnit: string;
  childUnit: string;
  conversionRate: number;
  qty: number;
  purchaseRate: string;
  lineTotal: string;
};

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [biltyNumber, setBiltyNumber] = useState<string>("");
  const [transporterName, setTransporterName] = useState<string>("");
  const [freightAmount, setFreightAmount] = useState<string>("0.00");
  const [isPaidImmediate, setIsPaidImmediate] = useState<boolean>(false);

  // Line items state
  const [items, setItems] = useState<LineItemState[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [unitType, setUnitType] = useState<"PARENT" | "CHILD">("PARENT");
  const [qty, setQty] = useState<number>(10);
  const [purchaseRate, setPurchaseRate] = useState<string>("320.00");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getPurchaseInitialData();
      setSuppliers(data.suppliers || []);
      setProducts(data.products || []);
      setWarehouses(data.warehouses || []);
      if (data.suppliers && data.suppliers[0]) setSelectedSupplierId(data.suppliers[0].id);
      if (data.warehouses && data.warehouses[0]) setSelectedWarehouseId(data.warehouses[0].id);
      if (data.products && data.products[0]) setSelectedProductId(data.products[0].id);
    }
    load();
  }, []);

  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;
    if (qty <= 0 || !purchaseRate || Number(purchaseRate) <= 0) return;

    const lineTotal = new Decimal(purchaseRate).mul(qty).toFixed(2);
    const newItem: LineItemState = {
      productId: prod.id,
      productName: prod.name,
      unitType,
      parentUnit: prod.parentUnit,
      childUnit: prod.childUnit,
      conversionRate: prod.conversionRate,
      qty,
      purchaseRate,
      lineTotal,
    };

    setItems([...items, newItem]);
    setQty(1);
    setPurchaseRate("");
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const rawSubtotal = items.reduce((acc, it) => acc.plus(new Decimal(it.lineTotal)), new Decimal(0));
  const freightDec = new Decimal(freightAmount || 0);
  const netPayable = rawSubtotal.plus(freightDec);

  const handleSubmit = async () => {
    if (!selectedSupplierId) {
      setStatusMessage({ type: "error", text: "Please select a supplier." });
      return;
    }
    if (items.length === 0) {
      setStatusMessage({ type: "error", text: "Please add at least one line item." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await createPurchaseInvoice({
      supplierId: selectedSupplierId,
      warehouseId: selectedWarehouseId,
      biltyNumber,
      transporterName,
      freightAmount,
      isPaidImmediate,
      items: items.map((it) => ({
        productId: it.productId,
        unitType: it.unitType,
        qty: it.qty,
        purchaseRate: it.purchaseRate,
      })),
    });

    setIsSubmitting(false);

    if (res.success && res.invoiceNo) {
      setStatusMessage({
        type: "success",
        text: `Inward purchase ${res.invoiceNo} booked successfully! FIFO inventory lots created.`,
      });
      setItems([]);
      setFreightAmount("0.00");
      setBiltyNumber("");
      setTransporterName("");
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to create purchase invoice." });
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* HEADER CARD */}
      <Card>
        <CardHeader className="py-3 px-4 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-zinc-700" />
              <span>Inward Purchase & Landed Freight Engine</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-0.5">
              Receive vendor consignments, allocate transportation costs to unit landed cost, and create FIFO lots.
            </CardDescription>
          </div>
          <Badge variant="neutral" className="text-xs font-mono">
            Shortcut [F4]
          </Badge>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          {/* TOP CONTROLS: SUPPLIER, WAREHOUSE, BILTY, FREIGHT */}
          <div className="grid grid-cols-12 gap-3 text-xs">
            {/* Supplier Picker */}
            <div className="col-span-3 space-y-1">
              <label className="text-zinc-600 font-medium">Vendor / Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full h-8 px-2 border border-zinc-200 rounded-md bg-white text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatCurrency(s.currentBalance)})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Warehouse */}
            <div className="col-span-3 space-y-1">
              <label className="text-zinc-600 font-medium">Receiving Warehouse</label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full h-8 px-2 border border-zinc-200 rounded-md bg-white text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.isRetailCounter ? "(Retail Counter)" : "(Godown Storage)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Bilty Logistics */}
            <div className="col-span-2 space-y-1">
              <label className="text-zinc-600 font-medium">Bilty / Waybill No.</label>
              <Input
                type="text"
                placeholder="e.g. BLT-8899"
                value={biltyNumber}
                onChange={(e) => setBiltyNumber(e.target.value)}
                className="h-8 font-mono"
              />
            </div>

            {/* Transporter */}
            <div className="col-span-2 space-y-1">
              <label className="text-zinc-600 font-medium">Transporter Carrier</label>
              <Input
                type="text"
                placeholder="e.g. Faisal Goods Transport"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                className="h-8"
              />
            </div>

            {/* Freight Allocation */}
            <div className="col-span-2 space-y-1">
              <label className="text-zinc-600 font-medium">Allocated Freight (Rs.)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={freightAmount}
                onChange={(e) => setFreightAmount(e.target.value)}
                className="h-8 text-right font-mono font-semibold"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STATUS NOTIFICATION BANNER */}
      {statusMessage && (
        <div
          className={`p-3 rounded-md text-xs flex items-center justify-between border ${
            statusMessage.type === "error"
              ? "bg-red-50 text-red-800 border-red-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {/* TWO-COLUMN WORKSPACE: ENTRY & TABLE VS TOTALS */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: FAST ITEM ENTRY & TABLE (Cols 9) */}
        <div className="col-span-9 flex flex-col gap-3 h-full overflow-hidden">
          {/* FAST LINE ENTRY */}
          <Card className="shrink-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                {/* Product Select (flex-1) */}
                <div className="flex-1">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full h-8 px-2 border border-zinc-200 rounded-md bg-white text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (1 {p.parentUnit} = {p.conversionRate} {p.childUnit}s)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit Toggle (w-28) */}
                <div className="w-28">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUnitType(unitType === "PARENT" ? "CHILD" : "PARENT")}
                    className="w-full h-8 justify-between text-xs px-2"
                  >
                    <span className="text-zinc-400 text-[10px]">UNIT:</span>
                    <span className="font-semibold text-zinc-800">{unitType}</span>
                  </Button>
                </div>

                {/* Quantity (w-24) */}
                <div className="w-24">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="h-8 text-right font-mono text-xs font-semibold"
                  />
                </div>

                {/* Purchase Rate (w-28) */}
                <div className="w-28">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Rate Rs."
                    value={purchaseRate}
                    onChange={(e) => setPurchaseRate(e.target.value)}
                    className="h-8 text-right font-mono text-xs font-semibold"
                  />
                </div>

                {/* Add Button */}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddItem}
                  className="w-20 h-8 font-semibold text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* LINE ITEMS TABLE */}
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="py-2.5 px-4 bg-zinc-50/60 border-b border-zinc-100 flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                Inward Consignment Items ({items.length})
              </CardTitle>
              <span className="text-[10px] text-zinc-400 font-mono">
                Landed cost calculated on commit
              </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-28 text-center">Unit</TableHead>
                    <TableHead className="w-24 text-right">Inward Qty</TableHead>
                    <TableHead className="w-28 text-right">Child Units</TableHead>
                    <TableHead className="w-32 text-right">Purchase Rate</TableHead>
                    <TableHead className="w-36 text-right">Line Total</TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-36 text-center text-zinc-400">
                        No inward items added yet. Select a product and add line items above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it, idx) => {
                      const totalChild = it.unitType === "PARENT" ? it.qty * it.conversionRate : it.qty;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-center font-mono text-zinc-400 text-xs">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-zinc-900">
                            {it.productName}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {it.unitType === "PARENT" ? it.parentUnit : it.childUnit}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {it.qty}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-zinc-600">
                            {totalChild} {it.childUnit}s
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-zinc-700">
                            {formatCurrency(it.purchaseRate)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-zinc-900">
                            {formatCurrency(it.lineTotal)}
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-zinc-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: SUMMARY & COMMIT (Cols 3) */}
        <div className="col-span-3 flex flex-col h-full">
          <Card className="flex flex-col justify-between h-full">
            <div>
              <CardHeader className="py-3 px-4 border-b border-zinc-100">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                  Purchase Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center text-xs text-zinc-600">
                  <span>Goods Subtotal</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {formatCurrency(rawSubtotal.toFixed(2))}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-600">
                  <span>Inward Freight Allocation</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {formatCurrency(freightAmount)}
                  </span>
                </div>

                <div className="border-t border-zinc-200 pt-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Total Landed Payable
                    </span>
                    <span className="font-mono text-2xl font-bold tracking-tight text-zinc-900">
                      {formatCurrency(netPayable.toFixed(2))}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 text-right font-mono">
                    Post to Accounts Payable
                  </div>
                </div>

                {/* Instant Cash Paid Option */}
                <div className="pt-2 border-t border-zinc-100">
                  <label className="flex items-center space-x-2 text-xs text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPaidImmediate}
                      onChange={(e) => setIsPaidImmediate(e.target.checked)}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                    />
                    <span className="font-medium">Paid Immediately in Cash</span>
                  </label>
                  <p className="text-[10px] text-zinc-400 mt-1 pl-5">
                    Settles Accounts Payable via Cash-in-Hand drawer automatically upon receipt.
                  </p>
                </div>
              </CardContent>
            </div>

            <div className="p-4 border-t border-zinc-100">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || items.length === 0}
                className="w-full h-10 font-semibold text-xs tracking-wide shadow-sm"
              >
                {isSubmitting ? "Generating FIFO Batches..." : "Commit Purchase & Post Lots"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
