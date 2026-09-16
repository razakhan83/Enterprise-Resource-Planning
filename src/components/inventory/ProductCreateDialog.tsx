"use client";

import React, { useState } from "react";
import { createProduct } from "@/actions/inventory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProductCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (product: any) => void;
}

export function ProductCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProductCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    parentUnit: "Carton",
    childUnit: "Piece",
    conversionRate: 1,
    defaultSaleRate: "0.00",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await createProduct({
      name: formData.name,
      sku: formData.sku || undefined,
      parentUnit: formData.parentUnit,
      childUnit: formData.childUnit,
      conversionRate: Number(formData.conversionRate),
      defaultSaleRate: formData.defaultSaleRate,
    });

    setSubmitting(false);

    if (res.success && res.product) {
      setFormData({
        name: "",
        sku: "",
        parentUnit: "Carton",
        childUnit: "Piece",
        conversionRate: 1,
        defaultSaleRate: "0.00",
      });
      onOpenChange(false);
      if (onSuccess) onSuccess(res.product);
    } else {
      setError(res.error || "Failed to create product");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">
            Add New Master Product
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            Define wholesale dual-packaging units, conversion factors, and default counter selling rate.
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
              Product Description / Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Heavy Duty Gate Valve 1-inch"
              className="h-9 text-xs"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="font-medium text-zinc-700 block mb-1">SKU / Item Code</label>
            <Input
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="e.g. VLV-GV-01"
              className="h-9 text-xs font-mono uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-zinc-700 block mb-1">
                Parent Unit (Wholesale Bulk) <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.parentUnit}
                onChange={(e) => setFormData({ ...formData, parentUnit: e.target.value })}
                placeholder="Carton, Bora, Box"
                className="h-9 text-xs"
                required
              />
            </div>

            <div>
              <label className="font-medium text-zinc-700 block mb-1">
                Child Unit (Retail Base) <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.childUnit}
                onChange={(e) => setFormData({ ...formData, childUnit: e.target.value })}
                placeholder="Piece, KG, Meter"
                className="h-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
            <div>
              <label className="font-medium text-zinc-700 block mb-1">
                Conversion Ratio <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                value={formData.conversionRate}
                onChange={(e) =>
                  setFormData({ ...formData, conversionRate: parseInt(e.target.value) || 1 })
                }
                className="h-9 text-xs font-mono"
                required
              />
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                1 {formData.parentUnit || "Parent"} = {formData.conversionRate} {formData.childUnit || "Child"}s
              </span>
            </div>

            <div>
              <label className="font-medium text-zinc-700 block mb-1">
                Default Selling Rate (Rs. / {formData.childUnit || "Child"}) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.defaultSaleRate}
                onChange={(e) => setFormData({ ...formData, defaultSaleRate: e.target.value })}
                placeholder="0.00"
                className="h-9 text-xs font-mono"
                required
              />
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                Bulk: Rs. {(Number(formData.defaultSaleRate || 0) * (formData.conversionRate || 1)).toFixed(2)} / {formData.parentUnit || "Parent"}
              </span>
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
              {submitting ? "Saving..." : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
