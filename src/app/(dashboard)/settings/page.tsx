"use client";

import React, { useEffect, useState } from "react";
import { getSettingsFormData, updateStoreSettings } from "@/actions/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState({
    businessName: "Trading Co.",
    tagline: "",
    phonePrimary: "",
    phoneSecondary: "",
    email: "",
    address: "",
    ntnNumber: "",
    strnNumber: "",
    fbrPosIntegrated: false,
    defaultInvoiceFormat: "THERMAL_80MM",
    invoicePrefixEstimate: "EST",
    invoicePrefixTax: "TAX",
    thermalPaperWidth: "80mm",
    thermalPrinterHeader: "",
    thermalPrinterFooter: "Exchange within 3 days with bill. No cash refund.",
    defaultWarehouseId: "",
    enableCreditLimitEnforcement: false,
    roundOffThreshold: "5.00",
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getSettingsFormData();
      if (res.success && res.settings) {
        setFormData({
          businessName: res.settings.businessName || "Trading Co.",
          tagline: res.settings.tagline || "",
          phonePrimary: res.settings.phonePrimary || "",
          phoneSecondary: res.settings.phoneSecondary || "",
          email: res.settings.email || "",
          address: res.settings.address || "",
          ntnNumber: res.settings.ntnNumber || "",
          strnNumber: res.settings.strnNumber || "",
          fbrPosIntegrated: !!res.settings.fbrPosIntegrated,
          defaultInvoiceFormat: res.settings.defaultInvoiceFormat || "THERMAL_80MM",
          invoicePrefixEstimate: res.settings.invoicePrefixEstimate || "EST",
          invoicePrefixTax: res.settings.invoicePrefixTax || "TAX",
          thermalPaperWidth: res.settings.thermalPaperWidth || "80mm",
          thermalPrinterHeader: res.settings.thermalPrinterHeader || "",
          thermalPrinterFooter: res.settings.thermalPrinterFooter || "Exchange within 3 days with bill. No cash refund.",
          defaultWarehouseId: res.settings.defaultWarehouseId || "",
          enableCreditLimitEnforcement: !!res.settings.enableCreditLimitEnforcement,
          roundOffThreshold: res.settings.roundOffThreshold || "5.00",
        });
      }
      if (res.warehouses) {
        setWarehouses(res.warehouses);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await updateStoreSettings({
      ...formData,
      defaultWarehouseId: formData.defaultWarehouseId || null,
    });

    setSaving(false);
    if (res.success) {
      setMessage({ type: "success", text: "Store settings saved successfully." });
      setTimeout(() => setMessage(null), 4000);
    } else {
      setMessage({ type: "error", text: res.error || "Failed to update settings" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-500 font-medium text-sm animate-pulse">Loading Store Settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 max-w-5xl mx-auto overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Master Store Settings</h1>
          <p className="text-xs text-zinc-500">
            Configure legal identifiers, operational defaults, and printing engines across the ERP.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {message && (
            <Badge
              variant={message.type === "success" ? "default" : "destructive"}
              className={message.type === "success" ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
            >
              {message.text}
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-4 h-9"
          >
            {saving ? "Saving Changes..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="profile" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-3 max-w-md bg-zinc-100 p-1 border border-zinc-200">
          <TabsTrigger value="profile" className="text-xs font-semibold">
            Profile & Legal
          </TabsTrigger>
          <TabsTrigger value="invoice" className="text-xs font-semibold">
            Invoice & Printing
          </TabsTrigger>
          <TabsTrigger value="trading" className="text-xs font-semibold">
            Trading Rules
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile & Legal */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card className="border-zinc-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Merchant Profile</CardTitle>
              <CardDescription className="text-xs">
                Business identity shown on thermal receipts, A4 invoices, and khata statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.businessName}
                    onChange={(e) => handleChange("businessName", e.target.value)}
                    placeholder="e.g. Al-Madina Trading Co."
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Tagline / Slogan</label>
                  <Input
                    value={formData.tagline}
                    onChange={(e) => handleChange("tagline", e.target.value)}
                    placeholder="e.g. Wholesale Hardware & Sanitary Importers"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Physical Address</label>
                <Input
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="e.g. Shop #14, Daryalal Street, Jodia Bazaar, Karachi"
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Primary Phone</label>
                  <Input
                    value={formData.phonePrimary}
                    onChange={(e) => handleChange("phonePrimary", e.target.value)}
                    placeholder="+92 300 1234567"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Secondary Phone / WhatsApp</label>
                  <Input
                    value={formData.phoneSecondary}
                    onChange={(e) => handleChange("phoneSecondary", e.target.value)}
                    placeholder="+92 321 7654321"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Official Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="sales@tradingco.pk"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tax & Regulatory Identifiers</CardTitle>
              <CardDescription className="text-xs">
                Official federal tax registrations for compliant Tax Invoices (Pakka Bills).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">National Tax Number (NTN)</label>
                  <Input
                    value={formData.ntnNumber}
                    onChange={(e) => handleChange("ntnNumber", e.target.value)}
                    placeholder="e.g. 7482910-4"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Sales Tax Registration (STRN)</label>
                  <Input
                    value={formData.strnNumber}
                    onChange={(e) => handleChange("strnNumber", e.target.value)}
                    placeholder="e.g. 32-77-8761-234-91"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="fbrPosIntegrated"
                  checked={formData.fbrPosIntegrated}
                  onChange={(e) => handleChange("fbrPosIntegrated", e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <label htmlFor="fbrPosIntegrated" className="text-xs font-medium text-zinc-800 cursor-pointer">
                  FBR POS Integration Enabled (QR code & fiscal invoice mode)
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Invoice & Printing */}
        <TabsContent value="invoice" className="mt-4 space-y-4">
          <Card className="border-zinc-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Print Output Configuration</CardTitle>
              <CardDescription className="text-xs">
                Select default print layout for POS Counter checkout and specify thermal dimensions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Default POS Output Format</label>
                  <select
                    value={formData.defaultInvoiceFormat}
                    onChange={(e) => handleChange("defaultInvoiceFormat", e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-900 shadow-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="THERMAL_80MM">Thermal Receipt (80mm / 58mm CSS)</option>
                    <option value="PDF_A4">Standard A4 Vector PDF Invoice</option>
                    <option value="PDF_A5">Compact A5 Half-Page Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Thermal Receipt Width</label>
                  <select
                    value={formData.thermalPaperWidth}
                    onChange={(e) => handleChange("thermalPaperWidth", e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-900 shadow-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="80mm">80mm Standard POS Roll (3.15 in)</option>
                    <option value="58mm">58mm Compact POS Roll (2.28 in)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Thermal Header Banner Text</label>
                <Input
                  value={formData.thermalPrinterHeader}
                  onChange={(e) => handleChange("thermalPrinterHeader", e.target.value)}
                  placeholder="e.g. TRADING CO. - WHOLESALE MERCHANTS"
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Printed in bold at the top of thermal slips below the business name.
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Return Policy & Footer Terms</label>
                <Input
                  value={formData.thermalPrinterFooter}
                  onChange={(e) => handleChange("thermalPrinterFooter", e.target.value)}
                  placeholder="e.g. Exchange within 3 days with original bill. No cash refund."
                  className="h-9 text-xs"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Printed at bottom of thermal slips and footer of A4 invoices.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Trading Rules */}
        <TabsContent value="trading" className="mt-4 space-y-4">
          <Card className="border-zinc-200 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Operational Controls & Sequence Prefixes</CardTitle>
              <CardDescription className="text-xs">
                Enforce operational business policies, credit ceilings, and document prefixes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Default Counter Warehouse</label>
                  <select
                    value={formData.defaultWarehouseId}
                    onChange={(e) => handleChange("defaultWarehouseId", e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-900 shadow-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="">-- Select Default Warehouse --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Round-off Threshold (Rs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.roundOffThreshold}
                    onChange={(e) => handleChange("roundOffThreshold", e.target.value)}
                    placeholder="5.00"
                    className="h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-zinc-400 mt-1 block">
                    Maximum allowed automatic Kasr discount deduction at POS checkout.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Estimate Invoice Prefix</label>
                  <Input
                    value={formData.invoicePrefixEstimate}
                    onChange={(e) => handleChange("invoicePrefixEstimate", e.target.value)}
                    placeholder="EST"
                    className="h-9 text-xs font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Tax Invoice Prefix</label>
                  <Input
                    value={formData.invoicePrefixTax}
                    onChange={(e) => handleChange("invoicePrefixTax", e.target.value)}
                    placeholder="TAX"
                    className="h-9 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enableCreditLimitEnforcement"
                    checked={formData.enableCreditLimitEnforcement}
                    onChange={(e) => handleChange("enableCreditLimitEnforcement", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <label
                    htmlFor="enableCreditLimitEnforcement"
                    className="text-xs font-medium text-zinc-800 cursor-pointer"
                  >
                    Enforce Customer Credit Limit (Prevent sale if balance exceeds ceiling)
                  </label>
                </div>
                <p className="text-[11px] text-zinc-500 ml-6 mt-0.5">
                  When enabled, billing checkout validates customer ledger balance + invoice total against customer credit limit.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
