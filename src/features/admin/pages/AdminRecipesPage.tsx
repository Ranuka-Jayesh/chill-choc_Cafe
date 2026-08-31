import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { inventoryService } from '@/services/inventoryService';
import { catalogService } from '@/services/catalogService';
import { Recipe, RecipeItem, Product, Ingredient, Category } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR } from '@/utils/format';
import {
  ChefHat,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  CheckCircle2,
  Sparkles,
  Layers,
  DollarSign,
  Utensils,
  Coffee,
  Boxes,
  Minus,
  TrendingUp,
} from 'lucide-react';
import { confirmDialog } from '@/store/useConfirmStore';
import { toast } from 'sonner';

export const AdminRecipesPage: React.FC = () => {
  const [recipes, setRecipes] = useState(inventoryService.getRecipes());
  const [products, setProducts] = useState(catalogService.getProducts());
  const [categories, setCategories] = useState(catalogService.getCategories());
  const [ingredients, setIngredients] = useState(inventoryService.getIngredients());

  // Search & Category Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Modal state
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setRecipes(inventoryService.getRecipes());
      setProducts(catalogService.getProducts());
      setCategories(catalogService.getCategories());
      setIngredients(inventoryService.getIngredients());
    });
    return unsub;
  }, []);

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter((rcp) => {
      const prod = products.find((p) => p.id === rcp.productId);
      if (selectedCategory !== 'ALL' && prod?.categoryId !== selectedCategory) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesProduct = rcp.productName.toLowerCase().includes(q);
        const matchesIngredient = rcp.items.some((it) =>
          it.ingredientName.toLowerCase().includes(q)
        );
        return matchesProduct || matchesIngredient;
      }
      return true;
    });
  }, [recipes, products, selectedCategory, search]);

  // Calculate recipe cost
  const getRecipeCostCents = (rcp: Recipe) => {
    return rcp.items.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const costPerUnit = ing?.averageCostCents || 0;
      return sum + Math.round(costPerUnit * item.quantity);
    }, 0);
  };

  // Open Create Recipe Modal
  const handleOpenCreateModal = () => {
    // Pick first product that doesn't have a recipe, or fallback to first product
    const existingProductIds = new Set(recipes.map((r) => r.productId));
    const availableProduct = products.find((p) => !existingProductIds.has(p.id)) || products[0];

    if (!availableProduct) {
      toast.error('No products available to create a recipe for.');
      return;
    }

    const defaultIng = ingredients[0];
    const initialItems: RecipeItem[] = defaultIng
      ? [
          {
            ingredientId: defaultIng.id,
            ingredientName: defaultIng.name,
            quantity: 1,
            unit: defaultIng.unit,
          },
        ]
      : [];

    setEditingRecipe({
      id: `rcp_${Date.now()}`,
      productId: availableProduct.id,
      productName: availableProduct.name,
      items: initialItems,
    });
  };

  // Save Recipe
  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe) return;

    if (editingRecipe.items.length === 0) {
      toast.error('Please add at least one consumed ingredient to the recipe.');
      return;
    }

    // Validate quantities
    const invalidItem = editingRecipe.items.find((it) => it.quantity <= 0);
    if (invalidItem) {
      toast.error('Ingredient quantities must be greater than 0.');
      return;
    }

    inventoryService.saveRecipe(editingRecipe);
    toast.success(`Recipe for "${editingRecipe.productName}" saved successfully.`);
    setEditingRecipe(null);
    setRecipes(inventoryService.getRecipes());
  };

  // Edit with Confirmation
  const handleRequestEditRecipe = async (rcp: Recipe) => {
    const confirmed = await confirmDialog({
      title: 'Edit Recipe Link',
      message: `Edit recipe for "${rcp.productName}"?`,
      confirmText: 'Edit Recipe',
      variant: 'primary',
    });
    if (confirmed) {
      setEditingRecipe(rcp);
    }
  };

  // Delete with Confirmation
  const handleDeleteRecipe = async (rcp: Recipe) => {
    const confirmed = await confirmDialog({
      title: 'Delete Recipe Link',
      message: `Permanently delete recipe for "${rcp.productName}"?`,
      confirmText: 'Delete Recipe',
      variant: 'danger',
    });
    if (confirmed) {
      inventoryService.deleteRecipe(rcp.id);
      setRecipes(inventoryService.getRecipes());
      toast.success(`Recipe for "${rcp.productName}" deleted.`);
    }
  };

  // Add Item in Modal
  const handleAddItemToModal = () => {
    if (!editingRecipe) return;
    const defaultIng = ingredients[0];
    if (!defaultIng) {
      toast.error('No ingredients available. Create ingredients first.');
      return;
    }

    const newItem: RecipeItem = {
      ingredientId: defaultIng.id,
      ingredientName: defaultIng.name,
      quantity: 1,
      unit: defaultIng.unit,
    };

    setEditingRecipe({
      ...editingRecipe,
      items: [...editingRecipe.items, newItem],
    });
  };

  // Remove Item in Modal
  const handleRemoveItemFromModal = (index: number) => {
    if (!editingRecipe) return;
    setEditingRecipe({
      ...editingRecipe,
      items: editingRecipe.items.filter((_, i) => i !== index),
    });
  };

  // Update item ingredient in modal
  const handleUpdateItemIngredient = (index: number, ingId: string) => {
    if (!editingRecipe) return;
    const ing = ingredients.find((i) => i.id === ingId);
    if (!ing) return;

    const updated = [...editingRecipe.items];
    updated[index] = {
      ...updated[index],
      ingredientId: ing.id,
      ingredientName: ing.name,
      unit: ing.unit,
    };
    setEditingRecipe({ ...editingRecipe, items: updated });
  };

  // Update item quantity in modal
  const handleUpdateItemQty = (index: number, qty: number) => {
    if (!editingRecipe) return;
    const updated = [...editingRecipe.items];
    updated[index] = {
      ...updated[index],
      quantity: qty,
    };
    setEditingRecipe({ ...editingRecipe, items: updated });
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* 1. Top Category Filter Chips Row */}
      <div className="flex items-center justify-end gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`h-9 px-3.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center ${
            selectedCategory === 'ALL'
              ? 'bg-[#251814] text-white shadow-xs'
              : 'bg-[#FAF7F2] text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark border border-[#E0D7CC]'
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`h-9 px-3.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center ${
                isActive
                  ? 'bg-[#251814] text-white shadow-xs'
                  : 'bg-[#FAF7F2] text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark border border-[#E0D7CC]'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* 2. Main Recipe Cards Grid View */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-16">
        {filteredRecipes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E9E0D5] p-16 text-center shadow-xs">
            <ChefHat className="w-10 h-10 mx-auto mb-2.5 text-text-muted/50" />
            <h4 className="font-extrabold text-sm text-brand-brown-dark">No recipe links found</h4>
            <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
              No product recipes match your search query or selected category filter.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('ALL');
              }}
              className="mt-3.5 px-4 py-2 bg-[#FAF7F2] hover:bg-cream-100 border border-[#E0D7CC] rounded-2xl text-xs font-bold text-brand-teal transition-all"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((rcp) => {
              const prod = products.find((p) => p.id === rcp.productId);
              const cat = categories.find((c) => c.id === prod?.categoryId);
              const costCents = getRecipeCostCents(rcp);
              const priceCents = prod?.basePriceCents || 0;
              const marginPct =
                priceCents > 0
                  ? Math.round(((priceCents - costCents) / priceCents) * 100)
                  : 0;

              return (
                <div
                  key={rcp.id}
                  className="bg-white rounded-2xl border border-[#E9E0D5] p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5 group"
                >
                  {/* Card Top: Chef Icon, Product Info, Edit & Delete */}
                  <div>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#E0D7CC] flex items-center justify-center text-[#E99343] shrink-0">
                          <ChefHat className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-sm text-brand-brown-dark truncate" title={rcp.productName}>
                            {rcp.productName}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {cat && (
                              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider truncate">
                                {cat.name}
                              </span>
                            )}
                            <span className="text-[10px] text-text-muted">•</span>
                            <span className="text-[10px] font-bold text-brand-teal">
                              {rcp.items.length} {rcp.items.length === 1 ? 'ingredient' : 'ingredients'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleRequestEditRecipe(rcp)}
                          className="p-1.5 bg-white border border-[#E0D7CC] hover:bg-cream-100 rounded-xl text-text-secondary hover:text-brand-teal transition-colors shadow-xs"
                          title="Edit Recipe"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecipe(rcp)}
                          className="p-1.5 bg-white border border-[#E0D7CC] hover:bg-rose-50 rounded-xl text-text-secondary hover:text-status-danger transition-colors shadow-xs"
                          title="Delete Recipe"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Ingredients Consumption Pills */}
                    <div className="space-y-1.5 mt-3">
                      {rcp.items.map((item, idx) => {
                        const ing = ingredients.find((i) => i.id === item.ingredientId);
                        const itemCostCents = Math.round((ing?.averageCostCents || 0) * item.quantity);

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 bg-[#FAF7F2] rounded-xl border border-[#EAE3DA] text-xs font-semibold text-brand-brown-dark"
                          >
                            <span className="truncate pr-2">{item.ingredientName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-text-muted text-[11px] tabular-nums">
                                {formatLKR(itemCostCents)}
                              </span>
                              <span className="font-black text-xs text-brand-teal tabular-nums">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Bottom: Estimated Cost & Margin */}
                  <div className="pt-2 border-t border-[#F2ECE4] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-text-muted block">Est. Cost</span>
                      <span className="font-black text-sm text-brand-brown-deep tabular-nums">
                        {formatLKR(costCents)}
                      </span>
                    </div>

                    {priceCents > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-text-muted block">Selling Price</span>
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="font-black text-xs text-brand-brown-dark tabular-nums">
                            {formatLKR(priceCents)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              marginPct >= 70
                                ? 'bg-status-success-bg text-status-success'
                                : marginPct >= 40
                                ? 'bg-status-warning-bg text-status-warning'
                                : 'bg-status-danger-bg text-status-danger'
                            }`}
                          >
                            {marginPct}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Floating Bottom Pop-Up Search & Action Pill (Standardized Luxury Capsule) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search recipe, product, ingredient..."
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
                isSearchFocused || search ? 'w-56 sm:w-72 md:w-80' : 'w-28 sm:w-36'
              }`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Circular Add Button (+) */}
          <button
            onClick={handleOpenCreateModal}
            className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
            title="Create Recipe Link"
          >
            <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CREATE / EDIT RECIPE MODAL                                             */}
      {/* ========================================================================= */}
      {editingRecipe &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg flex flex-col max-h-[92vh]">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                <h3 className="font-extrabold text-base text-white drop-shadow-xs">
                  {editingRecipe.productName ? `Recipe: ${editingRecipe.productName}` : 'New Recipe Link'}
                </h3>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingRecipe(null)}
                    className="px-4 py-2 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="recipe-form"
                    className="px-5 py-2 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95"
                  >
                    Save Recipe
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] flex flex-col min-h-0 overflow-hidden">
                <form id="recipe-form" onSubmit={handleSaveRecipe} className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Select Product */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Menu Product <span className="text-status-danger">*</span>
                    </label>
                    <select
                      value={editingRecipe.productId}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === e.target.value);
                        if (prod) {
                          setEditingRecipe({
                            ...editingRecipe,
                            productId: prod.id,
                            productName: prod.name,
                          });
                        }
                      }}
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatLKR(p.basePriceCents)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Consumed Ingredients Section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase text-text-secondary">
                        Consumed Ingredients Per 1 Serving
                      </label>
                      <button
                        type="button"
                        onClick={handleAddItemToModal}
                        className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Ingredient
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {editingRecipe.items.map((it, idx) => {
                        const ing = ingredients.find((i) => i.id === it.ingredientId);
                        const rowCostCents = Math.round((ing?.averageCostCents || 0) * it.quantity);

                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2.5 p-3 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC]"
                          >
                            {/* Ingredient Dropdown */}
                            <select
                              value={it.ingredientId}
                              onChange={(e) => handleUpdateItemIngredient(idx, e.target.value)}
                              className="flex-1 bg-white border border-[#E0D7CC] rounded-xl px-2.5 py-1.5 text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal cursor-pointer truncate"
                            >
                              {ingredients.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.unit})
                                </option>
                              ))}
                            </select>

                            {/* Quantity Input */}
                            <div className="w-24">
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={it.quantity}
                                onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                                className="w-full bg-white border border-[#E0D7CC] rounded-xl px-2 py-1.5 text-center text-xs font-black text-brand-brown-dark focus:outline-none focus:border-brand-teal tabular-nums"
                                placeholder="Qty"
                                required
                              />
                            </div>

                            {/* Unit Label */}
                            <span className="text-xs font-black text-brand-teal uppercase w-7 text-center">
                              {it.unit}
                            </span>

                            {/* Delete Row */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromModal(idx)}
                              className="p-1.5 text-text-secondary hover:text-status-danger hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove Ingredient"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] flex items-center justify-between text-xs">
                    <span className="font-bold text-text-secondary">Estimated Cost per Portion:</span>
                    <span className="font-black text-base text-brand-brown-deep tabular-nums">
                      {formatLKR(getRecipeCostCents(editingRecipe))}
                    </span>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
