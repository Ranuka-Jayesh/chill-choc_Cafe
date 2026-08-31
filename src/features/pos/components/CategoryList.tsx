import React from 'react';
import { Category } from '@/types';
import {
  Coffee,
  CupSoda,
  Cake,
  IceCream,
  UtensilsCrossed,
  Sparkles,
  LayoutGrid,
  Search,
  X,
  Pizza,
  Sandwich,
  Cookie,
  Soup,
  Flame,
  Wine,
  Beer,
  Croissant,
  Apple,
} from 'lucide-react';

interface CategoryListProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Coffee: <Coffee className="w-5 h-5 stroke-[2.2]" />,
  CupSoda: <CupSoda className="w-5 h-5 stroke-[2.2]" />,
  Cake: <Cake className="w-5 h-5 stroke-[2.2]" />,
  IceCream: <IceCream className="w-5 h-5 stroke-[2.2]" />,
  UtensilsCrossed: <UtensilsCrossed className="w-5 h-5 stroke-[2.2]" />,
  Sparkles: <Sparkles className="w-5 h-5 stroke-[2.2]" />,
  Pizza: <Pizza className="w-5 h-5 stroke-[2.2]" />,
  Sandwich: <Sandwich className="w-5 h-5 stroke-[2.2]" />,
  Cookie: <Cookie className="w-5 h-5 stroke-[2.2]" />,
  Soup: <Soup className="w-5 h-5 stroke-[2.2]" />,
  Flame: <Flame className="w-5 h-5 stroke-[2.2]" />,
  Wine: <Wine className="w-5 h-5 stroke-[2.2]" />,
  Beer: <Beer className="w-5 h-5 stroke-[2.2]" />,
  Croissant: <Croissant className="w-5 h-5 stroke-[2.2]" />,
  Apple: <Apple className="w-5 h-5 stroke-[2.2]" />,
};

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <aside className="w-full h-full bg-cream-50/80 border-r border-border/80 flex flex-col p-2.5 sm:p-3 gap-2 sm:gap-2.5 overflow-hidden">
      {/* Search Input with F2 shortcut badge (Enhanced Height & Touch Target) */}
      <div className="relative flex-shrink-0">
        <Search className="w-4 h-4 text-text-secondary/80 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          id="product-search-input"
          type="text"
          placeholder="Search items... (F2)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-10 sm:h-11 pl-9 pr-10 bg-white border border-cream-200/90 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-all shadow-xs"
        />
        {searchQuery ? (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-cream-100 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-black text-text-secondary bg-cream-100 px-1.5 py-0.5 rounded border border-border/70 shadow-xs">
            F2
          </span>
        )}
      </div>

      {/* Category Buttons Vertical List with min-h-0 Flex Containment */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
        {/* All Products Option */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`w-full flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all text-left active:scale-[0.98] cursor-pointer ${
            selectedCategoryId === null
              ? 'bg-gradient-to-r from-brand-teal to-brand-teal-dark text-white shadow-teal ring-2 ring-brand-teal/20'
              : 'bg-white text-text-primary hover:bg-cream-100/90 border border-border/70 shadow-xs'
          }`}
        >
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              selectedCategoryId === null
                ? 'bg-white text-brand-teal shadow-xs'
                : 'bg-cream-100 text-brand-brown-dark'
            }`}
          >
            <LayoutGrid className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
          </div>
          <div className="truncate flex-1">
            <div className="font-black text-xs leading-tight">All Menu</div>
            <div
              className={`text-[10px] font-semibold mt-0.5 ${
                selectedCategoryId === null ? 'text-cream-100' : 'text-text-secondary'
              }`}
            >
              Full catalog
            </div>
          </div>
        </button>

        {/* Categories from DB */}
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          const icon = cat.image ? (
            <img src={cat.image} alt={cat.name} className="w-5 h-5 object-contain rounded-md" />
          ) : (
            ICON_MAP[cat.icon] || <Coffee className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
          );

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`w-full flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all text-left active:scale-[0.98] cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-brand-teal to-brand-teal-dark text-white shadow-teal ring-2 ring-brand-teal/20'
                  : 'bg-white text-text-primary hover:bg-cream-100/90 border border-border/70 shadow-xs'
              }`}
            >
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 transition-all overflow-hidden ${
                  isSelected
                    ? 'bg-white text-brand-teal shadow-xs'
                    : 'bg-cream-100 text-brand-brown-dark'
                }`}
              >
                {icon}
              </div>
              <div className="truncate flex-1">
                <div className="font-black text-xs leading-tight truncate">{cat.name}</div>
                <div
                  className={`text-[10px] font-semibold mt-0.5 truncate ${
                    isSelected ? 'text-cream-100' : 'text-text-secondary'
                  }`}
                >
                  {cat.slug}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
