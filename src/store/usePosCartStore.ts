import { create } from 'zustand';
import { OrderItem, OrderItemModifier, OrderType, Product, HeldOrder } from '@/types';
import { db } from '@/services/storage/db';

interface PosCartState {
  items: OrderItem[];
  orderType: OrderType;
  tableNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  discountPercent: number;
  discountFixedCents: number;
  discountReason: string;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountCents: number;

  // Actions
  addItem: (product: Product, modifiers: OrderItemModifier[], quantity?: number, notes?: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  removeItem: (itemId: string) => void;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (table: string) => void;
  setCustomerInfo: (name: string, phone: string, customerId?: string) => void;
  setLoyaltyRedemption: (points: number, discountCents: number) => void;
  clearLoyaltyRedemption: () => void;
  setDiscount: (params: { percent?: number; fixedCents?: number; reason?: string }) => void;
  clearDiscount: () => void;
  clearCart: () => void;
  restoreCartFromHeldOrder: (heldOrder: HeldOrder) => void;

  // Derived Calculations
  getSubtotalCents: () => number;
  getDiscountCents: () => number;
  getServiceChargeCents: () => number;
  getTaxCents: () => number;
  getTotalCents: () => number;
  getItemCount: () => number;
}

export const usePosCartStore = create<PosCartState>((set, get) => ({
  items: [],
  orderType: 'DINE_IN',
  tableNumber: '',
  customerId: '',
  customerName: '',
  customerPhone: '',
  discountPercent: 0,
  discountFixedCents: 0,
  discountReason: '',
  loyaltyPointsRedeemed: 0,
  loyaltyDiscountCents: 0,

  addItem: (product, modifiers, quantity = 1, notes = '') => {
    const modifierSum = modifiers.reduce((acc, m) => acc + m.priceCents, 0);
    const unitPriceCents = product.basePriceCents + modifierSum;
    const itemTotalCents = unitPriceCents * quantity;

    // Check if identical item with identical modifiers and notes exists in cart
    const existingIndex = get().items.findIndex((item) => {
      if (item.productId !== product.id || item.notes !== notes) return false;
      if (item.modifiers.length !== modifiers.length) return false;
      const modIdsA = item.modifiers.map((m) => m.optionId).sort().join(',');
      const modIdsB = modifiers.map((m) => m.optionId).sort().join(',');
      return modIdsA === modIdsB;
    });

    if (existingIndex > -1) {
      set((state) => {
        const updated = [...state.items];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + quantity;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          itemTotalCents: (existing.basePriceCents + modifierSum) * newQty,
        };
        return { items: updated };
      });
    } else {
      const newItem: OrderItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        productId: product.id,
        name: product.name,
        basePriceCents: product.basePriceCents,
        quantity,
        modifiers,
        itemTotalCents,
        notes,
        preparationStationId: product.preparationStationId,
      };
      set((state) => ({ items: [...state.items, newItem] }));
    }
  },

  updateQuantity: (itemId, delta) => {
    set((state) => {
      const updated = state.items
        .map((item) => {
          if (item.id !== itemId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const modifierSum = item.modifiers.reduce((acc, m) => acc + m.priceCents, 0);
          return {
            ...item,
            quantity: newQty,
            itemTotalCents: (item.basePriceCents + modifierSum) * newQty,
          };
        })
        .filter(Boolean) as OrderItem[];
      return { items: updated };
    });
  },

  removeItem: (itemId) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
  },

  setOrderType: (orderType) => set({ orderType }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setCustomerInfo: (customerName, customerPhone, customerId = '') =>
    set({ customerName, customerPhone, customerId }),

  setLoyaltyRedemption: (points, discountCents) =>
    set({ loyaltyPointsRedeemed: points, loyaltyDiscountCents: discountCents }),

  clearLoyaltyRedemption: () =>
    set({ loyaltyPointsRedeemed: 0, loyaltyDiscountCents: 0 }),

  setDiscount: ({ percent, fixedCents, reason }) => {
    set({
      discountPercent: percent || 0,
      discountFixedCents: fixedCents || 0,
      discountReason: reason || '',
    });
  },

  clearDiscount: () => set({ discountPercent: 0, discountFixedCents: 0, discountReason: '' }),

  clearCart: () =>
    set({
      items: [],
      tableNumber: '',
      discountPercent: 0,
      discountFixedCents: 0,
      discountReason: '',
      customerId: '',
      customerName: '',
      customerPhone: '',
      loyaltyPointsRedeemed: 0,
      loyaltyDiscountCents: 0,
    }),

  restoreCartFromHeldOrder: (heldOrder: HeldOrder) => {
    set({
      items: heldOrder.items,
      orderType: heldOrder.orderType,
      tableNumber: heldOrder.tableNumber || '',
      customerId: '',
      customerName: heldOrder.customerName || '',
      customerPhone: heldOrder.customerPhone || '',
      discountPercent: heldOrder.discountPercent || 0,
      discountFixedCents: heldOrder.discountPercent ? 0 : heldOrder.discountCents,
      discountReason: heldOrder.discountReason || '',
      loyaltyPointsRedeemed: 0,
      loyaltyDiscountCents: 0,
    });
  },

  getSubtotalCents: () => {
    return get().items.reduce((acc, item) => acc + item.itemTotalCents, 0);
  },

  getDiscountCents: () => {
    const subtotal = get().getSubtotalCents();
    const { discountPercent, discountFixedCents, loyaltyDiscountCents = 0 } = get();
    let totalDisc = 0;
    if (discountFixedCents > 0) {
      totalDisc += Math.min(subtotal, discountFixedCents);
    } else if (discountPercent > 0) {
      totalDisc += Math.round((subtotal * discountPercent) / 100);
    }
    totalDisc += Math.min(Math.max(0, subtotal - totalDisc), loyaltyDiscountCents);
    return Math.min(subtotal, totalDisc);
  },

  getServiceChargeCents: () => {
    const settings = db.getSnapshot().settings;
    if (!settings.serviceChargePercent) return 0;
    const discountedSubtotal = Math.max(0, get().getSubtotalCents() - get().getDiscountCents());
    return Math.round((discountedSubtotal * settings.serviceChargePercent) / 100);
  },

  getTaxCents: () => {
    const settings = db.getSnapshot().settings;
    if (!settings.taxRatePercent) return 0;
    const discountedSubtotal = Math.max(0, get().getSubtotalCents() - get().getDiscountCents());
    return Math.round((discountedSubtotal * settings.taxRatePercent) / 100);
  },

  getTotalCents: () => {
    const subtotal = get().getSubtotalCents();
    const discount = get().getDiscountCents();
    const service = get().getServiceChargeCents();
    const tax = get().getTaxCents();
    return Math.max(0, subtotal - discount + service + tax);
  },

  getItemCount: () => {
    return get().items.reduce((acc, item) => acc + item.quantity, 0);
  },
}));
