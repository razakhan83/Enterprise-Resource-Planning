"use client";

import React, { useState, useEffect } from "react";
import {
  getExpensesList,
  getExpensesInitialData,
  createExpense,
  ExpenseFilters,
  ExpenseCategory,
} from "@/actions/expenses";
import { formatCurrency, formatDate } from "@/utils/format";
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
import {
  Receipt,
  Wallet,
  Building,
  Calendar,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Search,
  Filter,
} from "lucide-react";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [summary, setSummary] = useState<any>({
    totalExpense: "0.00",
    cashExpense: "0.00",
    bankExpense: "0.00",
    todayExpense: "0.00",
    count: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters State
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterPaidFrom, setFilterPaidFrom] = useState<"ALL" | "CASH" | "BANK">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // New Expense Form State
  const [category, setCategory] = useState<ExpenseCategory>("MEALS_TEA");
  const [amount, setAmount] = useState("");
  const [paidFrom, setPaidFrom] = useState<"CASH" | "BANK">("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));

  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [initData, listData] = await Promise.all([
      getExpensesInitialData(),
      getExpensesList({
        category: filterCategory,
        paidFrom: filterPaidFrom,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    ]);

    if (initData.success) {
      setBanks(initData.banks || []);
      setCategories(initData.categories || []);
      if (initData.banks && initData.banks[0]) setBankAccountId(initData.banks[0].id);
    }

    if (listData.success) {
      setExpenses(listData.expenses || []);
      setSummary(listData.summary);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filterCategory, filterPaidFrom, startDate, endDate]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setStatusMsg({ type: "error", text: "Please enter a valid expense amount." });
      return;
    }

    if (!description.trim()) {
      setStatusMsg({ type: "error", text: "Please provide an expense description for the audit log." });
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    const res = await createExpense({
      category,
      amount,
      paidFrom,
      bankAccountId: paidFrom === "BANK" ? bankAccountId : undefined,
      description,
      expenseDate,
    });

    setSubmitting(false);

    if (res.success) {
      setStatusMsg({ type: "success", text: (res as any).message || "Expense posted successfully." });
      setAmount("");
      setDescription("");
      loadData();
    } else {
      setStatusMsg({ type: "error", text: (res as any).error || "Failed to record expense." });
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto select-none">
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Total Overhead Expenses</span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {formatCurrency(summary.totalExpense)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Receipt className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Cash-in-Hand Disbursed</span>
              <span className="text-xl font-bold font-mono text-zinc-900">
                {formatCurrency(summary.cashExpense)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
              <Wallet className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Bank Disbursed</span>
              <span className="text-xl font-bold font-mono text-blue-700">
                {formatCurrency(summary.bankExpense)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-700">
              <Building className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-500 font-medium block">Today&apos;s Overhead</span>
              <span className="text-xl font-bold font-mono text-amber-700">
                {formatCurrency(summary.todayExpense)}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-700">
              <Calendar className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. MAIN SPLIT: EXPENSE ENTRY FORM (4 COLS) + EXPENSE REGISTRY TABLE (8 COLS) */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* LEFT COLUMN: QUICK ENTRY FORM (4 COLS) */}
        <div className="col-span-4 flex flex-col min-h-0">
          <Card className="border-zinc-200 flex-1 flex flex-col justify-between">
            <div>
              <CardHeader className="py-3 px-4 border-b border-zinc-100">
                <CardTitle className="text-xs font-semibold text-zinc-900 flex items-center space-x-1.5">
                  <Receipt className="h-3.5 w-3.5 text-zinc-700" />
                  <span>Record Operating Expense</span>
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Logs overhead cost with automatic double-entry posting to ledger.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3.5">
                {/* Status alert */}
                {statusMsg && (
                  <div
                    className={`p-2.5 rounded text-xs flex items-center justify-between border ${
                      statusMsg.type === "error"
                        ? "bg-red-50 text-red-800 border-red-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      {statusMsg.type === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>{statusMsg.text}</span>
                    </div>
                    <button onClick={() => setStatusMsg(null)} className="font-bold">×</button>
                  </div>
                )}

                <form onSubmit={handleCreateExpense} className="space-y-3">
                  {/* Category */}
                  <div>
                    <label className="text-xs font-medium text-zinc-700 block mb-1">
                      Expense Category
                    </label>
                    <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount & Date */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-medium text-zinc-700 block mb-1">
                        Amount (Rs.)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-8 font-mono font-bold text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-700 block mb-1">
                        Expense Date
                      </label>
                      <Input
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        className="h-8 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Source */}
                  <div>
                    <label className="text-xs font-medium text-zinc-700 block mb-1">
                      Payment Channel
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={paidFrom === "CASH" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaidFrom("CASH")}
                        className="h-8 text-xs font-medium"
                      >
                        Cash-in-Hand
                      </Button>
                      <Button
                        type="button"
                        variant={paidFrom === "BANK" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaidFrom("BANK")}
                        className="h-8 text-xs font-medium"
                      >
                        Bank Account
                      </Button>
                    </div>
                  </div>

                  {/* Bank Account Picker if paidFrom === BANK */}
                  {paidFrom === "BANK" && (
                    <div>
                      <label className="text-xs font-medium text-zinc-700 block mb-1">
                        Disbursing Bank
                      </label>
                      <Select value={bankAccountId} onValueChange={setBankAccountId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {banks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.bankName} ({formatCurrency(b.currentBalance)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="text-xs font-medium text-zinc-700 block mb-1">
                      Particulars / Remark
                    </label>
                    <Input
                      placeholder="e.g. Monthly Godown rent paid / Daily lunch for 4 staff"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || !amount}
                    className="w-full h-9 text-xs bg-zinc-900 text-white font-bold"
                  >
                    {submitting ? "Posting..." : "Post Operating Expense"}
                  </Button>
                </form>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: DENSE AUDIT TABLE & FILTERS (8 COLS) */}
        <div className="col-span-8 flex flex-col gap-3 min-h-0">
          {/* Filters Bar */}
          <Card className="border-zinc-200 shrink-0">
            <CardContent className="p-3">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-3">
                  <Select value={filterPaidFrom} onValueChange={(v: any) => setFilterPaidFrom(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Paid From" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Cash & Bank</SelectItem>
                      <SelectItem value="CASH">Cash Drawer Only</SelectItem>
                      <SelectItem value="BANK">Bank Transfer Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-5 flex items-center space-x-1.5">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-[11px]"
                    title="From"
                  />
                  <span className="text-zinc-400 text-xs">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-[11px]"
                    title="To"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-zinc-200 flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="py-2.5 px-4 border-b border-zinc-100 flex-row items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-xs font-semibold text-zinc-900">
                  Expense Audit Trail
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {expenses.length} Records
                </Badge>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Auto-deducted from Net Profit</span>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/70 hover:bg-zinc-50/70">
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead className="w-36">Category</TableHead>
                    <TableHead>Description / Memo</TableHead>
                    <TableHead className="w-28 text-center">Paid From</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-xs text-zinc-400">
                        Loading expenses...
                      </TableCell>
                    </TableRow>
                  ) : expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-xs text-zinc-400">
                        No expense records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenses.map((exp) => (
                      <TableRow key={exp.id} className="text-xs">
                        <TableCell className="font-mono text-zinc-600">
                          {new Date(exp.expenseDate).toISOString().slice(0, 10)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {categories.find((c) => c.value === exp.category)?.label || exp.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-800 font-medium">
                          {exp.description}
                        </TableCell>
                        <TableCell className="text-center">
                          {exp.paidFrom === "CASH" ? (
                            <span className="text-zinc-600 font-medium text-[11px]">Cash Drawer</span>
                          ) : (
                            <span className="text-blue-700 font-medium text-[11px]">
                              {exp.bankName ? exp.bankName.slice(0, 14) : "Bank Transfer"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-zinc-900">
                          {formatCurrency(exp.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
