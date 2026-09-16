import Decimal from "decimal.js";

// Enforce precision configuration
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const toDecimal = (val: string | number | Decimal): Decimal => {
  return new Decimal(val || 0);
};

export const addMoney = (a: string | number, b: string | number): string => {
  return toDecimal(a).plus(toDecimal(b)).toFixed(2);
};

export const subtractMoney = (a: string | number, b: string | number): string => {
  return toDecimal(a).minus(toDecimal(b)).toFixed(2);
};

export const multiplyMoney = (rate: string | number, qty: string | number): string => {
  return toDecimal(rate).mul(toDecimal(qty)).toFixed(2);
};

export const divideMoney = (total: string | number, divisor: string | number): string => {
  if (toDecimal(divisor).isZero()) return "0.00";
  return toDecimal(total).div(toDecimal(divisor)).toFixed(2);
};

export const isGreaterThan = (a: string | number, b: string | number): boolean => {
  return toDecimal(a).greaterThan(toDecimal(b));
};

export const isZero = (a: string | number): boolean => {
  return toDecimal(a).isZero();
};
