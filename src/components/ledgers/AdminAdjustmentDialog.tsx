"use client";

import React, { useState } from "react";
import { postAdminAdjustmentVoucher } from "@/actions/ledgers";
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
import { SlidersHorizontal } from "lucide-react";

interface AdminAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string;
  partyName: string;
  onSuccess?: () => void;
}

export function AdminAdjustmentDialog({
  open,
  onOpenChange,
  partyId,
  partyName,
  onSuccess,
}: AdminAdjustmentDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"DEBIT_NOTE" | "CREDIT_NOTE">("CREDIT_NOTE");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await postAdminAdjustmentVoucher({
      partyId,
      type,
      amount,
      reason,
    });

    setSubmitting(false);

    if (res.success) {
      setAmount("");
      setReason("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } else {
      setError((res as { error?: string }).error || "Failed to post adjustment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900 flex items-center">
            <SlidersHorizontal className="h-4 w-4 mr-1.5 text-zinc-700" />
            Admin Khata Adjustment Voucher
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Post an audited debit or credit note for {partyName} preserving double-entry balancing.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-medium text-zinc-700 block mb-1">Adjustment Type</label>
            <Select
              value={type}
              onValueChange={(val) => setType(val as "DEBIT_NOTE" | "CREDIT_NOTE")}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDIT_NOTE">
                  Credit Note (Discount / Rebate / Reduce Receivable)
                </SelectItem>
                <SelectItem value="DEBIT_NOTE">
                  Debit Note (Additional Charge / Increase Receivable)
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[10px] text-zinc-400 block mt-1">
              {type === "CREDIT_NOTE"
                ? "Posts a debit to Kasr/Discount Expense and credits the party ledger."
                : "Debits the party ledger and credits Sales Revenue."}
            </span>
          </div>

          <div>
            <label className="font-medium text-zinc-700 block mb-1">
              Adjustment Amount (Rs.) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 text-xs font-mono font-semibold"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="font-medium text-zinc-700 block mb-1">
              Reason / Audit Memo <span className="text-red-500">*</span>
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Special festive rebate authorized by manager"
              className="h-9 text-xs"
              required
            />
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
              {submitting ? "Posting..." : "Post Adjustment Voucher"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
