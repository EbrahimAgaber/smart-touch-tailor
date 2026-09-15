import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      order: [],
      promotions: [],
      promosReady: false,
      promoDiscount: 0,
      appliedPromos: [],
      manualPromosApplied: [], // array of promo IDs
      selectedCustomer: null,

      // ── NEW: item-level data ───────────────────────────────────────────────
      itemDiscounts: {},   // { variantKey: { type:'pct'|'fixed', value: number } }
      itemNotes: {},       // { variantKey: string }

      // ── NEW: undo stack (max 3) ────────────────────────────────────────────
      undoStack: [],       // [ { item, index, timestamp } ]

      // ── NEW: favorites ────────────────────────────────────────────────────
      favorites: [],       // array of item IDs (Set not serialisable by Zustand)

      // ── NEW: last cleared cart (for undo) ─────────────────────────────────
      lastClearedCart: [], // array of items saved on clearCart

      // Derived totals — NOT persisted (see partialize)
      subtotal: 0,
      tax: 0,
      total: 0,

      setCustomerInfo: (field, value) => set({ [field]: value }),
      setSelectedCustomer: (cust) => set({ selectedCustomer: cust }),

      // ── PROMOTIONS ────────────────────────────────────────────────────────
      fetchPromotions: async () => {
        try {
          if (!window.api || !window.api.getPromotions) {
            set({ promosReady: true });
            return;
          }
          const all = await window.api.getPromotions();
          set({ promotions: (all || []).filter(p => p.active), promosReady: true });
          get().recalculateTotals();
        } catch (e) {
          console.error('Promo fetch error:', e);
          set({ promosReady: true });
          get().recalculateTotals();
        }
      },

      toggleManualPromo: (promoId) => {
        set((state) => {
          const manual = state.manualPromosApplied || [];
          const next = manual.includes(promoId) 
            ? manual.filter(id => id !== promoId) 
            : [...manual, promoId];
          return { manualPromosApplied: next };
        });
        get().recalculateTotals();
      },

      // ── ADD ITEM ──────────────────────────────────────────────────────────
      addItem: (item, modsArr = [], note = '', qty = 1) => {
        if (!item) return;
        const effectiveMods = (modsArr && modsArr.length > 0) ? modsArr : (item.Modifiers || []);
        const modKey    = effectiveMods.map(m => m.id).sort().join(',');
        const variantId = `${item.ID}|${modKey}|${note}`;
        const basePrice = parseFloat(item.Price || 0)
          + (modsArr && modsArr.length > 0 ? modsArr.reduce((s, m) => s + (m.price || 0), 0) : 0);

        set((state) => {
          const newOrder = [...(state.order || [])];
          const existingIdx = newOrder.findIndex(o => o.variant === variantId);
          if (existingIdx > -1) {
            newOrder[existingIdx] = { ...newOrder[existingIdx], Qty: newOrder[existingIdx].Qty + qty };
          } else {
            newOrder.push({
              ID: item.ID, Name: item.Name, Price: basePrice, Qty: qty,
              Barcode: item.Barcode || '',
              Modifiers: effectiveMods, Note: note || '',
              Metadata: item.Metadata || {}, IsService: item.IsService || false,
              Unit: item.Unit || 'وحدة', variant: variantId,
              Category: item.Category || '',
            });
          }
          return { order: newOrder };
        });
        get().recalculateTotals();
      },

      // ── REMOVE ITEM (with undo) ────────────────────────────────────────────
      removeItem: (index) => {
        set((state) => {
          const newOrder = [...state.order];
          const removed  = newOrder[index];
          if (!removed) return {};

          // Push to undo stack
          const entry = { item: removed, index, timestamp: Date.now() };
          const undoStack = [entry, ...state.undoStack].slice(0, 3);

          newOrder.splice(index, 1);
          return { order: newOrder, undoStack };
        });
        get().recalculateTotals();
      },

      // ── UNDO LAST REMOVE ──────────────────────────────────────────────────
      restoreFromUndo: () => {
        set((state) => {
          if (!state.undoStack.length) return {};
          const [entry, ...rest] = state.undoStack;
          const newOrder = [...state.order];
          // Re-insert at original index (clamped)
          const insertAt = Math.min(entry.index, newOrder.length);
          newOrder.splice(insertAt, 0, entry.item);
          return { order: newOrder, undoStack: rest };
        });
        get().recalculateTotals();
      },

      // ── UPDATE QTY ────────────────────────────────────────────────────────
      updateQuantity: (index, qty) => {
        set((state) => {
          const newOrder = [...state.order];
          if (qty <= 0) {
            // Treat as remove-with-undo
            const removed  = newOrder[index];
            const entry    = { item: removed, index, timestamp: Date.now() };
            const undoStack = [entry, ...state.undoStack].slice(0, 3);
            newOrder.splice(index, 1);
            return { order: newOrder, undoStack };
          }
          newOrder[index] = { ...newOrder[index], Qty: qty };
          return { order: newOrder };
        });
        get().recalculateTotals();
      },

      updatePrice: (index, price) => {
        set((state) => {
          const newOrder = [...state.order];
          if (newOrder[index]) newOrder[index] = { ...newOrder[index], Price: price };
          return { order: newOrder };
        });
        get().recalculateTotals();
      },

      updateItemNote: (index, note) => {
        set((state) => {
          const newOrder = [...state.order];
          if (newOrder[index]) newOrder[index] = { ...newOrder[index], Note: note };
          return { order: newOrder };
        });
      },

      updateItemField: (index, field, value) => {
        set((state) => {
          const newOrder = [...state.order];
          if (newOrder[index]) newOrder[index] = { ...newOrder[index], [field]: value };
          return { order: newOrder };
        });
        get().recalculateTotals();
      },

      // ── ITEM DISCOUNT ─────────────────────────────────────────────────────
      setItemDiscount: (variantKey, type, value) => {
        set((state) => ({
          itemDiscounts: { ...state.itemDiscounts, [variantKey]: { type, value: parseFloat(value) || 0 } },
        }));
        get().recalculateTotals();
      },

      clearItemDiscount: (variantKey) => {
        set((state) => {
          const next = { ...state.itemDiscounts };
          delete next[variantKey];
          return { itemDiscounts: next };
        });
        get().recalculateTotals();
      },

      // ── FAVORITES ─────────────────────────────────────────────────────────
      toggleFavorite: (itemId) => {
        set((state) => {
          const favs = state.favorites || [];
          const next = favs.includes(itemId)
            ? favs.filter(id => id !== itemId)
            : [...favs, itemId];
          return { favorites: next };
        });
      },

      clearCart: () => {
        set((state) => ({ 
          lastClearedCart: [...state.order],
          order: [], subtotal: 0, tax: 0, total: 0, promoDiscount: 0, appliedPromos: [], manualPromosApplied: [], itemDiscounts: {}, itemNotes: {} 
        }));
      },

      restoreClearedCart: () => {
        set((state) => ({
          order: [...state.lastClearedCart],
          lastClearedCart: []
        }));
        get().recalculateTotals();
      },

      // ── RECALCULATE TOTALS ─────────────────────────────────────────────────
      recalculateTotals: () => {
        const { order = [], promotions = [], itemDiscounts = {}, manualPromosApplied = [] } = get();
        const vatRate = parseFloat(window.__vatRate__ || 0.15);

        let promoTotalDiscount = 0;
        let applied = [];
        
        const isApplicable = (p) => (p.apply_mode !== 'MANUAL') || (manualPromosApplied.includes(p.id));

        order.forEach(item => {
          let itemDiscount = 0;

          // Item-level manual discount
          const manualDisc = itemDiscounts[item.variant];
          if (manualDisc) {
            if (manualDisc.type === 'pct')   itemDiscount += (item.Price * item.Qty) * (manualDisc.value / 100);
            if (manualDisc.type === 'fixed') itemDiscount += Math.min(manualDisc.value, item.Price * item.Qty);
          }

          if (promotions && promotions.length > 0) {
            const bulk = promotions.find(p => p.type === 'BULK' && p.buy_product_id === item.ID && item.Qty >= p.buy_qty && isApplicable(p));
            if (bulk) {
              const bulkDisc = (item.Price * item.Qty) * (bulk.discount_value / 100);
              if (bulkDisc > itemDiscount) { itemDiscount = bulkDisc; applied.push({ name: bulk.name, amount: bulkDisc }); }
            }
            const bogo = promotions.find(p => p.type === 'BOGO' && p.buy_product_id === item.ID && item.Qty >= p.buy_qty && isApplicable(p));
            if (bogo) {
              const freeUnits = Math.floor(item.Qty / bogo.buy_qty) * bogo.get_qty;
              const bogoVal   = freeUnits * item.Price;
              if (bogoVal > itemDiscount) { itemDiscount = bogoVal; applied.push({ name: bogo.name, amount: bogoVal }); }
            }
          }

          promoTotalDiscount += itemDiscount;
        });

        const grossBeforePromo = order.reduce((s, item) => s + (item.Price * item.Qty), 0);

        if (promotions && promotions.length > 0) {
          const totalPromos = promotions.filter(p => p.type === 'TOTAL' && grossBeforePromo >= p.min_spend && isApplicable(p));
          let bestVal = 0, bestPromo = null;
          for (const p of totalPromos) {
            const val = p.discount_type === 'pct' ? (grossBeforePromo * (p.discount_value / 100)) : p.discount_value;
            if (val > bestVal) { bestVal = val; bestPromo = p; }
          }
          if (bestPromo) { promoTotalDiscount += bestVal; applied.push({ name: bestPromo.name, amount: bestVal }); }
        }

        const finalGross = Math.max(0, grossBeforePromo - promoTotalDiscount);
        const taxAmt  = finalGross * vatRate / (1 + vatRate);
        const netAmt  = finalGross - taxAmt;

        set({ subtotal: netAmt, tax: taxAmt, total: finalGross, promoDiscount: promoTotalDiscount, appliedPromos: applied });
      },
    }),
    {
      name: 'pos-cart',
      partialize: (state) => ({
        order: state.order,
        selectedCustomer: state.selectedCustomer,
        itemDiscounts: state.itemDiscounts,
        favorites: state.favorites,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.order && state.order.length > 0 && state.promosReady) {
          state.recalculateTotals();
        }
      },
    }
  )
);
