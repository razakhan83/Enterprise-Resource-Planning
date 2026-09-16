"use client";

import React, { useState, useEffect } from "react";
import { getLedgersData } from "@/actions/ledgers";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KhataStatementPrint } from "@/components/print/KhataStatementPrint";
import { AdminAdjustmentDialog } from "@/components/ledgers/AdminAdjustmentDialog";
import { PartyCombobox } from "@/components/parties/PartyCombobox";
import { Printer, Calendar, SlidersHorizontal, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";

export default function LedgersPage() {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [totalDebit, setTotalDebit] = useState("0.00");
  const [totalCredit, setTotalCredit] = useState("0.00");
  const [totalInvoiced, setTotalInvoiced] = useState("0.00");
  const [totalRecovered, setTotalRecovered] = useState("0.00");
  const [closingBalance, setClosingBalance] = useState("0.00");
  const [settings, setSettings] = useState<any>(null);

  // Filters
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<"TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);

  const fetchLedgers = async () => {
    setLoading(true);
    const res = await getLedgersData({
      partyId: selectedPartyId || "ALL",
      dateRangePreset: datePreset,
      startDate: datePreset === "CUSTOM" ? startDate : undefined,
      endDate: datePreset === "CUSTOM" ? endDate : undefined,
    });

    if (res.success) {
      if (res.parties) setParties(res.parties);
      setTransactions(res.transactions || []);
      setOpeningBalance(res.openingBalance || "0.00");
      setTotalDebit(res.totalDebit || "0.00");
      setTotalCredit(res.totalCredit || "0.00");
      setTotalInvoiced(res.totalInvoiced || "0.00");
      setTotalRecovered(res.totalRecovered || "0.00");
      setClosingBalance(res.closingBalance || "0.00");
      if (res.settings) setSettings(res.settings);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLedgers();
  }, [selectedPartyId, datePreset, startDate, endDate]);

  const selectedPartyObj = parties.find((p) => p.id === selectedPartyId);

  const datePresetLabel =
    datePreset === "TODAY"
      ? "Today"
      : datePreset === "YESTERDAY"
      ? "Yesterday"
      : datePreset === "THIS_WEEK"
      ? "This Week"
      : datePreset === "THIS_MONTH"
      ? "This Month"
      : datePreset === "CUSTOM"
      ? `${startDate || "Start"} to ${endDate || "End"}`
      : "All Time";

  return (
    <div className="flex flex-col h-full gap-4">
      <Card className="border-zinc-200 shadow-xs flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900">
                Financial Audit Trail & Party Khata
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-0.5">
                Complete double-entry khata, running balances, opening carry-forwards, and admin adjustments.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {selectedPartyId && (
                <>
                  <Button
                    onClick={() => setIsAdjustmentDialogOpen(true)}
                    variant="outline"
                    className="h-8 px-3 text-xs border-zinc-300 text-zinc-800 hover:bg-zinc-50 font-medium flex items-center space-x-1"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1 text-zinc-600" />
                    <span>Admin Adjustment</span>
                  </Button>
                  <Button
                    onClick={() => setIsPrintDialogOpen(true)}
                    className="h-8 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium flex items-center space-x-1"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    <span>Print Statement</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 items-center">
            {/* Searchable Party Combobox */}
            <div>
              <label className="text-[11px] font-medium text-zinc-600 block mb-1">
                Filter by Party / Account
              </label>
              <PartyCombobox
                parties={parties}
                selectedPartyId={selectedPartyId}
                onSelectParty={(p) => setSelectedPartyId(p ? p.id : null)}
                placeholder="All Financial Accounts"
                allowCashOption={false}
              />
            </div>

            {/* Date Range Preset */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-medium text-zinc-600 block mb-1">
                Date Range Filter
              </label>
              <div className="flex items-center space-x-1 bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs">
                {[
                  { id: "ALL", label: "All Time" },
                  { id: "TODAY", label: "Today" },
                  { id: "YESTERDAY", label: "Yesterday" },
                  { id: "THIS_WEEK", label: "This Week" },
                  { id: "THIS_MONTH", label: "This Month" },
                  { id: "CUSTOM", label: "Custom" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDatePreset(item.id as any)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                      datePreset === item.id
                        ? "bg-white text-zinc-950 shadow-2xs font-semibold"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Dates (if custom selected) */}
            {datePreset === "CUSTOM" && (
              <div className="flex items-center space-x-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-zinc-400 text-xs">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Top 3 Summary Cards (When Party Selected) */}
          {selectedPartyId && selectedPartyObj && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md">
                <div className="flex justify-between items-center text-xs text-zinc-500 mb-1">
                  <span>Total Invoiced / Debited</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <div className="font-mono text-lg font-bold text-zinc-900">
                  {formatCurrency(totalInvoiced)}
                </div>
              </div>

              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md">
                <div className="flex justify-between items-center text-xs text-zinc-500 mb-1">
                  <span>Total Recovered / Paid</span>
                  <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="font-mono text-lg font-bold text-emerald-700">
                  {formatCurrency(totalRecovered)}
                </div>
              </div>

              <div className="p-3 bg-zinc-900 text-white rounded-md">
                <div className="flex justify-between items-center text-xs text-zinc-300 mb-1">
                  <span>Current Net Balance</span>
                  <Wallet className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <div className="font-mono text-lg font-bold">
                  {formatCurrency(closingBalance)}
                  <span className="text-xs font-normal text-zinc-400 ml-1.5">
                    {Number(closingBalance) > 0 ? "Dr (Receivable)" : Number(closingBalance) < 0 ? "Cr (Payable)" : "Settled"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-xs text-zinc-400">
              Loading financial transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-zinc-500">
              No transactions recorded for the selected filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40 font-mono">Date & Time</TableHead>
                  <TableHead className="w-32 font-mono">Voucher / Inv #</TableHead>
                  <TableHead className="w-48">Account / Party</TableHead>
                  <TableHead className="w-24 text-center">Type</TableHead>
                  <TableHead>Particulars / Remarks</TableHead>
                  <TableHead className="w-32 text-right">Debit (Rs.)</TableHead>
                  <TableHead className="w-32 text-right">Credit (Rs.)</TableHead>
                  <TableHead className="w-36 text-right">Net Balance (Rs.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* If specific party is selected, render Opening Balance row first */}
                {selectedPartyId && (
                  <TableRow className="bg-zinc-50/80 font-medium text-zinc-700">
                    <TableCell className="font-mono text-xs text-zinc-400">-</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-400">B/F</TableCell>
                    <TableCell className="text-xs font-semibold text-zinc-900">
                      {selectedPartyObj?.name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px] font-mono">
                        OPENING
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs italic text-zinc-500">
                      Opening Balance Brought Forward
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-zinc-400">-</TableCell>
                    <TableCell className="text-right font-mono text-xs text-zinc-400">-</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-zinc-900">
                      {formatCurrency(openingBalance)}
                    </TableCell>
                  </TableRow>
                )}

                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-zinc-800">
                      {tx.voucherNo || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-xs text-zinc-900">
                      <div>{tx.partyName}</div>
                      {tx.systemRole && (
                        <div className="text-[10px] text-zinc-400 font-mono">{tx.systemRole}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          tx.type === "SALE"
                            ? "default"
                            : tx.type === "RECEIPT"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px] font-mono"
                      >
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600">{tx.particulars}</TableCell>
                    <TableCell className="font-mono text-right text-xs font-semibold text-zinc-900">
                      {Number(tx.debit) > 0 ? formatCurrency(tx.debit) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-right text-xs font-semibold text-zinc-900">
                      {Number(tx.credit) > 0 ? formatCurrency(tx.credit) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-right text-xs font-bold text-zinc-900">
                      {formatCurrency(tx.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Print Statement Modal */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 bg-white">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-2">
            <DialogTitle className="text-sm font-bold">
              Party Khata Statement: {selectedPartyObj?.name}
            </DialogTitle>
            <Button size="sm" onClick={() => window.print()} className="h-8 text-xs bg-zinc-900 text-white">
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print Document
            </Button>
          </DialogHeader>

          {selectedPartyObj && (
            <KhataStatementPrint
              partyName={selectedPartyObj.name}
              partyPhone={selectedPartyObj.phone}
              partyAddress={selectedPartyObj.address}
              periodLabel={datePresetLabel}
              openingBalance={openingBalance}
              totalDebit={totalDebit}
              totalCredit={totalCredit}
              closingBalance={closingBalance}
              transactions={transactions}
              settings={settings}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Adjustment Voucher Modal */}
      {selectedPartyObj && (
        <AdminAdjustmentDialog
          open={isAdjustmentDialogOpen}
          onOpenChange={setIsAdjustmentDialogOpen}
          partyId={selectedPartyObj.id}
          partyName={selectedPartyObj.name}
          onSuccess={() => fetchLedgers()}
        />
      )}
    </div>
  );
}
