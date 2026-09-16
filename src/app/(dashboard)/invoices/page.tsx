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
import { PartyCombobox } from "@/components/parties/PartyCombobox";
import { ProductCombobox } from "@/components/inventory/ProductCombobox";
import {
  FileText,
  Search,
  Filter,
  CreditCard,
  RotateCcw,
  Repeat,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  DollarSign,
  TrendingDown,
  Clock,
  Printer,
} from "lucide-react";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalCount: 0,
    totalInvoiced: "0.00",
    totalCollected: "0.00",
    totalDue: "0.00",
  });
  const [partiesList, setPartiesList] = useState<any[]>([]);
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
    const res = await getInvoicesList({
      search,
      partyId: selectedPartyId,
      billType,
      paymentStatus,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    if (res.success) {
      setInvoices(res.invoices || []);
      setSummary(res.summary);
      // Extract unique parties for filter
      const uniqueParties: any[] = [];
      const seen = new Set<string>();
      for (const inv of res.invoices || []) {
        if (inv.partyId && !seen.has(inv.partyId)) {
          seen.add(inv.partyId);
          uniqueParties.push({ id: inv.partyId, name: inv.partyName, type: "CUSTOMER", currentBalance: "0.00" });
        }
      }
      setPartiesList(uniqueParties);
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
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-zinc-200">
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

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Total Invoiced Val</span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {formatCurrency(summary.totalInvoiced)}
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

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Receivable Outstanding</span>
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

      {/* 2. FILTER & ACTION BAR */}
      <Card className="border-zinc-200">
        <CardContent className="p-3">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-12 gap-2.5 items-center">
            {/* Search Input */}
            <div className="col-span-3 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search Invoice #, Customer, Bilty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs font-medium"
              />
            </div>

            {/* Bill Type Filter */}
            <div className="col-span-2">
              <Select value={billType} onValueChange={(v: any) => setBillType(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Bill Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Bill Types</SelectItem>
                  <SelectItem value="PAKKA">Tax Invoice (Pakka)</SelectItem>
                  <SelectItem value="ESTIMATE">Estimate (Kacha)</SelectItem>
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
                  <SelectItem value="ALL">All Payment Statuses</SelectItem>
                  <SelectItem value="PAID">Fully Paid</SelectItem>
                  <SelectItem value="PARTIAL">Partially Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid (Credit Due)</SelectItem>
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

            {/* Filter Apply / Reset */}
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

      {/* 3. DENSE INVOICES AUDIT TABLE */}
      <Card className="border-zinc-200 flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="py-2.5 px-4 border-b border-zinc-100 flex-row items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-xs font-semibold text-zinc-900">
              Invoice Registry & Audit Workspace
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              {invoices.length} Invoices
            </Badge>
          </div>
          <span className="text-[11px] text-zinc-400">Click any row to open full audit & edit drawer</span>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/70 hover:bg-zinc-50/70">
                <TableHead className="w-32">Invoice No</TableHead>
                <TableHead className="w-36">Date & Time</TableHead>
                <TableHead>Customer / Party</TableHead>
                <TableHead className="w-24 text-center">Type</TableHead>
                <TableHead className="w-28 text-right">Net Amount</TableHead>
                <TableHead className="w-28 text-right">Paid Amount</TableHead>
                <TableHead className="w-28 text-right">Balance Due</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-24 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-xs text-zinc-400">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-xs text-zinc-400">
                    No invoices matching selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => {
                  const isPaid = Number(inv.balanceDue) <= 0;
                  const isPartial = Number(inv.paidAmount) > 0 && !isPaid;

                  return (
                    <TableRow
                      key={inv.id}
                      onClick={() => handleOpenDetails(inv.id)}
                      className="cursor-pointer hover:bg-zinc-50/80 transition-colors"
                    >
                      <TableCell className="font-mono text-xs font-bold text-zinc-900">
                        {inv.invoiceNo}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 font-mono">
                        {formatDate(inv.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-zinc-900">{inv.partyName}</div>
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
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px]">
                            PAID
                          </Badge>
                        ) : isPartial ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px]">
                            PARTIAL
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200 text-[9px]">
                            UNPAID
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetails(inv.id)}
                          className="h-6 text-[10px] px-2"
                        >
                          Audit & Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4. CONTROLLED AUDIT & EDIT DRAWER / DIALOG */}
      <Dialog
        open={Boolean(selectedInvoiceId)}
        onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
      >
        <DialogContent className="max-w-4xl bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col">
          {detailsLoading || !invoiceDetails ? (
            <div className="py-20 text-center text-xs text-zinc-400">Loading invoice audit trail...</div>
          ) : (
            <>
              {/* MODAL HEADER */}
              <DialogHeader className="border-b border-zinc-100 pb-3 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <DialogTitle className="text-base font-bold font-mono text-zinc-900">
                        {invoiceDetails.invoice.invoiceNo}
                      </DialogTitle>
                      <Badge
                        variant={invoiceDetails.invoice.isPakkaBill ? "default" : "outline"}
                        className="text-[10px] font-mono"
                      >
                        {invoiceDetails.invoice.isPakkaBill ? "TAX INVOICE" : "ESTIMATE"}
                      </Badge>
                      {invoiceDetails.invoice.isVoided && (
                        <Badge variant="destructive" className="text-[10px]">VOIDED</Badge>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 flex items-center space-x-3">
                      <span>Billed to: <strong className="text-zinc-900">{invoiceDetails.invoice.partyName}</strong></span>
                      <span>•</span>
                      <span>Date: <strong className="text-zinc-900">{formatDate(invoiceDetails.invoice.createdAt)}</strong></span>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-zinc-900">
                      Net: {formatCurrency(invoiceDetails.invoice.netAmount)}
                    </div>
                    <div className="text-xs text-amber-700 font-semibold">
                      Due: {formatCurrency(invoiceDetails.invoice.balanceDue)}
                    </div>
                  </div>
                </div>

                {/* Sub-nav tabs */}
                <div className="flex space-x-1 pt-3 border-t border-zinc-100 mt-3">
                  <Button
                    variant={activeTab === "items" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("items")}
                    className="h-7 text-xs"
                  >
                    Line Items & Batches ({invoiceDetails.items.length})
                  </Button>
                  <Button
                    variant={activeTab === "payment" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("payment")}
                    className="h-7 text-xs"
                  >
                    <CreditCard className="h-3.5 w-3.5 mr-1" />
                    Bill-wise Settlement
                  </Button>
                  <Button
                    variant={activeTab === "return" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("return")}
                    className="h-7 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Sales Return
                  </Button>
                  <Button
                    variant={activeTab === "barter" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("barter")}
                    className="h-7 text-xs"
                  >
                    <Repeat className="h-3.5 w-3.5 mr-1" />
                    Goods Exchange (Contra)
                  </Button>
                  <Button
                    variant={activeTab === "notes" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("notes")}
                    className="h-7 text-xs"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    Admin Audit Notes
                  </Button>
                </div>
              </DialogHeader>

              {/* STATUS ALERT */}
              {statusMsg && (
                <div
                  className={`mt-2 p-2.5 rounded text-xs flex items-center justify-between border ${
                    statusMsg.type === "error"
                      ? "bg-red-50 text-red-800 border-red-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {statusMsg.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span>{statusMsg.text}</span>
                  </div>
                  <button onClick={() => setStatusMsg(null)} className="font-bold">×</button>
                </div>
              )}

              {/* MODAL BODY */}
              <div className="flex-1 overflow-y-auto py-3">
                {/* TAB 1: LINE ITEMS & BATCH LINEAGE */}
                {activeTab === "items" && (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-50 text-xs">
                          <TableHead className="w-8 text-center">#</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-28 font-mono">Lot / Batch #</TableHead>
                          <TableHead className="w-24 text-center">Unit Sold</TableHead>
                          <TableHead className="w-24 text-center">Qty (Child)</TableHead>
                          <TableHead className="w-28 text-right">Cost Snapshot</TableHead>
                          <TableHead className="w-28 text-right">Sale Rate</TableHead>
                          <TableHead className="w-28 text-right">Line Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceDetails.items.map((it: any, idx: number) => {
                          const total = (Number(it.saleRate) * (it.unitTypeSold === "PARENT" ? it.qtyConsumed / it.conversionRate : it.qtyConsumed)).toFixed(2);
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
                                <Badge variant="outline" className="text-[10px]">
                                  {it.unitTypeSold === "PARENT" ? it.parentUnit : it.childUnit}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                {it.qtyConsumed} {it.childUnit}s
                              </TableCell>
                              <TableCell className="text-right font-mono text-zinc-500">
                                {formatCurrency(it.costSnapshot)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-zinc-900">
                                {formatCurrency(it.saleRate)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-zinc-900">
                                {formatCurrency(total)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Financial Breakdown Card */}
                    <div className="bg-zinc-50 border border-zinc-200 rounded p-3 flex justify-between text-xs font-mono">
                      <div>
                        <span className="text-zinc-500">Gross Total: </span>
                        <strong>{formatCurrency(invoiceDetails.invoice.totalAmount)}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Discount / Kasr: </span>
                        <strong className="text-red-700">-{formatCurrency(invoiceDetails.invoice.discountAmount)}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Net Payable: </span>
                        <strong className="text-zinc-900">{formatCurrency(invoiceDetails.invoice.netAmount)}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Paid: </span>
                        <strong className="text-emerald-700">{formatCurrency(invoiceDetails.invoice.paidAmount)}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">Balance Due: </span>
                        <strong className="text-amber-700">{formatCurrency(invoiceDetails.invoice.balanceDue)}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: BILL-WISE PAYMENT SETTLEMENT */}
                {activeTab === "payment" && (
                  <div className="max-w-md mx-auto space-y-4 py-2">
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-900">
                      <strong>Bill-wise Payment:</strong> Settle outstanding balance for this specific invoice.
                      Updates the invoice balance and automatically posts a credit to customer khata in real time.
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-700 block mb-1">
                          Amount to Settle (Max Due: {formatCurrency(invoiceDetails.invoice.balanceDue)})
                        </label>
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
                          Payment Method
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={payMethod === "CASH" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPayMethod("CASH")}
                            className="h-8 text-xs"
                          >
                            Cash-in-Hand
                          </Button>
                          <Button
                            type="button"
                            variant={payMethod === "BANK" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPayMethod("BANK")}
                            className="h-8 text-xs"
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
                          placeholder="Payment against invoice balance"
                          value={payNotes}
                          onChange={(e) => setPayNotes(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleSettlePayment}
                        disabled={submitting || !payAmount || Number(payAmount) <= 0}
                        className="w-full h-9 text-xs bg-zinc-900 text-white font-bold"
                      >
                        {submitting ? "Settling..." : `Commit Payment of ${formatCurrency(payAmount || 0)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 3: SALES RETURN / STOCK REVERSAL */}
                {activeTab === "return" && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-900">
                      <strong>Sales Return & Batch Restoration:</strong> Enter the quantity in child units to return.
                      Stock will be restored directly to the originating supplier lot using atomic row-level locking,
                      and a credit note will be issued to the customer khata.
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-50 text-xs">
                          <TableHead>Product</TableHead>
                          <TableHead className="w-28 font-mono">Lot #</TableHead>
                          <TableHead className="w-28 text-center">Billed Qty</TableHead>
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

                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-medium text-zinc-700 block">
                        Reason for Sales Return (Audit Requirement)
                      </label>
                      <Input
                        placeholder="e.g. Customer returned 2 defective valves / size exchange"
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
                    <div className="bg-purple-50 border border-purple-200 p-3 rounded text-xs text-purple-900">
                      <strong>In-Invoice Barter / Contra Deduction:</strong> If the customer gave exchange or scrap goods
                      against this purchase, log them here. Creates a new inward stock lot in the selected warehouse and
                      deducts the agreed valuation from this invoice.
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
                          placeholder="Search or Create Received Item..."
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
                          <div className="flex border border-zinc-200 rounded h-8 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setBarterUnitType("CHILD")}
                              className={`flex-1 text-[11px] font-semibold ${barterUnitType === "CHILD" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
                            >
                              Child
                            </button>
                            <button
                              type="button"
                              onClick={() => setBarterUnitType("PARENT")}
                              className={`flex-1 text-[11px] font-semibold ${barterUnitType === "PARENT" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
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
                        className="w-full h-9 text-xs bg-purple-700 hover:bg-purple-800 text-white font-bold"
                      >
                        {submitting ? "Processing..." : `Inward Lot & Offset ${formatCurrency(barterAgreedValue || 0)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 5: ADMIN AUDIT REMARKS */}
                {activeTab === "notes" && (
                  <div className="space-y-4">
                    <div className="border border-zinc-200 rounded p-3 bg-zinc-50/50">
                      <span className="text-xs font-semibold text-zinc-900 block mb-2">
                        Internal Management Remarks & Audit Log
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
                          placeholder="e.g. Customer promised balance payment by Thursday..."
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
    </div>
  );
}
