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
  StockRequest,
  Supplier,
} from '@/types';
import { realtimeSocketService } from './realtimeSocketService';
import { cashDrawerService } from './cashDrawerService';

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
    expiryDate?: string;
  }): void => {
    const ing = db.getSnapshot().ingredients.find((i) => i.id === params.ingredientId);
    if (!ing) return;

    const diff = params.newStock - ing.currentStock;
    if (diff === 0 && (!params.expiryDate || params.expiryDate === ing.expiryDate)) return;

    const type = diff >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

    db.update('ingredients', (list) =>
      list.map((i) =>
        i.id === params.ingredientId
          ? { ...i, currentStock: params.newStock, ...(params.expiryDate ? { expiryDate: params.expiryDate } : {}) }
          : i
      )
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
    // Normalize payments and set CHEQUE status to PENDING until cleared
    const normalizedPayments: PurchasePaymentSplit[] = (data.payments || []).map((pm, idx) => ({
      ...pm,
      id: pm.id || `pm_${Date.now()}_${idx}`,
      method: pm.method,
      amountCents: pm.amountCents,
      chequeNumber: pm.chequeNumber,
      bankName: pm.bankName,
      chequeDate: pm.chequeDate,
      chequeStatus: pm.method === 'CHEQUE' ? (pm.chequeStatus || 'PENDING') : 'CLEARED',
      clearedAt: pm.method === 'CHEQUE' ? (pm.chequeStatus === 'CLEARED' ? (pm.clearedAt || pm.timestamp || new Date().toISOString()) : undefined) : (pm.timestamp || new Date().toISOString()),
      timestamp: pm.timestamp || new Date().toISOString(),
      notes: pm.notes,
    }));

    // Realized / cleared payments
    const clearedPaidCents = normalizedPayments
      .filter((p) => p.method !== 'CHEQUE' || p.chequeStatus === 'CLEARED')
      .reduce((sum, p) => sum + p.amountCents, 0);

    const paidCents = data.paidCents !== undefined ? data.paidCents : clearedPaidCents;
    const dueCents = data.dueCents !== undefined ? data.dueCents : Math.max(0, data.totalCents - paidCents);
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
      payments: normalizedPayments,
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
        const normalizedPayment: PurchasePaymentSplit = {
          ...payment,
          id: payment.id || `pm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          chequeStatus: payment.method === 'CHEQUE' ? (payment.chequeStatus || 'PENDING') : 'CLEARED',
          clearedAt: payment.method === 'CHEQUE' && payment.chequeStatus === 'CLEARED' ? (payment.clearedAt || new Date().toISOString()) : undefined,
          timestamp: payment.timestamp || new Date().toISOString(),
        };
        const payments = [...(po.payments || []), normalizedPayment];
        const newPaidCents = payments
          .filter((p) => p.method !== 'CHEQUE' || p.chequeStatus === 'CLEARED')
          .reduce((sum, p) => sum + p.amountCents, 0);
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
    if (updatedPO) {
      realtimeSocketService.emitStockChanged(undefined, { action: 'PURCHASE_PAYMENT_RECORDED', purchase: updatedPO });
    }
    return updatedPO;
  },

  // Mark a pending cheque payment as cleared / paid by supplier
  clearPurchaseChequePayment: (params: {
    purchaseId: string;
    chequeNumber?: string;
    clearedDate?: string;
    notes?: string;
  }): Purchase | null => {
    let updatedPO: Purchase | null = null;
    db.update('purchases', (list) =>
      list.map((po) => {
        if (po.id !== params.purchaseId) return po;
        let didClear = false;
        const payments = (po.payments || []).map((pm) => {
          if (pm.method === 'CHEQUE' && pm.chequeStatus !== 'CLEARED') {
            if (!params.chequeNumber || pm.chequeNumber === params.chequeNumber) {
              didClear = true;
              return {
                ...pm,
                chequeStatus: 'CLEARED' as const,
                clearedAt: params.clearedDate ? new Date(params.clearedDate).toISOString() : new Date().toISOString(),
                notes: params.notes ? (pm.notes ? `${pm.notes} | ${params.notes}` : params.notes) : pm.notes,
              };
            }
          }
          return pm;
        });

        if (!didClear) return po;

        const newPaidCents = payments
          .filter((p) => p.method !== 'CHEQUE' || p.chequeStatus === 'CLEARED')
          .reduce((sum, p) => sum + p.amountCents, 0);
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

    if (updatedPO) {
      realtimeSocketService.emitStockChanged(undefined, { action: 'PURCHASE_CHEQUE_CLEARED', purchase: updatedPO });
    }
    return updatedPO;
  },

  getStockRequests: (): StockRequest[] => {
    return db.getSnapshot().stockRequests || [];
  },

  requestStockAdjustment: (data: {
    ingredientId: string;
    ingredientName: string;
    currentStock: number;
    requestedStock: number;
    unit: string;
    reason: string;
    userId: string;
    userName: string;
    expiryDate?: string;
  }): StockRequest => {
    const diff = Number((data.requestedStock - data.currentStock).toFixed(3));
    const request: StockRequest = {
      id: `stk_req_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      requestNumber: `STK-ADJ-${Date.now().toString().slice(-4)}`,
      type: 'STOCK_ADJUSTMENT',
      ingredientId: data.ingredientId,
      ingredientName: data.ingredientName,
      currentStock: data.currentStock,
      requestedStock: data.requestedStock,
      quantityChange: diff,
      unit: data.unit,
      expiryDate: data.expiryDate,
      reason: data.reason.trim() || 'Inventory physical count audit discrepancy',
      requestedByUserId: data.userId,
      requestedByUserName: data.userName,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
    };

    db.update('stockRequests', (list) => [request, ...(list || [])]);
    realtimeSocketService.emitStockRequestPending(request);
    return request;
  },

  requestStockDelivery: (data: {
    ingredientId?: string;
    ingredientName?: string;
    sku?: string;
    quantity?: number;
    unit?: string;
    costCents?: number;
    supplierId?: string;
    supplierName?: string;
    invoiceNumber?: string;
    expiryDate?: string;
    reason?: string;
    userId: string;
    userName: string;
    // Full purchase intake data
    items?: PurchaseItem[];
    totalCents?: number;
    paidCents?: number;
    dueCents?: number;
    paymentStatus?: PurchasePaymentStatus;
    payments?: PurchasePaymentSplit[];
    duePaymentDate?: string;
    notes?: string;
  }): StockRequest => {
    const items = data.items || [];
    const firstItem = items[0];
    const totalQty = items.length > 0 ? items.reduce((sum, item) => sum + item.quantity, 0) : (data.quantity || 1);
    const resolvedTotalCost = data.totalCents ?? data.costCents ?? (items.reduce((sum, item) => sum + item.totalCents, 0));

    const ingredientName = items.length > 1
      ? `${items.length} items (${firstItem?.ingredientName || ''}, ...)`
      : firstItem?.ingredientName || data.ingredientName || 'Delivery Goods';

    const existingIng = firstItem?.ingredientId
      ? db.getSnapshot().ingredients.find((i) => i.id === firstItem.ingredientId)
      : data.ingredientId
      ? db.getSnapshot().ingredients.find((i) => i.id === data.ingredientId)
      : undefined;

    const request: StockRequest = {
      id: `stk_req_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      requestNumber: `STK-RCV-${Date.now().toString().slice(-4)}`,
      type: 'STOCK_DELIVERY',
      ingredientId: existingIng?.id || firstItem?.ingredientId || data.ingredientId,
      ingredientName,
      sku: existingIng?.sku || data.sku,
      currentStock: existingIng ? existingIng.currentStock : 0,
      quantityChange: Number(totalQty.toFixed(3)),
      unit: firstItem?.unit || data.unit || 'units',
      costCents: resolvedTotalCost,
      totalCents: resolvedTotalCost,
      paidCents: data.paidCents,
      dueCents: data.dueCents,
      paymentStatus: data.paymentStatus,
      payments: data.payments,
      duePaymentDate: data.duePaymentDate,
      notes: data.notes,
      items: data.items,
      supplierId: data.supplierId,
      supplierName: data.supplierName?.trim() || 'Direct Supplier Delivery',
      invoiceNumber: data.invoiceNumber?.trim() || `INV-${Date.now().toString().slice(-4)}`,
      expiryDate: firstItem?.expiryDate || data.expiryDate,
      reason: data.reason?.trim() || `Goods Delivery Received (${items.length > 0 ? (items.length === 1 ? firstItem?.ingredientName : `${items.length} items`) : ingredientName})`,
      requestedByUserId: data.userId,
      requestedByUserName: data.userName,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
    };

    db.update('stockRequests', (list) => [request, ...(list || [])]);
    realtimeSocketService.emitStockRequestPending(request);
    return request;
  },

  approveStockRequest: (params: {
    requestId: string;
    adminId: string;
    adminName: string;
    modifiedQty?: number;
    modifiedCost?: number;
    modifiedExpiry?: string;
  }): StockRequest | null => {
    const requests = db.getSnapshot().stockRequests || [];
    const req = requests.find((r) => r.id === params.requestId);
    if (!req || req.status !== 'PENDING_APPROVAL') return null;

    const finalQty = params.modifiedQty !== undefined ? params.modifiedQty : (req.type === 'STOCK_ADJUSTMENT' ? req.requestedStock ?? (req.currentStock + req.quantityChange) : req.quantityChange);
    const finalCost = params.modifiedCost !== undefined ? params.modifiedCost : req.costCents;
    const finalExpiry = params.modifiedExpiry || req.expiryDate;

    // Apply the actual changes to inventory
    if (req.type === 'STOCK_ADJUSTMENT' && req.ingredientId) {
      inventoryService.adjustStock({
        ingredientId: req.ingredientId,
        newStock: finalQty,
        reason: `[Approved Staff Request] ${req.reason} (Submitted by ${req.requestedByUserName}, approved by ${params.adminName})`,
        userId: params.adminId,
        userName: params.adminName,
        expiryDate: finalExpiry,
      });
    } else if (req.type === 'STOCK_DELIVERY') {
      const items: PurchaseItem[] = req.items && req.items.length > 0
        ? req.items
        : [
            {
              ingredientId: req.ingredientId || `ing_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              ingredientName: req.ingredientName,
              quantity: finalQty,
              unit: req.unit as any,
              unitPriceCents: finalCost ? Math.round(finalCost / (finalQty || 1)) : 0,
              totalCents: finalCost || 0,
              expiryDate: finalExpiry,
            },
          ];

      inventoryService.recordPurchase({
        supplierId: req.supplierId,
        supplierName: req.supplierName || 'Direct Supplier Delivery',
        invoiceNumber: req.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
        items,
        totalCents: req.totalCents ?? (finalCost || 0),
        paidCents: req.paidCents,
        dueCents: req.dueCents,
        paymentStatus: req.paymentStatus,
        payments: req.payments,
        dueDate: req.duePaymentDate,
        notes: req.notes || `Cashier Delivery Receipt submitted by ${req.requestedByUserName} (Authorized by ${params.adminName}) - ${req.reason}`,
      });

      // Automatically deduct cash from cashier's cash drawer if cash payment was made
      let cashPaidCents = 0;
      if (req.payments && req.payments.length > 0) {
        cashPaidCents = req.payments
          .filter((p) => p.method === 'CASH')
          .reduce((sum, p) => sum + p.amountCents, 0);
      } else if (req.paymentStatus === 'PAID') {
        cashPaidCents = req.paidCents || req.totalCents || finalCost || 0;
      }

      if (cashPaidCents > 0) {
        const snapshot = db.getSnapshot();
        const allShifts = snapshot.shifts || [];
        const targetShift =
          allShifts.find((s) => s.cashierId === req.requestedByUserId && s.status === 'OPEN') ||
          snapshot.activeShift ||
          allShifts.find((s) => s.status === 'OPEN');

        if (targetShift) {
          cashDrawerService.addTransaction({
            shiftId: targetShift.id,
            terminalId: targetShift.terminalId || 'term_main',
            cashierId: req.requestedByUserId || targetShift.cashierId,
            cashierName: req.requestedByUserName || targetShift.cashierName,
            type: 'CASH_OUT',
            amount: -cashPaidCents,
            orderNumber: req.invoiceNumber ? `PO (${req.invoiceNumber})` : req.requestNumber,
            reason: `[Cash Paid Intake] Supplier: ${req.supplierName || 'General Supplier'} • ${req.ingredientName || 'Ingredients'} (${req.requestNumber})`,
            expenseCategory: 'Inventory / Stock Intake',
            status: 'APPROVED',
          });
        }
      }
    }

    const updatedReq: StockRequest = {
      ...req,
      status: 'APPROVED',
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: params.adminId,
      resolvedByUserName: params.adminName,
      requestedStock: req.type === 'STOCK_ADJUSTMENT' ? finalQty : undefined,
      quantityChange: req.type === 'STOCK_DELIVERY' ? finalQty : Number((finalQty - req.currentStock).toFixed(3)),
      costCents: finalCost,
      expiryDate: finalExpiry,
    };

    db.update('stockRequests', (list) =>
      (list || []).map((r) => (r.id === params.requestId ? updatedReq : r))
    );

    realtimeSocketService.emitStockRequestApproved(updatedReq);
    return updatedReq;
  },

  rejectStockRequest: (params: {
    requestId: string;
    adminId: string;
    adminName: string;
    reason: string;
  }): StockRequest | null => {
    const requests = db.getSnapshot().stockRequests || [];
    const req = requests.find((r) => r.id === params.requestId);
    if (!req || req.status !== 'PENDING_APPROVAL') return null;

    const updatedReq: StockRequest = {
      ...req,
      status: 'REJECTED',
      rejectionReason: params.reason || 'Rejected by Administrator',
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: params.adminId,
      resolvedByUserName: params.adminName,
    };

    db.update('stockRequests', (list) =>
      (list || []).map((r) => (r.id === params.requestId ? updatedReq : r))
    );

    realtimeSocketService.emitStockRequestRejected(updatedReq);
    return updatedReq;
  },
};

/**
 * Resolves ingredients strictly available for a selected supplier.
 * - If no supplier is selected (direct store/market purchase), returns all catalog ingredients.
 * - If a specific supplier is selected, ONLY returns ingredients supplied by that supplier
 *   (both linked via ingredient.supplierId AND configured in supplier.providedItems).
 */
export const getSupplierAvailableIngredients = (
  supplierId: string,
  suppliers: Supplier[],
  ingredients: Ingredient[]
): Ingredient[] => {
  if (!supplierId) {
    return ingredients;
  }
  const sup = suppliers.find((s) => s.id === supplierId);
  if (!sup) return ingredients;

  // 1. Ingredients directly linked with supplierId
  const linkedIngs = ingredients.filter((i) => i.supplierId === sup.id);

  // 2. Ingredients from supplier.providedItems
  const providedIngs: Ingredient[] = [];
  if (sup.providedItems && sup.providedItems.length > 0) {
    sup.providedItems.forEach((pItem, pIdx) => {
      const cleanName = pItem.name?.trim().toLowerCase();
      const match = ingredients.find(
        (i) =>
          (pItem.ingredientId && i.id === pItem.ingredientId) ||
          (cleanName && i.name.toLowerCase() === cleanName)
      );
      if (match) {
        if (!linkedIngs.some((li) => li.id === match.id) && !providedIngs.some((pi) => pi.id === match.id)) {
          providedIngs.push(match);
        }
      } else if (pItem.name && pItem.name.trim().length > 0) {
        const virtualId = pItem.ingredientId || `sup_item_${sup.id}_${pIdx}`;
        if (!providedIngs.some((pi) => pi.id === virtualId)) {
          providedIngs.push({
            id: virtualId,
            name: pItem.name.trim(),
            sku: pItem.sku || `SKU-${pIdx + 1}`,
            unit: (pItem.unit as any) || 'kg',
            currentStock: 0,
            reorderLevel: 5,
            averageCostCents: pItem.unitPriceCents || 50000,
            supplierId: sup.id,
            active: true,
          });
        }
      }
    });
  }

  // Strictly return only items belonging to this supplier (no fallback to other suppliers' items!)
  return [...linkedIngs, ...providedIngs];
};


