import { db } from './storage/db';
import { Product, Category, ModifierGroup, Supplier, SupplierProvidedItem, Ingredient, Expense, Purchase } from '@/types';
import { realtimeSocketService } from './realtimeSocketService';
import { supabaseStorageService } from './supabaseStorageService';

export const catalogService = {
  getCategories: (): Category[] => {
    return db.getSnapshot().categories.sort((a, b) => a.displayOrder - b.displayOrder);
  },

  getCategoryById: (id: string): Category | undefined => {
    return db.getSnapshot().categories.find((c) => c.id === id);
  },

  saveCategory: (category: Partial<Category> & { name: string; slug: string }): Category => {
    const list = db.getSnapshot().categories;
    const existing = category.id ? list.find((c) => c.id === category.id) : null;
    let saved: Category;

    if (existing) {
      saved = { ...existing, ...category };
      db.update('categories', (cats) => cats.map((c) => (c.id === existing.id ? saved : c)));
      realtimeSocketService.emitCatalogChanged('UPDATE', 'category', saved);
    } else {
      saved = {
        id: `cat_${Date.now()}`,
        name: category.name,
        slug: category.slug,
        icon: category.icon || 'Coffee',
        displayOrder: category.displayOrder || list.length + 1,
        preparationStationId: category.preparationStationId || 'st_bar',
        active: category.active ?? true,
      };
      db.update('categories', (cats) => [...cats, saved]);
      realtimeSocketService.emitCatalogChanged('CREATE', 'category', saved);
    }
    return saved;
  },

  deleteCategory: (id: string): void => {
    db.update('categories', (cats) => cats.filter((c) => c.id !== id));
    realtimeSocketService.emitCatalogChanged('DELETE', 'category', { id });
  },

  getProducts: (): Product[] => {
    return db.getSnapshot().products;
  },

  getProductById: (id: string): Product | undefined => {
    return db.getSnapshot().products.find((p) => p.id === id);
  },

  saveProduct: (product: Partial<Product> & { name: string; categoryId: string; basePriceCents: number }): Product => {
    const list = db.getSnapshot().products;
    const existing = product.id ? list.find((p) => p.id === product.id) : null;
    let saved: Product;

    if (existing) {
      // If product image was replaced or removed, delete former image from Supabase storage
      if (existing.image && product.image !== undefined && existing.image !== product.image) {
        supabaseStorageService.deleteProductImage(existing.image).catch((err) => {
          console.warn('Error deleting old product image from storage:', err);
        });
      }
      saved = { ...existing, ...product };
      db.update('products', (prods) => prods.map((p) => (p.id === existing.id ? saved : p)));
      realtimeSocketService.emitCatalogChanged('UPDATE', 'product', saved);
    } else {
      saved = {
        id: `prod_${Date.now()}`,
        name: product.name,
        categoryId: product.categoryId,
        description: product.description || '',
        image: product.image || '',
        basePriceCents: product.basePriceCents,
        costPriceCents: product.costPriceCents || 0,
        preparationStationId: product.preparationStationId || 'st_bar',
        modifierGroupIds: product.modifierGroupIds || [],
        taxRate: product.taxRate || 0,
        active: product.active ?? true,
        isSoldOut: product.isSoldOut ?? false,
      };
      db.update('products', (prods) => [...prods, saved]);
      realtimeSocketService.emitCatalogChanged('CREATE', 'product', saved);
    }
    return saved;
  },

  deleteProduct: (id: string): void => {
    const product = db.getSnapshot().products.find((p) => p.id === id);
    if (product?.image) {
      supabaseStorageService.deleteProductImage(product.image).catch((err) => {
        console.warn('Error deleting product image from storage:', err);
      });
    }
    db.update('products', (prods) => prods.filter((p) => p.id !== id));
    realtimeSocketService.emitCatalogChanged('DELETE', 'product', { id });
  },

  toggleSoldOut: (productId: string): boolean => {
    let newState = false;
    let updatedProduct: Product | undefined;
    db.update('products', (prods) =>
      prods.map((p) => {
        if (p.id === productId) {
          newState = !p.isSoldOut;
          updatedProduct = { ...p, isSoldOut: newState };
          return updatedProduct;
        }
        return p;
      })
    );
    if (updatedProduct) {
      realtimeSocketService.emitCatalogChanged('UPDATE', 'product', updatedProduct);
    }
    return newState;
  },

  getModifierGroups: (): ModifierGroup[] => {
    return db.getSnapshot().modifierGroups;
  },

  saveModifierGroup: (group: ModifierGroup): ModifierGroup => {
    const list = db.getSnapshot().modifierGroups;
    const existing = list.find((g) => g.id === group.id);
    if (existing) {
      db.update('modifierGroups', (groups) => groups.map((g) => (g.id === group.id ? group : g)));
      realtimeSocketService.emitCatalogChanged('UPDATE', 'product', group);
    } else {
      db.update('modifierGroups', (groups) => [...groups, group]);
      realtimeSocketService.emitCatalogChanged('CREATE', 'product', group);
    }
    return group;
  },

  deleteModifierGroup: (id: string): void => {
    db.update('modifierGroups', (groups) => groups.filter((g) => g.id !== id));
    realtimeSocketService.emitCatalogChanged('DELETE', 'product', { id });
  },

  getSuppliers: (): Supplier[] => {
    return db.getSnapshot().suppliers;
  },

  saveSupplier: (supplier: Partial<Supplier> & { name: string }): Supplier => {
    const existing = supplier.id ? catalogService.getSuppliers().find((s) => s.id === supplier.id) : undefined;
    const targetId = supplier.id || existing?.id || `sup_${Date.now()}`;

    // Normalize and register any providedItems into database ingredients
    const currentIngs = db.getSnapshot().ingredients || [];
    const normalizedProvidedItems: SupplierProvidedItem[] = [];

    (supplier.providedItems || []).forEach((pItem, idx) => {
      const cleanName = pItem.name?.trim();
      if (!cleanName) return;

      const matchedIng = currentIngs.find(
        (i) =>
          (pItem.ingredientId && i.id === pItem.ingredientId) ||
          i.name.toLowerCase() === cleanName.toLowerCase()
      );

      if (matchedIng) {
        // Link existing ingredient to this supplier if not already linked
        if (matchedIng.supplierId !== targetId) {
          db.update('ingredients', (ings) =>
            ings.map((i) => (i.id === matchedIng.id ? { ...i, supplierId: targetId } : i))
          );
        }
        normalizedProvidedItems.push({
          ...pItem,
          id: pItem.id || `item_${Date.now()}_${idx}`,
          name: cleanName,
          ingredientId: matchedIng.id,
          unit: matchedIng.unit || pItem.unit || 'kg',
          sku: matchedIng.sku || pItem.sku || `SKU-${idx + 1}`,
        });
      } else {
        // Create new real ingredient in database for this supplier
        const newIngId = pItem.ingredientId || `ing_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newIng: Ingredient = {
          id: newIngId,
          name: cleanName,
          sku: pItem.sku?.trim() || `SKU-${Date.now().toString().slice(-4)}`,
          unit: (pItem.unit as any) || 'kg',
          currentStock: 0,
          reorderLevel: 5,
          averageCostCents: pItem.unitPriceCents || 50000,
          supplierId: targetId,
          active: true,
        };
        db.update('ingredients', (ings) => [...ings, newIng]);
        normalizedProvidedItems.push({
          ...pItem,
          id: pItem.id || `item_${Date.now()}_${idx}`,
          name: cleanName,
          ingredientId: newIngId,
          unit: newIng.unit,
          sku: newIng.sku,
        });
      }
    });

    let saved: Supplier;
    if (existing) {
      saved = {
        ...existing,
        ...supplier,
        id: targetId,
        providedItems: normalizedProvidedItems,
      };
      db.update('suppliers', (sups) => sups.map((s) => (s.id === existing.id ? saved : s)));
    } else {
      saved = {
        id: targetId,
        name: supplier.name,
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        active: supplier.active ?? true,
        notes: supplier.notes || '',
        providedItems: normalizedProvidedItems,
      };
      db.update('suppliers', (sups) => [...sups, saved]);
    }

    realtimeSocketService.emitStockChanged(undefined, { action: 'SUPPLIER_SAVED', supplier: saved });
    return saved;
  },

  deleteSupplier: (id: string): void => {
    db.update('suppliers', (sups) => sups.filter((s) => s.id !== id));
    realtimeSocketService.emitStockChanged(undefined, { action: 'SUPPLIER_DELETED', supplierId: id });
  },

  getPurchases: (): Purchase[] => {
    return db.getSnapshot().purchases || [];
  },

  getExpenses: (): Expense[] => {
    return db.getSnapshot().expenses;
  },

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>): Expense => {
    const newExp: Expense = {
      id: `exp_${Date.now()}`,
      ...expense,
      createdAt: new Date().toISOString(),
    };
    db.update('expenses', (list) => [newExp, ...list]);
    return newExp;
  },

  deleteExpense: (id: string): void => {
    db.update('expenses', (list) => list.filter((e) => e.id !== id));
  },

  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>): Expense | null => {
    let updated: Expense | null = null;
    db.update('expenses', (list) =>
      list.map((exp) => {
        if (exp.id === id) {
          updated = { ...exp, ...updates };
          return updated;
        }
        return exp;
      })
    );
    return updated;
  },
};
