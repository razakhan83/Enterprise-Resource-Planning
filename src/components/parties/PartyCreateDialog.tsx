"use client";

import React, { useState } from "react";
import { createParty } from "@/actions/parties";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PartyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (party: any) => void;
  defaultType?: "CUSTOMER" | "SUPPLIER" | "DUAL";
}

export function PartyCreateDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultType = "CUSTOMER",
}: PartyCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: defaultType,
    phone: "",
    address: "",
    creditLimit: "0.00",
    openingBalance: "0.00",
    balanceType: "DEBIT" as "DEBIT" | "CREDIT",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await createParty({
      name: formData.name,
      type: formData.type,
      phone: formData.phone,
      address: formData.address,
      creditLimit: formData.creditLimit,
      openingBalance: formData.openingBalance,
      balanceType: formData.balanceType,
    });

    setSubmitting(false);

    if (res.success && res.party) {
      // Reset form
      setFormData({
        name: "",
        type: defaultType,
        phone: "",
        address: "",
        creditLimit: "0.00",
        openingBalance: "0.00",
        balanceType: "DEBIT",
      });
      onOpenChange(false);
      if (onSuccess) onSuccess(res.party);
    } else {
      setError(res.error || "Failed to create party");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">
            Add New Trading Party
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Create a customer, supplier, or dual trading partner with opening balance & credit controls.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-medium text-zinc-700 block mb-1">
              Party / Company Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Al-Madina Hardware Store"
              className="h-9 text-xs"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-zinc-700 block mb-1">Account Classification</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "CUSTOMER" | "SUPPLIER" | "DUAL",
                  })
                }
                className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-900 shadow-xs focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="CUSTOMER">Customer (Wholesale / Retail)</option>
                <option value="SUPPLIER">Supplier (Vendor)</option>
                <option value="DUAL">Dual (Customer & Vendor)</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-zinc-700 block mb-1">Contact Phone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+92 300 1234567"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-medium text-zinc-700 block mb-1">Business Address</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Shop #, Market, City"
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
            <div>
              <label className="font-medium text-zinc-700 block mb-1">Credit Limit (Rs.)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                placeholder="0.00"
                className="h-9 text-xs font-mono"
              />
              <span className="text-[10px] text-zinc-400 block mt-0.5">0 = No limit or cash only</span>
            </div>

            <div>
              <label className="font-medium text-zinc-700 block mb-1">Opening Balance (Rs.)</label>
              <div className="flex space-x-1">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  placeholder="0.00"
                  className="h-9 text-xs font-mono flex-1"
                />
                <select
                  value={formData.balanceType}
                  onChange={(e) =>
                    setFormData({ ...formData, balanceType: e.target.value as "DEBIT" | "CREDIT" })
                  }
                  className="h-9 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-bold text-zinc-700 focus:outline-none"
                >
                  <option value="DEBIT">Dr (Receivable)</option>
                  <option value="CREDIT">Cr (Payable)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-8 px-4 text-xs bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {submitting ? "Creating..." : "Save Party Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
