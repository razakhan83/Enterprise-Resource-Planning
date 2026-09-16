"use client";

import React, { useState, useEffect } from "react";
import { getReportsData } from "@/actions/reports";
import { formatCurrency } from "@/utils/format";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Clock,
  MessageSquare,
  AlertTriangle,
  Building,
  CheckCircle,
} from "lucide-react";

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getReportsData();
      setData(res);
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-zinc-500 font-mono">
        Loading analytics engine...
      </div>
    );
  }

  const { supplierMatrix, financialStatement, agingList } = data;

  const handleWhatsAppReminder = (customer: any) => {
    const text = encodeURIComponent(
      `Assalam-o-Alaikum ${customer.name},\n\nThis is a friendly reminder regarding your outstanding balance of ${formatCurrency(
        customer.balance
      )} with us. Kindly arrange settlement at your earliest convenience.\n\nBank: Meezan Bank Ltd\nAccount: 0102-0105892341\nTitle: ERP Commercial Distribution\n\nThank you!`
    );
    const phone = customer.phone ? customer.phone.replace(/[^0-9]/g, "") : "";
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* HEADER CARD */}
      <Card>
        <CardHeader className="py-3 px-4 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-700" />
              <span>Business Intelligence & Margin Analytics</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-0.5">
              Vendor-wise gross margins, real-time net profit statement, and customer receivable aging buckets.
            </CardDescription>
          </div>
          <Badge variant="neutral" className="text-xs font-mono">
            Executive Analytics
          </Badge>
        </CardHeader>
      </Card>

      {/* TABS */}
      <Tabs defaultValue="supplier-margin" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-3 w-full h-9">
          <TabsTrigger value="supplier-margin" className="text-xs font-medium gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
            <span>Supplier Profit Margin Matrix</span>
          </TabsTrigger>
          <TabsTrigger value="net-profit" className="text-xs font-medium gap-1.5">
            <Building className="h-3.5 w-3.5 text-emerald-600" />
            <span>Net Profit Statement</span>
          </TabsTrigger>
          <TabsTrigger value="debt-aging" className="text-xs font-medium gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Receivables Debt Aging</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. SUPPLIER PROFIT MARGIN MATRIX */}
        <TabsContent value="supplier-margin" className="flex-1 mt-3 min-h-0 overflow-hidden">
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="py-2.5 px-4 bg-zinc-50/60 border-b border-zinc-100 flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                Vendor Gross Profitability Matrix
              </CardTitle>
              <span className="text-[10px] text-zinc-400 font-mono">
                Formula: (Sales - Landed Cost) / Sales × 100
              </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor / Supplier</TableHead>
                    <TableHead className="w-28 text-right">Units Sold</TableHead>
                    <TableHead className="w-36 text-right">Gross Sales</TableHead>
                    <TableHead className="w-36 text-right">Landed Cost (COGS)</TableHead>
                    <TableHead className="w-36 text-right">Gross Profit (Rs.)</TableHead>
                    <TableHead className="w-32 text-right">Margin %</TableHead>
                    <TableHead className="w-32 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierMatrix.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center text-zinc-400 text-xs">
                        No sales mapped to supplier batches yet. Perform sales to view margin analytics.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplierMatrix.map((sm: any) => (
                      <TableRow key={sm.supplierId}>
                        <TableCell className="font-semibold text-xs text-zinc-900">
                          {sm.supplierName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {sm.unitsSold} units
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCurrency(sm.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-zinc-600">
                          {formatCurrency(sm.cogs)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-bold text-xs ${
                            sm.isLossMaking ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
                          {formatCurrency(sm.grossMarginRs)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-bold text-xs ${
                            sm.isLossMaking ? "text-red-600" : "text-zinc-900"
                          }`}
                        >
                          {sm.marginPercent}%
                        </TableCell>
                        <TableCell className="text-center">
                          {sm.isLossMaking ? (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Loss Maker</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 border-emerald-300 bg-emerald-50">
                              Profitable
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. NET PROFIT STATEMENT */}
        <TabsContent value="net-profit" className="flex-1 mt-3 overflow-y-auto">
          <div className="grid grid-cols-12 gap-4">
            {/* P&L Step-Down Statement */}
            <Card className="col-span-7">
              <CardHeader className="py-3 px-4 border-b border-zinc-100">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                  Trading Profit & Loss Statement
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {/* 1. Gross Revenue */}
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-zinc-800">Gross Sales Revenue</span>
                  <span className="font-mono font-bold text-zinc-900 text-sm">
                    {formatCurrency(financialStatement.totalRevenue)}
                  </span>
                </div>

                {/* 2. COGS */}
                <div className="flex justify-between items-center py-1 text-zinc-600">
                  <span className="pl-3">Less: Cost of Goods Sold (Landed Cost)</span>
                  <span className="font-mono font-semibold">
                    -{formatCurrency(financialStatement.totalCogs)}
                  </span>
                </div>

                {/* 3. Trading Gross Profit */}
                <div className="flex justify-between items-center py-2 px-3 bg-zinc-50 rounded border border-zinc-200">
                  <span className="font-bold text-zinc-900 uppercase">Trading Gross Profit</span>
                  <span className="font-mono font-bold text-base text-zinc-900">
                    {formatCurrency(financialStatement.grossProfit)}
                  </span>
                </div>

                {/* 4. Operating Expenses */}
                <div className="flex justify-between items-center py-1 text-zinc-600">
                  <span className="pl-3">Less: Operational Overheads & Expenses</span>
                  <span className="font-mono font-semibold text-red-600">
                    -{formatCurrency(financialStatement.totalExpenses)}
                  </span>
                </div>

                {/* 5. Net Profit */}
                <div
                  className={`flex justify-between items-center p-4 rounded-md border mt-3 ${
                    Number(financialStatement.netProfit) >= 0
                      ? "bg-emerald-50/70 border-emerald-300"
                      : "bg-red-50/70 border-red-300"
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-sm uppercase text-zinc-900">
                      Net Operational Profit / Loss
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      Pure operational bottom-line after overheads
                    </div>
                  </div>
                  <div
                    className={`font-mono text-2xl font-black ${
                      Number(financialStatement.netProfit) >= 0
                        ? "text-emerald-800"
                        : "text-red-800"
                    }`}
                  >
                    {formatCurrency(financialStatement.netProfit)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Operating Expenses Breakdown */}
            <Card className="col-span-5">
              <CardHeader className="py-3 px-4 border-b border-zinc-100">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                  Operating Expenses Ledger
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense Head</TableHead>
                      <TableHead className="w-28 text-right">Amount (Rs.)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialStatement.expensesBreakdown.map((exp: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-medium">
                          <div>{exp.category}</div>
                          {exp.notes && (
                            <div className="text-[10px] text-zinc-400">{exp.notes}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-zinc-900">
                          {formatCurrency(exp.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 3. DEBT AGING & WHATSAPP REMINDERS */}
        <TabsContent value="debt-aging" className="flex-1 mt-3 min-h-0 overflow-hidden">
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="py-2.5 px-4 bg-zinc-50/60 border-b border-zinc-100 flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                Accounts Receivable Debt Aging Buckets
              </CardTitle>
              <span className="text-[10px] text-zinc-400 font-mono">
                1-Click WhatsApp Recovery Directives
              </span>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Account</TableHead>
                    <TableHead className="w-36">Phone Number</TableHead>
                    <TableHead className="w-36 text-right">Overdue Balance</TableHead>
                    <TableHead className="w-36 text-center">Aging Bucket</TableHead>
                    <TableHead className="w-32 text-center">Days Aged</TableHead>
                    <TableHead className="w-40 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-zinc-400 text-xs">
                        No outstanding customer credit debts recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agingList.map((cust: any) => (
                      <TableRow key={cust.id}>
                        <TableCell className="font-semibold text-xs text-zinc-900">
                          {cust.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-600">
                          {cust.phone || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-zinc-900">
                          {formatCurrency(cust.balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {cust.bucket === "61_PLUS" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              60+ Days Overdue
                            </Badge>
                          ) : cust.bucket === "31_60" ? (
                            <Badge variant="neutral" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                              31-60 Days
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              Current (0-30 Days)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-zinc-500">
                          {cust.ageDays} days
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsAppReminder(cust)}
                            className="h-7 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 gap-1.5"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
