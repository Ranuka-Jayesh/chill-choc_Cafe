import React, { useState } from 'react';
import { Product } from '@/types';
import { formatLKR } from '@/utils/format';
import {
  Plus,
  SlidersHorizontal,
  AlertTriangle,
  Coffee,
  CupSoda,
  Cake,
  IceCream,
  UtensilsCrossed,
  Sparkles,
  Ban,
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const getCategoryFallback = (categoryId: string) => {
  switch (categoryId) {
    case 'cat_coffee':
      return {
        icon: Coffee,
        bg: 'from-amber-50 to-amber-100/80',
        textColor: 'text-amber-800',
        cardBorder: 'border-amber-200/60',
      };
    case 'cat_cold_drinks':
      return {
        icon: CupSoda,
        bg: 'from-teal-50 to-teal-100/80',
        textColor: 'text-brand-teal',
        cardBorder: 'border-teal-200/60',
      };
    case 'cat_desserts':
      return {
        icon: Cake,
        bg: 'from-yellow-50 to-amber-100/80',
        textColor: 'text-amber-700',
        cardBorder: 'border-yellow-200/60',
      };
    case 'cat_ice_cream':
      return {
        icon: IceCream,
        bg: 'from-rose-50 to-pink-100/80',
        textColor: 'text-rose-600',
        cardBorder: 'border-rose-200/60',
      };
    case 'cat_food':
      return {
        icon: UtensilsCrossed,
        bg: 'from-orange-50 to-amber-100/80',
        textColor: 'text-brand-orange',
        cardBorder: 'border-orange-200/60',
      };
    default:
      return {
        icon: Sparkles,
        bg: 'from-cream-50 to-cream-200/80',
        textColor: 'text-brand-teal',
        cardBorder: 'border-cream-300',
      };
  }
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const hasModifiers = product.modifierGroupIds && product.modifierGroupIds.length > 0;
  const fallback = getCategoryFallback(product.categoryId);
  const IconComponent = fallback.icon;

  const showFallback = !product.image || imageError;

  return (
    <button
      type="button"
      onClick={() => !product.isSoldOut && onClick(product)}
      disabled={product.isSoldOut}
      className={`group relative flex flex-col justify-between rounded-[20px] sm:rounded-[24px] overflow-hidden border text-left transition-all duration-200 focus:outline-none shadow-xs ${
        product.isSoldOut
          ? 'bg-[#FAF7F2]/70 border-[#E9E0D5] opacity-75 cursor-not-allowed select-none'
          : 'bg-white border-brand-teal/30 hover:border-brand-teal active:scale-[0.97] hover:shadow-card hover:-translate-y-0.5 cursor-pointer'
      }`}
    >
      {/* 1. Full-Width Top-Bleed Image Container with Soft Desaturation when Out of Stock */}
      <div className="relative w-full aspect-[16/11] bg-cream-100/70 overflow-hidden flex-shrink-0">
        {showFallback ? (
          <div
            className={`w-full h-full bg-gradient-to-br ${fallback.bg} flex items-center justify-center relative overflow-hidden ${
              product.isSoldOut ? 'filter blur-[1px] grayscale-[60%] opacity-70' : 'group-hover:scale-105'
            } transition-all duration-300`}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/90 shadow-sm border border-white/80 flex items-center justify-center">
              <IconComponent className={`w-6 h-6 sm:w-7 sm:h-7 ${fallback.textColor} stroke-[2]`} />
            </div>
          </div>
        ) : (
          <img
            src={product.image}
            alt={product.name}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-all duration-300 ${
              product.isSoldOut
                ? 'filter blur-[1px] scale-100 grayscale-[60%] opacity-70'
                : 'group-hover:scale-108'
            }`}
            loading="lazy"
          />
        )}

        {/* Minimal Out of Stock Center Text Overlay */}
        {product.isSoldOut ? (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center p-2 text-center z-10 animate-in fade-in duration-200">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-brand-brown-dark bg-[#FAF7F2] px-2.5 py-1 rounded-full border border-[#E2D8CC] shadow-xs">
              Currently Unavailable
            </span>
          </div>
        ) : (
          hasModifiers && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-brand-brown-deep/85 backdrop-blur-md text-[9px] font-black text-white flex items-center gap-1 shadow-sm">
              <SlidersHorizontal className="w-2 h-2 text-brand-yellow" />
              <span>Custom</span>
            </div>
          )
        )}
      </div>

      {/* 2. Card Info & Action Button (Padded Bottom Section) */}
      <div className={`w-full p-2.5 sm:p-3 flex items-end justify-between gap-1.5 flex-1 ${product.isSoldOut ? 'bg-[#FAF7F2]/60' : 'bg-white'}`}>
        <div className="min-w-0 flex-1">
          <h3 className={`font-black text-xs sm:text-sm truncate tracking-tight transition-colors leading-snug ${
            product.isSoldOut ? 'text-brand-brown-dark/50 line-through' : 'text-brand-brown-dark group-hover:text-brand-teal'
          }`}>
            {product.name}
          </h3>
          <p className={`text-xs sm:text-sm font-extrabold tabular-nums mt-0.5 ${
            product.isSoldOut ? 'text-text-muted/60' : 'text-text-secondary/90'
          }`}>
            {formatLKR(product.basePriceCents)}
          </p>
        </div>

        {/* Circular Action Button */}
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            product.isSoldOut
              ? 'border-[#E0D7CC] bg-[#FAF7F2] text-brand-brown-dark/40'
              : 'border-brand-teal text-brand-teal group-hover:bg-brand-teal group-hover:text-white active:scale-90 shadow-xs'
          }`}
        >
          {product.isSoldOut ? (
            <Ban className="w-3 h-3 stroke-[2.5]" />
          ) : (
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          )}
        </div>
      </div>
    </button>
  );
};
