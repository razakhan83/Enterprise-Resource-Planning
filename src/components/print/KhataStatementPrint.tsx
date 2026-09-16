import React from "react";
import { formatCurrency, formatDate } from "@/utils/format";

export interface StatementTx {
  id: string;
  type: string;
  particulars: string;
  debit: string;
  credit: string;
  runningBalance: string;
  createdAt: Date | string;
}

export interface KhataStatementPrintProps {
  partyName: string;
  partyPhone?: string | null;
  partyAddress?: string | null;
  periodLabel: string;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  transactions: StatementTx[];
  settings?: any;
}

export const KhataStatementPrint: React.FC<KhataStatementPrintProps> = ({
  partyName,
  partyPhone,
  partyAddress,
  periodLabel,
  openingBalance,
  totalDebit,
  totalCredit,
  closingBalance,
  transactions,
  settings,
}) => {
  const businessName = settings?.businessName || "Trading Co.";
  const address = settings?.address || "Wholesale Commercial Market";
  const phone = settings?.phonePrimary || "+92 300 1234567";
  const ntn = settings?.ntnNumber;

  const opNum = Number(openingBalance || 0);
  const clNum = Number(closingBalance || 0);

  return (
    <div id="khata-statement-print" className="bg-white text-zinc-900 p-8 max-w-4xl mx-auto font-sans text-xs">
      {/* Header */}
      <div className="border-b-2 border-zinc-900 pb-4 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">{businessName}</h1>
          <p className="text-zinc-600 text-[11px]">{address}</p>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
            Tel: {phone} {ntn && <span>| NTN: {ntn}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="inline-block px-3 py-1 bg-zinc-900 text-white font-mono font-bold text-xs uppercase rounded">
            PARTY KHATA STATEMENT
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-medium">Period: {periodLabel}</div>
          <div className="text-[10px] text-zinc-400 font-mono">Generated: {formatDate(new Date())}</div>
        </div>
      </div>

      {/* Party Meta */}
      <div className="bg-zinc-50 border border-zinc-200 rounded p-3 mb-4 flex justify-between items-center">
        <div>
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Account Information</div>
          <div className="text-sm font-bold text-zinc-900">{partyName}</div>
          {partyAddress && <div className="text-zinc-600 text-[11px]">{partyAddress}</div>}
        </div>
        <div className="text-right font-mono">
          {partyPhone && <div className="text-zinc-700">Phone: {partyPhone}</div>}
          <div className="text-[11px] font-semibold text-zinc-900 mt-0.5">
            Closing Balance:{" "}
            <span className={clNum > 0 ? "text-emerald-700" : clNum < 0 ? "text-red-700" : ""}>
              {formatCurrency(closingBalance)} {clNum > 0 ? "Dr" : clNum < 0 ? "Cr" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <table className="w-full border-collapse text-xs mb-4">
        <thead>
          <tr className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-300">
            <th className="py-2 px-2 text-left w-36">Posting Date</th>
            <th className="py-2 px-2 text-center w-24">Type</th>
            <th className="py-2 px-2 text-left">Particulars / Details</th>
            <th className="py-2 px-2 text-right w-28">Debit (Rs.)</th>
            <th className="py-2 px-2 text-right w-28">Credit (Rs.)</th>
            <th className="py-2 px-2 text-right w-32">Balance (Rs.)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {/* Opening Balance Row */}
          <tr className="bg-zinc-50 font-semibold text-zinc-700">
            <td className="py-2 px-2 font-mono text-[11px]">-</td>
            <td className="py-2 px-2 text-center text-[10px] font-mono">B/F</td>
            <td className="py-2 px-2 italic">Opening Balance Brought Forward</td>
            <td className="py-2 px-2 text-right font-mono">{opNum > 0 ? formatCurrency(openingBalance) : "-"}</td>
            <td className="py-2 px-2 text-right font-mono">{opNum < 0 ? formatCurrency(Math.abs(opNum)) : "-"}</td>
            <td className="py-2 px-2 text-right font-mono font-bold text-zinc-900">
              {formatCurrency(openingBalance)} {opNum > 0 ? "Dr" : opNum < 0 ? "Cr" : ""}
            </td>
          </tr>

          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-zinc-50/50">
              <td className="py-1.5 px-2 font-mono text-[11px] text-zinc-600">{formatDate(tx.createdAt)}</td>
              <td className="py-1.5 px-2 text-center font-mono text-[10px] text-zinc-500">{tx.type}</td>
              <td className="py-1.5 px-2 text-zinc-800">{tx.particulars}</td>
              <td className="py-1.5 px-2 text-right font-mono">
                {Number(tx.debit) > 0 ? formatCurrency(tx.debit) : "-"}
              </td>
              <td className="py-1.5 px-2 text-right font-mono">
                {Number(tx.credit) > 0 ? formatCurrency(tx.credit) : "-"}
              </td>
              <td className="py-1.5 px-2 text-right font-mono font-semibold text-zinc-900">
                {formatCurrency(tx.runningBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Box */}
      <div className="flex justify-end mb-8">
        <div className="w-80 bg-zinc-50 border border-zinc-200 rounded p-3 space-y-1.5 font-mono text-xs">
          <div className="flex justify-between">
            <span className="font-sans text-zinc-600">Total Debits (+):</span>
            <span className="font-bold">{formatCurrency(totalDebit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans text-zinc-600">Total Credits (-):</span>
            <span className="font-bold">{formatCurrency(totalCredit)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-zinc-300 text-sm font-bold text-zinc-950">
            <span className="font-sans">Net Closing Balance:</span>
            <span>
              {formatCurrency(closingBalance)} {clNum > 0 ? "Dr" : clNum < 0 ? "Cr" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-16 pt-8 border-t border-zinc-200 text-center text-zinc-500 text-xs">
        <div>
          <div className="border-b border-zinc-400 h-8 mb-1" />
          <span>Accounts Department / Verified</span>
        </div>
        <div>
          <div className="border-b border-zinc-400 h-8 mb-1" />
          <span>Customer Acknowledgment / Stamp</span>
        </div>
      </div>
    </div>
  );
};
