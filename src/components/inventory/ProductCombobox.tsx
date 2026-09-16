"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductDialog } from "./ProductDialog";
import { formatCurrency } from "@/utils/format";
import { Search, ChevronsUpDown, Check, Plus, Box } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductComboboxItem {
  id: string;
  name: string;
  sku?: string | null;
  parentUnit: string;
  childUnit: string;
  conversionRate: number;
  defaultSaleRate?: string;
  totalChildStock?: number;
}

interface ProductComboboxProps {
  products: ProductComboboxItem[];
  selectedProductId: string | null;
  onSelectProduct: (product: ProductComboboxItem | null) => void;
  placeholder?: string;
  className?: string;
}

export function ProductCombobox({
  products,
  selectedProductId,
  onSelectProduct,
  placeholder = "Select product...",
  className,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleOpenNewProduct = () => {
    setNewProductName(search.trim());
    setOpen(false);
    setDialogOpen(true);
  };

  const handleProductCreated = (created: any) => {
    onSelectProduct(created);
    setSearch("");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal text-xs h-9 bg-white border-zinc-200 px-3 hover:bg-zinc-50",
              className
            )}
          >
            <div className="flex items-center space-x-2 truncate">
              <Box className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="truncate font-medium text-zinc-900">
                {selectedProduct ? selectedProduct.name : placeholder}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0 ml-2">
              {selectedProduct?.sku && (
                <span className="font-mono text-[10px] text-zinc-400">
                  {selectedProduct.sku}
                </span>
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-400" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2 bg-white shadow-lg border border-zinc-200" align="start">
          <div className="space-y-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU..."
                className="pl-8 h-8 text-xs font-normal"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 border border-zinc-100 rounded">
              {filtered.map((p) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectProduct(p);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`p-2 text-xs flex justify-between items-center cursor-pointer hover:bg-zinc-50 ${
                      isSelected ? "bg-zinc-50 font-semibold text-zinc-900" : "text-zinc-700"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium truncate text-zinc-900">{p.name}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center space-x-1.5 font-mono">
                        <span>{p.sku || "NO-SKU"}</span>
                        <span>•</span>
                        <span>1 {p.parentUnit} = {p.conversionRate} {p.childUnit}s</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[11px] font-bold text-zinc-900">
                        {formatCurrency(p.defaultSaleRate || 0)}
                      </div>
                      {isSelected && <Check className="h-3 w-3 text-zinc-900 ml-auto mt-0.5" />}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-zinc-400">
                  No products found matching &ldquo;{search}&rdquo;.
                </div>
              )}
            </div>

            {/* Quick-Add Option */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenNewProduct}
              className="w-full h-8 text-xs font-medium border-dashed border-zinc-300 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 flex items-center justify-center space-x-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{search.trim() ? `Add "${search.trim()}" as New Product` : "Add New Product"}</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={newProductName}
        onSuccess={handleProductCreated}
      />
    </>
  );
}
