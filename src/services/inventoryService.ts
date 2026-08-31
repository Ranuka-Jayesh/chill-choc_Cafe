import { db } from './storage/db';
import {
  Ingredient,
  Recipe,
  InventoryMovement,
  OrderItem,
  Purchase,
  PurchaseItem,
  PurchasePaymentSplit,
  PurchasePaymentStatus,
} from '@/types';
import { realtimeSocketService } from './realtimeSocketService';

export const inventoryService = {
  getIngredients: (): Ingredient[] => {
    return db.getSnapshot().ingredients;
  },

  getRecipes: (): Recipe[] => {
    return db.getSnapshot().recipes;
  },

  getMovements: (): InventoryMovement[] => {
    return db.getSnapshot().inventoryMovements;
  },

  saveIngredient: (data: Partial<Ingredient> & { name: string; unit: any; currentStock: number }): Ingredient => {
    const all = db.getSnapshot().ingredients;
    const existing = data.id ? all.find((i) => i.id === data.id) : null;

    let saved: Ingredient;
    if (existing) {
      saved = {
        ...existing,
        ...data,
      };
      db.update('ingredients', (list) => list.map((i) => (i.id === existing.id ? saved : i)));
    } else {
      saved = {
        id: `ing_${Date.now()}`,
        name: data.name,
        sku: data.sku || `ING-${Date.now().toString().slice(-4)}`,
        unit: data.unit,
        currentStock: Number(data.currentStock) || 0,
        reorderLevel: Number(data.reorderLevel) || 0,
        averageCostCents: Number(data.averageCostCents) || 0,
        supplierId: data.supplierId,
        expiryDate: data.expiryDate,
        active: data.active ?? true,
      };
      db.update('ingredients', (list) => [...list, saved]);
    }
    realtimeSocketService.emitStockChanged(saved.id, { action: 'SAVE', ingredient: saved });
    return saved;
  },

  deleteIngredient: (ingredientId: string): void => {
    db.update('ingredients', (list) => list.filter((i) => i.id !== ingredientId));
    realtimeSocketService.emitStockChanged(ingredientId, { action: 'DELETE' });
  },

  saveRecipe: (recipe: Recipe): Recipe => {
    const all = db.getSnapshot().recipes;
    const existing = all.find((r) => r.productId === recipe.productId || r.id === recipe.id);
    if (existing) {
      db.update('recipes', (list) => list.map((r) => (r.id === existing.id ? recipe : r)));
    } else {
      db.update('recipes', (list) => [...list, recipe]);
    }
    realtimeSocketService.emitStockChanged(undefined, { action: 'RECIPE_SAVE', recipe });
    return recipe;
  },

  deleteRecipe: (recipeId: string): void => {
    db.update('recipes', (list) => list.filter((r) => r.id !== recipeId));
    realtimeSocketService.emitStockChanged(undefined, { action: 'RECIPE_DELETE', recipeId });
  },

  deductRecipeStockForOrder: (orderItems: OrderItem[], orderNumber: string): void => {
    const recipes = db.getSnapshot().recipes;
    const movements: InventoryMovement[] = [];

    db.update('ingredients', (ingredients) => {
      const updatedIngredients = [...ingredients];

      for (const item of orderItems) {
        // 1. Deduct Base Recipe Ingredients
        const recipe = recipes.find((r) => r.productId === item.productId);
        if (recipe) {
          for (const recipeItem of recipe.items) {
            const index = updatedIngredients.findIndex((ing) => ing.id === recipeItem.ingredientId);
            if (index === -1) continue;

            const ing = updatedIngredients[index];
            const consumedQty = recipeItem.quantity * item.quantity;
            const newStock = Math.max(0, Number((ing.currentStock - consumedQty).toFixed(3)));

            updatedIngredients[index] = {
              ...ing,
              currentStock: newStock,
            };

            movements.push({
              id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              ingredientId: ing.id,
              ingredientName: ing.name,
              type: 'SALE_CONSUMPTION',
              quantity: -consumedQty,
              unit: recipeItem.unit || ing.unit,
              costCents: Math.round((ing.averageCostCents || 0) * (consumedQty / 1)),
              reason: `Sold in Order ${orderNumber} (${item.quantity}x ${item.name})`,
              referenceId: orderNumber,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // 2. Deduct Selected Modifiers Linked Ingredients (Multi-Ingredient or Single)
        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            const modIngredients =
              mod.ingredients && mod.ingredients.length > 0
                ? mod.ingredients
                : mod.ingredientId && mod.ingredientQuantity
                ? [
                    {
                      ingredientId: mod.ingredientId,
                      ingredientName: '',
                      quantity: mod.ingredientQuantity,
                      unit: mod.ingredientUnit || '',
                    },
                  ]
                : [];

            for (const modIng of modIngredients) {
              if (!modIng.ingredientId || !modIng.quantity) continue;

              const index = updatedIngredients.findIndex((ing) => ing.id === modIng.ingredientId);
              if (index === -1) continue;

              const ing = updatedIngredients[index];
              const consumedQty = modIng.quantity * item.quantity;
              const newStock = Math.max(0, Number((ing.currentStock - consumedQty).toFixed(3)));

              updatedIngredients[index] = {
                ...ing,
                currentStock: newStock,
              };

              movements.push({
                id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                ingredientId: ing.id,
                ingredientName: ing.name,
                type: 'SALE_CONSUMPTION',
                quantity: -consumedQty,
                unit: modIng.unit || ing.unit,
                costCents: Math.round((ing.averageCostCents || 0) * (consumedQty / 1)),
                reason: `Sold in Order ${orderNumber} (+ ${mod.optionName} on ${item.quantity}x ${item.name})`,
                referenceId: orderNumber,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }

      return updatedIngredients;
    });

    if (movements.length > 0) {
      db.update('inventoryMovements', (list) => [...movements, ...list]);
      realtimeSocketService.emitStockChanged(undefined, { action: 'SALE_CONSUMPTION', orderNumber, movementsCount: movements.length });
    }
  },

  returnRecipeStockForRefund: (orderItems: OrderItem[], orderNumber: string, reason: string): void => {
    const recipes = db.getSnapshot().recipes;
    const movements: InventoryMovement[] = [];

    db.update('ingredients', (ingredients) => {
      const updatedIngredients = [...ingredients];

      for (const item of orderItems) {
        // 1. Return Base Recipe Ingredients
        const recipe = recipes.find((r) => r.productId === item.productId);
        if (recipe) {
          for (const recipeItem of recipe.items) {
            const index = updatedIngredients.findIndex((ing) => ing.id === recipeItem.ingredientId);
            if (index === -1) continue;

            const ing = updatedIngredients[index];
            const returnQty = recipeItem.quantity * item.quantity;
            const newStock = Number((ing.currentStock + returnQty).toFixed(3));

            updatedIngredients[index] = {
              ...ing,
              currentStock: newStock,
            };

            movements.push({
              id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              ingredientId: ing.id,
              ingredientName: ing.name,
              type: 'RETURN',
              quantity: returnQty,
              unit: recipeItem.unit || ing.unit,
              costCents: 0,
              reason: `Restocked on refund of Order ${orderNumber}: ${reason}`,
              referenceId: orderNumber,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // 2. Return Selected Modifiers Linked Ingredients (Multi-Ingredient or Single)
        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            const modIngredients =
              mod.ingredients && mod.ingredients.length > 0
                ? mod.ingredients
                : mod.ingredientId && mod.ingredientQuantity
                ? [
                    {
                      ingredientId: mod.ingredientId,
                      ingredientName: '',
                      quantity: mod.ingredientQuantity,
                      unit: mod.ingredientUnit || '',
                    },
                  ]
                : [];

            for (const modIng of modIngredients) {
              if (!modIng.ingredientId || !modIng.quantity) continue;

              const index = updatedIngredients.findIndex((ing) => ing.id === modIng.ingredientId);
              if (index === -1) continue;

              const ing = updatedIngredients[index];
              const returnQty = modIng.quantity * item.quantity;
              const newStock = Number((ing.currentStock + returnQty).toFixed(3));

              updatedIngredients[index] = {
                ...ing,
                currentStock: newStock,
              };

              movements.push({
                id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                ingredientId: ing.id,
                ingredientName: ing.name,
                type: 'RETURN',
                quantity: returnQty,
                unit: modIng.unit || ing.unit,
                costCents: 0,
                reason: `Restocked on refund of Order ${orderNumber} (+ ${mod.optionName} on ${item.quantity}x ${item.name}): ${reason}`,
                referenceId: orderNumber,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }

      return updatedIngredients;
    });

    if (movements.length > 0) {
      db.update('inventoryMovements', (list) => [...movements, ...list]);
      realtimeSocketService.emitStockChanged(undefined, { action: 'REFUND_RESTOCK', orderNumber });
    }
  },

  adjustStock: (params: {
    ingredientId: string;
    newStock: number;
    reason: string;
    userId: string;
    userName: string;
  }): void => {
    const ing = db.getSnapshot().ingredients.find((i) => i.id === params.ingredientId);
    if (!ing) return;

    const diff = params.newStock - ing.currentStock;
    if (diff === 0) return;

    const type = diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

    db.update('ingredients', (list) =>
      list.map((i) => (i.id === params.ingredientId ? { ...i, currentStock: params.newStock } : i))
    );

    const movement: InventoryMovement = {
      id: `mov_${Date.now()}`,
      ingredientId: ing.id,
      ingredientName: ing.name,
      type,
      quantity: diff,
      unit: ing.unit,
      costCents: 0,
      reason: params.reason || `Manual adjustment by ${params.userName}`,
      timestamp: new Date().toISOString(),
    };

    db.update('inventoryMovements', (list) => [movement, ...list]);

    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: params.userId,
        userName: params.userName,
        action: 'STOCK_ADJUSTMENT',
        entity: 'Ingredient',
        entityId: ing.id,
        details: `Stock of ${ing.name} adjusted from ${ing.currentStock} to ${params.newStock} ${ing.unit} (${params.reason})`,
        terminalId: 'BACKOFFICE',
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    realtimeSocketService.emitStockChanged(ing.id, { action: 'ADJUST', movement });
  },

  recordPurchase: (data: {
    supplierId?: string;
    supplierName: string;
    invoiceNumber: string;
    items: PurchaseItem[];
    totalCents: number;
    payments?: PurchasePaymentSplit[];
    paymentStatus?: PurchasePaymentStatus;
    paidCents?: number;
    dueCents?: number;
    dueDate?: string;
    notes?: string;
  }): Purchase => {
    const paidCents = data.paidCents ?? data.totalCents;
    const dueCents = data.dueCents ?? Math.max(0, data.totalCents - paidCents);
    const paymentStatus: PurchasePaymentStatus =
      data.paymentStatus ??
      (dueCents === 0 ? 'PAID' : paidCents > 0 ? 'PARTIAL' : 'UNPAID');

    const newPO: Purchase = {
      id: `po_${Date.now()}`,
      purchaseNumber: `PO-${Date.now().toString().slice(-4)}`,
      supplierId: data.supplierId || 'direct',
      supplierName: data.supplierName.trim() || 'Direct Store Purchase',
      invoiceNumber: data.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
      purchaseDate: new Date().toISOString(),
      status: 'RECEIVED',
      paymentStatus,
      subtotalCents: data.totalCents,
      discountCents: 0,
      totalCents: data.totalCents,
      paidCents,
      dueCents,
      dueDate: dueCents > 0 ? data.dueDate : undefined,
      payments: data.payments || [],
      items: data.items,
      notes: data.notes,
      receivedAt: new Date().toISOString(),
    };

    db.update('purchases', (list) => [newPO, ...list]);

    db.update('ingredients', (ings) => {
      const updated = ings.map((ing) => {
        const poItem = data.items.find(
          (it) => it.ingredientId === ing.id || it.ingredientName.toLowerCase() === ing.name.toLowerCase()
        );
        if (!poItem) return ing;
        return {
          ...ing,
          currentStock: Number((ing.currentStock + poItem.quantity).toFixed(2)),
          lastRestockedAt: new Date().toISOString(),
          expiryDate: poItem.expiryDate || ing.expiryDate,
        };
      });

      data.items.forEach((it) => {
        const exists = updated.some(
          (i) => i.id === it.ingredientId || i.name.toLowerCase() === it.ingredientName.toLowerCase()
        );
        if (!exists) {
          updated.push({
            id: it.ingredientId || `ing_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: it.ingredientName,
            sku: `ING-${Date.now().toString().slice(-4)}`,
            unit: (it.unit as any) || 'kg',
            currentStock: Number(it.quantity.toFixed(2)),
            reorderLevel: 5,
            averageCostCents: it.unitPriceCents || 50000,
            supplierId: data.supplierId,
            expiryDate: it.expiryDate,
            active: true,
            createdAt: new Date().toISOString(),
            lastRestockedAt: new Date().toISOString(),
          });
        }
      });

      return updated;
    });

    data.items.forEach((it) => {
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
          expiryDate: it.expiryDate,
          timestamp: new Date().toISOString(),
        },
        ...movs,
      ]);
    });

    realtimeSocketService.emitStockChanged(undefined, { action: 'PURCHASE_RECEIVED', purchase: newPO });
    return newPO;
  },

  addPurchasePayment: (purchaseId: string, payment: PurchasePaymentSplit): Purchase | null => {
    let updatedPO: Purchase | null = null;
    db.update('purchases', (list) =>
      list.map((po) => {
        if (po.id !== purchaseId) return po;
        const payments = [...(po.payments || []), payment];
        const newPaidCents = payments.reduce((sum, p) => sum + p.amountCents, 0);
        const newDueCents = Math.max(0, po.totalCents - newPaidCents);
        const newPaymentStatus: PurchasePaymentStatus =
          newDueCents === 0 ? 'PAID' : newPaidCents > 0 ? 'PARTIAL' : 'UNPAID';
        updatedPO = {
          ...po,
          payments,
          paidCents: newPaidCents,
          dueCents: newDueCents,
          dueDate: newDueCents > 0 ? po.dueDate : undefined,
          paymentStatus: newPaymentStatus,
        };
        return updatedPO;
      })
    );
    return updatedPO;
  },
};
