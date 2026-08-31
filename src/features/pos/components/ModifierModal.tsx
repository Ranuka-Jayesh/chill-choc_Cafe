import React, { useState, useEffect } from 'react';
import { Product, ModifierGroup, OrderItemModifier } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR } from '@/utils/format';
import { X, Plus, Minus, Check, Sparkles, Utensils, Coffee, CupSoda, Cake, IceCream, UtensilsCrossed } from 'lucide-react';

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

  const applicableGroups =
    product.customModifiers && product.customModifiers.length > 0
      ? product.customModifiers
      : db.getSnapshot().modifierGroups.filter((g) => product.modifierGroupIds?.includes(g.id));

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-brand-brown-deep/75 backdrop-blur-md animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-white rounded-3xl sm:rounded-[32px] shadow-2xl border border-border/80 overflow-hidden flex flex-col md:flex-row max-h-[92vh]"
      >
        
        {/* LEFT SIDE: Full-Height Big Hero Image & Product Card */}
        <div className="relative md:w-5/12 min-h-[220px] md:min-h-[540px] flex-shrink-0 overflow-hidden bg-brand-brown-deep flex items-center justify-center">
          {!product.image || imageError ? (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-brown to-brand-brown-deep flex flex-col items-center justify-center p-6">
              <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-12 shadow-xl">
                {product.categoryId === 'cat_coffee' && <Coffee className="w-12 h-12 text-brand-yellow stroke-[1.8]" />}
                {product.categoryId === 'cat_cold_drinks' && <CupSoda className="w-12 h-12 text-brand-teal stroke-[1.8]" />}
                {product.categoryId === 'cat_desserts' && <Cake className="w-12 h-12 text-brand-yellow stroke-[1.8]" />}
                {product.categoryId === 'cat_ice_cream' && <IceCream className="w-12 h-12 text-rose-300 stroke-[1.8]" />}
                {product.categoryId === 'cat_food' && <UtensilsCrossed className="w-12 h-12 text-brand-orange stroke-[1.8]" />}
                {!['cat_coffee', 'cat_cold_drinks', 'cat_desserts', 'cat_ice_cream', 'cat_food'].includes(product.categoryId) && (
                  <Sparkles className="w-12 h-12 text-brand-teal stroke-[1.8]" />
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
          {/* Subtle gradient vignette for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/15" />

          {/* Floating Category Badge */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-brand-brown-dark font-black text-xs shadow-md border border-white/60 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-brand-teal" />
              {db.getSnapshot().categories.find((c) => c.id === product.categoryId)?.name || 'Café Item'}
            </span>
          </div>

          {/* Bottom Product Details on Image */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 text-white space-y-1.5 z-10">
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-md">
              {product.name}
            </h2>
            {product.description && (
              <p className="text-xs text-white/85 line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            )}
            <div className="pt-2 flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-xl bg-brand-yellow/90 backdrop-blur-xs text-brand-brown-deep font-black text-xs sm:text-sm shadow-xs">
                Base: {formatLKR(product.basePriceCents)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Customization Options, Modifiers & Footer */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Header with Title & Close Button */}
          <div className="flex items-center justify-between px-6 py-4 sm:py-5 bg-gradient-to-r from-cream-50 to-white border-b border-border/70">
            <div>
              <h3 className="font-black text-base text-brand-brown-dark tracking-tight">
                Customize Order Options
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Select your preferred size, milk, and add-ons
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Modifier Options */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 bg-white">
            {applicableGroups.map((group) => {
              return (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs uppercase tracking-wider text-brand-brown-dark flex items-center gap-2">
                      {group.name}
                      {group.required ? (
                        <span className="text-[10px] text-brand-teal font-black px-2 py-0.5 rounded-full bg-brand-teal-light border border-brand-teal/20">
                          REQUIRED
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-secondary font-semibold">
                          (OPTIONAL {group.multiSelect ? `UP TO ${group.maxSelections}` : ''})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {group.options.map((option) => {
                      const isSelected = selectedModifiers.some((m) => m.optionId === option.id);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleOptionToggle(group, option)}
                          className={`flex flex-col p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                            isSelected
                              ? 'bg-brand-teal-light/50 border-brand-teal text-brand-teal-dark shadow-xs'
                              : 'bg-cream-50/50 border-border/70 hover:bg-cream-100 hover:border-border text-text-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-black leading-tight line-clamp-1">
                              {option.name}
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center border flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-brand-teal text-white border-brand-teal'
                                  : 'border-zinc-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>
                          <span className="text-[11px] font-extrabold text-text-secondary mt-1.5 tabular-nums">
                            {option.priceCents > 0 ? `+${formatLKR(option.priceCents)}` : 'Included'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Special Instructions / Kitchen Notes */}
            <div className="space-y-1.5 pt-3 border-t border-border/70">
              <label className="text-xs font-black uppercase tracking-wider text-text-secondary">
                Special Instructions / Kitchen Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Extra hot, Less sweet, Oat milk..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 bg-cream-50 border border-border rounded-2xl text-xs font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 bg-cream-50 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Quantity Stepper */}
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-2xl border border-border shadow-xs">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded-xl bg-cream-100 hover:bg-cream-200 disabled:opacity-40 flex items-center justify-center text-brand-brown transition-colors active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-black text-base w-8 text-center text-text-primary tabular-nums">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-xl bg-cream-100 hover:bg-cream-200 flex items-center justify-center text-brand-brown transition-colors active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-1 justify-end">
              <button
                onClick={handleSubmit}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-black text-sm sm:text-base shadow-teal transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Add to Order</span>
                <span className="opacity-70">•</span>
                <span className="tabular-nums">{formatLKR(grandTotalCents)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
