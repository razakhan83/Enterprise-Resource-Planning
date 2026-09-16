"use client";

import React, { useState, useEffect } from "react";
import {
  getInvoicesList,
  getInvoiceDetails,
  updateInvoiceAdminNotes,
  settleInvoicePayment,
  processSalesReturn,
  addInInvoiceBarterAdjustment,
  InvoiceFilters,
} from "@/actions/invoices";
import { getStoreSettings } from "@/actions/settings";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCombobox } from "@/components/inventory/ProductCombobox";
import { A4Invoice } from "@/components/print/A4Invoice";
import { ThermalReceipt } from "@/components/print/ThermalReceipt";
import {
  FileText,
  Search,
  CreditCard,
  RotateCcw,
  Repeat,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Layers,
  DollarSign,
  TrendingDown,
  Printer,
  X,
  User,
  Truck,
  Eye,
} from "lucide-react";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalCount: 0,
    totalInvoiced: "0.00",
    totalCollected: "0.00",
    totalDue: "0.00",
  });
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("ALL");
  const [billType, setBillType] = useState<"ALL" | "PAKKA" | "ESTIMATE">("ALL");
  const [paymentStatus, setPaymentStatus] = useState<"ALL" | "PAID" | "PARTIAL" | "UNPAID">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Audit Detail Modal State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "payment" | "return" | "barter" | "notes">("items");

  // Print Preview Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printPaperFormat, setPrintPaperFormat] = useState<"A4" | "A5" | "80mm">("A4");
  const [printInvoiceData, setPrintInvoiceData] = useState<any | null>(null);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  // Sub-actions states inside modal
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK">("CASH");
  const [payBankId, setPayBankId] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Return form state
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState("");

  // Barter form state
  const [barterProductId, setBarterProductId] = useState<string | null>(null);
  const [barterWarehouseId, setBarterWarehouseId] = useState("");
  const [barterUnitType, setBarterUnitType] = useState<"PARENT" | "CHILD">("CHILD");
  const [barterQty, setBarterQty] = useState(1);
  const [barterAgreedValue, setBarterAgreedValue] = useState("");
  const [barterReason, setBarterReason] = useState("");

  // Admin note state
  const [newAdminNote, setNewAdminNote] = useState("");

  const loadInvoices = async () => {
    setLoading(true);
    const [res, settings] = await Promise.all([
      getInvoicesList({
        search,
        partyId: selectedPartyId,
        billType,
        paymentStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
      getStoreSettings(),
    ]);

    if (res.success) {
      setInvoices(res.invoices || []);
      setSummary(res.summary);
    }
    if (settings) {
      setStoreSettings(settings);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInvoices();
  }, [selectedPartyId, billType, paymentStatus, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInvoices();
  };

  const handleOpenDetails = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDetailsLoading(true);
    setStatusMsg(null);
    setActiveTab("items");

    const res = await getInvoiceDetails(invoiceId);
    if (res.success && res.invoice) {
      setInvoiceDetails(res);
      setPayAmount(res.invoice.balanceDue);
      if (res.banks && res.banks[0]) setPayBankId(res.banks[0].id);
      if (res.warehouses && res.warehouses[0]) setBarterWarehouseId(res.warehouses[0].id);
    }
    setDetailsLoading(false);
  };

  const refreshDetails = async () => {
    if (!selectedInvoiceId) return;
    const res = await getInvoiceDetails(selectedInvoiceId);
    if (res.success && res.invoice) {
      setInvoiceDetails(res);
      setPayAmount(res.invoice.balanceDue);
    }
    loadInvoices();
  };

  // Open Print preview directly for an invoice
  const handleOpenPrintPreview = async (invOrId: any) => {
    setIsPrintLoading(true);
    setIsPrintModalOpen(true);

    if (typeof invOrId === "string" || !invOrId.items) {
      const id = typeof invOrId === "string" ? invOrId : invOrId.id;
      const res = await getInvoiceDetails(id);
      if (res.success && res.invoice) {
        setPrintInvoiceData(res);
      }
    } else {
      setPrintInvoiceData(invOrId);
    }
    setIsPrintLoading(false);
  };

  // Payment Settlement
  const handleSettlePayment = async () => {
    if (!selectedInvoiceId || !payAmount || Number(payAmount) <= 0) {
      setStatusMsg({ type: "error", text: "Please enter a valid payment amount." });
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    const res = await settleInvoicePayment({
      invoiceId: selectedInvoiceId,
      amount: payAmount,
      paymentMethod: payMethod,
      bankAccountId: payMethod === "BANK" ? payBankId : undefined,
      referenceNo: payRef,
      notes: payNotes,
    });

    setSubmitting(false);

    if (res.success) {
      setStatusMsg({ type: "success", text: (res as any).message || "Payment settled successfully." });
      setPayRef("");
      setPayNotes("");
      refreshDetails();
    } else {
      setStatusMsg({ type: "error", text: (res as any).error || "Failed to settle payment." });
    }
  };

  // Sales Return
  const handleProcessReturn = async () => {
    if (!selectedInvoiceId) return;

    const itemsToReturn = Object.entries(returnQtys)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ salesItemId: itemId, returnQtyChildUnits: qty }));

    if (itemsToReturn.length === 0) {
      setStatusMsg({ type: "error", text: "Please specify at least 1 unit to return." });
      return;
    }

    if (!returnReason.trim()) {
      setStatusMsg({ type: "error", text: "Return reason is required for the audit trail." });
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    const res = await processSalesReturn({
      invoiceId: selectedInvoiceId,
      returnItems: itemsToReturn,
      reason: returnReason,
    });

    setSubmitting(false);

    if (res.success) {
      setStatusMsg({ type: "success", text: (res as any).message || "Sales return processed successfully." });
      setReturnQtys({});
      setReturnReason("");
      refreshDetails();
    } else {
      setStatusMsg({ type: "error", text: (res as any).error || "Failed to process sales return." });
    }
  };

  // Barter / Exchange Adjustment
  const handleAddBarter = async () => {
    if (!selectedInvoiceId || !barterProductId || !barterWarehouseId || Number(barterAgreedValue) <= 0) {
      setStatusMsg({ type: "error", text: "Please select an exchange product, warehouse, and agreed value." });
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    const res = await addInInvoiceBarterAdjustment({
      invoiceId: selectedInvoiceId,
      productId: barterProductId,
      warehouseId: barterWarehouseId,
      unitType: barterUnitType,
      qty: barterQty,
      agreedValue: barterAgreedValue,
      reason: barterReason,
    });

    setSubmitting(false);

    if (res.success) {
      setStatusMsg({ type: "success", text: (res as any).message || "Barter adjustment recorded." });
      setBarterAgreedValue("");
      setBarterReason("");
      refreshDetails();
    } else {
      setStatusMsg({ type: "error", text: (res as any).error || "Failed to add barter adjustment." });
    }
  };

  // Add Admin Note
  const handleAddNote = async () => {
    if (!selectedInvoiceId || !newAdminNote.trim()) return;

    setSubmitting(true);
    setStatusMsg(null);

    const res = await updateInvoiceAdminNotes(selectedInvoiceId, newAdminNote);
    setSubmitting(false);

    if (res.success) {
      setStatusMsg({ type: "success", text: "Admin note logged." });
      setNewAdminNote("");
      refreshDetails();
    } else {
      setStatusMsg({ type: "error", text: res.error || "Failed to add note." });
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto select-none">
      {/* 1. TOP SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-zinc-200 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Total Invoices</span>
              <span className="text-xl font-bold font-mono text-zinc-900">{summary.totalCount}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
              <FileText className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Total Invoiced</span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {formatCurrency(summary.totalInvoiced)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-700">
              <Layers className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Total Recovered</span>
              <span className="text-xl font-bold font-mono text-emerald-700">
                {formatCurrency(summary.totalCollected)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Balance Outstanding</span>
              <span className="text-xl font-bold font-mono text-amber-700">
                {formatCurrency(summary.totalDue)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-700">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. FILTER & SEARCH BAR */}
      <Card className="border-zinc-200 shadow-xs">
        <CardContent className="p-3">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-12 gap-2.5 items-center">
            {/* Search Input */}
            <div className="col-span-3 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search Invoice #, Party, Bilty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-7 h-8 text-xs font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setTimeout(loadInvoices, 50);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Bill Type Filter */}
            <div className="col-span-2">
              <Select value={billType} onValueChange={(v: any) => setBillType(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Bill Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Bill Types</SelectItem>
                  <SelectItem value="PAKKA">Tax Invoice</SelectItem>
                  <SelectItem value="ESTIMATE">Estimate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status Filter */}
            <div className="col-span-2">
              <Select value={paymentStatus} onValueChange={(v: any) => setPaymentStatus(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Payment Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PAID">Fully Paid</SelectItem>
                  <SelectItem value="PARTIAL">Partially Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid Due</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="col-span-3 flex items-center space-x-1.5">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-[11px]"
                title="Start Date"
              />
              <span className="text-zinc-400 text-xs">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-[11px]"
                title="End Date"
              />
            </div>

            {/* Action Buttons */}
            <div className="col-span-2 flex space-x-1.5">
              <Button type="submit" size="sm" className="h-8 flex-1 text-xs bg-zinc-900 text-white font-medium">
                Filter
              </Button>
              {(search || selectedPartyId !== "ALL" || billType !== "ALL" || paymentStatus !== "ALL" || startDate || endDate) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setSelectedPartyId("ALL");
                    setBillType("ALL");
                    setPaymentStatus("ALL");
                    setStartDate("");
                    setEndDate("");
                    setTimeout(loadInvoices, 50);
                  }}
                  className="h-8 px-2 text-xs text-zinc-600"
                >
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 3. DENSE INVOICES REGISTRY TABLE */}
      <Card className="border-zinc-200 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="py-2.5 px-4 border-b border-zinc-100 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-xs font-semibold text-zinc-900">
              Invoice Registry
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              {invoices.length} Invoices
            </Badge>
          </div>
          <span className="text-[11px] text-zinc-400">Click row or actions to view details, edit, or print PDF</span>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/70 hover:bg-zinc-50/70">
                <TableHead className="w-28 font-semibold text-xs">Invoice No</TableHead>
                <TableHead className="w-36 font-semibold text-xs">Date & Time</TableHead>
                <TableHead className="font-semibold text-xs">Customer / Party</TableHead>
                <TableHead className="w-24 text-center font-semibold text-xs">Type</TableHead>
                <TableHead className="w-28 text-right font-semibold text-xs">Net Amount</TableHead>
                <TableHead className="w-28 text-right font-semibold text-xs">Paid</TableHead>
                <TableHead className="w-28 text-right font-semibold text-xs">Balance Due</TableHead>
                <TableHead className="w-24 text-center font-semibold text-xs">Status</TableHead>
                <TableHead className="w-36 text-center font-semibold text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-xs text-zinc-400">
                    Loading invoice registry...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-xs text-zinc-400">
                    No invoices match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => {
                  const isPaid = Number(inv.balanceDue) <= 0;
                  const isPartial = Number(inv.paidAmount) > 0 && Number(inv.balanceDue) > 0;

                  return (
                    <TableRow
                      key={inv.id}
                      onClick={() => handleOpenDetails(inv.id)}
                      className="cursor-pointer hover:bg-zinc-50/80 transition-colors text-xs"
                    >
                      <TableCell className="font-mono font-bold text-zinc-950">
                        {inv.invoiceNo}
                      </TableCell>
                      <TableCell className="text-zinc-500 font-mono text-[11px]">
                        {formatDate(inv.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-zinc-900">{inv.partyName}</div>
                        {inv.partyPhone && (
                          <div className="text-[10px] text-zinc-400 font-mono">{inv.partyPhone}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={inv.isPakkaBill ? "default" : "outline"}
                          className="text-[9px] font-mono"
                        >
                          {inv.isPakkaBill ? "TAX" : "EST"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs text-zinc-900">
                        {formatCurrency(inv.netAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-700 font-semibold">
                        {formatCurrency(inv.paidAmount)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-xs font-bold ${
                          isPaid ? "text-zinc-400" : isPartial ? "text-amber-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(inv.balanceDue)}
                      </TableCell>
                      <TableCell className="text-center">
                        {inv.isVoided ? (
                          <Badge variant="destructive" className="text-[9px]">VOIDED</Badge>
                        ) : isPaid ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-medium">
                            PAID
                          </Badge>
                        ) : isPartial ? (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-medium">
                            PARTIAL
                          </Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] font-medium">
                            UNPAID
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDetails(inv.id)}
                            className="h-6 text-[11px] px-2 text-zinc-700 hover:text-zinc-950"
                            title="Audit & Edit Invoice"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Audit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPrintPreview(inv.id)}
                            className="h-6 text-[11px] px-2 text-zinc-700 hover:text-zinc-950"
                            title="Print / Export PDF"
                          >
                            <Printer className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4. CONTROLLED AUDIT & EDIT MODAL */}
      <Dialog
        open={Boolean(selectedInvoiceId)}
        onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
      >
        <DialogContent className="max-w-4xl bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col">
          {detailsLoading || !invoiceDetails ? (
            <div className="py-20 text-center text-xs text-zinc-400">Loading invoice audit trail...</div>
          ) : (
            <>
              {/* MODAL HEADER: SAFE PADDING FROM (X) CLOSE BUTTON */}
              <DialogHeader className="border-b border-zinc-100 pb-3 shrink-0 pr-12">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <DialogTitle className="text-lg font-bold font-mono text-zinc-950">
                        {invoiceDetails.invoice.invoiceNo}
                      </DialogTitle>
                      <Badge
                        variant={invoiceDetails.invoice.isPakkaBill ? "default" : "outline"}
                        className="text-[10px] font-mono tracking-wider"
                      >
                        {invoiceDetails.invoice.isPakkaBill ? "TAX INVOICE" : "ESTIMATE"}
                      </Badge>
                      {invoiceDetails.invoice.isVoided && (
                        <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 flex items-center space-x-2">
                      <span>Billed to: <strong className="text-zinc-900 font-semibold">{invoiceDetails.invoice.partyName}</strong></span>
                      <span className="text-zinc-300">•</span>
                      <span>Date: <strong className="text-zinc-900 font-mono">{formatDate(invoiceDetails.invoice.createdAt)}</strong></span>
                    </div>
                  </div>

                  {/* Financial Quick Badge + Print Action */}
                  <div className="flex items-center space-x-3">
                    <div className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-md text-right font-mono">
                      <div className="text-xs font-bold text-zinc-900">
                        Net: {formatCurrency(invoiceDetails.invoice.netAmount)}
                      </div>
                      <div className={`text-[11px] font-semibold ${
                        Number(invoiceDetails.invoice.balanceDue) > 0 ? "text-amber-700" : "text-emerald-700"
                      }`}>
                        Due: {formatCurrency(invoiceDetails.invoice.balanceDue)}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenPrintPreview(invoiceDetails)}
                      className="h-8 text-xs font-medium border-zinc-300 text-zinc-800 hover:bg-zinc-50"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1 text-zinc-600" />
                      Print / PDF
                    </Button>
                  </div>
                </div>

                {/* Sub-nav Tab Strip (Pill Segmented Navigation) */}
                <div className="flex items-center space-x-1.5 pt-3 border-t border-zinc-100 mt-3 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab("items")}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeTab === "items"
                        ? "bg-zinc-900 text-white font-semibold shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Line Items & Batches ({invoiceDetails.items.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("payment")}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeTab === "payment"
                        ? "bg-zinc-900 text-white font-semibold shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Settlement</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("return")}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeTab === "return"
                        ? "bg-zinc-900 text-white font-semibold shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                    }`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Sales Return</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("barter")}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeTab === "barter"
                        ? "bg-zinc-900 text-white font-semibold shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                    }`}
                  >
                    <Repeat className="h-3.5 w-3.5" />
                    <span>Goods Exchange (Contra)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("notes")}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeTab === "notes"
                        ? "bg-zinc-900 text-white font-semibold shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Audit Notes</span>
                  </button>
                </div>
              </DialogHeader>

              {/* MODAL BODY */}
              <div className="flex-1 overflow-y-auto pt-3">
                {statusMsg && (
                  <div
                    className={`mb-3 p-2.5 text-xs rounded flex items-center justify-between ${
                      statusMsg.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      {statusMsg.type === "error" ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>{statusMsg.text}</span>
                    </div>
                    <button onClick={() => setStatusMsg(null)} className="text-xs hover:opacity-75">✕</button>
                  </div>
                )}

                {/* TAB 1: LINE ITEMS & BATCH BREAKDOWN */}
                {activeTab === "items" && (
                  <div className="space-y-4">
                    <div className="border border-zinc-200 rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-50/70 text-xs">
                            <TableHead className="w-10 text-center">#</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="w-32">Lot / Batch #</TableHead>
                            <TableHead className="w-20 text-center">Unit</TableHead>
                            <TableHead className="w-24 text-center">Qty</TableHead>
                            <TableHead className="w-28 text-right">Cost</TableHead>
                            <TableHead className="w-28 text-right">Sale Rate</TableHead>
                            <TableHead className="w-28 text-right">Line Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoiceDetails.items.map((it: any, idx: number) => {
                            const lineTotal = (Number(it.saleRate) * (it.unitTypeSold === "PARENT" ? it.qtyConsumed / it.conversionRate : it.qtyConsumed)).toFixed(2);
                            return (
                              <TableRow key={it.id} className="text-xs">
                                <TableCell className="text-center font-mono text-zinc-400">{idx + 1}</TableCell>
                                <TableCell>
                                  <div className="font-semibold text-zinc-900">{it.productName}</div>
                                  {it.productSku && <div className="font-mono text-[10px] text-zinc-400">{it.productSku}</div>}
                                </TableCell>
                                <TableCell className="font-mono text-[11px] text-zinc-700">
                                  {it.batchNumber}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-[10px] py-0 px-1">
                                    {it.unitTypeSold === "PARENT" ? it.parentUnit : it.childUnit}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-mono font-semibold">
                                  {it.unitTypeSold === "PARENT"
                                    ? `${(it.qtyConsumed / (it.conversionRate || 1)).toFixed(0)} ${it.parentUnit}`
                                    : `${it.qtyConsumed} ${it.childUnit}`}
                                </TableCell>
                                <TableCell className="text-right font-mono text-zinc-500">
                                  {formatCurrency(it.costSnapshot)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-zinc-900">
                                  {formatCurrency(it.saleRate)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-zinc-950">
                                  {formatCurrency(lineTotal)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* STRUCTURED TWO-COLUMN FINANCIAL & LOGISTICS SUMMARY */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Logistics & Audit Info */}
                      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md space-y-2 text-xs">
                        <div className="font-semibold text-zinc-900 border-b border-zinc-200 pb-1 flex items-center space-x-1.5">
                          <Truck className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Dispatch & Logistics</span>
                        </div>
                        {invoiceDetails.invoice.biltyNumber ? (
                          <div className="space-y-1 font-mono text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Bilty Number:</span>
                              <span className="font-bold text-zinc-900">{invoiceDetails.invoice.biltyNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Transporter:</span>
                              <span>{invoiceDetails.invoice.transporterName || "Direct Carrier"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Freight Terms:</span>
                              <Badge variant="outline" className="text-[9px]">
                                {invoiceDetails.invoice.freightTerms || "TO_PAY"}
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="text-zinc-400 italic text-[11px]">
                            Direct counter collection / No freight bilty attached.
                          </div>
                        )}
                      </div>

                      {/* Right: Clean Financial Ledger Breakdown */}
                      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between text-zinc-600">
                          <span>Gross Goods Subtotal:</span>
                          <span className="font-semibold text-zinc-900">
                            {formatCurrency(invoiceDetails.invoice.totalAmount)}
                          </span>
                        </div>

                        {Number(invoiceDetails.invoice.discountAmount) > 0 && (
                          <div className="flex justify-between text-red-700">
                            <span>Discount / Kasr:</span>
                            <span className="font-semibold">
                              -{formatCurrency(invoiceDetails.invoice.discountAmount)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between text-zinc-950 font-bold border-t border-zinc-200 pt-1.5 text-sm">
                          <span>Net Payable:</span>
                          <span>{formatCurrency(invoiceDetails.invoice.netAmount)}</span>
                        </div>

                        <div className="flex justify-between text-emerald-700">
                          <span>Paid to Date:</span>
                          <span className="font-semibold">
                            {formatCurrency(invoiceDetails.invoice.paidAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between font-bold border-t border-zinc-300 pt-1 text-sm">
                          <span className="text-zinc-700">Balance Due:</span>
                          <span className={Number(invoiceDetails.invoice.balanceDue) > 0 ? "text-amber-700" : "text-zinc-400"}>
                            {formatCurrency(invoiceDetails.invoice.balanceDue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BILL-WISE PAYMENT SETTLEMENT */}
                {activeTab === "payment" && (
                  <div className="max-w-md mx-auto space-y-4 py-2">
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-md text-xs text-zinc-700">
                      <strong>Bill-wise Settlement:</strong> Settle outstanding balance for this specific invoice.
                      Updates the invoice balance and automatically posts a credit to customer khata ledger in real time.
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-zinc-700">Amount to Settle</label>
                          <button
                            type="button"
                            onClick={() => setPayAmount(invoiceDetails.invoice.balanceDue)}
                            className="text-[11px] text-blue-700 hover:underline font-medium"
                          >
                            Pay Full Due ({formatCurrency(invoiceDetails.invoice.balanceDue)})
                          </button>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="font-mono font-bold text-sm h-9"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Payment Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={payMethod === "CASH" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPayMethod("CASH")}
                            className="h-8 text-xs font-medium"
                          >
                            Cash-in-Hand
                          </Button>
                          <Button
                            type="button"
                            variant={payMethod === "BANK" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPayMethod("BANK")}
                            className="h-8 text-xs font-medium"
                          >
                            Bank Transfer
                          </Button>
                        </div>
                      </div>

                      {payMethod === "BANK" && (
                        <div>
                          <label className="text-xs font-medium text-zinc-700 block mb-1">
                            Receiving Bank
                          </label>
                          <Select value={payBankId} onValueChange={setPayBankId}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select bank" />
                            </SelectTrigger>
                            <SelectContent>
                              {invoiceDetails.banks.map((b: any) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.bankName} - {b.accountNumber} ({formatCurrency(b.currentBalance)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Reference / Slip No. (Optional)
                        </label>
                        <Input
                          placeholder="e.g. Cheque #4912 or Bank Ref"
                          value={payRef}
                          onChange={(e) => setPayRef(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Notes / Memo
                        </label>
                        <Input
                          placeholder="Settlement memo against invoice"
                          value={payNotes}
                          onChange={(e) => setPayNotes(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleSettlePayment}
                        disabled={submitting || !payAmount || Number(payAmount) <= 0}
                        className="w-full h-9 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-bold mt-2"
                      >
                        {submitting ? "Settling..." : `Commit Settlement of ${formatCurrency(payAmount || 0)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 3: SALES RETURN / STOCK RESTORATION */}
                {activeTab === "return" && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-xs text-amber-900">
                      <strong>Sales Return & Batch Restoration:</strong> Specify the quantity to return.
                      Stock will be atomically restored directly to the originating purchase batch,
                      and a credit note will be posted to the customer khata.
                    </div>

                    <div className="border border-zinc-200 rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-zinc-50/70 text-xs">
                            <TableHead>Product</TableHead>
                            <TableHead className="w-28 font-mono">Lot #</TableHead>
                            <TableHead className="w-24 text-center">Billed Qty</TableHead>
                            <TableHead className="w-28 text-right">Sale Rate</TableHead>
                            <TableHead className="w-36 text-center">Qty to Return</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoiceDetails.items.map((it: any) => (
                            <TableRow key={it.id} className="text-xs">
                              <TableCell className="font-semibold text-zinc-900">{it.productName}</TableCell>
                              <TableCell className="font-mono text-[11px] text-zinc-600">{it.batchNumber}</TableCell>
                              <TableCell className="text-center font-mono">
                                {it.qtyConsumed} {it.childUnit}s
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(it.saleRate)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={it.qtyConsumed}
                                    value={returnQtys[it.id] || 0}
                                    onChange={(e) => {
                                      const val = Math.min(it.qtyConsumed, Math.max(0, parseInt(e.target.value) || 0));
                                      setReturnQtys((prev) => ({ ...prev, [it.id]: val }));
                                    }}
                                    className="w-20 h-7 text-center font-mono text-xs"
                                  />
                                  <span className="text-[10px] text-zinc-400">{it.childUnit}s</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="text-xs font-medium text-zinc-700 block">
                        Reason for Sales Return (Audit Requirement)
                      </label>
                      <Input
                        placeholder="e.g. Customer returned defective items / exchange"
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        onClick={handleProcessReturn}
                        disabled={submitting || !returnReason.trim()}
                        className="h-8 text-xs bg-red-700 hover:bg-red-800 text-white font-bold"
                      >
                        {submitting ? "Processing..." : "Process Return & Restore Stock"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 4: IN-INVOICE BARTER / GOODS EXCHANGE */}
                {activeTab === "barter" && (
                  <div className="max-w-md mx-auto space-y-4 py-2">
                    <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-md text-xs text-zinc-700">
                      <strong>In-Invoice Barter / Contra Deduction:</strong> If the customer gave exchange or scrap goods
                      against this purchase, log them here. Creates a new inward stock lot and deducts the agreed value from this invoice.
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Product Received in Exchange
                        </label>
                        <ProductCombobox
                          products={invoiceDetails.products}
                          selectedProductId={barterProductId}
                          onSelectProduct={(p) => setBarterProductId(p ? p.id : null)}
                          placeholder="Search or Select Received Item..."
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Destination Warehouse
                        </label>
                        <Select value={barterWarehouseId} onValueChange={setBarterWarehouseId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            {invoiceDetails.warehouses.map((w: any) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-zinc-700 block mb-1">Unit Type</label>
                          <div className="flex border border-zinc-200 rounded h-8 overflow-hidden bg-zinc-50">
                            <button
                              type="button"
                              onClick={() => setBarterUnitType("CHILD")}
                              className={`flex-1 text-[11px] font-semibold ${barterUnitType === "CHILD" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                            >
                              Child
                            </button>
                            <button
                              type="button"
                              onClick={() => setBarterUnitType("PARENT")}
                              className={`flex-1 text-[11px] font-semibold ${barterUnitType === "PARENT" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                            >
                              Parent
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-zinc-700 block mb-1">Quantity</label>
                          <Input
                            type="number"
                            min="1"
                            value={barterQty}
                            onChange={(e) => setBarterQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-8 font-mono text-center text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Agreed Valuation / Credit Offset (Rs.)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={barterAgreedValue}
                          onChange={(e) => setBarterAgreedValue(e.target.value)}
                          className="h-8 font-mono font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Exchange Memo / Notes
                        </label>
                        <Input
                          placeholder="e.g. 5 units old scrap bronze fittings received"
                          value={barterReason}
                          onChange={(e) => setBarterReason(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleAddBarter}
                        disabled={submitting || !barterProductId || Number(barterAgreedValue) <= 0}
                        className="w-full h-9 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-bold mt-2"
                      >
                        {submitting ? "Processing..." : `Inward Lot & Offset ${formatCurrency(barterAgreedValue || 0)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 5: ADMIN AUDIT REMARKS */}
                {activeTab === "notes" && (
                  <div className="space-y-4">
                    <div className="border border-zinc-200 rounded-md p-3 bg-zinc-50/50">
                      <span className="text-xs font-semibold text-zinc-900 block mb-2">
                        Internal Management Remarks & Audit Trail
                      </span>
                      {invoiceDetails.invoice.adminNotes ? (
                        <pre className="text-xs text-zinc-700 font-mono whitespace-pre-wrap bg-white p-3 border border-zinc-200 rounded max-h-60 overflow-y-auto">
                          {invoiceDetails.invoice.adminNotes}
                        </pre>
                      ) : (
                        <div className="text-xs text-zinc-400 italic">No admin notes logged yet.</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-700 block">
                        Add New Internal Comment
                      </label>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="e.g. Customer promised balance payment by Monday..."
                          value={newAdminNote}
                          onChange={(e) => setNewAdminNote(e.target.value)}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          onClick={handleAddNote}
                          disabled={submitting || !newAdminNote.trim()}
                          className="h-8 text-xs bg-zinc-900 text-white font-medium"
                        >
                          Add Remark
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. DUAL PRINT & PDF VECTOR EXPORT MODAL */}
      <Dialog
        open={isPrintModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPrintModalOpen(false);
            setPrintInvoiceData(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col bg-zinc-100 p-4 shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-200 bg-white -m-4 p-4 rounded-t-lg shrink-0">
            <div className="flex items-center space-x-3">
              <DialogTitle className="text-sm font-bold text-zinc-900 flex items-center space-x-2">
                <Printer className="h-4 w-4 text-zinc-600" />
                <span>Print Invoice & PDF Export</span>
              </DialogTitle>

              {/* Format Switcher */}
              <div className="flex bg-zinc-100 border border-zinc-200 rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setPrintPaperFormat("A4")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    printPaperFormat === "A4"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  A4 Standard PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPaperFormat("A5")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    printPaperFormat === "A5"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  A5 Compact
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPaperFormat("80mm")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    printPaperFormat === "80mm"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  80mm Slip
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2 mr-8">
              <Button
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs bg-zinc-900 text-white font-semibold hover:bg-zinc-800"
              >
                <Printer className="h-3.5 w-3.5 mr-1" />
                Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4 flex justify-center">
            {isPrintLoading || !printInvoiceData ? (
              <div className="py-20 text-center text-xs text-zinc-500 font-mono">
                Generating print preview...
              </div>
            ) : printPaperFormat === "80mm" ? (
              <ThermalReceipt
                invoiceNo={printInvoiceData.invoice.invoiceNo}
                isPakkaBill={printInvoiceData.invoice.isPakkaBill}
                date={formatDate(printInvoiceData.invoice.createdAt)}
                partyName={printInvoiceData.invoice.partyName}
                previousBalance={printInvoiceData.invoice.previousBalance || "0.00"}
                items={printInvoiceData.items.map((it: any) => ({
                  productName: it.productName,
                  unitType: it.unitTypeSold === "PARENT" ? it.parentUnit : it.childUnit,
                  qty: it.unitTypeSold === "PARENT" ? Math.round(it.qtyConsumed / (it.conversionRate || 1)) : it.qtyConsumed,
                  rate: it.saleRate,
                  lineTotal: (Number(it.saleRate) * (it.unitTypeSold === "PARENT" ? it.qtyConsumed / (it.conversionRate || 1) : it.qtyConsumed)).toFixed(2),
                }))}
                totalAmount={printInvoiceData.invoice.totalAmount}
                discountAmount={printInvoiceData.invoice.discountAmount}
                netAmount={printInvoiceData.invoice.netAmount}
                biltyNumber={printInvoiceData.invoice.biltyNumber}
                transporterName={printInvoiceData.invoice.transporterName}
                freightTerms={printInvoiceData.invoice.freightTerms}
                settings={storeSettings}
              />
            ) : (
              <A4Invoice
                paperSize={printPaperFormat}
                invoiceNo={printInvoiceData.invoice.invoiceNo}
                isPakkaBill={printInvoiceData.invoice.isPakkaBill}
                date={formatDate(printInvoiceData.invoice.createdAt)}
                partyName={printInvoiceData.invoice.partyName}
                partyPhone={printInvoiceData.invoice.partyPhone}
                partyAddress={printInvoiceData.invoice.partyAddress}
                previousBalance={printInvoiceData.invoice.previousBalance || "0.00"}
                items={printInvoiceData.items.map((it: any) => ({
                  sku: it.productSku,
                  productName: it.productName,
                  unitType: it.unitTypeSold === "PARENT" ? it.parentUnit : it.childUnit,
                  qty: it.unitTypeSold === "PARENT" ? Math.round(it.qtyConsumed / (it.conversionRate || 1)) : it.qtyConsumed,
                  rate: it.saleRate,
                  lineTotal: (Number(it.saleRate) * (it.unitTypeSold === "PARENT" ? it.qtyConsumed / (it.conversionRate || 1) : it.qtyConsumed)).toFixed(2),
                }))}
                totalAmount={printInvoiceData.invoice.totalAmount}
                discountAmount={printInvoiceData.invoice.discountAmount}
                netAmount={printInvoiceData.invoice.netAmount}
                biltyNumber={printInvoiceData.invoice.biltyNumber}
                transporterName={printInvoiceData.invoice.transporterName}
                freightTerms={printInvoiceData.invoice.freightTerms}
                settings={storeSettings}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
