"use client";

import React, { useState, useEffect } from "react";
import { createParty, updateParty } from "@/actions/parties";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (party: any) => void;
  partyToEdit?: {
    id: string;
    name: string;
    type: "CUSTOMER" | "SUPPLIER" | "DUAL";
    phone?: string | null;
    address?: string | null;
    creditLimit?: string;
  } | null;
  defaultType?: "CUSTOMER" | "SUPPLIER" | "DUAL";
  initialName?: string;
}

export function PartyDialog({
  open,
  onOpenChange,
  onSuccess,
  partyToEdit = null,
  defaultType = "CUSTOMER",
  initialName = "",
}: PartyDialogProps) {
  const isEditing = !!partyToEdit;
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

  useEffect(() => {
    if (partyToEdit) {
      setFormData({
        name: partyToEdit.name,
        type: partyToEdit.type,
        phone: partyToEdit.phone || "",
        address: partyToEdit.address || "",
        creditLimit: partyToEdit.creditLimit || "0.00",
        openingBalance: "0.00",
        balanceType: "DEBIT",
      });
    } else {
      setFormData({
        name: initialName || "",
        type: defaultType,
        phone: "",
        address: "",
        creditLimit: "0.00",
        openingBalance: "0.00",
        balanceType: "DEBIT",
      });
    }
    setError(null);
  }, [partyToEdit, initialName, defaultType, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (isEditing && partyToEdit) {
      const res = await updateParty({
        id: partyToEdit.id,
        name: formData.name,
        type: formData.type,
        phone: formData.phone,
        address: formData.address,
        creditLimit: formData.creditLimit,
      });
      setSubmitting(false);

      if (res.success && res.party) {
        onOpenChange(false);
        if (onSuccess) onSuccess(res.party);
      } else {
        setError(res.error || "Failed to update party");
      }
    } else {
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
        onOpenChange(false);
        if (onSuccess) onSuccess(res.party);
      } else {
        setError(res.error || "Failed to create party");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">
            {isEditing ? "Edit Trading Party" : "Add New Trading Party"}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            {isEditing
              ? "Update contact details and credit limits for this party."
              : "Register customer or supplier account with opening balance and credit controls."}
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
              <label className="font-medium text-zinc-700 block mb-1">Classification</label>
              <Select
                value={formData.type}
                onValueChange={(val) =>
                  setFormData({
                    ...formData,
                    type: val as "CUSTOMER" | "SUPPLIER" | "DUAL",
                  })
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  <SelectItem value="DUAL">Dual (Customer & Supplier)</SelectItem>
                </SelectContent>
              </Select>
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

            {!isEditing ? (
              <div>
                <label className="font-medium text-zinc-700 block mb-1">Opening Balance (Rs.)</label>
                <div className="flex space-x-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) =>
                      setFormData({ ...formData, openingBalance: e.target.value })
                    }
                    placeholder="0.00"
                    className="h-9 text-xs font-mono flex-1"
                  />
                  <Select
                    value={formData.balanceType}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
                        balanceType: val as "DEBIT" | "CREDIT",
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-28 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBIT">Dr (Receivable)</SelectItem>
                      <SelectItem value="CREDIT">Cr (Payable)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-center">
                <span className="text-[10px] text-zinc-400">
                  Opening balance ledger entry is permanent to preserve audit immutability.
                </span>
              </div>
            )}
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
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
