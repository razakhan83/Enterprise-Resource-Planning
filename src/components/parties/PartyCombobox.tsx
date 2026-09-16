"use client";

import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PartyDialog } from "./PartyDialog";
import { formatCurrency } from "@/utils/format";
import { Search, ChevronsUpDown, Check, Plus, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PartyComboboxItem {
  id: string;
  name: string;
  type: string;
  phone?: string | null;
  address?: string | null;
  currentBalance: string;
}

interface PartyComboboxProps {
  parties: PartyComboboxItem[];
  selectedPartyId: string | null;
  onSelectParty: (party: PartyComboboxItem | null) => void;
  allowedTypes?: ("CUSTOMER" | "SUPPLIER" | "DUAL")[];
  allowCashOption?: boolean;
  placeholder?: string;
  defaultNewPartyType?: "CUSTOMER" | "SUPPLIER" | "DUAL";
  className?: string;
}

export function PartyCombobox({
  parties,
  selectedPartyId,
  onSelectParty,
  allowedTypes,
  allowCashOption = true,
  placeholder = "Select Party...",
  defaultNewPartyType = "CUSTOMER",
  className,
}: PartyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");

  const filteredParties = parties.filter((p) => {
    if (allowedTypes && !allowedTypes.includes(p.type as any)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  });

  const selectedParty = parties.find((p) => p.id === selectedPartyId);

  const handleOpenNewParty = () => {
    setNewPartyName(search.trim());
    setOpen(false);
    setDialogOpen(true);
  };

  const handlePartyCreated = (created: any) => {
    onSelectParty(created);
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
              <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="truncate font-medium text-zinc-900">
                {selectedParty
                  ? selectedParty.name
                  : allowCashOption && selectedPartyId === null
                  ? "Cash Customer (Walk-in)"
                  : placeholder}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0 ml-2">
              {selectedParty && (
                <span className="font-mono text-[10px] text-zinc-500 font-semibold">
                  {formatCurrency(selectedParty.currentBalance)}
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
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
                placeholder="Search party by name, phone..."
                className="pl-8 pr-7 h-8 text-xs font-normal"
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5"
                  title="Clear party search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* List */}
            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 border border-zinc-100 rounded">
              {/* Optional Cash Customer Option */}
              {allowCashOption && !search && (
                <div
                  onClick={() => {
                    onSelectParty(null);
                    setOpen(false);
                  }}
                  className={`p-2 text-xs flex justify-between items-center cursor-pointer hover:bg-zinc-50 ${
                    selectedPartyId === null ? "bg-zinc-50 font-semibold text-zinc-900" : "text-zinc-700"
                  }`}
                >
                  <div>
                    <div className="font-medium">Cash Customer</div>
                    <div className="text-[10px] text-zinc-400">Direct walk-in cash drawer</div>
                  </div>
                  {selectedPartyId === null && <Check className="h-3.5 w-3.5 text-zinc-900" />}
                </div>
              )}

              {filteredParties.map((p) => {
                const isSelected = selectedPartyId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onSelectParty(p);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`p-2 text-xs flex justify-between items-center cursor-pointer hover:bg-zinc-50 ${
                      isSelected ? "bg-zinc-50 font-semibold text-zinc-900" : "text-zinc-700"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-medium truncate text-zinc-900">{p.name}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center space-x-1.5">
                        <span>{p.phone || "No phone"}</span>
                        <span>•</span>
                        <span className="font-mono">{p.type}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[11px] font-bold text-zinc-900">
                        {formatCurrency(p.currentBalance)}
                      </div>
                      {isSelected && <Check className="h-3 w-3 text-zinc-900 ml-auto mt-0.5" />}
                    </div>
                  </div>
                );
              })}

              {filteredParties.length === 0 && (
                <div className="p-3 text-center text-xs text-zinc-400">
                  No registered parties found matching &ldquo;{search}&rdquo;.
                </div>
              )}
            </div>

            {/* Quick-Add Option */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenNewParty}
              className="w-full h-8 text-xs font-medium border-dashed border-zinc-300 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 flex items-center justify-center space-x-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{search.trim() ? `Add "${search.trim()}" as New Party` : "Add New Party"}</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <PartyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialName={newPartyName}
        defaultType={defaultNewPartyType}
        onSuccess={handlePartyCreated}
      />
    </>
  );
}
