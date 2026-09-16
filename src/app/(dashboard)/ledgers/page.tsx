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
import { Printer, Calendar, Filter } from "lucide-react";

export default function LedgersPage() {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [totalDebit, setTotalDebit] = useState("0.00");
  const [totalCredit, setTotalCredit] = useState("0.00");
  const [closingBalance, setClosingBalance] = useState("0.00");
  const [settings, setSettings] = useState<any>(null);

  // Filters
  const [selectedPartyId, setSelectedPartyId] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<"TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Print Statement Dialog
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  const fetchLedgers = async () => {
    setLoading(true);
    const res = await getLedgersData({
      partyId: selectedPartyId,
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
                Immutable double-entry journal postings with opening balances and party statements.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-3">
              {selectedPartyId !== "ALL" && (
                <Button
                  onClick={() => setIsPrintDialogOpen(true)}
                  className="h-8 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium flex items-center space-x-1"
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  <span>Print Party Statement</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 items-center">
            {/* Party Selector */}
            <div>
              <label className="text-[11px] font-medium text-zinc-600 block mb-1">
                Filter by Party / Account
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="ALL">All Financial Accounts & Parties</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Preset */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-medium text-zinc-600 block mb-1">
                Date Range Filter
              </label>
              <div className="flex items-center space-x-1 bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs">
                {[
                  { id: "ALL", label: "All" },
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

          {/* Party Khata Summary Strip */}
          {selectedPartyId !== "ALL" && selectedPartyObj && (
            <div className="mt-3 p-2.5 bg-zinc-50 border border-zinc-200 rounded flex items-center justify-between text-xs">
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-zinc-500 text-[11px]">Selected Account: </span>
                  <span className="font-bold text-zinc-900">{selectedPartyObj.name}</span>
                </div>
                <div className="text-zinc-400">|</div>
                <div>
                  <span className="text-zinc-500 text-[11px]">Opening Balance: </span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {formatCurrency(openingBalance)}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-4 font-mono">
                <div>
                  <span className="text-zinc-500 text-[11px]">Period Debits: </span>
                  <span className="font-semibold text-zinc-900">+{formatCurrency(totalDebit)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[11px]">Period Credits: </span>
                  <span className="font-semibold text-zinc-900">-{formatCurrency(totalCredit)}</span>
                </div>
                <div className="pl-2 border-l border-zinc-300">
                  <span className="text-zinc-500 text-[11px]">Closing Balance: </span>
                  <span className="font-bold text-zinc-950">{formatCurrency(closingBalance)}</span>
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
                  <TableHead className="w-40 font-mono">Posting Date</TableHead>
                  <TableHead className="w-56">Account / Party</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead>Particulars / Memo</TableHead>
                  <TableHead className="w-32 text-right">Debit (Rs.)</TableHead>
                  <TableHead className="w-32 text-right">Credit (Rs.)</TableHead>
                  <TableHead className="w-36 text-right">Balance (Rs.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* If specific party is selected, render Opening Balance row first */}
                {selectedPartyId !== "ALL" && (
                  <TableRow className="bg-zinc-50/80 font-medium text-zinc-700">
                    <TableCell className="font-mono text-xs text-zinc-400">-</TableCell>
                    <TableCell className="text-xs font-semibold text-zinc-900">
                      {selectedPartyObj?.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-mono">
                        B/F
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
                    <TableCell className="font-medium text-xs text-zinc-900">
                      <div>{tx.partyName}</div>
                      {tx.systemRole && (
                        <div className="text-[10px] text-zinc-400 font-mono">{tx.systemRole}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
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
              Print Party Statement: {selectedPartyObj?.name}
            </DialogTitle>
            <Button size="sm" onClick={() => window.print()} className="h-8 text-xs">
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
    </div>
  );
}
