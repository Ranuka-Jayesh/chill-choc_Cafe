import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { inventoryService } from '@/services/inventoryService';
import { catalogService } from '@/services/catalogService';
import { Ingredient, Supplier } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR } from '@/utils/format';
import {
  Boxes,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  Sparkles,
  SlidersHorizontal,
  Package,
  ArrowUpDown,
  DollarSign,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { confirmDialog } from '@/store/useConfirmStore';
import { toast } from 'sonner';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';

type StockStatusFilter = 'ALL' | 'LOW' | 'OPTIMAL' | 'OUT';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Stock' },
  { value: 'OPTIMAL', label: 'Optimal' },
  { value: 'LOW', label: 'Low Stock' },
  { value: 'OUT', label: 'Out of Stock' },
];

export const AdminIngredientsPage: React.FC = () => {
  const [ingredients, setIngredients] = useState(inventoryService.getIngredients());

  const now = new Date();
  const currentMonthStr = String(now.getMonth() + 1);
  const currentYearStr = String(now.getFullYear());

  const [dateRange, setDateRange] = useState<MonthYearValue>({
    year: currentYearStr,
    month: currentMonthStr,
  });

  // Search and Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Modals
  const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
  const [adjustingIngredient, setAdjustingIngredient] = useState<Ingredient | null>(null);
  const [adjustedQty, setAdjustedQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Physical stock inventory audit');

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setIngredients(inventoryService.getIngredients());
    });
    return unsub;
  }, []);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const isOut = ing.currentStock <= 0;
      const isLow = !isOut && ing.currentStock <= ing.reorderLevel;

      if (statusFilter === 'OUT' && !isOut) return false;
      if (statusFilter === 'LOW' && !isLow) return false;
      if (statusFilter === 'OPTIMAL' && (isLow || isOut)) return false;

      if (unitFilter !== 'ALL' && ing.unit !== unitFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ing.name.toLowerCase().includes(q) ||
          ing.sku.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ingredients, statusFilter, unitFilter, search]);

  // Inventory KPI statistics
  const totalItems = ingredients.length;
  const outOfStockCount = ingredients.filter((i) => i.currentStock <= 0).length;
  const lowStockCount = ingredients.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel).length;
  const optimalCount = ingredients.filter((i) => i.currentStock > i.reorderLevel).length;
  const totalValuationCents = ingredients.reduce((acc, i) => acc + (i.currentStock * (i.averageCostCents || 0)), 0);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingIngredient({
      name: '',
      sku: `ING-${Date.now().toString().slice(-4)}`,
      unit: 'kg',
      currentStock: 10,
      reorderLevel: 3,
      averageCostCents: 50000,
      active: true,
    });
  };

  // Save Ingredient
  const handleSaveIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIngredient?.name || !editingIngredient.unit) {
      toast.error('Please fill in ingredient name and unit.');
      return;
    }

    inventoryService.saveIngredient({
      ...editingIngredient,
      name: editingIngredient.name,
      unit: editingIngredient.unit as any,
      currentStock: Number(editingIngredient.currentStock) || 0,
      reorderLevel: Number(editingIngredient.reorderLevel) || 0,
      averageCostCents: Number(editingIngredient.averageCostCents) || 0,
      supplierId: editingIngredient.supplierId,
    });

    toast.success(`Ingredient "${editingIngredient.name}" saved successfully.`);
    setEditingIngredient(null);
    setIngredients(inventoryService.getIngredients());
  };

  // Edit with Confirmation
  const handleRequestEditIngredient = async (ing: Ingredient) => {
    const confirmed = await confirmDialog({
      title: 'Edit Ingredient',
      message: `Edit details for "${ing.name}"?`,
      confirmText: 'Edit Ingredient',
      variant: 'primary',
    });
    if (confirmed) {
      setEditingIngredient(ing);
    }
  };

  // Delete with Confirmation
  const handleDeleteIngredient = async (ing: Ingredient) => {
    const confirmed = await confirmDialog({
      title: 'Delete Ingredient',
      message: `Permanently delete "${ing.name}"?`,
      confirmText: 'Delete Ingredient',
      variant: 'danger',
    });
    if (confirmed) {
      inventoryService.deleteIngredient(ing.id);
      setIngredients(inventoryService.getIngredients());
      toast.success(`"${ing.name}" was deleted successfully.`);
    }
  };

  // Adjust Stock
  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingIngredient) return;

    inventoryService.adjustStock({
      ingredientId: adjustingIngredient.id,
      newStock: Number(adjustedQty),
      reason: adjustReason,
      userId: 'usr_admin',
      userName: 'Admin Chaminda',
    });

    toast.success(`Stock of "${adjustingIngredient.name}" updated to ${adjustedQty} ${adjustingIngredient.unit}`);
    setAdjustingIngredient(null);
    setIngredients(inventoryService.getIngredients());
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* 1. Top Header Row: Live KPI Stats on Left, Status Filter Pills on Right */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
        {/* Left: Live Stock KPI Stats */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total:</span>
            <span className="font-black text-xs text-brand-brown-dark tabular-nums">{totalItems}</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-status-success shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Optimal:</span>
            <span className="font-black text-xs text-brand-brown-deep tabular-nums">{optimalCount}</span>
          </div>

          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
              <span className="w-2 h-2 rounded-full bg-status-warning shrink-0" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-status-warning">Low Stock:</span>
              <span className="font-black text-xs text-status-warning tabular-nums">{lowStockCount}</span>
            </div>
          )}

          {outOfStockCount > 0 && (
            <div className="flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
              <span className="w-2 h-2 rounded-full bg-status-danger shrink-0 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-status-danger">Out of Stock:</span>
              <span className="font-black text-xs text-status-danger tabular-nums">{outOfStockCount}</span>
            </div>
          )}

          <div className="hidden lg:flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
            <span className="w-2 h-2 rounded-full bg-[#E99343] shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Valuation:</span>
            <span className="font-black text-xs text-brand-brown-dark tabular-nums">{formatLKR(totalValuationCents)}</span>
          </div>
        </div>

        {/* Right: Custom Designed Dropdown & Month Year Picker */}
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <div className="w-[140px] sm:w-[155px]">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as StockStatusFilter)}
              options={STATUS_OPTIONS}
              buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
            />
          </div>

          <MonthYearPicker
            value={dateRange}
            onChange={(newVal) => setDateRange(newVal)}
          />
        </div>
      </div>

      {/* 2. Main Ingredients Table Area (with Bottom Clearance for Floating Pill) */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col mb-1">
        <div className="flex-1 overflow-auto min-h-0 pb-32">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
              <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Ingredient</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">SKU Code</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Unit</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Current Stock</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Reorder Threshold</th>
                <th className="py-3.5 px-4 bg-[#FAF7F2]/95">Avg Cost</th>
                <th className="py-3.5 px-4 text-center bg-[#FAF7F2]/95">Status</th>
                <th className="py-3.5 px-4 text-right bg-[#FAF7F2]/95">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE4] font-medium">
              {filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-text-muted">
                    <Boxes className="w-9 h-9 mx-auto mb-2 text-text-muted/40" />
                    <div className="font-semibold text-xs text-text-secondary">No ingredients found matching your search or filters.</div>
                    <button
                      onClick={() => {
                        setSearch('');
                        setStatusFilter('ALL');
                        setUnitFilter('ALL');
                      }}
                      className="mt-3 px-3.5 py-1 text-xs font-black text-brand-teal hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredIngredients.map((ing) => {
                  const isOut = ing.currentStock <= 0;
                  const isLow = !isOut && ing.currentStock <= ing.reorderLevel;

                  return (
                    <tr key={ing.id} className="hover:bg-[#FAF7F2]/70 transition-colors group">
                      <td className="py-3.5 px-4 font-black text-brand-brown-dark">{ing.name}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-text-muted">{ing.sku}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-cream-100/80 text-brand-brown border border-[#E0D7CC]">
                          {ing.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`font-black text-sm tabular-nums ${isOut ? 'text-status-danger' : isLow ? 'text-status-warning' : 'text-brand-brown-deep'}`}>
                          {ing.currentStock} <span className="text-[11px] font-bold text-text-muted">{ing.unit}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary font-medium text-xs tabular-nums">
                        {ing.reorderLevel} {ing.unit}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-xs text-brand-brown-dark tabular-nums whitespace-nowrap">
                        {formatLKR(ing.averageCostCents)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border ${
                            isOut
                              ? 'bg-status-danger-bg text-status-danger border-status-danger/30'
                              : isLow
                              ? 'bg-status-warning-bg text-status-warning border-status-warning/30'
                              : 'bg-status-success-bg text-status-success border-status-success/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOut ? 'bg-status-danger' : isLow ? 'bg-status-warning' : 'bg-status-success'
                            }`}
                          />
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Optimal'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setAdjustingIngredient(ing);
                              setAdjustedQty(ing.currentStock);
                            }}
                            className="px-3 py-1 bg-[#FAF7F2] hover:bg-[#251814] hover:text-white text-brand-brown font-extrabold text-[11px] rounded-full border border-[#E0D7CC] transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Adjust Stock"
                          >
                            Adjust Stock
                          </button>
                          <button
                            onClick={() => handleRequestEditIngredient(ing)}
                            className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 rounded-full text-text-secondary hover:text-brand-teal flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Edit Ingredient"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteIngredient(ing)}
                            className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-rose-50 hover:border-rose-200 hover:text-status-danger rounded-full text-text-muted flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Delete Ingredient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {/* Bottom Spacer Row to Ensure Last Record is Never Hidden by Floating Capsule */}
              {filteredIngredients.length > 0 && (
                <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                  <td colSpan={8} className="h-24 bg-transparent border-0" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Floating Bottom Pop-Up Search & Action Pill (Exact Match to Products Studio Design) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ingredients..."
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
                isSearchFocused || search ? 'w-56 sm:w-72 md:w-80' : 'w-24 sm:w-32'
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
            onClick={handleOpenAddModal}
            className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
            title="Add New Ingredient"
          >
            <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ADJUST STOCK MODAL                                                     */}
      {/* ========================================================================= */}
      {adjustingIngredient &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    Adjust Stock: {adjustingIngredient.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAdjustingIngredient(null)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="adjust-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Save Adjustment
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="adjust-form" onSubmit={handleConfirmAdjust} className="p-5 sm:p-6 space-y-4">
                  {/* Current Stock Banner */}
                  <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] flex items-center justify-between">
                    <span className="text-xs font-bold text-text-secondary">Current Recorded Stock:</span>
                    <span className="font-black text-base text-brand-brown-deep tabular-nums">
                      {adjustingIngredient.currentStock} {adjustingIngredient.unit}
                    </span>
                  </div>

                  {/* Actual Count with Quick +/- Buttons */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      New Actual Count ({adjustingIngredient.unit})
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setAdjustedQty((prev) => Math.max(0, Number((prev - 1).toFixed(2))))}
                        className="w-10 h-10 rounded-2xl bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-brand-brown-dark font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={adjustedQty}
                        onChange={(e) => setAdjustedQty(Number(e.target.value))}
                        className="flex-1 h-10 px-3 bg-white border border-[#E2D8CC] focus:border-brand-teal rounded-2xl text-center text-base font-black text-brand-brown-dark focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setAdjustedQty((prev) => Number((prev + 1).toFixed(2)))}
                        className="w-10 h-10 rounded-2xl bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-brand-brown-dark font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Adjustment Reason */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Adjustment Reason <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Physical inventory audit, Spoilage, Delivery"
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 5. ADD / EDIT INGREDIENT MODAL                                            */}
      {/* ========================================================================= */}
      {editingIngredient &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg sm:max-w-xl flex flex-col max-h-[92vh]">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between gap-3 mb-3 px-1 shrink-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs truncate">
                    {editingIngredient.id ? 'Edit Ingredient' : 'New Ingredient'}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingIngredient(null)}
                    className="px-4 py-2 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="ingredient-form"
                    className="px-5 py-2 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    Save Ingredient
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="ingredient-form" onSubmit={handleSaveIngredient} className="p-5 sm:p-6 space-y-5">
                  {/* Ingredient Name */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Ingredient Name <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingIngredient.name || ''}
                      onChange={(e) => setEditingIngredient({ ...editingIngredient, name: e.target.value })}
                      placeholder="e.g. Arabica Espresso Beans, Fresh Cow Milk..."
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Unit */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Measurement Unit
                      </label>
                      <select
                        value={editingIngredient.unit || 'kg'}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, unit: e.target.value as any })}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors cursor-pointer"
                      >
                        <option value="kg">kg (Kilograms)</option>
                        <option value="g">g (Grams)</option>
                        <option value="L">L (Liters)</option>
                        <option value="ml">ml (Milliliters)</option>
                        <option value="pcs">pcs (Pieces)</option>
                      </select>
                    </div>

                    {/* SKU Code */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        SKU Code
                      </label>
                      <input
                        type="text"
                        value={editingIngredient.sku || ''}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, sku: e.target.value })}
                        placeholder="ING-1001"
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Stock */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Initial Stock Count
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingIngredient.currentStock ?? 0}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, currentStock: Number(e.target.value) })}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                        required
                      />
                    </div>

                    {/* Reorder Threshold */}
                    <div>
                      <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                        Reorder Threshold
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingIngredient.reorderLevel ?? 0}
                        onChange={(e) => setEditingIngredient({ ...editingIngredient, reorderLevel: Number(e.target.value) })}
                        className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    {/* Average Cost */}
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Average Unit Cost (Rs.)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={(editingIngredient.averageCostCents || 0) / 100}
                      onChange={(e) => setEditingIngredient({ ...editingIngredient, averageCostCents: Math.round(Number(e.target.value) * 100) })}
                      placeholder="0.00"
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                    />
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
