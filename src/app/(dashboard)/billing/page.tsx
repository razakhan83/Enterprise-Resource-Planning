"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  usePosStore,
  PartyOption,
  ProductOption,
} from "@/store/posStore";
import {
  getPosInitialData,
  createSaleInvoice,
  voidSaleInvoice,
  getRecentInvoices,
} from "@/actions/billing";
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
import { ThermalReceipt } from "@/components/print/ThermalReceipt";
import { A4Invoice } from "@/components/print/A4Invoice";
import { PartyCreateDialog } from "@/components/parties/PartyCreateDialog";
import {
  Search,
  User,
  Truck,
  Trash2,
  Printer,
  FileText,
  Check,
  CreditCard,
  AlertCircle,
  UserPlus,
  Ban,
  Clock,
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
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active Line Entry Form State
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unitType, setUnitType] = useState<"PARENT" | "CHILD">("CHILD");
  const [qty, setQty] = useState<number>(1);
  const [rate, setRate] = useState<string>("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);

  // Modals
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfPaperSize, setPdfPaperSize] = useState<"A4" | "A5">("A4");
  const [isQuickPartyOpen, setIsQuickPartyOpen] = useState(false);

  // Void Invoice Dialog State
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedInvoiceToVoid, setSelectedInvoiceToVoid] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  // Focus Refs for Fast Keyboard Entry
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial data from DB
  const loadInitialData = async () => {
    const data = await getPosInitialData();
    if (data.products) setProducts(data.products);
    if (data.parties) setParties(data.parties);
    if (data.settings) setStoreSettings(data.settings);
    if (data.recentInvoices) setRecentInvoices(data.recentInvoices);
  };

  useEffect(() => {
    loadInitialData();
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

    // Auto-fill Rate input from product.defaultSaleRate (multiplied if Parent unit)
    const baseRate = Number(product.defaultSaleRate || 0);
    const calculated =
      unitType === "PARENT"
        ? (baseRate * (product.conversionRate || 1)).toFixed(2)
        : baseRate.toFixed(2);
    setRate(calculated);

    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  };

  const handleUnitToggle = (newUnit: "PARENT" | "CHILD") => {
    setUnitType(newUnit);
    if (selectedProduct) {
      const baseRate = Number(selectedProduct.defaultSaleRate || 0);
      const calculated =
        newUnit === "PARENT"
          ? (baseRate * (selectedProduct.conversionRate || 1)).toFixed(2)
          : baseRate.toFixed(2);
      setRate(calculated);
    }
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

    // Reset entry line and return focus to item search
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

  // Global POS Hotkeys (Ctrl+Enter for Thermal, Ctrl+P for PDF)
  useEffect(() => {
    const handleGlobalPosKeys = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleCommitCheckout("THERMAL");
      } else if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        handleCommitCheckout("PDF");
      }
    };
    window.addEventListener("keydown", handleGlobalPosKeys);
    return () => window.removeEventListener("keydown", handleGlobalPosKeys);
  }, [cart, selectedParty, discountAmount, isPakkaBill, biltyNumber, transporterName, freightTerms]);

  const handleCommitCheckout = async (targetFormat: "THERMAL" | "PDF") => {
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
        partyPhone: selectedParty?.phone,
        partyAddress: selectedParty?.address,
        previousBalance: selectedParty?.currentBalance || "0.00",
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
      clearCart();
      loadInitialData(); // Refresh stock & recent list

      if (targetFormat === "THERMAL") {
        setReceiptModalOpen(true);
      } else {
        setIsPdfModalOpen(true);
      }
    } else {
      setStatusMessage({ type: "error", text: result.error || "Failed to commit invoice." });
    }
  };

  const handleExecuteVoid = async () => {
    if (!selectedInvoiceToVoid) return;
    setIsVoiding(true);

    const res = await voidSaleInvoice(selectedInvoiceToVoid.id, voidReason);
    setIsVoiding(false);

    if (res.success) {
      setVoidDialogOpen(false);
      setSelectedInvoiceToVoid(null);
      setVoidReason("");
      setStatusMessage({ type: "success", text: `Invoice ${res.invoiceNo} successfully voided and reversed.` });
      loadInitialData();
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to void invoice" });
    }
  };

  const grossTotal = getGrossTotal();
  const netPayable = getNetPayable();

  return (
    <div className="flex flex-col h-full gap-3 select-none">
      {/* Top Notification Status Bar */}
      {statusMessage && (
        <div
          className={`px-3 py-2 text-xs font-medium rounded flex items-center justify-between transition-all ${
            statusMessage.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs hover:opacity-75 font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* MAIN TWO-COLUMN SPLIT */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* LEFT COLUMN: ACTIVE ENTRY & CART ITEMS (8 COLS) */}
        <div className="col-span-8 flex flex-col gap-3 h-full min-h-0">
          {/* 1. FAST TABULAR ENTRY BAR */}
          <Card className="border-zinc-200 shadow-xs shrink-0">
            <CardContent className="p-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                {/* Product Search & Autocomplete (Col 5) */}
                <div className="col-span-5 relative">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">
                    Product Search [Type or ArrowDown]
                  </span>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                      ref={itemInputRef}
                      type="text"
                      placeholder="Scan SKU or item name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setProductDropdownOpen(true);
                      }}
                      onFocus={() => setProductDropdownOpen(true)}
                      onKeyDown={handleItemKeyDown}
                      className="pl-8 h-8 text-xs font-medium"
                      autoFocus
                    />
                  </div>

                  {/* Dropdown Options List */}
                  {productDropdownOpen && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      {filteredProducts.map((p, idx) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className={`px-3 py-1.5 text-xs flex justify-between items-center cursor-pointer ${
                            idx === dropdownIndex
                              ? "bg-zinc-100 text-zinc-950 font-semibold"
                              : "hover:bg-zinc-50 text-zinc-700"
                          }`}
                        >
                          <div>
                            <span className="font-mono text-zinc-400 text-[10px] mr-1.5">
                              {p.sku || "NO-SKU"}
                            </span>
                            <span>{p.name}</span>
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500">
                            {p.stockChildUnits} {p.childUnit}s | Rs. {p.defaultSaleRate}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unit Type Selector: Child vs Parent (Col 2) */}
                <div className="col-span-2">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">Unit</span>
                  <div className="flex border border-zinc-200 rounded h-8 overflow-hidden bg-zinc-50">
                    <button
                      type="button"
                      onClick={() => handleUnitToggle("CHILD")}
                      className={`flex-1 text-[11px] font-semibold transition-colors ${
                        unitType === "CHILD"
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {selectedProduct ? selectedProduct.childUnit : "Piece"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitToggle("PARENT")}
                      className={`flex-1 text-[11px] font-semibold transition-colors ${
                        unitType === "PARENT"
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {selectedProduct ? selectedProduct.parentUnit : "Carton"}
                    </button>
                  </div>
                </div>

                {/* Quantity Input (Col 2) */}
                <div className="col-span-2">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">Qty</span>
                  <Input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rateInputRef.current?.focus();
                        rateInputRef.current?.select();
                      }
                    }}
                    className="h-8 text-xs font-mono text-center font-semibold"
                  />
                </div>

                {/* Rate Input (Col 2) */}
                <div className="col-span-2">
                  <span className="text-[10px] text-zinc-500 font-medium block mb-0.5">Rate (Rs.)</span>
                  <Input
                    ref={rateInputRef}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCommitActiveLine();
                      }
                    }}
                    className="h-8 text-xs font-mono text-right font-semibold"
                  />
                </div>

                {/* Add Line Button (Col 1) */}
                <div className="col-span-1 pt-3">
                  <Button
                    type="button"
                    onClick={handleCommitActiveLine}
                    className="w-full h-8 px-0 text-xs bg-zinc-900 text-white font-bold"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. CART LINE ITEMS TABLE */}
          <Card className="border-zinc-200 shadow-xs flex-1 flex flex-col overflow-hidden min-h-0">
            <CardHeader className="py-2.5 px-4 border-b border-zinc-100 flex flex-row items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-xs font-semibold text-zinc-900">
                  Cart Items
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {cart.length} Lines
                </Badge>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="h-6 text-[10px] text-red-600 hover:bg-red-50 px-2"
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Clear Cart
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-center">#</TableHead>
                    <TableHead>Item Description</TableHead>
                    <TableHead className="w-20 text-center">Unit</TableHead>
                    <TableHead className="w-24 text-center">Qty</TableHead>
                    <TableHead className="w-28 text-right">Rate</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center text-zinc-400 text-xs">
                        No items added to cart. Search and press Enter to add items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center font-mono text-[11px] text-zinc-400">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-zinc-900">
                          {item.productName}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {item.unitType === "PARENT" ? item.parentUnit : item.childUnit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) =>
                              updateCartItemQty(item.id, parseInt(e.target.value) || 1)
                            }
                            className="w-16 h-6 text-center font-mono text-xs border border-zinc-200 rounded"
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
                            className="text-zinc-400 hover:text-red-600 p-1 transition-colors"
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

          {/* 3. RECENT INVOICES & VOID ACTION STRIP */}
          <div className="bg-white border border-zinc-200 rounded p-2.5 shrink-0 max-h-36 overflow-y-auto">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 text-xs">
              <div className="flex items-center space-x-1.5 font-semibold text-zinc-900">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                <span>Recent Counter Invoices</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Real-time DB Sync</span>
            </div>
            <div className="divide-y divide-zinc-100 text-xs">
              {recentInvoices.length === 0 ? (
                <div className="text-zinc-400 text-center py-2 text-[11px]">No recent sales invoices.</div>
              ) : (
                recentInvoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="py-1 flex items-center justify-between text-[11px]">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-zinc-900">{inv.invoiceNo}</span>
                      <span className="text-zinc-600">{inv.partyName || "Cash Customer"}</span>
                      {inv.isVoided ? (
                        <Badge variant="destructive" className="text-[9px] py-0 px-1">
                          VOIDED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                          {inv.isPakkaBill ? "TAX" : "EST"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono font-semibold text-zinc-900">
                        {formatCurrency(inv.netAmount)}
                      </span>
                      {!inv.isVoided && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoiceToVoid(inv);
                            setVoidDialogOpen(true);
                          }}
                          className="h-5 px-1.5 text-[10px] text-red-600 hover:bg-red-50"
                        >
                          <Ban className="h-3 w-3 mr-0.5" /> Void
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: FINANCIAL SETTLEMENT & CHECKOUT CONTROLS (4 COLS) */}
        <div className="col-span-4 flex flex-col gap-3 h-full min-h-0">
          <Card className="border-zinc-200 shadow-xs flex-1 flex flex-col justify-between overflow-hidden">
            <div>
              <CardHeader className="py-3 px-4 border-b border-zinc-100">
                <CardTitle className="text-xs font-semibold text-zinc-900 flex justify-between items-center">
                  <span>Settlement & Checkout</span>
                  <Badge
                    variant={isPakkaBill ? "default" : "outline"}
                    onClick={togglePakkaBill}
                    className="cursor-pointer text-[10px] font-mono tracking-wider transition-all"
                  >
                    {isPakkaBill ? "TAX INVOICE (PAKKA)" : "ESTIMATE (KACHA)"}
                  </Badge>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Selected Party Display / Trigger */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-zinc-700 font-medium">Billed To / Party</span>
                    <button
                      type="button"
                      onClick={() => setPartyModalOpen(true)}
                      className="text-[11px] text-zinc-900 font-semibold hover:underline flex items-center"
                    >
                      <User className="h-3 w-3 mr-1" />
                      <span>Change [F3]</span>
                    </button>
                  </div>
                  <div
                    onClick={() => setPartyModalOpen(true)}
                    className="p-2.5 border border-zinc-200 rounded-md bg-zinc-50/70 hover:bg-zinc-100/70 cursor-pointer transition-colors flex justify-between items-center"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-900 truncate max-w-[180px]">
                        {selectedParty ? selectedParty.name : "Cash-in-Hand Customer"}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {selectedParty ? `${selectedParty.type} Account` : "Direct Counter Sale"}
                      </div>
                    </div>
                    {selectedParty && (
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-zinc-900">
                          {formatCurrency(selectedParty.currentBalance)}
                        </div>
                        <div className="text-[9px] text-zinc-400">Previous Bal</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Logistics / Transport Booking Trigger */}
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-700 font-medium">Logistics & Bilty</span>
                    <button
                      type="button"
                      onClick={() => setBiltyModalOpen(true)}
                      className="text-[11px] text-zinc-600 hover:text-zinc-900 flex items-center font-medium"
                    >
                      <Truck className="h-3 w-3 mr-1" />
                      <span>{biltyNumber ? "Edit Bilty" : "Add Bilty"}</span>
                    </button>
                  </div>
                  {biltyNumber && (
                    <div className="mt-1.5 p-2 bg-zinc-50 border border-zinc-200 rounded text-[10px] flex justify-between font-mono">
                      <span>Bilty: {biltyNumber} ({freightTerms})</span>
                      <span>{transporterName || "Carrier"}</span>
                    </div>
                  )}
                </div>

                {/* Gross Goods Total */}
                <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600">Goods Subtotal:</span>
                    <span className="font-mono font-semibold text-zinc-900">
                      {formatCurrency(grossTotal)}
                    </span>
                  </div>

                  {/* Kasr / Discount Input */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-600">Discount / Kasr:</span>
                    <div className="w-28">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        className="h-7 text-xs font-mono text-right font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Net Payable Final Big Block */}
                <div className="border-t-2 border-zinc-900 pt-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold uppercase text-zinc-700">Net Payable:</span>
                    <span className="font-mono text-2xl font-black tracking-tight text-zinc-950">
                      {formatCurrency(netPayable)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </div>

            {/* DUAL CHECKOUT PRINT BUTTONS */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 space-y-2">
              {/* Button 1: Thermal Slip [Ctrl + Enter] */}
              <Button
                type="button"
                onClick={() => handleCommitCheckout("THERMAL")}
                disabled={isSubmitting || cart.length === 0}
                className="w-full h-10 font-bold text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-xs flex items-center justify-between px-3"
              >
                <div className="flex items-center space-x-1.5">
                  <Printer className="h-4 w-4" />
                  <span>Thermal Slip</span>
                </div>
                <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                  Ctrl + Enter
                </span>
              </Button>

              {/* Button 2: PDF Invoice [Ctrl + P] */}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCommitCheckout("PDF")}
                disabled={isSubmitting || cart.length === 0}
                className="w-full h-10 font-bold text-xs border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-900 shadow-xs flex items-center justify-between px-3"
              >
                <div className="flex items-center space-x-1.5">
                  <FileText className="h-4 w-4 text-zinc-700" />
                  <span>A4/A5 PDF Invoice</span>
                </div>
                <span className="text-[10px] font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-300 text-zinc-600">
                  Ctrl + P
                </span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* DIALOG 1: PARTY SELECTOR (F3) */}
      <Dialog open={isPartyModalOpen} onOpenChange={setPartyModalOpen}>
        <DialogContent className="max-w-md bg-white p-5">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-bold">Select Customer Account</DialogTitle>
            <Button
              size="sm"
              onClick={() => setIsQuickPartyOpen(true)}
              className="h-7 text-xs bg-zinc-900 text-white font-medium flex items-center"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              <span>Quick Add [F3]</span>
            </Button>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Walk-in Cash option */}
            <div
              onClick={() => {
                setParty(null);
                setPartyModalOpen(false);
              }}
              className="p-2.5 border border-zinc-200 rounded hover:bg-zinc-50 cursor-pointer text-xs flex justify-between items-center"
            >
              <div>
                <div className="font-bold text-zinc-900">Cash-in-Hand Customer</div>
                <div className="text-[10px] text-zinc-500">Walk-in counter sale</div>
              </div>
              <Badge variant="outline" className="text-[10px]">Default</Badge>
            </div>

            {/* Registered Parties list */}
            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded">
              {parties.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setParty(p);
                    setPartyModalOpen(false);
                  }}
                  className="p-2.5 hover:bg-zinc-50 cursor-pointer text-xs flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold text-zinc-900">{p.name}</div>
                    <div className="text-[10px] text-zinc-500">{p.phone || p.address || "Registry"}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-zinc-900">{formatCurrency(p.currentBalance)}</div>
                    <div className="text-[9px] text-zinc-400">Balance</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD PARTY DIALOG */}
      <PartyCreateDialog
        open={isQuickPartyOpen}
        onOpenChange={setIsQuickPartyOpen}
        onSuccess={(newParty) => {
          setParties((prev) => [newParty, ...prev]);
          setParty(newParty);
          setPartyModalOpen(false);
        }}
      />

      {/* DIALOG 2: BILTY / LOGISTICS MODAL */}
      <Dialog open={isBiltyModalOpen} onOpenChange={setBiltyModalOpen}>
        <DialogContent className="max-w-sm bg-white p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Transport & Logistics</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="text-zinc-700 block mb-1 font-medium">Bilty / GR Number</label>
              <Input
                value={biltyNumber}
                onChange={(e) =>
                  setBiltyDetails({ biltyNumber: e.target.value, transporterName, freightTerms })
                }
                placeholder="e.g. BLT-98214"
                className="h-8 font-mono"
              />
            </div>
            <div>
              <label className="text-zinc-700 block mb-1 font-medium">Carrier / Transporter</label>
              <Input
                value={transporterName}
                onChange={(e) =>
                  setBiltyDetails({ biltyNumber, transporterName: e.target.value, freightTerms })
                }
                placeholder="e.g. Faisal Goods Carrier"
                className="h-8"
              />
            </div>
            <div>
              <label className="text-zinc-700 block mb-1 font-medium">Freight Payment Terms</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={freightTerms === "PAID" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setBiltyDetails({ biltyNumber, transporterName, freightTerms: "PAID" })
                  }
                  className="h-8 text-xs"
                >
                  PAID
                </Button>
                <Button
                  type="button"
                  variant={freightTerms === "TO-PAY" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setBiltyDetails({ biltyNumber, transporterName, freightTerms: "TO-PAY" })
                  }
                  className="h-8 text-xs"
                >
                  TO-PAY
                </Button>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={() => setBiltyModalOpen(false)} className="h-8 text-xs">
                Save Logistics
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: THERMAL RECEIPT MODAL */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-w-md bg-white p-4">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold font-mono">
              Thermal Print Preview [{completedReceipt?.invoiceNo}]
            </DialogTitle>
          </DialogHeader>

          {completedReceipt && (
            <div className="space-y-3">
              <div className="flex justify-center p-3 bg-zinc-50 border border-zinc-200 rounded max-h-[70vh] overflow-y-auto">
                <ThermalReceipt
                  invoiceNo={completedReceipt.invoiceNo}
                  isPakkaBill={completedReceipt.isPakkaBill}
                  date={completedReceipt.date}
                  partyName={completedReceipt.partyName}
                  previousBalance={completedReceipt.previousBalance}
                  items={completedReceipt.items}
                  totalAmount={completedReceipt.totalAmount}
                  discountAmount={completedReceipt.discountAmount}
                  netAmount={completedReceipt.netAmount}
                  biltyNumber={completedReceipt.biltyNumber}
                  transporterName={completedReceipt.transporterName}
                  freightTerms={completedReceipt.freightTerms}
                  settings={storeSettings}
                  paperWidth={storeSettings?.thermalPaperWidth || "80mm"}
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="sm" onClick={() => setReceiptModalOpen(false)}>
                  Close
                </Button>
                <Button size="sm" onClick={() => window.print()} className="bg-zinc-900 text-white">
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Print Thermal Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: PROFESSIONAL A4/A5 PDF INVOICE MODAL */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-white p-4 overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-2">
            <div className="flex items-center space-x-3">
              <DialogTitle className="text-sm font-bold">
                Tax / Commercial Invoice: {completedReceipt?.invoiceNo}
              </DialogTitle>
              <div className="flex border border-zinc-200 rounded p-0.5 bg-zinc-100 text-xs">
                <button
                  type="button"
                  onClick={() => setPdfPaperSize("A4")}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    pdfPaperSize === "A4" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600"
                  }`}
                >
                  A4 Standard
                </button>
                <button
                  type="button"
                  onClick={() => setPdfPaperSize("A5")}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    pdfPaperSize === "A5" ? "bg-white text-zinc-950 shadow-2xs" : "text-zinc-600"
                  }`}
                >
                  A5 Compact
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button size="sm" onClick={() => window.print()} className="h-8 text-xs bg-zinc-900 text-white">
                <Printer className="h-3.5 w-3.5 mr-1" />
                Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          {completedReceipt && (
            <div className="py-2">
              <A4Invoice
                paperSize={pdfPaperSize}
                invoiceNo={completedReceipt.invoiceNo}
                isPakkaBill={completedReceipt.isPakkaBill}
                date={completedReceipt.date}
                partyName={completedReceipt.partyName}
                partyPhone={completedReceipt.partyPhone}
                partyAddress={completedReceipt.partyAddress}
                previousBalance={completedReceipt.previousBalance}
                items={completedReceipt.items}
                totalAmount={completedReceipt.totalAmount}
                discountAmount={completedReceipt.discountAmount}
                netAmount={completedReceipt.netAmount}
                biltyNumber={completedReceipt.biltyNumber}
                transporterName={completedReceipt.transporterName}
                freightTerms={completedReceipt.freightTerms}
                settings={storeSettings}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: VOID INVOICE CONFIRMATION */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent className="max-w-sm bg-white p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-red-600 flex items-center">
              <Ban className="h-4 w-4 mr-1.5" />
              Void Invoice {selectedInvoiceToVoid?.invoiceNo}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs pt-2">
            <p className="text-zinc-600">
              Are you sure you want to void this invoice? All deducted stock will be returned to batches
              using atomic row locking, and reversal journal entries will be posted.
            </p>

            <div>
              <label className="text-zinc-700 block mb-1 font-medium">Void Reason / Return Note</label>
              <Input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer returned goods / billing error"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVoidDialogOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isVoiding}
                onClick={handleExecuteVoid}
                className="h-8 text-xs bg-red-600 text-white hover:bg-red-700"
              >
                {isVoiding ? "Voiding..." : "Confirm Void & Restore Stock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
