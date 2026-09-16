import { create } from "zustand";
import Decimal from "decimal.js";

export type PosCartItem = {
  id: string;
  productId: string;
  productName: string;
  unitType: "PARENT" | "CHILD";
  parentUnit: string;
  childUnit: string;
  conversionRate: number;
  qty: number;
  rate: string;
  lineTotal: string;
};

export type PartyOption = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  creditLimit?: string;
  currentBalance: string;
};

export type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  parentUnit: string;
  childUnit: string;
  conversionRate: number;
  defaultSaleRate?: string;
  stockChildUnits: number;
  stockParentUnits: number;
};

export type CompletedReceiptData = {
  invoiceNo: string;
  partyName: string;
  partyPhone?: string | null;
  partyAddress?: string | null;
  previousBalance?: string;
  date: string;
  isPakkaBill: boolean;
  items: PosCartItem[];
  totalAmount: string;
  discountAmount: string;
  netAmount: string;
  biltyNumber?: string;
  transporterName?: string;
  freightTerms?: string;
};

interface PosState {
  // Cart & Active Line
  cart: PosCartItem[];
  selectedParty: PartyOption | null; // null = Walk-in Cash
  isPakkaBill: boolean; // false = Kacha (EST), true = Pakka (TAX)
  discountAmount: string; // Kasr
  biltyNumber: string;
  transporterName: string;
  freightTerms: "PAID" | "TO-PAY";

  // Modals & Navigation
  isPartyModalOpen: boolean;
  isBiltyModalOpen: boolean;
  isReceiptModalOpen: boolean;
  completedReceipt: CompletedReceiptData | null;
  isSubmitting: boolean;

  // Actions
  setParty: (party: PartyOption | null) => void;
  togglePakkaBill: () => void;
  setDiscountAmount: (val: string) => void;
  setBiltyDetails: (details: { biltyNumber: string; transporterName: string; freightTerms: "PAID" | "TO-PAY" }) => void;
  
  addToCart: (item: Omit<PosCartItem, "id" | "lineTotal">) => void;
  updateCartItemQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;

  setPartyModalOpen: (open: boolean) => void;
  setBiltyModalOpen: (open: boolean) => void;
  setReceiptModalOpen: (open: boolean) => void;
  setCompletedReceipt: (receipt: CompletedReceiptData | null) => void;
  setIsSubmitting: (submitting: boolean) => void;

  // Calculated totals
  getGrossTotal: () => string;
  getNetPayable: () => string;
}

export const usePosStore = create<PosState>((set, get) => ({
  cart: [],
  selectedParty: null,
  isPakkaBill: false,
  discountAmount: "0.00",
  biltyNumber: "",
  transporterName: "",
  freightTerms: "PAID",

  isPartyModalOpen: false,
  isBiltyModalOpen: false,
  isReceiptModalOpen: false,
  completedReceipt: null,
  isSubmitting: false,

  setParty: (party) => set({ selectedParty: party }),
  togglePakkaBill: () => set((s) => ({ isPakkaBill: !s.isPakkaBill })),
  setDiscountAmount: (val) => set({ discountAmount: val }),
  setBiltyDetails: (details) => set(details),

  addToCart: (item) => {
    const lineTotal = new Decimal(item.rate || 0).mul(item.qty || 1).toFixed(2);
    const newItem: PosCartItem = {
      ...item,
      id: crypto.randomUUID(),
      lineTotal,
    };
    set((s) => ({ cart: [...s.cart, newItem] }));
  },

  updateCartItemQty: (id, qty) => {
    if (qty <= 0) {
      get().removeFromCart(id);
      return;
    }
    set((s) => ({
      cart: s.cart.map((item) => {
        if (item.id === id) {
          const lineTotal = new Decimal(item.rate).mul(qty).toFixed(2);
          return { ...item, qty, lineTotal };
        }
        return item;
      }),
    }));
  },

  removeFromCart: (id) => {
    set((s) => ({ cart: s.cart.filter((item) => item.id !== id) }));
  },

  clearCart: () => {
    set({
      cart: [],
      discountAmount: "0.00",
      biltyNumber: "",
      transporterName: "",
      freightTerms: "PAID",
      completedReceipt: null,
    });
  },

  setPartyModalOpen: (open) => set({ isPartyModalOpen: open }),
  setBiltyModalOpen: (open) => set({ isBiltyModalOpen: open }),
  setReceiptModalOpen: (open) => set({ isReceiptModalOpen: open }),
  setCompletedReceipt: (receipt) => set({ completedReceipt: receipt }),
  setIsSubmitting: (submitting) => set({ isSubmitting: submitting }),

  getGrossTotal: () => {
    const total = get().cart.reduce((acc, item) => {
      return acc.plus(new Decimal(item.lineTotal));
    }, new Decimal(0));
    return total.toFixed(2);
  },

  getNetPayable: () => {
    const gross = new Decimal(get().getGrossTotal());
    const discount = new Decimal(get().discountAmount || 0);
    const net = gross.minus(discount);
    return net.isNegative() ? "0.00" : net.toFixed(2);
  },
}));
