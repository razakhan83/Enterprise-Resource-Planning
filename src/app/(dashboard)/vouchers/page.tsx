"use client";

import React, { useState, useEffect } from "react";
import {
  getVouchersInitialData,
  postPaymentReceiptVoucher,
  settleContraBarterVoucher,
} from "@/actions/vouchers";
import { formatCurrency } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartyCombobox } from "@/components/parties/PartyCombobox";
import { ArrowDownLeft, ArrowUpRight, Repeat, CheckCircle2, AlertCircle, Building, Wallet } from "lucide-react";

export default function VouchersPage() {
  const [parties, setParties] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("receipt");

  // Form State: Receipt & Payment
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK">("CASH");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [particulars, setParticulars] = useState<string>("");

  // Form State: Contra Settlement
  const [contraPartyId, setContraPartyId] = useState<string>("");
  const [nettedAmount, setNettedAmount] = useState<string>("");
  const [cashDifference, setCashDifference] = useState<string>("0.00");
  const [differenceAction, setDifferenceAction] = useState<"RECEIVE_CASH" | "PAY_CASH" | "NONE">("NONE");
  const [contraParticulars, setContraParticulars] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getVouchersInitialData();
      setParties(data.parties || []);
      setBanks(data.banks || []);
      if (data.parties && data.parties[0]) setSelectedPartyId(data.parties[0].id);
      if (data.banks && data.banks[0]) setSelectedBankId(data.banks[0].id);

      const dual = data.parties.find((p: any) => p.type === "DUAL");
      if (dual) setContraPartyId(dual.id);
    }
    load();
  }, []);

  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const selectedContraParty = parties.find((p) => p.id === contraPartyId);

  const handlePostVoucher = async (type: "RECEIPT" | "PAYMENT") => {
    if (!selectedPartyId || !amount || Number(amount) <= 0) {
      setStatusMessage({ type: "error", text: "Please select an account and specify a valid amount." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await postPaymentReceiptVoucher({
      voucherType: type,
      partyId: selectedPartyId,
      amount,
      paymentMethod,
      bankAccountId: paymentMethod === "BANK" ? selectedBankId : undefined,
      referenceNo,
      particulars: particulars || (type === "RECEIPT" ? "Customer Udhar Recovery" : "Supplier Dues Payment"),
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({
        type: "success",
        text: `Voucher posted successfully! Ledger updated by ${formatCurrency(amount)}.`,
      });
      setAmount("");
      setReferenceNo("");
      setParticulars("");
      // Refresh balances
      getVouchersInitialData().then((d) => setParties(d.parties || []));
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to post voucher." });
    }
  };

  const handlePostContra = async () => {
    if (!contraPartyId || !nettedAmount || Number(nettedAmount) <= 0) {
      setStatusMessage({ type: "error", text: "Please select a dual party and specify netted amount." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await settleContraBarterVoucher({
      partyId: contraPartyId,
      nettedAmount,
      cashDifference,
      differenceAction,
      particulars: contraParticulars || "Periodic Barter Clearance",
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({
        type: "success",
        text: `Contra Barter Voucher committed! Netted ${formatCurrency(nettedAmount)} successfully.`,
      });
      setNettedAmount("");
      setCashDifference("0.00");
      setContraParticulars("");
      getVouchersInitialData().then((d) => setParties(d.parties || []));
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to post contra settlement." });
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 max-w-4xl mx-auto">
      {/* TOP CARD */}
      <Card>
        <CardHeader className="py-3 px-4 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-zinc-700" />
              <span>Financial Vouchers & Settlements</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-0.5">
              Record customer recoveries, supplier disbursements, bank transfers, and dual-party barter contra vouchers.
            </CardDescription>
          </div>
          <Badge variant="neutral" className="text-xs font-mono">
            Shortcut [F7]
          </Badge>
        </CardHeader>
      </Card>

      {/* NOTIFICATION STATUS */}
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

      {/* VOUCHER MODES TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-3 w-full h-9">
          <TabsTrigger value="receipt" className="text-xs font-medium gap-1.5">
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
            <span>Customer Recovery (Receipt)</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="text-xs font-medium gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5 text-blue-600" />
            <span>Supplier Payment (Disbursement)</span>
          </TabsTrigger>
          <TabsTrigger value="contra" className="text-xs font-medium gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-purple-600" />
            <span>Contra Barter Settlement</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CUSTOMER RECEIPT VOUCHER */}
        <TabsContent value="receipt" className="flex-1 mt-4">
          <Card>
            <CardHeader className="py-3 px-4 border-b border-zinc-100">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-emerald-800 flex items-center gap-1.5">
                <ArrowDownLeft className="h-4 w-4" />
                <span>Receive Customer Recovery / Outstanding Dues</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                {/* Customer Account */}
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Customer Account</label>
                  <PartyCombobox
                    parties={parties}
                    selectedPartyId={selectedPartyId || null}
                    onSelectParty={(p) => setSelectedPartyId(p ? p.id : "")}
                    allowedTypes={["CUSTOMER", "DUAL"]}
                    allowCashOption={false}
                    placeholder="Search or Select Customer..."
                    defaultNewPartyType="CUSTOMER"
                  />
                </div>

                {/* Amount Received */}
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Amount Received (Rs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-9 font-mono font-semibold text-emerald-800"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Deposit Channel</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === "CASH" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("CASH")}
                      className="h-9"
                    >
                      Cash-in-Hand
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "BANK" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("BANK")}
                      className="h-9"
                    >
                      Bank Account
                    </Button>
                  </div>
                </div>

                {paymentMethod === "BANK" ? (
                  <div className="space-y-1.5">
                    <label className="font-medium text-zinc-700">Receiving Bank</label>
                    <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Bank Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bankName} - {b.accountNumber} ({formatCurrency(b.currentBalance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="font-medium text-zinc-700">Reference / Slip No.</label>
                    <Input
                      type="text"
                      placeholder="e.g. Counter Cash Receipt #42"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="h-9 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Particulars */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-700">Particulars / Memo</label>
                <Input
                  type="text"
                  placeholder="Recovery against past credit invoices"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  className="h-8"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => handlePostVoucher("RECEIPT")}
                  disabled={isSubmitting || !amount}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-9 px-5"
                >
                  {isSubmitting ? "Posting..." : "Post Receipt Voucher"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: SUPPLIER PAYMENT VOUCHER */}
        <TabsContent value="payment" className="flex-1 mt-4">
          <Card>
            <CardHeader className="py-3 px-4 border-b border-zinc-100">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-blue-800 flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4" />
                <span>Issue Supplier Payment / Vendor Dues Settlement</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                {/* Supplier Account */}
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Vendor / Supplier</label>
                  <PartyCombobox
                    parties={parties}
                    selectedPartyId={selectedPartyId || null}
                    onSelectParty={(p) => setSelectedPartyId(p ? p.id : "")}
                    allowedTypes={["SUPPLIER", "DUAL"]}
                    allowCashOption={false}
                    placeholder="Search or Select Supplier..."
                    defaultNewPartyType="SUPPLIER"
                  />
                </div>

                {/* Amount Paid */}
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Amount Paid (Rs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-9 font-mono font-semibold text-blue-800"
                  />
                </div>
              </div>

              {/* Disbursement Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Disbursement Source</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={paymentMethod === "CASH" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("CASH")}
                      className="h-9"
                    >
                      Cash-in-Hand
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "BANK" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("BANK")}
                      className="h-9"
                    >
                      Bank Transfer
                    </Button>
                  </div>
                </div>

                {paymentMethod === "BANK" ? (
                  <div className="space-y-1.5">
                    <label className="font-medium text-zinc-700">Disbursing Bank</label>
                    <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Disbursing Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bankName} - {b.accountNumber} ({formatCurrency(b.currentBalance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="font-medium text-zinc-700">Payment Ref / Voucher No.</label>
                    <Input
                      type="text"
                      placeholder="e.g. PV-901"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="h-9 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Particulars */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-700">Particulars / Memo</label>
                <Input
                  type="text"
                  placeholder="Payment against inward inventory shipments"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  className="h-8"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => handlePostVoucher("PAYMENT")}
                  disabled={isSubmitting || !amount}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs h-9 px-5"
                >
                  {isSubmitting ? "Posting..." : "Post Payment Voucher"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CONTRA BARTER SETTLEMENT */}
        <TabsContent value="contra" className="flex-1 mt-4">
          <Card>
            <CardHeader className="py-3 px-4 border-b border-zinc-100">
              <CardTitle className="text-xs uppercase tracking-wider font-semibold text-purple-800 flex items-center gap-1.5">
                <Repeat className="h-4 w-4" />
                <span>Contra Barter Settlement Voucher (Dual Parties)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                {/* Dual Party */}
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Dual Trading Party</label>
                  <PartyCombobox
                    parties={parties}
                    selectedPartyId={contraPartyId || null}
                    onSelectParty={(p) => setContraPartyId(p ? p.id : "")}
                    allowedTypes={["DUAL"]}
                    allowCashOption={false}
                    placeholder="Select Dual Trading Party..."
                    defaultNewPartyType="DUAL"
                  />
                </div>

                {/* Netted Amount */}
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Netted Amount to Contra (Rs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={nettedAmount}
                    onChange={(e) => setNettedAmount(e.target.value)}
                    className="h-9 font-mono font-semibold text-purple-800"
                  />
                </div>
              </div>

              {/* Cash Difference Adjustment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Residual Cash Differential (Rs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cashDifference}
                    onChange={(e) => setCashDifference(e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-700">Difference Action</label>
                  <Select value={differenceAction} onValueChange={(val: any) => setDifferenceAction(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Difference Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None (Pure Ledger Contra Offset)</SelectItem>
                      <SelectItem value="RECEIVE_CASH">Receive Cash Difference into Cash Drawer</SelectItem>
                      <SelectItem value="PAY_CASH">Pay Cash Difference to Party</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Memo */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-700">Settlement Memo</label>
                <Input
                  type="text"
                  placeholder="Quarterly barter clearance: sanitary goods vs brass pipe fittings"
                  value={contraParticulars}
                  onChange={(e) => setContraParticulars(e.target.value)}
                  className="h-8"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handlePostContra}
                  disabled={isSubmitting || !nettedAmount}
                  className="bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs h-9 px-5"
                >
                  {isSubmitting ? "Settling..." : "Post Contra Barter Settlement"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
