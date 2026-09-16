import React from "react";

export type GatePassProps = {
  chalanNo: string;
  date: string;
  destinationParty: string;
  transporterName?: string;
  biltyNumber?: string;
  vehicleNumber?: string;
  items: Array<{
    productName: string;
    unitType: string;
    qty: number;
  }>;
};

export const GatePass: React.FC<GatePassProps> = ({
  chalanNo,
  date,
  destinationParty,
  transporterName,
  biltyNumber,
  vehicleNumber,
  items,
}) => {
  return (
    <div
      id="gate-pass-print"
      className="bg-white p-6 border border-zinc-300 w-[450px] font-sans text-xs text-zinc-900 select-none shadow-sm"
    >
      {/* Header */}
      <div className="border-b-2 border-zinc-900 pb-3 mb-3 text-center">
        <h2 className="text-base font-extrabold tracking-wider uppercase">
          WAREHOUSE GATE PASS / DELIVERY CHALAN
        </h2>
        <div className="text-[11px] text-zinc-600 font-mono">
          Strict Security Document • Rates & Prices Confidential
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs border border-zinc-200 p-2.5 rounded mb-3 bg-zinc-50/50">
        <div>
          <span className="text-zinc-500 block text-[10px]">CHALAN NO:</span>
          <span className="font-mono font-bold text-zinc-900">{chalanNo}</span>
        </div>
        <div>
          <span className="text-zinc-500 block text-[10px]">DATE & TIME:</span>
          <span className="font-mono">{date}</span>
        </div>
        <div>
          <span className="text-zinc-500 block text-[10px]">DELIVERY DESTINATION:</span>
          <span className="font-semibold text-zinc-900">{destinationParty}</span>
        </div>
        <div>
          <span className="text-zinc-500 block text-[10px]">TRANSPORTER / CARRIER:</span>
          <span className="font-medium">{transporterName || "Direct Pickup"}</span>
        </div>
        {biltyNumber && (
          <div>
            <span className="text-zinc-500 block text-[10px]">BILTY NO:</span>
            <span className="font-mono font-semibold">{biltyNumber}</span>
          </div>
        )}
        {vehicleNumber && (
          <div>
            <span className="text-zinc-500 block text-[10px]">VEHICLE REG NO:</span>
            <span className="font-mono">{vehicleNumber}</span>
          </div>
        )}
      </div>

      {/* Physical Item Quantities Table (STRICTLY NO RATES/AMOUNTS) */}
      <table className="w-full text-left border-collapse mb-6">
        <thead>
          <tr className="border-b border-zinc-900 text-zinc-700 bg-zinc-100 text-[11px]">
            <th className="p-2 w-12 text-center">#</th>
            <th className="p-2">Goods / Package Description</th>
            <th className="p-2 w-24 text-center">Packaging</th>
            <th className="p-2 w-24 text-right">Physical Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {items.map((it, idx) => (
            <tr key={idx}>
              <td className="p-2 text-center font-mono text-zinc-500 text-xs">{idx + 1}</td>
              <td className="p-2 font-semibold text-xs text-zinc-900">{it.productName}</td>
              <td className="p-2 text-center text-xs text-zinc-600 font-mono">{it.unitType}</td>
              <td className="p-2 text-right font-mono font-bold text-sm text-zinc-900">
                {it.qty}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Warehouse Signatures */}
      <div className="grid grid-cols-3 gap-4 pt-6 border-t border-dashed border-zinc-300 text-center text-[10px] text-zinc-500">
        <div>
          <div className="border-b border-zinc-400 pb-1 mb-1"></div>
          <div>Warehouse Incharge</div>
        </div>
        <div>
          <div className="border-b border-zinc-400 pb-1 mb-1"></div>
          <div>Driver / Carrier Sign</div>
        </div>
        <div>
          <div className="border-b border-zinc-400 pb-1 mb-1"></div>
          <div>Gate Security Check</div>
        </div>
      </div>
    </div>
  );
};
