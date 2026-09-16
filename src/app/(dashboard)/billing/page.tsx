"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  usePosStore,
  PartyOption,
  ProductOption,
} from "@/store/posStore";
import { getPosInitialData, createSaleInvoice } from "@/actions/billing";
import { formatCurrency, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Search,
  User,
  Truck,
  Trash2,
  Printer,
  Check,
  CreditCard,
  AlertCircle,
} from "lucide-react";

export default function BillingPosPage() {
  const {
    cart,
    selectedParty,
    isPakkaBill,
    discountAmount,
    biltyNumber,
    transporterName,
    freightTerms,
    isPartyModalOpen,
    isBiltyModalOpen,
    isReceiptModalOpen,
    completedReceipt,
    isSubmitting,
    setParty,
    togglePakkaBill,
    setDiscountAmount,
    setBiltyDetails,
    addToCart,
    updateCartItemQty,
    removeFromCart,
    clearCart,
    setPartyModalOpen,
    setBiltyModalOpen,
    setReceiptModalOpen,
    setCompletedReceipt,
    setIsSubmitting,
    getGrossTotal,
    getNetPayable,
  } = usePosStore();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active Line Entry Form State
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unitType, setUnitType] = useState<"PARENT" | "CHILD">("CHILD");
  const [qty, setQty] = useState<number>(1);
  const [rate, setRate] = useState<string>("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);

  // Focus Refs for Tabular Fast-Entry Navigation
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial products and parties from Neon
  useEffect(() => {
    async function loadData() {
      const data = await getPosInitialData();
      if (data.products) setProducts(data.products);
      if (data.parties) setParties(data.parties);
    }
    loadData();
  }, []);

  // Filter products for autocomplete
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectProduct = (product: ProductOption) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setProductDropdownOpen(false);
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  };

  const handleCommitActiveLine = () => {
    if (!selectedProduct) {
      itemInputRef.current?.focus();
      return;
    }
    if (!rate || Number(rate) <= 0) {
      rateInputRef.current?.focus();
      return;
    }
    if (qty <= 0) {
      qtyInputRef.current?.focus();
      return;
    }

    addToCart({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      unitType,
      parentUnit: selectedProduct.parentUnit,
      childUnit: selectedProduct.childUnit,
      conversionRate: selectedProduct.conversionRate,
      qty,
      rate,
    });

    // Reset entry line and return focus immediately to item search
    setSelectedProduct(null);
    setSearchQuery("");
    setQty(1);
    setRate("");
    setUnitType("CHILD");
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 40);
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setProductDropdownOpen(true);
      setDropdownIndex((prev) => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropdownIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (productDropdownOpen && filteredProducts[dropdownIndex]) {
        handleSelectProduct(filteredProducts[dropdownIndex]);
      } else if (selectedProduct) {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }
    } else if (e.key === "Escape") {
      setProductDropdownOpen(false);
    }
  };

  // Global POS Hotkeys (Ctrl+Enter to Commit & Print)
  useEffect(() => {
    const handleGlobalPosKeys = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleCommitAndPrint();
      }
    };
    window.addEventListener("keydown", handleGlobalPosKeys);
    return () => window.removeEventListener("keydown", handleGlobalPosKeys);
  }, [cart, selectedParty, discountAmount, isPakkaBill, biltyNumber, transporterName, freightTerms]);

  const handleCommitAndPrint = async () => {
    if (cart.length === 0) {
      setStatusMessage({ type: "error", text: "Cart is empty. Please add items to proceed." });
      itemInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const result = await createSaleInvoice({
      partyId: selectedParty?.id || null,
      items: cart.map((c) => ({
        productId: c.productId,
        productName: c.productName,
        unitType: c.unitType,
        qty: c.qty,
        rate: c.rate,
      })),
      discountAmount,
      isPakkaBill,
      biltyNumber,
      transporterName,
      freightTerms,
    });

    setIsSubmitting(false);

    if (result.success && result.invoiceNo) {
      const receiptData = {
        invoiceNo: result.invoiceNo,
        partyName: selectedParty ? selectedParty.name : "Cash-in-Hand Customer",
        date: formatDate(new Date()),
        isPakkaBill,
        items: [...cart],
        totalAmount: result.totalAmount || getGrossTotal(),
        discountAmount: result.discountAmount || discountAmount,
        netAmount: result.netAmount || getNetPayable(),
        biltyNumber,
        transporterName,
        freightTerms,
      };

      setCompletedReceipt(receiptData);
      setReceiptModalOpen(true);
      clearCart();

      // Refresh product stock list in background
      getPosInitialData().then((d) => {
        if (d.products) setProducts(d.products);
      });
    } else {
      setStatusMessage({ type: "error", text: result.error || "Failed to commit invoice." });
    }
  };

  const grossTotal = getGrossTotal();
  const netPayable = getNetPayable();

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 1. TOP CONTEXT BAR (Card container) */}
      <Card className="shrink-0">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Party Selector Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPartyModalOpen(true)}
              className="flex items-center gap-2 border-zinc-300 h-8"
            >
              {selectedParty ? <User className="h-3.5 w-3.5 text-zinc-600" /> : <CreditCard className="h-3.5 w-3.5 text-zinc-600" />}
              <span className="font-medium text-xs">
                {selectedParty ? selectedParty.name : "Cash-in-Hand (Walk-in)"}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-4">
                F3
              </Badge>
            </Button>

            {/* Current Balance Badge */}
            {selectedParty ? (
              <Badge variant="neutral" className="text-xs font-mono h-8 px-2.5">
                <span className="text-zinc-400 mr-1.5 font-sans">Current Balance:</span>
                <span className="font-semibold text-zinc-900">{formatCurrency(selectedParty.currentBalance)}</span>
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-xs h-8 px-2.5 text-zinc-500 font-sans">
                Direct Cash Settlement
              </Badge>
            )}

            {/* Logistics / Bilty Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBiltyModalOpen(true)}
              className="flex items-center gap-1.5 h-8 text-xs border-zinc-200"
            >
              <Truck className="h-3.5 w-3.5 text-zinc-500" />
              <span>{biltyNumber ? `Bilty: ${biltyNumber}` : "Add Logistics"}</span>
            </Button>
          </div>

          <div className="flex items-center space-x-3">
            {/* Invoice Type Segmented Control (Estimate vs Tax Invoice) */}
            <div className="flex items-center bg-zinc-100 p-0.5 rounded-md border border-zinc-200">
              <button
                type="button"
                onClick={() => isPakkaBill && togglePakkaBill()}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  !isPakkaBill
                    ? "bg-white text-zinc-950 font-semibold shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Estimate
              </button>
              <button
                type="button"
                onClick={() => !isPakkaBill && togglePakkaBill()}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  isPakkaBill
                    ? "bg-zinc-900 text-white font-semibold shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Tax Invoice
              </button>
            </div>

            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="h-8 text-zinc-500 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ERROR / STATUS BANNER */}
      {statusMessage && (
        <div
          className={`p-3 rounded-md text-xs flex items-center justify-between border ${
            statusMessage.type === "error"
              ? "bg-red-50 text-red-800 border-red-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* 2. MAIN TWO-COLUMN WORKSPACE */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: FAST ENTRY BAR & ACTIVE CART TABLE (Cols 9) */}
        <div className="col-span-9 flex flex-col h-full gap-3 overflow-hidden">
          {/* FAST ENTRY BAR */}
          <Card className="shrink-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 relative">
                {/* 1. Item Lookup (flex-1) */}
                <div className="flex-1 relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                      ref={itemInputRef}
                      type="text"
                      placeholder="Scan SKU barcode or type item name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setProductDropdownOpen(true);
                        setDropdownIndex(0);
                      }}
                      onFocus={() => setProductDropdownOpen(true)}
                      onKeyDown={handleItemKeyDown}
                      className="pl-8 text-xs h-8 font-medium"
                    />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {productDropdownOpen && filteredProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-56 overflow-y-auto z-40">
                      {filteredProducts.map((p, idx) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className={`px-3 py-2 text-xs flex justify-between items-center cursor-pointer border-b border-zinc-100 last:border-0 ${
                            idx === dropdownIndex ? "bg-zinc-100 font-medium text-zinc-900" : "hover:bg-zinc-50"
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              SKU: {p.sku || "-"} • 1 {p.parentUnit} = {p.conversionRate} {p.childUnit}s
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px] text-emerald-700 font-semibold">
                            {p.stockChildUnits} {p.childUnit}s
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Unit Selector (w-28) */}
                <div className="w-28">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUnitType(unitType === "PARENT" ? "CHILD" : "PARENT")}
                    className="w-full h-8 justify-between text-xs px-2"
                  >
                    <span className="text-zinc-400 text-[10px]">UNIT:</span>
                    <span className="font-semibold text-zinc-800">
                      {selectedProduct
                        ? unitType === "PARENT"
                          ? selectedProduct.parentUnit
                          : selectedProduct.childUnit
                        : unitType}
                    </span>
                  </Button>
                </div>

                {/* 3. Quantity (w-24) */}
                <div className="w-24">
                  <Input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rateInputRef.current?.focus();
                        rateInputRef.current?.select();
                      }
                    }}
                    className="text-right font-mono h-8 text-xs font-semibold"
                  />
                </div>

                {/* 4. Sales Rate (w-28) */}
                <div className="w-28">
                  <Input
                    ref={rateInputRef}
                    type="number"
                    step="0.01"
                    placeholder="Rate Rs."
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCommitActiveLine();
                      }
                    }}
                    className="text-right font-mono h-8 text-xs font-semibold"
                  />
                </div>

                {/* 5. Add Item Button (w-20) */}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleCommitActiveLine}
                  className="w-20 h-8 font-semibold text-xs"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ACTIVE CART DATA TABLE */}
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="py-2.5 px-4 bg-zinc-50/60 border-b border-zinc-100 flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                Active Invoice Items ({cart.length})
              </CardTitle>
              <span className="text-[10px] text-zinc-400 font-mono">
                Tabular Navigation Active
              </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24 text-center">Unit</TableHead>
                    <TableHead className="w-24 text-right">Qty</TableHead>
                    <TableHead className="w-32 text-right">Rate</TableHead>
                    <TableHead className="w-36 text-right">Total</TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-44 text-center text-zinc-400">
                        No items added. Use the input row above to scan or search items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item, idx) => (
                      <TableRow key={item.id} className="group">
                        <TableCell className="text-center font-mono text-zinc-400 text-xs">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-zinc-900">
                          <div>{item.productName}</div>
                          {item.unitType === "PARENT" && (
                            <div className="text-[10px] text-zinc-400 font-mono">
                              1 {item.parentUnit} = {item.conversionRate} {item.childUnit}s
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {item.unitType === "PARENT" ? item.parentUnit : item.childUnit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) =>
                              updateCartItemQty(item.id, parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-right py-0.5 px-1 bg-transparent hover:bg-zinc-100 focus:bg-white border border-transparent hover:border-zinc-200 focus:border-zinc-900 rounded font-mono text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-zinc-700">
                          {formatCurrency(item.rate)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-zinc-900">
                          {formatCurrency(item.lineTotal)}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: CHECKOUT PANEL (Cols 3) */}
        <div className="col-span-3 flex flex-col h-full">
          <Card className="flex flex-col justify-between h-full">
            <div>
              <CardHeader className="py-3 px-4 border-b border-zinc-100">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                  Payment Summary
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Subtotal */}
                <div className="flex justify-between items-center text-xs text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-zinc-900 text-sm">
                    {formatCurrency(grossTotal)}
                  </span>
                </div>

                {/* Discount / Round-off Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-700 font-medium">Discount / Round-off</span>
                    <span className="text-[10px] text-zinc-400 font-mono">Kasr Expense</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-xs">
                      Rs.
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="pl-8 text-right font-mono text-xs font-semibold text-zinc-900 h-8"
                    />
                  </div>
                </div>

                {/* Bilty Details Chip (if entered) */}
                {biltyNumber && (
                  <div className="bg-zinc-50 border border-zinc-200 p-2.5 rounded text-[11px] space-y-1 text-zinc-700">
                    <div className="flex justify-between font-semibold text-zinc-900">
                      <span>Logistics</span>
                      <Badge variant="outline" className="text-[10px]">{freightTerms}</Badge>
                    </div>
                    <div>Bilty #{biltyNumber}</div>
                    {transporterName && <div className="text-zinc-500">{transporterName}</div>}
                  </div>
                )}

                <div className="border-t border-zinc-200 pt-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Net Payable
                    </span>
                    <span className="font-mono text-2xl font-bold tracking-tight text-zinc-900">
                      {formatCurrency(netPayable)}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 text-right font-mono">
                    Strict NUMERIC(14,2) Precision
                  </div>
                </div>
              </CardContent>
            </div>

            {/* SAVE & PRINT ACTION BUTTON */}
            <div className="p-4 border-t border-zinc-100">
              <Button
                onClick={handleCommitAndPrint}
                disabled={isSubmitting || cart.length === 0}
                className="w-full h-10 font-semibold text-xs tracking-wide shadow-sm"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                <span>{isSubmitting ? "Processing..." : "Save & Print"}</span>
                <span className="ml-2 text-[10px] font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-700">
                  Ctrl + Enter
                </span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* DIALOG 1: REGISTERED PARTY SELECTOR (F3) */}
      <Dialog open={isPartyModalOpen} onOpenChange={setPartyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Customer / Account</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Quick Option: Cash-in-Hand Customer */}
            <div className="p-3 border border-zinc-200 rounded-md bg-zinc-50/50 flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-zinc-900">Cash-in-Hand Customer</div>
                <div className="text-[11px] text-zinc-500">Walk-in sale posted directly to cash drawer</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setParty(null);
                  setPartyModalOpen(false);
                }}
                className="h-7 text-xs font-medium"
              >
                Select Cash
              </Button>
            </div>

            {/* Registered Party List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded-md">
              {parties.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setParty(p);
                    setPartyModalOpen(false);
                  }}
                  className="p-2.5 hover:bg-zinc-50 cursor-pointer text-xs flex justify-between items-center transition-colors"
                >
                  <div>
                    <div className="font-semibold text-zinc-900">{p.name}</div>
                    <div className="text-[10px] text-zinc-400">{p.address || "Market Registry"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-zinc-900">{formatCurrency(p.currentBalance)}</div>
                    <div className="text-[10px] text-zinc-400">Balance</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: LOGISTICS / BILTY BOOKING */}
      <Dialog open={isBiltyModalOpen} onOpenChange={setBiltyModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Logistics & Transport</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-zinc-600 mb-1 font-medium">Bilty / Waybill Number</label>
              <Input
                type="text"
                placeholder="e.g. BLT-10928"
                value={biltyNumber}
                onChange={(e) => setBiltyDetails({ biltyNumber: e.target.value, transporterName, freightTerms })}
                className="font-mono h-8"
              />
            </div>

            <div>
              <label className="block text-zinc-600 mb-1 font-medium">Goods Carrier / Transporter</label>
              <Input
                type="text"
                placeholder="e.g. Faisal Goods Transport"
                value={transporterName}
                onChange={(e) => setBiltyDetails({ biltyNumber, transporterName: e.target.value, freightTerms })}
                className="h-8"
              />
            </div>

            <div>
              <label className="block text-zinc-600 mb-1 font-medium">Freight Terms</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={freightTerms === "PAID" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBiltyDetails({ biltyNumber, transporterName, freightTerms: "PAID" })}
                  className="h-8 text-xs"
                >
                  Paid
                </Button>
                <Button
                  type="button"
                  variant={freightTerms === "TO-PAY" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBiltyDetails({ biltyNumber, transporterName, freightTerms: "TO-PAY" })}
                  className="h-8 text-xs"
                >
                  To-Pay
                </Button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={() => setBiltyModalOpen(false)}>
                Save Logistics
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: 80MM THERMAL RECEIPT MODAL */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs">
              Print Thermal Receipt [{completedReceipt?.invoiceNo}]
            </DialogTitle>
          </DialogHeader>

          {completedReceipt && (
            <div className="space-y-4">
              <div className="flex justify-center p-3 bg-zinc-50 border border-zinc-200 rounded">
                <div
                  id="thermal-receipt"
                  className="bg-white p-3 border border-zinc-300 w-[280px] text-[11px] font-mono leading-tight text-black"
                >
                  <div className="text-center pb-2 border-b border-black">
                    <div className="text-xs font-bold uppercase">COMMERCIAL ENTERPRISE ERP</div>
                    <div className="text-[10px]">Wholesale & Distribution</div>
                    <div className="mt-1 font-bold text-[11px]">
                      {completedReceipt.isPakkaBill ? "TAX INVOICE" : "ESTIMATE BILL"}
                    </div>
                  </div>

                  <div className="py-2 text-[10px] space-y-0.5 border-b border-black">
                    <div className="flex justify-between">
                      <span>Invoice:</span>
                      <span className="font-bold">{completedReceipt.invoiceNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{completedReceipt.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Party:</span>
                      <span className="font-bold">{completedReceipt.partyName}</span>
                    </div>
                    {completedReceipt.biltyNumber && (
                      <div className="flex justify-between text-[9px]">
                        <span>Bilty: {completedReceipt.biltyNumber}</span>
                        <span>({completedReceipt.freightTerms})</span>
                      </div>
                    )}
                  </div>

                  <table className="w-full my-2 text-[10px]">
                    <thead>
                      <tr className="border-b border-black text-left">
                        <th className="pb-1">Item</th>
                        <th className="pb-1 text-center">Qty</th>
                        <th className="pb-1 text-right">Rate</th>
                        <th className="pb-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {completedReceipt.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{it.productName}</td>
                          <td className="py-1 text-center">{it.qty}</td>
                          <td className="py-1 text-right">{it.rate}</td>
                          <td className="py-1 text-right font-bold">{it.lineTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="pt-2 border-t border-black space-y-1 text-right">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rs. {completedReceipt.totalAmount}</span>
                    </div>
                    {Number(completedReceipt.discountAmount) > 0 && (
                      <div className="flex justify-between text-zinc-700">
                        <span>Discount:</span>
                        <span>-Rs. {completedReceipt.discountAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold border-t border-black pt-1">
                      <span>NET PAYABLE:</span>
                      <span>Rs. {completedReceipt.netAmount}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setReceiptModalOpen(false)}>
                  Close
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Print Receipt (80mm)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
