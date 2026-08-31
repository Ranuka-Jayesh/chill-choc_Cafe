import { db } from './storage/db';
import { Product, Category, ModifierGroup, Supplier, Expense, Purchase } from '@/types';
import { realtimeSocketService } from './realtimeSocketService';

const SEED_PURCHASES: Purchase[] = [
  {
    id: 'po_001',
    purchaseNumber: 'PO-8801',
    supplierId: 'sup_ceylon_coffee',
    supplierName: 'Ceylon Coffee Roasters Ltd',
    invoiceNumber: 'CCR-INV-9921',
    purchaseDate: '2026-08-25T09:30:00.000Z',
    status: 'RECEIVED',
    paymentStatus: 'PAID',
    subtotalCents: 4500000,
    discountCents: 0,
    totalCents: 4500000,
    paidCents: 4500000,
    dueCents: 0,
    payments: [{ method: 'CARD', amountCents: 4500000, timestamp: '2026-08-25T09:30:00.000Z' }],
    items: [
      {
        ingredientId: 'ing_beans',
        ingredientName: 'Specialty Espresso Beans',
        quantity: 10,
        unit: 'kg',
        unitPriceCents: 450000,
        totalCents: 4500000,
      },
    ],
    receivedAt: '2026-08-25T09:30:00.000Z',
    notes: 'Premium dark roast blend delivery',
  },
  {
    id: 'po_002',
    purchaseNumber: 'PO-8802',
    supplierId: 'sup_highland_dairy',
    supplierName: 'Highland Pure Dairy LK',
    invoiceNumber: 'HPD-7721',
    purchaseDate: '2026-08-26T07:15:00.000Z',
    status: 'RECEIVED',
    paymentStatus: 'PAID',
    subtotalCents: 2750000,
    discountCents: 0,
    totalCents: 2750000,
    paidCents: 2750000,
    dueCents: 0,
    payments: [{ method: 'CASH', amountCents: 2750000, timestamp: '2026-08-26T07:15:00.000Z' }],
    items: [
      {
        ingredientId: 'ing_milk',
        ingredientName: 'Fresh Whole Barista Milk',
        quantity: 50,
        unit: 'L',
        unitPriceCents: 55000,
        totalCents: 2750000,
      },
    ],
    receivedAt: '2026-08-26T07:15:00.000Z',
    notes: 'Daily dairy restock',
  },
  {
    id: 'po_003',
    purchaseNumber: 'PO-8803',
    supplierId: 'sup_choc_lanka',
    supplierName: 'Choc & Bakers Supplies Lanka',
    invoiceNumber: 'CBS-4412',
    purchaseDate: '2026-08-27T11:00:00.000Z',
    status: 'RECEIVED',
    paymentStatus: 'PARTIAL',
    subtotalCents: 5250000,
    discountCents: 0,
    totalCents: 5250000,
    paidCents: 3000000,
    dueCents: 2250000,
    dueDate: '2026-09-05T00:00:00.000Z',
    payments: [{ method: 'CHEQUE', amountCents: 3000000, chequeNumber: 'CHQ-9901', bankName: 'Commercial Bank' }],
    items: [
      {
        ingredientId: 'ing_choc_chips',
        ingredientName: 'Belgian Dark Choc Ganache',
        quantity: 15,
        unit: 'kg',
        unitPriceCents: 350000,
        totalCents: 5250000,
      },
    ],
    receivedAt: '2026-08-27T11:00:00.000Z',
    notes: 'Special waffle toppings batch',
  },
];

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
    const list = db.getSnapshot().suppliers;
    const existing = supplier.id ? list.find((s) => s.id === supplier.id) : null;
    let saved: Supplier;
    if (existing) {
      saved = { ...existing, ...supplier };
      db.update('suppliers', (sups) => sups.map((s) => (s.id === existing.id ? saved : s)));
    } else {
      saved = {
        id: `sup_${Date.now()}`,
        name: supplier.name,
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        active: supplier.active ?? true,
        notes: supplier.notes || '',
        providedItems: supplier.providedItems || [],
      };
      db.update('suppliers', (sups) => [...sups, saved]);
    }
    return saved;
  },

  deleteSupplier: (id: string): void => {
    db.update('suppliers', (sups) => sups.filter((s) => s.id !== id));
  },

  getPurchases: (): Purchase[] => {
    const list = db.getSnapshot().purchases;
    if (!list || list.length === 0) {
      db.update('purchases', () => SEED_PURCHASES);
      return SEED_PURCHASES;
    }
    return list;
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
