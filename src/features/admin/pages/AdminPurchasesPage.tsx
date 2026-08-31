import React, { useState, useEffect } from 'react';
import { catalogService } from '@/services/catalogService';
import { inventoryService } from '@/services/inventoryService';
import { Purchase, PurchaseItem } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, formatDateTime, rupeesToCents, centsToRupees } from '@/utils/format';
import { Truck, Plus, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

export const AdminPurchasesPage: React.FC = () => {
  const [purchases, setPurchases] = useState(catalogService.getPurchases());
  const [ingredients, setIngredients] = useState(inventoryService.getIngredients());
  const [isCreating, setIsCreating] = useState(false);

  // New PO state
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-4)}`);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setPurchases(catalogService.getPurchases());
      setIngredients(inventoryService.getIngredients());
    });
    return unsub;
  }, []);

  const handleAddItem = () => {
    const ing = ingredients[0];
    if (!ing) return;
    setItems([
      ...items,
      {
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantity: 5,
        unit: ing.unit,
        unitPriceCents: ing.averageCostCents || 50000,
        totalCents: (ing.averageCostCents || 50000) * 5,
      },
    ]);
  };

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Add at least one item to purchase order.');
      return;
    }

    const subtotalCents = items.reduce((a, i) => a + i.totalCents, 0);

    const newPO: Purchase = {
      id: `po_${Date.now()}`,
      purchaseNumber: `PO-${Date.now().toString().slice(-4)}`,
      supplierId: 'direct',
      supplierName: vendorName.trim() || 'Direct Store Purchase',
      invoiceNumber,
      purchaseDate: new Date().toISOString(),
      status: 'RECEIVED',
      subtotalCents,
      discountCents: 0,
      totalCents: subtotalCents,
      items,
      receivedAt: new Date().toISOString(),
    };

    // Add purchase
    db.update('purchases', (list) => [newPO, ...list]);

    // Automatically increase ingredient stock & log inventory movement
    db.update('ingredients', (ings) =>
      ings.map((ing) => {
        const poItem = items.find((it) => it.ingredientId === ing.id);
        if (!poItem) return ing;
        return {
          ...ing,
          currentStock: Number((ing.currentStock + poItem.quantity).toFixed(2)),
        };
      })
    );

    items.forEach((it) => {
      db.update('inventoryMovements', (movs) => [
        {
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          ingredientId: it.ingredientId,
          ingredientName: it.ingredientName,
          type: 'PURCHASE',
          quantity: it.quantity,
          unit: it.unit,
          costCents: it.totalCents,
          reason: `Goods Received PO ${newPO.purchaseNumber} (${newPO.supplierName})`,
          referenceId: newPO.purchaseNumber,
          timestamp: new Date().toISOString(),
        },
        ...movs,
      ]);
    });

    toast.success(`Purchase Order ${newPO.purchaseNumber} received and stock updated!`);
    setIsCreating(false);
    setItems([]);
    setVendorName('');
    setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
  };

  return (
    <div className="space-y-5 w-full pb-12 animate-in fade-in">
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setIsCreating(true);
            setVendorName('');
            handleAddItem();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs rounded-xl shadow-teal transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Receive New Stock / Purchase
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-cream-50 text-text-secondary font-extrabold uppercase text-[10px]">
                <th className="py-3 px-4">PO #</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Vendor / Store</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Items Received</th>
                <th className="py-3 px-4 text-right">Total (LKR)</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 font-medium">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-text-secondary">
                    No purchase orders recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-cream-50/60 transition-colors">
                    <td className="py-3 px-4 font-black text-brand-brown-dark">{po.purchaseNumber}</td>
                    <td className="py-3 px-4 font-mono">{po.invoiceNumber}</td>
                    <td className="py-3 px-4 font-bold">{po.supplierName}</td>
                    <td className="py-3 px-4 text-text-secondary">{formatDateTime(po.purchaseDate)}</td>
                    <td className="py-3 px-4 text-text-secondary">
                      {po.items.map((i) => `${i.quantity} ${i.unit} ${i.ingredientName}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-brand-brown-deep tabular-nums">
                      {formatLKR(po.totalCents)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-status-success-bg text-status-success font-extrabold text-[10px] uppercase">
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive PO Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-elevated border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-cream-50 border-b border-border">
              <h3 className="font-extrabold text-sm text-brand-brown-dark">
                Goods Received Note / Purchase
              </h3>
              <button onClick={() => setIsCreating(false)} className="p-1.5 text-text-secondary hover:bg-cream-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Vendor / Store (Optional)</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Local Supermarket, Metro, Market"
                    className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Invoice / Receipt #</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                    required
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-text-secondary">Received Items</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 bg-cream-50 rounded-xl border border-border">
                      <select
                        value={it.ingredientId}
                        onChange={(e) => {
                          const ing = ingredients.find((i) => i.id === e.target.value);
                          if (ing) {
                            const updated = [...items];
                            updated[idx].ingredientId = ing.id;
                            updated[idx].ingredientName = ing.name;
                            updated[idx].unit = ing.unit;
                            setItems(updated);
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-border rounded-lg text-xs font-bold"
                      >
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={it.quantity}
                        onChange={(e) => {
                          const updated = [...items];
                          const qty = Number(e.target.value);
                          updated[idx].quantity = qty;
                          updated[idx].totalCents = updated[idx].unitPriceCents * qty;
                          setItems(updated);
                        }}
                        className="w-20 px-2 py-1.5 bg-white border border-border rounded-lg text-xs font-bold tabular-nums"
                        placeholder="Qty"
                        required
                      />

                      <span className="text-xs font-bold text-brand-teal w-6">{it.unit}</span>

                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="p-1 text-text-secondary hover:text-status-danger"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-extrabold text-xs shadow-teal"
                >
                  Receive Goods & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
