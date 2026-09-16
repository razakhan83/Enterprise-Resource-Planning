"use client";

import React, { useState, useEffect } from "react";
import { getPartiesList } from "@/actions/parties";
import { formatCurrency } from "@/utils/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { PartyDialog } from "@/components/parties/PartyDialog";
import { UserPlus, Search, Pencil } from "lucide-react";

export default function PartiesPage() {
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [partyToEdit, setPartyToEdit] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const loadParties = async () => {
    setLoading(true);
    const res = await getPartiesList();
    if (res.success && res.parties) {
      setParties(res.parties);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadParties();
  }, []);

  const filtered = parties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone && p.phone.includes(search)) ||
      (p.address && p.address.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === "ALL" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full gap-4">
      <Card className="border-zinc-200 shadow-xs flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900">
                Party & Khata Directory
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 mt-0.5">
                Manage registered wholesale customers, vendors, and dual trading accounts with credit limits.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="font-mono text-xs">
                {parties.length} Accounts
              </Badge>
              <Button
                onClick={() => {
                  setPartyToEdit(null);
                  setDialogOpen(true);
                }}
                className="h-8 px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium flex items-center space-x-1"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                <span>Add New Party</span>
              </Button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex items-center justify-between pt-3 gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search party by name, phone, or location..."
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="flex items-center space-x-1 bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs">
              {["ALL", "CUSTOMER", "SUPPLIER", "DUAL"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                    filterType === type
                      ? "bg-white text-zinc-950 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-xs text-zinc-400">
              Loading party directory...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-zinc-500">
              No matching parties found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-60">Account Name</TableHead>
                  <TableHead className="w-28">Classification</TableHead>
                  <TableHead className="w-36">Contact Phone</TableHead>
                  <TableHead>Registered Address</TableHead>
                  <TableHead className="w-32 text-right">Credit Limit</TableHead>
                  <TableHead className="w-36 text-right">Current Balance</TableHead>
                  <TableHead className="w-20 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const balNum = Number(p.currentBalance || 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold text-xs text-zinc-900">
                        {p.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.type === "CUSTOMER"
                              ? "default"
                              : p.type === "SUPPLIER"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px] font-medium"
                        >
                          {p.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-600">
                        {p.phone || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 truncate max-w-xs">
                        {p.address || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-right text-xs text-zinc-600">
                        {Number(p.creditLimit) > 0 ? formatCurrency(p.creditLimit) : "Uncapped"}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-right font-bold text-xs ${
                          balNum > 0
                            ? "text-emerald-700"
                            : balNum < 0
                            ? "text-red-700"
                            : "text-zinc-600"
                        }`}
                      >
                        {formatCurrency(p.currentBalance)}
                        <span className="text-[10px] font-normal text-zinc-400 ml-1">
                          {balNum > 0 ? "Dr" : balNum < 0 ? "Cr" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPartyToEdit(p);
                            setDialogOpen(true);
                          }}
                          className="h-7 px-2 text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          <span>Edit</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PartyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partyToEdit={partyToEdit}
        onSuccess={() => loadParties()}
      />
    </div>
  );
}
