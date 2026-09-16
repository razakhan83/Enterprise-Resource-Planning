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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartyCombobox } from "@/components/parties/PartyCombobox";
import { ProductCombobox } from "@/components/inventory/ProductCombobox";
import { Truck, Plus, Trash2, CheckCircle2, AlertCircle, Building2, PackageCheck } from "lucide-react";
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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [biltyNumber, setBiltyNumber] = useState<string>("");
  const [transporterName, setTransporterName] = useState<string>("");
  const [freightAmount, setFreightAmount] = useState<string>("0.00");
  const [isPaidImmediate, setIsPaidImmediate] = useState<boolean>(false);

  // Line items state
  const [items, setItems] = useState<LineItemState[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<"PARENT" | "CHILD">("PARENT");
  const [qty, setQty] = useState<number>(10);
  const [purchaseRate, setPurchaseRate] = useState<string>("320.00");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    const data = await getPurchaseInitialData();
    setSuppliers(data.suppliers || []);
    setProducts(data.products || []);
    setWarehouses(data.warehouses || []);
    if (data.suppliers && data.suppliers[0] && !selectedSupplierId) {
      setSelectedSupplierId(data.suppliers[0].id);
    }
    if (data.warehouses && data.warehouses[0] && !selectedWarehouseId) {
      setSelectedWarehouseId(data.warehouses[0].id);
    }
    if (data.products && data.products[0] && !selectedProductId) {
      setSelectedProductId(data.products[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleAddItem = () => {
    if (!selectedProduct) return;
    if (qty <= 0 || !purchaseRate || Number(purchaseRate) <= 0) return;

    const lineTotal = new Decimal(purchaseRate).mul(qty).toFixed(2);
    const newItem: LineItemState = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      unitType,
      parentUnit: selectedProduct.parentUnit,
      childUnit: selectedProduct.childUnit,
      conversionRate: selectedProduct.conversionRate,
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

  const rawSubtotal = items.reduce(
    (acc, it) => acc.plus(new Decimal(it.lineTotal)),
    new Decimal(0)
  );
  const freightDec = new Decimal(freightAmount || 0);
  const netPayable = rawSubtotal.plus(freightDec);

  // Calculate Landed Cost per child unit
  const totalChildUnits = items.reduce((acc, it) => {
    const childUnits = it.unitType === "PARENT" ? it.qty * it.conversionRate : it.qty;
    return acc + childUnits;
  }, 0);

  const freightPerChild =
    totalChildUnits > 0 ? freightDec.div(totalChildUnits) : new Decimal(0);

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
      loadData();
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to commit purchase invoice." });
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* HEADER & INWARD LOGISTICS CONFIG */}
      <Card className="border-zinc-200 shadow-xs shrink-0">
        <CardHeader className="py-3 px-4 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-zinc-600" />
                Inward Purchase & Landed Batch Engine
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-0.5">
                Log vendor consignments, allocate freight costs to landed batches, and update accounts payable.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="font-mono text-xs">
                {items.length} Inward Lots
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 bg-zinc-50/50">
          <div className="grid grid-cols-12 gap-3 text-xs">
            {/* Vendor / Supplier Combobox with Quick-Add */}
            <div className="col-span-3 space-y-1">
              <label className="text-zinc-600 font-medium block">Vendor / Supplier</label>
              <PartyCombobox
                parties={suppliers}
                selectedPartyId={selectedSupplierId}
                onSelectParty={(s) => setSelectedSupplierId(s ? s.id : null)}
                allowedTypes={["SUPPLIER", "DUAL"]}
                allowCashOption={false}
                defaultNewPartyType="SUPPLIER"
                placeholder="Select Vendor..."
              />
            </div>

            {/* Destination Warehouse */}
            <div className="col-span-3 space-y-1">
              <label className="text-zinc-600 font-medium block">Receiving Warehouse</label>
              <Select
                value={selectedWarehouseId}
                onValueChange={(val) => setSelectedWarehouseId(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} {w.isRetailCounter ? "(Retail Counter)" : "(Godown Storage)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bilty Logistics */}
            <div className="col-span-2 space-y-1">
              <label className="text-zinc-600 font-medium block">Bilty / GR No.</label>
              <Input
                type="text"
                placeholder="e.g. BLT-8899"
                value={biltyNumber}
                onChange={(e) => setBiltyNumber(e.target.value)}
                className="h-9 font-mono"
              />
            </div>

            {/* Transporter */}
            <div className="col-span-2 space-y-1">
              <label className="text-zinc-600 font-medium block">Transporter</label>
              <Input
                type="text"
                placeholder="e.g. Faisal Goods Carrier"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Freight Allocation */}
            <div className="col-span-2 space-y-1">
              <label className="text-zinc-600 font-medium block">Freight Cost (Rs.)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={freightAmount}
                onChange={(e) => setFreightAmount(e.target.value)}
                className="h-9 text-right font-mono font-semibold"
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
            {statusMessage.type === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* TWO-COLUMN WORKSPACE: ENTRY & TABLE VS TOTALS */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: ITEM ENTRY & TABLE (Cols 9) */}
        <div className="col-span-9 flex flex-col gap-3 h-full overflow-hidden">
          {/* FAST LINE ENTRY WITH PRODUCT COMBOBOX */}
          <Card className="shrink-0 border-zinc-200 shadow-xs">
            <CardContent className="p-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                {/* Searchable Product Combobox with Quick-Add (Col 5) */}
                <div className="col-span-5">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">
                    Product Description [Search or + Add New]
                  </span>
                  <ProductCombobox
                    products={products}
                    selectedProductId={selectedProductId}
                    onSelectProduct={(p) => setSelectedProductId(p ? p.id : null)}
                  />
                </div>

                {/* Unit Toggle (Col 2) */}
                <div className="col-span-2">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">Unit</span>
                  <div className="flex border border-zinc-200 rounded h-9 overflow-hidden bg-zinc-50">
                    <button
                      type="button"
                      onClick={() => setUnitType("PARENT")}
                      className={`flex-1 text-[11px] font-semibold transition-colors ${
                        unitType === "PARENT"
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {selectedProduct ? selectedProduct.parentUnit : "Carton"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitType("CHILD")}
                      className={`flex-1 text-[11px] font-semibold transition-colors ${
                        unitType === "CHILD"
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {selectedProduct ? selectedProduct.childUnit : "Piece"}
                    </button>
                  </div>
                </div>

                {/* Quantity (Col 2) */}
                <div className="col-span-2">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">Qty</span>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="h-9 text-right font-mono text-xs font-semibold"
                  />
                </div>

                {/* Purchase Rate (Col 2) */}
                <div className="col-span-2">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">Rate (Rs.)</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Rate Rs."
                    value={purchaseRate}
                    onChange={(e) => setPurchaseRate(e.target.value)}
                    className="h-9 text-right font-mono text-xs font-semibold"
                  />
                </div>

                {/* Add Button (Col 1) */}
                <div className="col-span-1 pt-3.5">
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full h-9 font-bold text-xs bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5 mr-0.5" /> Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LINE ITEMS TABLE */}
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-zinc-200 shadow-xs">
            <CardHeader className="py-2.5 px-4 bg-zinc-50/60 border-b border-zinc-100 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                Inward Consignment Items ({items.length})
              </CardTitle>
              <span className="text-[10px] text-zinc-400 font-mono">
                {totalChildUnits > 0
                  ? `Allocated Freight: Rs. ${freightPerChild.toFixed(2)} / child unit`
                  : "Landed cost calculated automatically"}
              </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Product Description</TableHead>
                    <TableHead className="w-24 text-center">Unit</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-24 text-right">Child Units</TableHead>
                    <TableHead className="w-28 text-right">Purchase Rate</TableHead>
                    <TableHead className="w-32 text-right">Landed Cost / Base</TableHead>
                    <TableHead className="w-32 text-right">Line Total</TableHead>
                    <TableHead className="w-10 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-36 text-center text-zinc-400 text-xs">
                        No inward items added yet. Select a product and click Add.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it, idx) => {
                      const totalChild =
                        it.unitType === "PARENT" ? it.qty * it.conversionRate : it.qty;
                      const rawRatePerChild =
                        it.unitType === "PARENT"
                          ? new Decimal(it.purchaseRate).div(it.conversionRate)
                          : new Decimal(it.purchaseRate);
                      const landedPerChild = rawRatePerChild.plus(freightPerChild);

                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-center font-mono text-zinc-400 text-xs">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-zinc-900">
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
                          <TableCell className="text-right font-mono text-xs font-bold text-zinc-900">
                            {formatCurrency(landedPerChild.toFixed(2))}
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
          <Card className="flex flex-col justify-between h-full border-zinc-200 shadow-xs">
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
                    <span className="font-mono text-2xl font-black tracking-tight text-zinc-900">
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
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                    />
                    <span className="font-medium">Paid Immediately in Cash</span>
                  </label>
                  <p className="text-[10px] text-zinc-400 mt-1 pl-6">
                    Settles Accounts Payable via Cash-in-Hand drawer automatically upon receipt.
                  </p>
                </div>
              </CardContent>
            </div>

            <div className="p-4 border-t border-zinc-100">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || items.length === 0}
                className="w-full h-10 font-bold text-xs bg-zinc-900 text-white hover:bg-zinc-800 tracking-wide shadow-xs"
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
