import Decimal from "decimal.js";

/**
 * Formats a monetary amount into strict Pakistani Rupee standard: Rs. 1,250.00
 */
export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "Rs. 0.00";
  }
  try {
    const d = new Decimal(amount);
    const parts = d.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `Rs. ${parts.join(".")}`;
  } catch {
    return "Rs. 0.00";
  }
}

/**
 * Format standard datetime for invoices and vouchers
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
