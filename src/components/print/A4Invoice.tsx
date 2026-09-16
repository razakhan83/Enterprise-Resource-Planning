import React from "react";
import { formatCurrency } from "@/utils/format";

export interface A4InvoiceItem {
  sku?: string | null;
  productName: string;
  unitType: string;
  qty: number;
  rate: string;
  lineTotal: string;
}

export interface StoreSettingsData {
  businessName?: string;
  tagline?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  email?: string | null;
  address?: string | null;
  ntnNumber?: string | null;
  strnNumber?: string | null;
  thermalPrinterFooter?: string | null;
}

export interface A4InvoiceProps {
  paperSize?: "A4" | "A5";
  invoiceNo: string;
  isPakkaBill: boolean;
  date: string;
  partyName: string;
  partyPhone?: string | null;
  partyAddress?: string | null;
  partyNtn?: string | null;
  previousBalance?: string;
  items: A4InvoiceItem[];
  totalAmount: string;
  discountAmount: string;
  netAmount: string;
  biltyNumber?: string;
  transporterName?: string;
  freightTerms?: string;
  settings?: StoreSettingsData | null;
}

export const A4Invoice: React.FC<A4InvoiceProps> = ({
  paperSize = "A4",
  invoiceNo,
  isPakkaBill,
  date,
  partyName,
  partyPhone,
  partyAddress,
  partyNtn,
  previousBalance = "0.00",
  items,
  totalAmount,
  discountAmount,
  netAmount,
  biltyNumber,
  transporterName,
  freightTerms,
  settings,
}) => {
  const prevBalNum = Number(previousBalance || 0);
  const netNum = Number(netAmount || 0);
  const totalOutstanding = (prevBalNum + netNum).toFixed(2);

  const businessName = settings?.businessName || "Trading Co.";
  const tagline = settings?.tagline || "Wholesale & Commercial Supplies";
  const address = settings?.address || "Wholesale Commercial Market";
  const phone = settings?.phonePrimary || "+92 300 1234567";
  const ntn = settings?.ntnNumber || "";
  const strn = settings?.strnNumber || "";
  const footerTerms = settings?.thermalPrinterFooter || "Exchange within 3 days with bill. No cash refund.";

  return (
    <div
      id="a4-invoice-container"
      className={`bg-white text-zinc-900 mx-auto p-8 font-sans ${
        paperSize === "A5" ? "max-w-[148mm] min-h-[210mm] text-xs p-5" : "max-w-[210mm] min-h-[297mm] text-sm"
      }`}
      style={{
        boxSizing: "border-box",
      }}
    >
      {/* Top Header: Business Branding & Legal Identifiers */}
      <div className="border-b-2 border-zinc-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-900 leading-none">
              {businessName}
            </h1>
            <p className="text-xs font-medium text-zinc-600">{tagline}</p>
            <p className="text-xs text-zinc-500 max-w-sm">{address}</p>
            <div className="text-xs font-mono text-zinc-700 flex items-center space-x-3 pt-1">
              <span>Tel: {phone}</span>
              {settings?.email && <span>Email: {settings.email}</span>}
            </div>
          </div>

          <div className="text-right space-y-1">
            <div className="inline-block px-3 py-1 bg-zinc-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded">
              {isPakkaBill ? "LEGAL TAX INVOICE" : "COMMERCIAL ESTIMATE"}
            </div>
            <div className="text-xs font-mono text-zinc-700 pt-1">
              {ntn && <div>NTN: <span className="font-semibold">{ntn}</span></div>}
              {strn && <div>STRN: <span className="font-semibold">{strn}</span></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Meta Bar & Bilty / Logistics */}
      <div className="grid grid-cols-2 gap-4 bg-zinc-50 border border-zinc-200 rounded p-3 mb-4 text-xs">
        <div className="space-y-1">
          <div className="flex">
            <span className="w-24 text-zinc-500 font-medium">Invoice No:</span>
            <span className="font-mono font-bold text-zinc-900">{invoiceNo}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-zinc-500 font-medium">Issue Date:</span>
            <span className="font-medium text-zinc-900">{date}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-zinc-500 font-medium">Bill Type:</span>
            <span className="font-medium text-zinc-900">
              {isPakkaBill ? "Taxable Supply" : "Regular Commercial"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          {biltyNumber ? (
            <>
              <div className="flex">
                <span className="w-24 text-zinc-500 font-medium">Bilty / GR #:</span>
                <span className="font-mono font-bold text-zinc-900">{biltyNumber}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-zinc-500 font-medium">Transporter:</span>
                <span className="font-medium text-zinc-900">{transporterName || "Direct Carrier"}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-zinc-500 font-medium">Freight Terms:</span>
                <span className="font-semibold text-zinc-900">{freightTerms || "PAID"}</span>
              </div>
            </>
          ) : (
            <div className="text-zinc-500 italic flex items-center h-full">
              Direct Counter Delivery / Self Pick-up
            </div>
          )}
        </div>
      </div>

      {/* Customer / Party Information */}
      <div className="border border-zinc-200 rounded p-3 mb-5 text-xs bg-white">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
          Billed To / Party Khata
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="font-bold text-sm text-zinc-900">{partyName}</div>
            {partyAddress && <div className="text-zinc-600 mt-0.5">{partyAddress}</div>}
          </div>
          <div className="text-right space-y-0.5 font-mono text-zinc-700">
            {partyPhone && <div>Phone: {partyPhone}</div>}
            {partyNtn && <div>Party NTN: {partyNtn}</div>}
          </div>
        </div>
      </div>

      {/* Structured Line Items Table */}
      <div className="border border-zinc-200 rounded overflow-hidden mb-4">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
              <th className="py-2 px-3 w-10 text-center">#</th>
              <th className="py-2 px-3">Item Description & SKU</th>
              <th className="py-2 px-3 text-center w-20">Unit</th>
              <th className="py-2 px-3 text-right w-20">Qty</th>
              <th className="py-2 px-3 text-right w-28">Rate (Rs.)</th>
              <th className="py-2 px-3 text-right w-32">Total (Rs.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-zinc-50/50">
                <td className="py-2 px-3 text-center text-zinc-500 font-mono">{idx + 1}</td>
                <td className="py-2 px-3">
                  <span className="font-semibold text-zinc-900">{item.productName}</span>
                  {item.sku && (
                    <span className="text-[10px] font-mono text-zinc-500 block">SKU: {item.sku}</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center text-zinc-600">{item.unitType}</td>
                <td className="py-2 px-3 text-right font-mono font-medium">{item.qty}</td>
                <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.rate)}</td>
                <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">
                  {formatCurrency(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Settlement Totals & Khata Carry-forward */}
      <div className="flex justify-end mb-8">
        <div className="w-72 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between py-1 border-b border-zinc-200">
            <span className="text-zinc-600 font-sans">Gross Subtotal:</span>
            <span className="font-bold">{formatCurrency(totalAmount)}</span>
          </div>

          {Number(discountAmount) > 0 && (
            <div className="flex justify-between py-1 border-b border-zinc-200 text-zinc-700">
              <span className="text-zinc-600 font-sans">Kasr / Discount:</span>
              <span className="font-semibold text-red-600">-{formatCurrency(discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between py-1.5 border-b-2 border-zinc-900 text-sm font-bold">
            <span className="font-sans">Net Payable:</span>
            <span className="text-zinc-950">{formatCurrency(netAmount)}</span>
          </div>

          {prevBalNum > 0 && (
            <div className="pt-1 text-[11px] space-y-1 bg-zinc-50 p-2 rounded border border-zinc-200">
              <div className="flex justify-between text-zinc-600">
                <span className="font-sans">Previous Ledger Bal:</span>
                <span>{formatCurrency(previousBalance)}</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-950 border-t border-zinc-300 pt-1">
                <span className="font-sans">Total Khata Due:</span>
                <span>{formatCurrency(totalOutstanding)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signature Blocks */}
      <div className="grid grid-cols-3 gap-8 pt-8 border-t border-zinc-200 text-center text-xs text-zinc-600 mt-auto">
        <div>
          <div className="border-b border-zinc-400 h-10 mb-1" />
          <span className="font-medium">Prepared by</span>
        </div>
        <div>
          <div className="border-b border-zinc-400 h-10 mb-1" />
          <span className="font-medium">Checked by / Dispatch</span>
        </div>
        <div>
          <div className="border-b border-zinc-400 h-10 mb-1" />
          <span className="font-medium">Customer Signature / Stamp</span>
        </div>
      </div>

      {/* Legal Footer */}
      <div className="text-center text-[10px] text-zinc-400 pt-6 mt-4 border-t border-dotted border-zinc-200">
        <div>{footerTerms}</div>
        <div className="font-mono mt-0.5">Printed via ERP Dual-Engine (A4/A5 Vector PDF)</div>
      </div>
    </div>
  );
};
