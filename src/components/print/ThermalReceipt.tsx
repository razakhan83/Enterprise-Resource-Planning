import React from "react";
import { formatCurrency } from "@/utils/format";

export type ThermalReceiptProps = {
  invoiceNo: string;
  isPakkaBill: boolean;
  date: string;
  partyName: string;
  previousBalance?: string;
  items: Array<{
    productName: string;
    unitType: string;
    qty: number;
    rate: string;
    lineTotal: string;
  }>;
  totalAmount: string;
  discountAmount: string;
  netAmount: string;
  biltyNumber?: string;
  transporterName?: string;
  freightTerms?: string;
  paperWidth?: "58mm" | "80mm";
  settings?: any;
};

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  invoiceNo,
  isPakkaBill,
  date,
  partyName,
  previousBalance = "0.00",
  items,
  totalAmount,
  discountAmount,
  netAmount,
  biltyNumber,
  transporterName,
  freightTerms,
  paperWidth = "80mm",
  settings,
}) => {
  const prevBalNum = Number(previousBalance || 0);
  const totalOutstanding = (prevBalNum + Number(netAmount)).toFixed(2);

  const businessName = settings?.businessName || "TRADING CO.";
  const headerBanner = settings?.thermalPrinterHeader;
  const address = settings?.address;
  const phone = settings?.phonePrimary;
  const footerTerms = settings?.thermalPrinterFooter || "Exchange within 3 days with bill. No cash refund.";

  const is58 = paperWidth === "58mm" || settings?.thermalPaperWidth === "58mm";

  return (
    <div
      id="thermal-receipt"
      className={`bg-white p-3 border border-zinc-300 font-mono leading-tight text-black select-none ${
        is58 ? "w-[215px] text-[10px]" : "w-[280px] text-[11px]"
      }`}
    >
      {/* Header */}
      <div className="text-center pb-2 border-b border-black">
        <div className="text-xs font-black uppercase tracking-wider">{businessName}</div>
        {headerBanner && <div className="text-[10px] font-bold mt-0.5">{headerBanner}</div>}
        {address && <div className="text-[9px] text-zinc-700 mt-0.5">{address}</div>}
        {phone && <div className="text-[9px] text-zinc-700">Tel: {phone}</div>}
        <div className="mt-1 font-bold text-[11px]">
          {isPakkaBill ? "LEGAL TAX INVOICE" : "ESTIMATE MEMORANDUM"}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="py-2 text-[10px] space-y-0.5 border-b border-black">
        <div className="flex justify-between">
          <span>Invoice No:</span>
          <span className="font-bold">{invoiceNo}</span>
        </div>
        <div className="flex justify-between">
          <span>Date / Time:</span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between">
          <span>Party Name:</span>
          <span className="font-bold truncate max-w-[150px]">{partyName}</span>
        </div>
        {biltyNumber && (
          <div className="flex justify-between text-[9px] pt-0.5 border-t border-dotted border-zinc-400">
            <span>Bilty #{biltyNumber} ({freightTerms || "PAID"})</span>
            <span>{transporterName || ""}</span>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <table className="w-full my-2 text-[10px]">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="pb-1">Description</th>
            <th className="pb-1 text-center">Qty</th>
            <th className="pb-1 text-right">Rate</th>
            <th className="pb-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {items.map((it, idx) => (
            <tr key={idx}>
              <td className="py-1">
                <div className="truncate max-w-[100px] font-medium">{it.productName}</div>
                <div className="text-[8px] text-zinc-500">{it.unitType}</div>
              </td>
              <td className="py-1 text-center">{it.qty}</td>
              <td className="py-1 text-right">{it.rate}</td>
              <td className="py-1 text-right font-bold">{it.lineTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Financial Settlement Totals */}
      <div className="pt-2 border-t border-black space-y-1 text-right text-[10px]">
        <div className="flex justify-between">
          <span>Goods Subtotal:</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>
        {Number(discountAmount) > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>Discount / Kasr:</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs font-bold border-t border-black pt-1">
          <span>NET BILL AMOUNT:</span>
          <span>{formatCurrency(netAmount)}</span>
        </div>

        {/* Previous Balance Carry-Forward */}
        {prevBalNum > 0 && (
          <div className="pt-1 border-t border-dotted border-zinc-400 space-y-0.5 text-[9px]">
            <div className="flex justify-between text-zinc-600">
              <span>Previous Balance:</span>
              <span>{formatCurrency(previousBalance)}</span>
            </div>
            <div className="flex justify-between font-bold text-[10px] text-black">
              <span>TOTAL OUTSTANDING:</span>
              <span>{formatCurrency(totalOutstanding)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pt-2 mt-2 border-t border-black text-[9px] text-zinc-600 space-y-0.5">
        <div>{footerTerms}</div>
        <div className="text-[8px] text-zinc-400">Pure CSS {is58 ? "58mm" : "80mm"} Print Engine</div>
      </div>
    </div>
  );
};
