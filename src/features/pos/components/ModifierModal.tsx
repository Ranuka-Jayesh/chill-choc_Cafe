import React, { useState, useEffect } from 'react';
import { Product, ModifierGroup, OrderItemModifier } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR } from '@/utils/format';
import {
  X,
  Plus,
  Minus,
  Check,
  Sparkles,
  Utensils,
  Coffee,
  CupSoda,
  Cake,
  IceCream,
  UtensilsCrossed,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';

interface ModifierModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Product, modifiers: OrderItemModifier[], quantity: number, notes: string) => void;
}

export const ModifierModal: React.FC<ModifierModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [selectedModifiers, setSelectedModifiers] = useState<OrderItemModifier[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [imageError, setImageError] = useState(false);

  // When product opens, load default modifiers
  useEffect(() => {
    setImageError(false);
    if (!product || !isOpen) {
      setSelectedModifiers([]);
      setQuantity(1);
      setNotes('');
      return;
    }

    const applicableGroups =
      product.customModifiers && product.customModifiers.length > 0
        ? product.customModifiers
        : db.getSnapshot().modifierGroups.filter((g) => product.modifierGroupIds?.includes(g.id));

    const defaults: OrderItemModifier[] = [];
    applicableGroups.forEach((group) => {
      // Find default option or pick first option if group is required
      const defOpt = group.options.find((o) => o.isDefault) || (group.required ? group.options[0] : null);
      if (defOpt) {
        defaults.push({
          groupId: group.id,
          groupName: group.name,
          optionId: defOpt.id,
          optionName: defOpt.name,
          priceCents: defOpt.priceCents,
          ingredientId: defOpt.ingredientId,
          ingredientQuantity: defOpt.ingredientQuantity,
          ingredientUnit: defOpt.ingredientUnit,
          ingredients: defOpt.ingredients,
        });
      }
    });

    setSelectedModifiers(defaults);
    setQuantity(1);
    setNotes('');
  }, [product, isOpen]);

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const dbSnapshot = db.getSnapshot();
  const category = dbSnapshot.categories.find((c) => c.id === product.categoryId);
  const prepStation = dbSnapshot.stations.find((s) => s.id === category?.preparationStationId);

  const applicableGroups =
    product.customModifiers && product.customModifiers.length > 0
      ? product.customModifiers
      : dbSnapshot.modifierGroups.filter((g) => product.modifierGroupIds?.includes(g.id));

  const handleOptionToggle = (group: ModifierGroup, option: ModifierGroup['options'][0]) => {
    const isSelected = selectedModifiers.some((m) => m.optionId === option.id);

    if (group.multiSelect) {
      if (isSelected) {
        setSelectedModifiers(selectedModifiers.filter((m) => m.optionId !== option.id));
      } else {
        const countInGroup = selectedModifiers.filter((m) => m.groupId === group.id).length;
        if (countInGroup < group.maxSelections) {
          setSelectedModifiers([
            ...selectedModifiers,
            {
              groupId: group.id,
              groupName: group.name,
              optionId: option.id,
              optionName: option.name,
              priceCents: option.priceCents,
              ingredientId: option.ingredientId,
              ingredientQuantity: option.ingredientQuantity,
              ingredientUnit: option.ingredientUnit,
              ingredients: option.ingredients,
            },
          ]);
        }
      }
    } else {
      // Single select (radio behavior)
      const filtered = selectedModifiers.filter((m) => m.groupId !== group.id);
      if (isSelected && !group.required) {
        // Uncheck if optional
        setSelectedModifiers(filtered);
      } else {
        setSelectedModifiers([
          ...filtered,
          {
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceCents: option.priceCents,
            ingredientId: option.ingredientId,
            ingredientQuantity: option.ingredientQuantity,
            ingredientUnit: option.ingredientUnit,
            ingredients: option.ingredients,
          },
        ]);
      }
    }
  };

  const modifierTotalCents = selectedModifiers.reduce((sum, m) => sum + m.priceCents, 0);
  const unitPriceCents = product.basePriceCents + modifierTotalCents;
  const grandTotalCents = unitPriceCents * quantity;

  const handleSubmit = () => {
    onConfirm(product, selectedModifiers, quantity, notes.trim());
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 bg-brand-brown-deep/80 backdrop-blur-md animate-in fade-in overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex flex-col my-auto"
      >
        {/* TOP BAR: Product Title, Breadcrumb & Close Button */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-3 px-1 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {product.name}
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-bold">
              <span>{category?.name || 'Item'}</span>
              <span className="opacity-40">•</span>
              <span className="text-brand-yellow font-extrabold">POS Customizer</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* MAIN BODY: Two Separated Clean Modular Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
          
          {/* ========================================================================= */}
          {/* CARD 1 (LEFT): FULL-BLEED HERO PHOTO CARD WITH FADED BOTTOM DETAILS       */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 relative flex flex-col justify-between rounded-2xl sm:rounded-[24px] overflow-hidden shadow-xl border border-white/15 bg-brand-brown-deep min-h-[260px] sm:min-h-[320px] lg:min-h-[440px]">
            {/* Background Image / Fallback Container */}
            {!product.image || imageError ? (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-brown via-brand-brown-dark to-brand-brown-deep flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-4 shadow-lg">
                  {product.categoryId === 'cat_coffee' && <Coffee className="w-8 h-8 sm:w-10 sm:h-10 text-brand-yellow stroke-[1.8]" />}
                  {product.categoryId === 'cat_cold_drinks' && <CupSoda className="w-8 h-8 sm:w-10 sm:h-10 text-brand-teal stroke-[1.8]" />}
                  {product.categoryId === 'cat_desserts' && <Cake className="w-8 h-8 sm:w-10 sm:h-10 text-brand-yellow stroke-[1.8]" />}
                  {product.categoryId === 'cat_ice_cream' && <IceCream className="w-8 h-8 sm:w-10 sm:h-10 text-rose-300 stroke-[1.8]" />}
                  {product.categoryId === 'cat_food' && <UtensilsCrossed className="w-8 h-8 sm:w-10 sm:h-10 text-brand-orange stroke-[1.8]" />}
                  {!['cat_coffee', 'cat_cold_drinks', 'cat_desserts', 'cat_ice_cream', 'cat_food'].includes(product.categoryId) && (
                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-brand-teal stroke-[1.8]" />
                  )}
                </div>
              </div>
            ) : (
              <img
                src={product.image}
                alt={product.name}
                onError={() => setImageError(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Smooth Cinematic Faded Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/20 pointer-events-none" />

            {/* Top Floating Badges */}
            <div className="relative z-10 p-3.5 sm:p-4 flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-brand-brown-dark font-black text-[11px] shadow-sm border border-white/60 flex items-center gap-1.5">
                <Utensils className="w-3 h-3 text-brand-teal" />
                {category?.name || 'Café Item'}
              </span>

              <span
                className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm border ${
                  product.isSoldOut
                    ? 'bg-status-warning/90 text-white border-status-warning/40'
                    : 'bg-emerald-500/90 text-white border-emerald-400/40'
                }`}
              >
                {product.isSoldOut ? 'Sold Out' : 'Available'}
              </span>
            </div>

            {/* Bottom Faded Details Area */}
            <div className="relative z-10 p-4 sm:p-5 space-y-2">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-md">
                  {product.name}
                </h2>
                {product.description && (
                  <p className="text-[11px] sm:text-xs text-white/90 line-clamp-2 leading-relaxed drop-shadow-sm font-medium">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Price & Station Floating Bar */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/20">
                <div className="px-3 py-1 rounded-lg bg-brand-yellow text-brand-brown-deep font-black text-xs sm:text-sm shadow-sm">
                  Base: {formatLKR(product.basePriceCents)}
                </div>

                {prepStation && (
                  <div className="text-[10px] sm:text-[11px] text-white/90 font-bold bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 truncate">
                    {prepStation.name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD 2 (RIGHT): CUSTOMIZATION OPTIONS & ORDER ACTION (7 Cols)             */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-white rounded-2xl sm:rounded-[24px] shadow-xl border border-[#E9E0D5] overflow-hidden">
            
            {/* 1. Header (Compact) */}
            <div className="flex items-center gap-2 px-4 sm:px-5 py-3 bg-gradient-to-r from-cream-50 to-white border-b border-[#EAE3DA] shrink-0">
              <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200/80 flex items-center justify-center text-brand-teal shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-brand-brown-dark leading-tight">
                  Customize Order Options
                </h3>
                <p className="text-[10px] text-text-secondary font-medium">
                  Select your preferred size, milk, and add-ons
                </p>
              </div>
            </div>

            {/* 2. Options Area (Ergonomic compact padding to fit all standard selections) */}
            <div className="p-3.5 sm:p-4 space-y-3.5 overflow-y-auto max-h-[58vh] lg:max-h-none scrollbar-thin scrollbar-thumb-[#E0D7CC] scrollbar-track-transparent">
              {applicableGroups.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-text-secondary">
                  <SlidersHorizontal className="w-6 h-6 text-text-muted/60 mb-1.5 stroke-[1.5]" />
                  <p className="text-xs font-bold text-brand-brown-dark">No Modifiers Configured</p>
                  <p className="text-[10px] text-text-muted">Standard recipe served.</p>
                </div>
              ) : (
                applicableGroups.map((group) => {
                  return (
                    <div key={group.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[11px] uppercase tracking-wider text-brand-brown-dark flex items-center gap-1.5">
                          {group.name}
                          {group.required ? (
                            <span className="text-[9px] text-brand-teal font-black px-1.5 py-0.2 rounded-md bg-brand-teal-light border border-brand-teal/20">
                              REQUIRED
                            </span>
                          ) : (
                            <span className="text-[9px] text-text-secondary font-semibold">
                              (OPTIONAL {group.multiSelect ? `UP TO ${group.maxSelections}` : ''})
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {group.options.map((option) => {
                          const isSelected = selectedModifiers.some((m) => m.optionId === option.id);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleOptionToggle(group, option)}
                              className={`flex flex-col px-2.5 py-2 rounded-xl border text-left transition-all active:scale-[0.97] cursor-pointer ${
                                isSelected
                                  ? 'bg-brand-teal-light/60 border-brand-teal text-brand-teal-dark shadow-xs ring-1 ring-brand-teal/30'
                                  : 'bg-[#FAF7F2]/60 border-border/70 hover:bg-cream-100 hover:border-border text-text-primary'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-black leading-tight line-clamp-1">
                                  {option.name}
                                </span>
                                <div
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border flex-shrink-0 transition-colors ${
                                    isSelected
                                      ? 'bg-brand-teal text-white border-brand-teal'
                                      : 'border-zinc-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              </div>
                              <span className="text-[10px] font-extrabold text-text-secondary mt-0.5 tabular-nums">
                                {option.priceCents > 0 ? `+${formatLKR(option.priceCents)}` : 'Included'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Special Instructions / Kitchen Notes */}
              <div className="space-y-1 pt-2 border-t border-[#EAE3DA]">
                <label className="text-[10px] font-black uppercase tracking-wider text-text-secondary flex items-center gap-1">
                  <FileText className="w-3 h-3 text-brand-teal" />
                  Special Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra hot, Less sweet, Oat milk..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FAF7F2] border border-border/80 rounded-xl text-xs font-bold text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-teal focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* 3. Bottom Pinned Footer: Quantity Stepper & Add to Order */}
            <div className="px-4 sm:px-5 py-3 bg-[#FAF7F2] border-t border-[#E9E0D5] flex items-center justify-between gap-3 shrink-0">
              {/* Quantity Stepper */}
              <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-2xl border border-border shadow-xs">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="w-9 h-9 rounded-xl bg-cream-100 hover:bg-cream-200 disabled:opacity-40 flex items-center justify-center text-brand-brown-dark transition-all active:scale-95 cursor-pointer"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <span className="font-black text-base w-8 text-center text-brand-brown-dark tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 rounded-xl bg-cream-100 hover:bg-cream-200 flex items-center justify-center text-brand-brown-dark transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark active:scale-[0.98] text-white font-black text-sm sm:text-base shadow-teal transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Add to Order</span>
                <span className="opacity-60">•</span>
                <span className="tabular-nums">{formatLKR(grandTotalCents)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
