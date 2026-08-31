import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { inventoryService } from '@/services/inventoryService';
import { catalogService } from '@/services/catalogService';
import { db } from '@/services/storage/db';
import { Ingredient, Supplier } from '@/types';
import { formatLKR } from '@/utils/format';
import {
  Boxes,
  X,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  Layers,
  Building2,
  RefreshCw,
} from 'lucide-react';

interface PosStockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type StockFilterType = 'ALL' | 'LOW_OUT' | 'EXPIRED_NEAR';

export const PosStockDrawer: React.FC<PosStockDrawerProps> = ({ isOpen, onClose }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(inventoryService.getIngredients());
  const [suppliers, setSuppliers] = useState<Supplier[]>(catalogService.getSuppliers());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<StockFilterType>('ALL');

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Real-time synchronization
  useEffect(() => {
    const refresh = () => {
      setIngredients(inventoryService.getIngredients());
      setSuppliers(catalogService.getSuppliers());
    };

    refresh();
    const unsub = db.subscribe(refresh);
    return unsub;
  }, [isOpen]);

  // Expiry Status Calculation
  const getExpiryInfo = (expiryDate?: string) => {
    if (!expiryDate) return { status: 'NONE' as const, daysLeft: null, text: 'No Expiry Set' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    if (isNaN(exp.getTime())) return { status: 'NONE' as const, daysLeft: null, text: 'No Expiry Set' };

    const diffDays = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return {
        status: 'EXPIRED' as const,
        daysLeft: diffDays,
        text: `Expired ${Math.abs(diffDays)}d ago`,
      };
    }
    if (diffDays === 0) {
      return {
        status: 'EXPIRING_SOON' as const,
        daysLeft: 0,
        text: 'Expires Today',
      };
    }
    if (diffDays <= 7) {
      return {
        status: 'EXPIRING_SOON' as const,
        daysLeft: diffDays,
        text: `Expires in ${diffDays}d`,
      };
    }
    return {
      status: 'VALID' as const,
      daysLeft: diffDays,
      text: `Expires: ${expiryDate}`,
    };
  };

  // KPI Metrics
  const expiredCount = useMemo(() => {
    return ingredients.filter((i) => getExpiryInfo(i.expiryDate).status === 'EXPIRED').length;
  }, [ingredients]);

  const nearExpiryCount = useMemo(() => {
    return ingredients.filter((i) => getExpiryInfo(i.expiryDate).status === 'EXPIRING_SOON').length;
  }, [ingredients]);

  const lowOrOutCount = useMemo(() => {
    return ingredients.filter((i) => i.currentStock <= i.reorderLevel).length;
  }, [ingredients]);

  // Filtered List
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const isOut = ing.currentStock <= 0;
      const isLow = !isOut && ing.currentStock <= ing.reorderLevel;
      const expiry = getExpiryInfo(ing.expiryDate);

      if (filterType === 'LOW_OUT' && !isOut && !isLow) return false;
      if (
        filterType === 'EXPIRED_NEAR' &&
        expiry.status !== 'EXPIRED' &&
        expiry.status !== 'EXPIRING_SOON'
      )
        return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ing.name.toLowerCase().includes(q) ||
          ing.sku.toLowerCase().includes(q) ||
          (ing.expiryDate && ing.expiryDate.includes(q))
        );
      }
      return true;
    });
  }, [ingredients, filterType, search]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-xl h-full bg-[#FAF7F2] shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 border-l border-[#E2D8CC]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#EAE3DA] flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-teal-light text-brand-teal flex items-center justify-center shadow-xs">
              <Boxes className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <h2 className="font-extrabold text-base sm:text-lg text-brand-brown-dark tracking-tight">
              Ingredient Stock & Expiry
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-brand-brown-dark transition-colors cursor-pointer active:scale-90"
            title="Close Drawer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white/80 border-b border-[#EAE3DA] shrink-0">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-text-muted absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ingredient name, SKU, or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark placeholder:text-text-muted/60 focus:outline-none focus:border-brand-teal focus:bg-white transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 p-1 rounded-full text-text-muted hover:text-brand-brown-dark transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Ingredient Minimal Flat Rows */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white divide-y divide-[#F0E8DF]">
          {filteredIngredients.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center p-6 text-center space-y-2 text-text-muted">
              <Boxes className="w-9 h-9 text-text-muted/40" />
              <div className="text-xs font-bold text-brand-brown-dark">No Ingredients Found</div>
              <p className="text-[11px] text-text-muted max-w-xs">
                Try adjusting your search or switching to "All Stock".
              </p>
            </div>
          ) : (
            filteredIngredients.map((ing) => {
              const isOut = ing.currentStock <= 0;
              const isLow = !isOut && ing.currentStock <= ing.reorderLevel;
              const expiry = getExpiryInfo(ing.expiryDate);
              const isExpired = expiry.status === 'EXPIRED';
              const isExpiringSoon = expiry.status === 'EXPIRING_SOON';
              const sup = suppliers.find((s) => s.id === ing.supplierId);

              return (
                <div
                  key={ing.id}
                  className="py-2.5 px-4 hover:bg-[#FAF7F2]/70 transition-colors group"
                >
                  {/* Top Line: Name, SKU, Supplier, Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-extrabold text-xs text-brand-brown-dark truncate">
                        {ing.name}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-text-muted">
                        {ing.sku}
                      </span>
                      {sup && (
                        <span className="hidden sm:inline text-[10px] text-text-muted truncate">
                          • {sup.name}
                        </span>
                      )}
                    </div>

                    {/* Minimal Status Badge */}
                    <div className="shrink-0">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-black text-[9px] uppercase border bg-rose-100 text-rose-800 border-rose-300">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                          <span>Expired</span>
                        </span>
                      ) : isOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-black text-[9px] uppercase border bg-status-danger-bg text-status-danger border-status-danger/30">
                          <span>Out of Stock</span>
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-black text-[9px] uppercase border bg-status-warning-bg text-status-warning border-status-warning/30">
                          <span>Low Stock</span>
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-black text-[9px] uppercase border bg-amber-50 text-amber-900 border-amber-300">
                          <Clock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                          <span>Near Expiry</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-black text-[9px] uppercase border bg-status-success-bg text-status-success border-status-success/30">
                          <span>In Stock</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Line: Stock & Expiry details */}
                  <div className="flex items-center justify-between text-[11px] mt-1 text-text-secondary">
                    <div className="flex items-center gap-3">
                      <span>
                        Qty:{' '}
                        <strong
                          className={`font-black tabular-nums ${
                            isOut
                              ? 'text-status-danger'
                              : isLow
                              ? 'text-status-warning'
                              : 'text-brand-brown-deep'
                          }`}
                        >
                          {ing.currentStock} {ing.unit}
                        </strong>
                      </span>
                      <span className="text-text-muted">
                        Min: <span className="font-bold text-text-secondary">{ing.reorderLevel} {ing.unit}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-text-muted text-[10px] uppercase font-bold">Expiry:</span>
                      {ing.expiryDate ? (
                        isExpired ? (
                          <span className="font-mono font-bold text-rose-700 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{ing.expiryDate} ({Math.abs(expiry.daysLeft || 0)}d ago)</span>
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="font-mono font-bold text-amber-800 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0 text-amber-700" />
                            <span>{ing.expiryDate} (in {expiry.daysLeft}d)</span>
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-brand-brown-dark">
                            {ing.expiryDate}
                          </span>
                        )
                      ) : (
                        <span className="text-text-muted/40 font-mono">-</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Full-Width Seamless Filter Bar */}
        <div className="h-12 bg-white border-t border-[#EAE3DA] grid grid-cols-3 divide-x divide-[#EAE3DA] shrink-0 select-none">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`h-full w-full px-2 text-xs font-bold flex items-center justify-center transition-all cursor-pointer truncate ${
              filterType === 'ALL'
                ? 'bg-brand-teal text-white font-black'
                : 'bg-white hover:bg-cream-100/80 text-brand-brown-dark'
            }`}
          >
            All Stock ({ingredients.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('EXPIRED_NEAR')}
            className={`h-full w-full px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
              filterType === 'EXPIRED_NEAR'
                ? 'bg-rose-600 text-white font-black'
                : expiredCount > 0
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold'
                : 'bg-white hover:bg-cream-100/80 text-brand-brown-dark'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${filterType === 'EXPIRED_NEAR' ? 'text-white' : 'text-rose-600'}`} />
            <span className="truncate">Expiry Alerts ({expiredCount + nearExpiryCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('LOW_OUT')}
            className={`h-full w-full px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
              filterType === 'LOW_OUT'
                ? 'bg-amber-600 text-white font-black'
                : lowOrOutCount > 0
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold'
                : 'bg-white hover:bg-cream-100/80 text-brand-brown-dark'
            }`}
          >
            <Package className={`w-3.5 h-3.5 shrink-0 ${filterType === 'LOW_OUT' ? 'text-white' : 'text-amber-700'}`} />
            <span className="truncate">Low / Out ({lowOrOutCount})</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
