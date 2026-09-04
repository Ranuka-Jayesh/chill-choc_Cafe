import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { catalogService } from '@/services/catalogService';
import { inventoryService } from '@/services/inventoryService';
import { realtimeSocketService } from '@/services/realtimeSocketService';
import { supabaseStorageService } from '@/services/supabaseStorageService';
import { Product, Category, ModifierGroup, ModifierOption, Ingredient, RecipeItem } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, rupeesToCents, centsToRupees } from '@/utils/format';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Edit2,
  Loader2,
  Trash2,
  Check,
  X,
  Copy,
  Layers,
  SlidersHorizontal,
  Coffee,
  CupSoda,
  Cake,
  IceCream,
  Sparkles,
  DollarSign,
  Download,
  Upload,
  Image as ImageIcon,
  Package,
  Pizza,
  Sandwich,
  Cookie,
  Soup,
  Flame,
  Wine,
  Beer,
  Croissant,
  Apple,
  ChefHat,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from 'lucide-react';
import { confirmDialog } from '@/store/useConfirmStore';
import { toast } from 'sonner';

export const CATEGORY_ICON_PRESETS = [
  {
    id: 'Coffee',
    label: 'Coffee',
    icon: Coffee,
    keywords: ['coffee', 'espresso', 'latte', 'cappuccino', 'mocha', 'macchiato', 'americano', 'brew', 'caffeine', 'frappe', 'roast', 'flat white'],
  },
  {
    id: 'CupSoda',
    label: 'Drinks & Juices',
    icon: CupSoda,
    keywords: ['drink', 'soda', 'beverage', 'juice', 'smoothie', 'cola', 'iced', 'lemonade', 'mojito', 'shake', 'cold', 'tea', 'refresh', 'water'],
  },
  {
    id: 'Cake',
    label: 'Cakes & Bakery',
    icon: Cake,
    keywords: ['cake', 'bakery', 'pastry', 'sweet', 'tart', 'muffin', 'cupcake', 'dessert', 'pie', 'gateau', 'cheesecake'],
  },
  {
    id: 'IceCream',
    label: 'Ice Cream',
    icon: IceCream,
    keywords: ['ice', 'cream', 'gelato', 'sundae', 'frozen', 'sorbet', 'popsicle', 'cone'],
  },
  {
    id: 'Sandwich',
    label: 'Sandwiches & Burgers',
    icon: Sandwich,
    keywords: ['sandwich', 'burger', 'sub', 'wrap', 'toast', 'toastie', 'panini', 'snack', 'club', 'roll'],
  },
  {
    id: 'Pizza',
    label: 'Pizza',
    icon: Pizza,
    keywords: ['pizza', 'slice', 'crust', 'calzone'],
  },
  {
    id: 'Croissant',
    label: 'Breakfast & Breads',
    icon: Croissant,
    keywords: ['croissant', 'breakfast', 'bread', 'bagel', 'waffle', 'pancake', 'morning', 'brunch'],
  },
  {
    id: 'Cookie',
    label: 'Cookies & Snacks',
    icon: Cookie,
    keywords: ['cookie', 'biscuit', 'snack', 'bites', 'crunch', 'chips'],
  },
  {
    id: 'Soup',
    label: 'Soups & Bowls',
    icon: Soup,
    keywords: ['soup', 'bowl', 'ramen', 'noodle', 'curry', 'pasta', 'pot', 'broth', 'stew'],
  },
  {
    id: 'UtensilsCrossed',
    label: 'Meals & Food',
    icon: UtensilsCrossed,
    keywords: ['meal', 'food', 'dish', 'lunch', 'dinner', 'main', 'plate', 'entree', 'rice', 'meat', 'chicken'],
  },
  {
    id: 'Apple',
    label: 'Healthy & Salads',
    icon: Apple,
    keywords: ['fruit', 'apple', 'salad', 'healthy', 'vegan', 'fresh', 'diet', 'green', 'organic'],
  },
  {
    id: 'Wine',
    label: 'Cocktails & Bar',
    icon: Wine,
    keywords: ['wine', 'cocktail', 'mocktail', 'bar', 'alcohol', 'liquor', 'champagne'],
  },
  {
    id: 'Beer',
    label: 'Chilled Beers',
    icon: Beer,
    keywords: ['beer', 'ale', 'lager', 'draft', 'pint', 'cider'],
  },
  {
    id: 'Sparkles',
    label: 'Specials & Combos',
    icon: Sparkles,
    keywords: ['special', 'combo', 'feature', 'new', 'popular', 'best', 'signature', 'deal', 'promo'],
  },
];

export const getSuggestedIconId = (name?: string): string | null => {
  if (!name || !name.trim()) return null;
  const lower = name.toLowerCase();
  for (const preset of CATEGORY_ICON_PRESETS) {
    if (preset.keywords.some((kw) => lower.includes(kw))) {
      return preset.id;
    }
  }
  return null;
};

export const renderCategoryIcon = (iconName?: string, className = "w-5 h-5") => {
  const preset = CATEGORY_ICON_PRESETS.find((p) => p.id === iconName);
  if (preset) {
    const IconComp = preset.icon;
    return <IconComp className={className} />;
  }
  return <Coffee className={className} />;
};

type CatalogTab = 'products' | 'categories' | 'modifiers';

export const AdminProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = (searchParams.get('tab') as CatalogTab) || 'products';
  const [activeTab, setActiveTab] = useState<CatalogTab>(
    ['products', 'categories', 'modifiers'].includes(activeTabParam) ? activeTabParam : 'products'
  );

  const [products, setProducts] = useState(catalogService.getProducts());
  const [categories, setCategories] = useState(catalogService.getCategories());
  const [modifierGroups, setModifierGroups] = useState(catalogService.getModifierGroups());
  const [ingredients, setIngredients] = useState<Ingredient[]>(inventoryService.getIngredients());

  // Real-time Database & WebSocket Synchronizer
  useEffect(() => {
    const refreshCatalog = () => {
      setProducts(catalogService.getProducts());
      setCategories(catalogService.getCategories());
      setModifierGroups(catalogService.getModifierGroups());
      setIngredients(inventoryService.getIngredients());
    };

    const unsubDb = db.subscribe(refreshCatalog);
    const unsubCatalog = realtimeSocketService.on('CATALOG_CHANGED', refreshCatalog);
    const unsubStock = realtimeSocketService.on('STOCK_CHANGED', refreshCatalog);

    return () => {
      unsubDb();
      unsubCatalog();
      unsubStock();
    };
  }, []);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Modals
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [productRecipeItems, setProductRecipeItems] = useState<RecipeItem[]>([]);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const categoryIconInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Live Recipe Calculations for Product Studio
  const calculatedPortionCostCents = useMemo(() => {
    return productRecipeItems.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const unitCost = ing?.averageCostCents || 0;
      return sum + Math.round(unitCost * item.quantity);
    }, 0);
  }, [productRecipeItems, ingredients]);

  const profitMarginPercent = useMemo(() => {
    const basePrice = editingProduct?.basePriceCents || 0;
    if (basePrice <= 0) return '0.0';
    const profit = basePrice - calculatedPortionCostCents;
    return ((profit / basePrice) * 100).toFixed(1);
  }, [editingProduct?.basePriceCents, calculatedPortionCostCents]);

  // Interactive Product View Modal State
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [selectedViewModifiers, setSelectedViewModifiers] = useState<Record<string, string[]>>({});

  // Collapsible Accordion (Minimize/Maximize) State for Modifier Groups & Options
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedOptions, setCollapsedOptions] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleOptionCollapse = (optionKey: string) => {
    setCollapsedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(optionKey)) {
        next.delete(optionKey);
      } else {
        next.add(optionKey);
      }
      return next;
    });
  };

  const handleOpenViewProduct = (p: Product) => {
    const initialSelected: Record<string, string[]> = {};
    if (p.customModifiers) {
      p.customModifiers.forEach((g) => {
        const defaultOpts = g.options.filter((o) => o.isDefault).map((o) => o.id);
        if (defaultOpts.length > 0) {
          initialSelected[g.id] = defaultOpts;
        } else if (g.required && g.options.length > 0) {
          initialSelected[g.id] = [g.options[0].id];
        } else {
          initialSelected[g.id] = [];
        }
      });
    }
    setSelectedViewModifiers(initialSelected);
    setViewingProduct(p);
  };

  const handleToggleViewModifierOption = (group: ModifierGroup, optId: string) => {
    setSelectedViewModifiers((prev) => {
      const current = prev[group.id] || [];
      if (group.multiSelect) {
        const next = current.includes(optId)
          ? current.filter((id) => id !== optId)
          : [...current, optId];
        return { ...prev, [group.id]: next };
      } else {
        return { ...prev, [group.id]: [optId] };
      }
    });
  };

  // Calculations for Product View Modal
  const viewProductRecipe = useMemo(() => {
    if (!viewingProduct) return null;
    return inventoryService.getRecipes().find((r) => r.productId === viewingProduct.id) || null;
  }, [viewingProduct]);

  const viewProductBaseCostCents = useMemo(() => {
    if (!viewProductRecipe) return 0;
    return viewProductRecipe.items.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const unitCost = ing?.averageCostCents || 0;
      return sum + Math.round(unitCost * item.quantity);
    }, 0);
  }, [viewProductRecipe, ingredients]);

  const viewSelectedModifiersPriceCents = useMemo(() => {
    if (!viewingProduct || !viewingProduct.customModifiers) return 0;
    let sum = 0;
    viewingProduct.customModifiers.forEach((g) => {
      const selectedIds = selectedViewModifiers[g.id] || [];
      g.options.forEach((o) => {
        if (selectedIds.includes(o.id)) {
          sum += o.priceCents || 0;
        }
      });
    });
    return sum;
  }, [viewingProduct, selectedViewModifiers]);

  const totalCalculatedViewPriceCents = (viewingProduct?.basePriceCents || 0) + viewSelectedModifiersPriceCents;

  const viewSelectedModifierIngredients = useMemo(() => {
    if (!viewingProduct || !viewingProduct.customModifiers) return [];
    const ingList: RecipeItem[] = [];
    viewingProduct.customModifiers.forEach((g) => {
      const selectedIds = selectedViewModifiers[g.id] || [];
      g.options.forEach((o) => {
        if (selectedIds.includes(o.id)) {
          if (o.ingredients && o.ingredients.length > 0) {
            ingList.push(...o.ingredients);
          } else if (o.ingredientId) {
            const ing = ingredients.find((i) => i.id === o.ingredientId);
            ingList.push({
              ingredientId: o.ingredientId,
              ingredientName: ing?.name || '',
              quantity: o.ingredientQuantity || 1,
              unit: o.ingredientUnit || ing?.unit || '',
            });
          }
        }
      });
    });
    return ingList;
  }, [viewingProduct, selectedViewModifiers, ingredients]);

  const viewModifierCostCents = useMemo(() => {
    return viewSelectedModifierIngredients.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const unitCost = ing?.averageCostCents || 0;
      return sum + Math.round(unitCost * item.quantity);
    }, 0);
  }, [viewSelectedModifierIngredients, ingredients]);

  const totalCalculatedViewCostCents = viewProductBaseCostCents + viewModifierCostCents;

  const viewProfitMarginPercent = useMemo(() => {
    if (totalCalculatedViewPriceCents <= 0) return '0.0';
    const profit = totalCalculatedViewPriceCents - totalCalculatedViewCostCents;
    return ((profit / totalCalculatedViewPriceCents) * 100).toFixed(1);
  }, [totalCalculatedViewPriceCents, totalCalculatedViewCostCents]);

  const handleAddRecipeItem = () => {
    const defaultIng = ingredients[0];
    if (!defaultIng) {
      toast.error('No ingredients found in inventory. Add ingredients in the Ingredients studio.');
      return;
    }
    setProductRecipeItems([
      ...productRecipeItems,
      {
        ingredientId: defaultIng.id,
        ingredientName: defaultIng.name,
        quantity: 1,
        unit: defaultIng.unit,
      },
    ]);
  };

  const handleUpdateRecipeItem = (index: number, field: keyof RecipeItem, value: any) => {
    const updated = [...productRecipeItems];
    if (field === 'ingredientId') {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) {
        updated[index] = {
          ...updated[index],
          ingredientId: ing.id,
          ingredientName: ing.name,
          unit: ing.unit,
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    setProductRecipeItems(updated);
  };

  const handleRemoveRecipeItem = (index: number) => {
    setProductRecipeItems(productRecipeItems.filter((_, i) => i !== index));
  };

  const handleOpenAddModal = () => {
    if (activeTab === 'products') {
      setProductRecipeItems([]);
      setEditingProduct({
        name: '',
        categoryId: categories[0]?.id || 'cat_coffee',
        description: '',
        basePriceCents: 85000,
        costPriceCents: 25000,
        image: '',
        preparationStationId: 'st_bar',
        modifierGroupIds: [],
        customModifiers: [],
        active: true,
        isSoldOut: false,
      });
    } else if (activeTab === 'categories') {
      setEditingCategory({
        name: '',
        slug: '',
        icon: 'Coffee',
        image: '',
        displayOrder: categories.length + 1,
        preparationStationId: 'st_bar',
        active: true,
      });
    } else if (activeTab === 'modifiers') {
      setEditingGroup({
        id: `mod_${Date.now()}`,
        name: 'New Modifier Preset',
        required: false,
        multiSelect: false,
        minSelections: 0,
        maxSelections: 1,
        options: [
          { id: `opt_${Date.now()}_1`, name: 'Option 1', priceCents: 0, isDefault: true },
          { id: `opt_${Date.now()}_2`, name: 'Option 2 (Extra)', priceCents: 15000 },
        ],
      });
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    setIsUploadingImage(true);
    const toastId = toast.loading('Uploading product image to Supabase Storage...');

    try {
      const oldImg = editingProduct?.image;
      const result = await supabaseStorageService.uploadProductImage(file);
      if (editingProduct) {
        setEditingProduct({
          ...editingProduct,
          image: result.url,
        });
      }

      if (oldImg && oldImg !== result.url) {
        supabaseStorageService.deleteProductImage(oldImg).catch((err) => {
          console.warn('Error deleting previous product image:', err);
        });
      }

      if (result.isSupabaseStorage) {
        toast.success('Image saved to Supabase Storage!', { id: toastId });
      } else {
        toast.warning(
          `Stored image locally (${result.error || 'Bucket "products" not configured in Supabase'}).`,
          { id: toastId, duration: 5000 }
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload image.', { id: toastId });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleCategoryIconUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('Icon size must be less than 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl && editingCategory) {
        setEditingCategory({
          ...editingCategory,
          image: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Tab change handler
  const handleTabChange = (tab: CatalogTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setSearch('');
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setProducts(catalogService.getProducts());
      setCategories(catalogService.getCategories());
      setModifierGroups(catalogService.getModifierGroups());
      setIngredients(inventoryService.getIngredients());
    });
    return unsub;
  }, []);

  // Filtered Lists
  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredCategories = categories.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredModifiers = modifierGroups.filter((g) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.options.some((o) => o.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const categoryOptions = [
    { value: 'ALL', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleToggleSoldOut = (id: string) => {
    const newState = catalogService.toggleSoldOut(id);
    setProducts(catalogService.getProducts());
    toast.info(`Product marked as ${newState ? 'Sold Out' : 'Available'}`);
  };

  // --- Product Save ---
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct.categoryId) {
      toast.error('Please enter product name and category.');
      return;
    }

    const isUpdating = Boolean(editingProduct.id);
    if (isUpdating) {
      const confirmed = await confirmDialog({
        title: 'Update Product',
        message: `Save and update changes for "${editingProduct.name}"?`,
        confirmText: 'Update Product',
        variant: 'primary',
      });
      if (!confirmed) return;
    }

    const defaultStation =
      categories.find((c) => c.id === editingProduct.categoryId)?.preparationStationId || 'st_bar';

    const savedProduct = catalogService.saveProduct({
      ...editingProduct,
      name: editingProduct.name,
      categoryId: editingProduct.categoryId,
      preparationStationId: editingProduct.preparationStationId || defaultStation,
      basePriceCents: editingProduct.basePriceCents || 85000,
      costPriceCents: calculatedPortionCostCents > 0 ? calculatedPortionCostCents : (editingProduct.costPriceCents || 0),
      customModifiers: editingProduct.customModifiers || [],
    });

    // Synchronize Recipe Link
    const existingRecipes = inventoryService.getRecipes();
    const existingRecipe = existingRecipes.find((r) => r.productId === savedProduct.id);

    if (productRecipeItems.length > 0) {
      inventoryService.saveRecipe({
        id: existingRecipe?.id || `rcp_${Date.now()}`,
        productId: savedProduct.id,
        productName: savedProduct.name,
        items: productRecipeItems,
      });
    } else if (existingRecipe) {
      inventoryService.deleteRecipe(existingRecipe.id);
    }

    toast.success('Product, recipe & modifiers saved successfully.');
    setEditingProduct(null);
    setProductRecipeItems([]);
    setProducts(catalogService.getProducts());
  };

  // --- Interactive Product Handlers ---
  const handleRequestEditProduct = (p: Product) => {
    const existingRecipe = inventoryService.getRecipes().find((r) => r.productId === p.id);
    setProductRecipeItems(existingRecipe ? [...existingRecipe.items] : []);
    setEditingProduct(p);
  };

  const handleDeleteProduct = async (productId: string) => {
    const p = products.find((prod) => prod.id === productId);
    if (!p) return;
    const confirmed = await confirmDialog({
      title: 'Delete Product',
      message: `Permanently delete "${p.name}"?`,
      confirmText: 'Delete Product',
      variant: 'danger',
    });
    if (confirmed) {
      if (p.image) {
        supabaseStorageService.deleteProductImage(p.image).catch((err) => {
          console.warn('Error deleting product image from storage:', err);
        });
      }
      catalogService.deleteProduct(productId);
      const existingRecipe = inventoryService.getRecipes().find((r) => r.productId === productId);
      if (existingRecipe) {
        inventoryService.deleteRecipe(existingRecipe.id);
      }
      setProducts(catalogService.getProducts());
      toast.success(`"${p.name}" was deleted successfully.`);
    }
  };

  // --- Category Save & Handlers ---
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name) return;

    if (editingCategory.id) {
      const confirmed = await confirmDialog({
        title: 'Update Category',
        message: `Save changes for "${editingCategory.name}"?`,
        confirmText: 'Update Category',
        variant: 'primary',
      });
      if (!confirmed) return;
    }

    catalogService.saveCategory({
      ...editingCategory,
      name: editingCategory.name,
      slug: editingCategory.slug || editingCategory.name.toLowerCase().replace(/\s+/g, '-'),
      icon: editingCategory.icon || 'Coffee',
      image: editingCategory.image || '',
      displayOrder: editingCategory.displayOrder || categories.length + 1,
      preparationStationId: editingCategory.preparationStationId || 'st_bar',
    });

    toast.success('Category saved successfully.');
    setEditingCategory(null);
    setCategories(catalogService.getCategories());
  };

  const handleRequestEditCategory = (cat: Category) => {
    setEditingCategory(cat);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const confirmed = await confirmDialog({
      title: 'Delete Category',
      message: `Permanently delete "${cat.name}"?`,
      confirmText: 'Delete Category',
      variant: 'danger',
    });
    if (confirmed) {
      catalogService.deleteCategory(categoryId);
      setCategories(catalogService.getCategories());
      toast.success(`"${cat.name}" was deleted.`);
    }
  };

  // --- Modifier Group Save & Handlers ---
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup?.name) return;

    if (editingGroup.id) {
      const confirmed = await confirmDialog({
        title: 'Update Modifier Preset',
        message: `Save changes for "${editingGroup.name}"?`,
        confirmText: 'Update Preset',
        variant: 'primary',
      });
      if (!confirmed) return;
    }

    catalogService.saveModifierGroup(editingGroup);
    toast.success('Modifier preset saved.');
    setEditingGroup(null);
    setModifierGroups(catalogService.getModifierGroups());
  };

  const handleRequestEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = modifierGroups.find((g) => g.id === groupId);
    if (!group) return;
    const confirmed = await confirmDialog({
      title: 'Delete Modifier Preset',
      message: `Permanently delete "${group.name}"?`,
      confirmText: 'Delete Preset',
      variant: 'danger',
    });
    if (confirmed) {
      catalogService.deleteModifierGroup(groupId);
      setModifierGroups(catalogService.getModifierGroups());
      toast.success(`"${group.name}" preset was deleted.`);
    }
  };

  // --- Manual Modifier Handlers for Product Edit ---
  const handleAddProductModifierGroup = () => {
    const newGroup: ModifierGroup = {
      id: `pmod_${Date.now()}`,
      name: 'Custom Options',
      required: false,
      multiSelect: false,
      minSelections: 0,
      maxSelections: 1,
      options: [
        { id: `popt_${Date.now()}_1`, name: 'Option 1', priceCents: 0, isDefault: true },
        { id: `popt_${Date.now()}_2`, name: 'Option 2', priceCents: 15000, isDefault: false },
      ],
    };
    setEditingProduct((prev) => (prev ? {
      ...prev,
      customModifiers: [...(prev.customModifiers || []), newGroup],
    } : prev));
  };

  const handleImportTemplateModifier = (templateGroupId: string) => {
    const template = modifierGroups.find((g) => g.id === templateGroupId);
    if (!template) return;

    const isSizeGroup =
      template.name.toLowerCase().includes('size') ||
      template.name.toLowerCase().includes('portion') ||
      template.name.toLowerCase().includes('cup');

    // Clone template so pricing is localized to this product
    const clonedGroup: ModifierGroup = {
      ...template,
      id: `pmod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: template.name,
      options: template.options.map((opt) => {
        // If it's a size modifier and product has a base recipe, auto-prefill options with base recipe!
        const initialIngredients =
          opt.ingredients && opt.ingredients.length > 0
            ? opt.ingredients
            : isSizeGroup && productRecipeItems.length > 0
            ? productRecipeItems.map((item) => ({ ...item }))
            : opt.ingredientId
            ? [
                {
                  ingredientId: opt.ingredientId,
                  ingredientName:
                    ingredients.find((i) => i.id === opt.ingredientId)?.name || '',
                  quantity: opt.ingredientQuantity || 1,
                  unit: opt.ingredientUnit || '',
                },
              ]
            : undefined;

        return {
          ...opt,
          id: `popt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ingredientId: undefined,
          ingredientQuantity: undefined,
          ingredientUnit: undefined,
          ingredients: initialIngredients,
        };
      }),
    };

    setEditingProduct((prev) => (prev ? {
      ...prev,
      customModifiers: [...(prev.customModifiers || []), clonedGroup],
    } : prev));
    toast.success(
      isSizeGroup && productRecipeItems.length > 0
        ? `Imported "${template.name}" with regular recipe ingredients pre-filled.`
        : `Imported "${template.name}".`
    );
  };

  const handleCopyBaseRecipeToOption = (groupId: string, optionId: string) => {
    if (productRecipeItems.length === 0) {
      toast.info('Please add ingredients to the Regular Base Recipe above first.');
      return;
    }
    setEditingProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customModifiers: (prev.customModifiers || []).map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            options: g.options.map((o) => {
              if (o.id !== optionId) return o;
              return {
                ...o,
                ingredientId: undefined,
                ingredientQuantity: undefined,
                ingredientUnit: undefined,
                ingredients: productRecipeItems.map((item) => ({ ...item })),
              };
            }),
          };
        }),
      };
    });
    toast.success('Copied regular recipe ingredients to this modifier option.');
  };

  const handleRemoveProductModifierGroup = (groupId: string) => {
    setEditingProduct((prev) => (prev ? {
      ...prev,
      customModifiers: (prev.customModifiers || []).filter((g) => g.id !== groupId),
    } : prev));
  };

  const handleAddOptionToProductGroup = (groupId: string) => {
    setEditingProduct((prev) => (prev ? {
      ...prev,
      customModifiers: (prev.customModifiers || []).map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: [
            ...g.options,
            {
              id: `popt_${Date.now()}`,
              name: 'New Option',
              priceCents: 0,
              isDefault: false,
            },
          ],
        };
      }),
    } : prev));
  };

  const handleRemoveOptionFromProductGroup = (groupId: string, optionId: string) => {
    setEditingProduct((prev) => (prev ? {
      ...prev,
      customModifiers: (prev.customModifiers || []).map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          options: g.options.filter((o) => o.id !== optionId),
        };
      }),
    } : prev));
  };

  const handleUpdateProductOption = (
    groupId: string,
    optionId: string,
    fieldOrUpdates: keyof ModifierOption | Partial<ModifierOption>,
    value?: any
  ) => {
    setEditingProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customModifiers: (prev.customModifiers || []).map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            options: g.options.map((o) => {
              if (o.id !== optionId) return o;
              if (typeof fieldOrUpdates === 'string') {
                return { ...o, [fieldOrUpdates]: value };
              }
              return { ...o, ...fieldOrUpdates };
            }),
          };
        }),
      };
    });
  };

  // Row-by-row ingredient handlers for Product Custom Modifiers
  const handleAddIngredientToProductOption = (groupId: string, optionId: string) => {
    const defaultIng = ingredients[0];
    if (!defaultIng) {
      toast.error('No ingredients found in inventory.');
      return;
    }
    setEditingProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customModifiers: (prev.customModifiers || []).map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            options: g.options.map((o) => {
              if (o.id !== optionId) return o;
              const existingList: RecipeItem[] =
                o.ingredients && o.ingredients.length > 0
                  ? o.ingredients
                  : o.ingredientId
                  ? [
                      {
                        ingredientId: o.ingredientId,
                        ingredientName:
                          ingredients.find((i) => i.id === o.ingredientId)?.name || '',
                        quantity: o.ingredientQuantity || 1,
                        unit: o.ingredientUnit || defaultIng.unit,
                      },
                    ]
                  : [];

              return {
                ...o,
                ingredientId: undefined,
                ingredientQuantity: undefined,
                ingredientUnit: undefined,
                ingredients: [
                  ...existingList,
                  {
                    ingredientId: defaultIng.id,
                    ingredientName: defaultIng.name,
                    quantity: 1,
                    unit: defaultIng.unit,
                  },
                ],
              };
            }),
          };
        }),
      };
    });
  };

  const handleUpdateProductOptionIngredient = (
    groupId: string,
    optionId: string,
    ingIdx: number,
    field: keyof RecipeItem,
    val: any
  ) => {
    setEditingProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customModifiers: (prev.customModifiers || []).map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            options: g.options.map((o) => {
              if (o.id !== optionId) return o;
              const list: RecipeItem[] =
                o.ingredients && o.ingredients.length > 0
                  ? [...o.ingredients]
                  : o.ingredientId
                  ? [
                      {
                        ingredientId: o.ingredientId,
                        ingredientName:
                          ingredients.find((i) => i.id === o.ingredientId)?.name || '',
                        quantity: o.ingredientQuantity || 1,
                        unit: o.ingredientUnit || '',
                      },
                    ]
                  : [];
              if (!list[ingIdx]) return o;

              if (field === 'ingredientId') {
                const ing = ingredients.find((i) => i.id === val);
                if (ing) {
                  list[ingIdx] = {
                    ...list[ingIdx],
                    ingredientId: ing.id,
                    ingredientName: ing.name,
                    unit: ing.unit,
                  };
                }
              } else {
                list[ingIdx] = {
                  ...list[ingIdx],
                  [field]: val,
                };
              }

              return {
                ...o,
                ingredientId: undefined,
                ingredientQuantity: undefined,
                ingredientUnit: undefined,
                ingredients: list,
              };
            }),
          };
        }),
      };
    });
  };

  const handleRemoveProductOptionIngredient = (
    groupId: string,
    optionId: string,
    ingIdx: number
  ) => {
    setEditingProduct((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customModifiers: (prev.customModifiers || []).map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            options: g.options.map((o) => {
              if (o.id !== optionId) return o;
              const list = (o.ingredients || []).filter((_, i) => i !== ingIdx);
              return {
                ...o,
                ingredients: list.length > 0 ? list : undefined,
              };
            }),
          };
        }),
      };
    });
  };

  // Row-by-row ingredient handlers for Preset Modifiers Studio
  const handleAddIngredientToPresetOption = (optIdx: number) => {
    if (!editingGroup) return;
    const defaultIng = ingredients[0];
    if (!defaultIng) {
      toast.error('No ingredients found in inventory.');
      return;
    }
    const updatedOptions = [...editingGroup.options];
    const targetOpt = updatedOptions[optIdx];
    const existingList: RecipeItem[] =
      targetOpt.ingredients && targetOpt.ingredients.length > 0
        ? targetOpt.ingredients
        : targetOpt.ingredientId
        ? [
            {
              ingredientId: targetOpt.ingredientId,
              ingredientName:
                ingredients.find((i) => i.id === targetOpt.ingredientId)?.name || '',
              quantity: targetOpt.ingredientQuantity || 1,
              unit: targetOpt.ingredientUnit || defaultIng.unit,
            },
          ]
        : [];

    updatedOptions[optIdx] = {
      ...targetOpt,
      ingredientId: undefined,
      ingredientQuantity: undefined,
      ingredientUnit: undefined,
      ingredients: [
        ...existingList,
        {
          ingredientId: defaultIng.id,
          ingredientName: defaultIng.name,
          quantity: 1,
          unit: defaultIng.unit,
        },
      ],
    };

    setEditingGroup({
      ...editingGroup,
      options: updatedOptions,
    });
  };

  const handleUpdatePresetOptionIngredient = (
    optIdx: number,
    ingIdx: number,
    field: keyof RecipeItem,
    val: any
  ) => {
    if (!editingGroup) return;
    const updatedOptions = [...editingGroup.options];
    const targetOpt = updatedOptions[optIdx];
    const list: RecipeItem[] =
      targetOpt.ingredients && targetOpt.ingredients.length > 0
        ? [...targetOpt.ingredients]
        : targetOpt.ingredientId
        ? [
            {
              ingredientId: targetOpt.ingredientId,
              ingredientName:
                ingredients.find((i) => i.id === targetOpt.ingredientId)?.name || '',
              quantity: targetOpt.ingredientQuantity || 1,
              unit: targetOpt.ingredientUnit || '',
            },
          ]
        : [];

    if (!list[ingIdx]) return;

    if (field === 'ingredientId') {
      const ing = ingredients.find((i) => i.id === val);
      if (ing) {
        list[ingIdx] = {
          ...list[ingIdx],
          ingredientId: ing.id,
          ingredientName: ing.name,
          unit: ing.unit,
        };
      }
    } else {
      list[ingIdx] = {
        ...list[ingIdx],
        [field]: val,
      };
    }

    updatedOptions[optIdx] = {
      ...targetOpt,
      ingredientId: undefined,
      ingredientQuantity: undefined,
      ingredientUnit: undefined,
      ingredients: list,
    };

    setEditingGroup({
      ...editingGroup,
      options: updatedOptions,
    });
  };

  const handleRemovePresetOptionIngredient = (optIdx: number, ingIdx: number) => {
    if (!editingGroup) return;
    const updatedOptions = [...editingGroup.options];
    const targetOpt = updatedOptions[optIdx];
    const list = (targetOpt.ingredients || []).filter((_, i) => i !== ingIdx);

    updatedOptions[optIdx] = {
      ...targetOpt,
      ingredients: list.length > 0 ? list : undefined,
    };

    setEditingGroup({
      ...editingGroup,
      options: updatedOptions,
    });
  };

  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* 1. Seamless Segmented Tab Switcher (Unified 3-in-1 Catalog Studio) & Top Right Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-[#EAE3DA] pb-2">
        {/* Left: Tab Switchers */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleTabChange('products')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'products'
                ? 'bg-[#251814] text-white shadow-xs'
                : 'text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Products</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${activeTab === 'products' ? 'bg-white/20 text-white' : 'bg-cream-200 text-brand-brown'}`}>
              {products.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('categories')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'categories'
                ? 'bg-[#251814] text-white shadow-xs'
                : 'text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categories</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${activeTab === 'categories' ? 'bg-white/20 text-white' : 'bg-cream-200 text-brand-brown'}`}>
              {categories.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('modifiers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'modifiers'
                ? 'bg-[#251814] text-white shadow-xs'
                : 'text-text-secondary hover:bg-cream-100 hover:text-brand-brown-dark'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Modifier Presets</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${activeTab === 'modifiers' ? 'bg-white/20 text-white' : 'bg-cream-200 text-brand-brown'}`}>
              {modifierGroups.length}
            </span>
          </button>
        </div>

        {/* Top Right: Live Catalog Stats */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs select-none">
          {activeTab === 'products' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total:</span>
                <span className="font-black text-xs text-brand-brown-dark tabular-nums">{filteredProducts.length}</span>
                <span className="text-[10px] text-text-muted font-medium">
                  ({filteredProducts.filter((p) => !p.isSoldOut).length} in stock • {filteredProducts.filter((p) => p.isSoldOut).length} sold out)
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 border-l border-[#EAE3DA] pl-3">
                <span className="w-2 h-2 rounded-full bg-[#E99343] shrink-0" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Categories:</span>
                <span className="font-black text-xs text-brand-brown-dark tabular-nums">{categories.length}</span>
              </div>
            </>
          )}

          {activeTab === 'categories' && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total Categories:</span>
              <span className="font-black text-xs text-brand-brown-dark tabular-nums">{filteredCategories.length}</span>
            </div>
          )}

          {activeTab === 'modifiers' && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total Presets:</span>
              <span className="font-black text-xs text-brand-brown-dark tabular-nums">{filteredModifiers.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Category Filter Pills (Products Tab) */}
      {activeTab === 'products' && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar shrink-0">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              categoryFilter === 'ALL'
                ? 'bg-[#251814] text-white shadow-xs'
                : 'bg-cream-100/80 text-brand-brown hover:bg-cream-200'
            }`}
          >
            All Items
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                categoryFilter === c.id
                  ? 'bg-[#251814] text-white shadow-xs'
                  : 'bg-cream-100/80 text-brand-brown hover:bg-cream-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-20">
        {/* TAB 1: PRODUCTS GRID */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const categoryName = categories.find((c) => c.id === p.categoryId)?.name || 'Unknown';
              const customModifiersCount = p.customModifiers?.length || 0;

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-3xl border overflow-hidden shadow-soft flex flex-col justify-between transition-all group ${
                    p.isSoldOut ? 'border-status-warning/40 opacity-85' : 'border-border hover:shadow-card hover:border-[#D6C7B7]'
                  }`}
                >
                  <div
                    onClick={() => handleOpenViewProduct(p)}
                    className="cursor-pointer"
                  >
                    {/* Image */}
                    <div className="relative h-36 bg-cream-100 overflow-hidden flex items-center justify-center">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                          <Package className="w-8 h-8 opacity-30 text-brand-brown" />
                        </div>
                      )}

                      {/* Category Badge */}
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-brand-brown-deep/80 text-white text-[10px] font-extrabold uppercase backdrop-blur-sm shadow-xs">
                        {categoryName}
                      </span>

                      {/* Interactive Minimal Stock Status Toggle Badge */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSoldOut(p.id);
                        }}
                        className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase backdrop-blur-md shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                          p.isSoldOut
                            ? 'bg-status-warning text-white hover:bg-amber-600'
                            : 'bg-white/95 text-status-success hover:bg-white border border-status-success/20'
                        }`}
                        title="Click to toggle Stock Status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.isSoldOut ? 'bg-white animate-pulse' : 'bg-status-success'
                          }`}
                        />
                        <span>{p.isSoldOut ? 'Sold Out' : 'In Stock'}</span>
                      </button>

                      {customModifiersCount > 0 && (
                        <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#251814]/85 text-[#F5EBE1] text-[9px] font-extrabold backdrop-blur-xs">
                          {customModifiersCount} Modifiers
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-4 space-y-1">
                      <h3 className="font-extrabold text-sm text-brand-brown-dark group-hover:text-brand-teal transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-xs text-text-secondary line-clamp-2">{p.description}</p>
                    </div>
                  </div>

                  {/* Card Footer: Clean, Minimal, Responsive */}
                  <div className="p-3.5 px-4 bg-cream-50/80 border-t border-border flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-text-secondary">Selling Price</div>
                      <div className="font-black text-sm text-brand-brown-deep tabular-nums">
                        {formatLKR(p.basePriceCents)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestEditProduct(p);
                        }}
                        className="p-2 bg-white border border-[#E0D7CC] hover:bg-cream-100 rounded-xl text-brand-brown hover:text-brand-teal transition-colors shadow-xs cursor-pointer"
                        title="Edit Product"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(p.id);
                        }}
                        className="p-2 bg-white border border-[#E0D7CC] hover:bg-rose-50 rounded-xl text-text-muted hover:text-status-danger transition-colors shadow-xs cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: CATEGORIES GRID */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white p-5 rounded-3xl border border-border shadow-soft flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cream-100 text-brand-brown flex items-center justify-center font-bold overflow-hidden shrink-0">
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      renderCategoryIcon(cat.icon, 'w-5 h-5')
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-brand-brown-dark">{cat.name}</h3>
                    <div className="text-[11px] text-text-secondary">
                      Order #{cat.displayOrder} • {cat.slug}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRequestEditCategory(cat)}
                    className="p-2 text-text-secondary hover:text-brand-teal hover:bg-cream-100 rounded-xl transition-colors"
                    title="Edit Category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-2 text-text-secondary hover:text-status-danger hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: MODIFIER PRESETS */}
        {activeTab === 'modifiers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredModifiers.map((group) => (
              <div
                key={group.id}
                className="bg-white p-6 rounded-3xl border border-border shadow-soft space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-base text-brand-brown-dark">{group.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-100 text-brand-brown uppercase">
                          {group.required ? 'Required' : 'Optional'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-100 text-brand-brown uppercase">
                          {group.multiSelect ? `Multi (Max ${group.maxSelections})` : 'Single Choice'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRequestEditGroup(group)}
                        className="p-2 text-text-secondary hover:text-brand-teal hover:bg-cream-100 rounded-xl transition-colors"
                        title="Edit Preset"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 text-text-secondary hover:text-status-danger hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete Preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Options Pills */}
                  <div className="space-y-1.5 pt-1">
                    {group.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between p-2.5 bg-cream-50 rounded-xl border border-border text-xs"
                      >
                        <span className="font-bold text-text-primary">
                          {opt.name}{' '}
                          {opt.isDefault && (
                            <span className="text-[10px] text-brand-teal font-normal">(Default)</span>
                          )}
                        </span>
                        <span className="font-black text-brand-brown-dark tabular-nums">
                          {opt.priceCents > 0 ? `+${formatLKR(opt.priceCents)}` : 'Rs. 0.00'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Floating Bottom Pop-Up Search & Action Pill */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === 'products'
                  ? 'Search products...'
                  : activeTab === 'categories'
                  ? 'Search categories...'
                  : 'Search modifier presets...'
              }
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
            title={
              activeTab === 'products'
                ? 'Add New Product'
                : activeTab === 'categories'
                ? 'Add New Category'
                : 'Create Modifier Preset'
            }
          >
<Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ADD / EDIT PRODUCT MODAL (PERFECT RESPONSIVE 3-PANEL STUDIO)           */}
      {/* ========================================================================= */}
      {editingProduct &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1600px] h-[94vh] max-h-[94vh] flex flex-col">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between mb-2.5 px-1 shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs">
                    {editingProduct.id ? 'Edit Product' : 'Create New Product'}
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block">
                    Product Studio
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-1.5 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="product-form"
                    className="px-5 py-1.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 cursor-pointer"
                  >
                    Save Product
                  </button>
                </div>
              </div>

              {/* Main 3-Card Side-by-Side Responsive Grid Area */}
              <form
                id="product-form"
                onSubmit={handleSaveProduct}
                className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-hidden min-h-0"
              >
                {/* ================================================================= */}
                {/* 1. LEFT CARD: RECIPE & MODIFIERS STUDIO (Col Span 6 / 50% width)  */}
                {/* ================================================================= */}
                <div className="lg:col-span-6 xl:col-span-6 2xl:col-span-6 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  {/* 1. REGULAR BASE RECIPE & INGREDIENT YIELD */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                          <ChefHat className="w-4 h-4" />
                        </div>
                        <div>
                          <label className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block">
                            Regular Base Recipe & Yield
                          </label>
                          <span className="text-[10px] text-text-muted">
                            Raw ingredients consumed per standard serving
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Live Cost & Margin Mini-Pill */}
                        {productRecipeItems.length > 0 && (
                          <div className="flex items-center gap-1.5 bg-[#FAF7F2] px-2 py-0.5 rounded-xl border border-[#EAE3DA] text-[11px]">
                            <span className="text-text-muted font-bold">Cost:</span>
                            <span className="font-black text-brand-brown-deep tabular-nums">
                              {formatLKR(calculatedPortionCostCents)}
                            </span>
                            <span className="text-text-muted">|</span>
                            <span className="text-status-success font-black">
                              +{profitMarginPercent}% Margin
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleAddRecipeItem}
                          className="px-2.5 py-1 rounded-xl bg-brand-brown hover:bg-brand-brown-dark text-white font-bold text-xs shadow-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Ingredient
                        </button>
                      </div>
                    </div>

                    {productRecipeItems.length === 0 ? (
                      <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-dashed border-[#E2D8CC] text-center space-y-1">
                        <div className="text-xs font-bold text-brand-brown-dark">
                          No Base Recipe Linked
                        </div>
                        <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                          Click <span className="font-bold text-brand-brown">"+ Add Ingredient"</span> above to map raw ingredients consumed for the regular serving (e.g. 0.018 kg Beans, 0.22 L Milk).
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {productRecipeItems.map((item, rIdx) => {
                          const ing = ingredients.find((i) => i.id === item.ingredientId);
                          const itemCostCents = Math.round((ing?.averageCostCents || 0) * item.quantity);

                          return (
                            <div
                              key={rIdx}
                              className="flex items-center gap-2.5 bg-[#FAF7F2] p-2 sm:p-2.5 rounded-2xl border border-[#EAE3DA] shadow-2xs hover:border-[#DFD6CB] transition-all"
                            >
                              {/* Ingredient Selector */}
                              <div className="flex-1 min-w-0">
                                <label className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                                  Ingredient
                                </label>
                                <select
                                  value={item.ingredientId}
                                  onChange={(e) => handleUpdateRecipeItem(rIdx, 'ingredientId', e.target.value)}
                                  className="w-full bg-white border border-[#E0D7CC] rounded-xl px-2.5 py-1 text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal cursor-pointer truncate"
                                >
                                  {ingredients.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.name} ({i.unit}) - {formatLKR(i.averageCostCents || 0)}/{i.unit}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Consumed Quantity */}
                              <div className="w-28 shrink-0">
                                <label className="text-[9px] font-extrabold uppercase text-text-muted block mb-0.5">
                                  Portion Qty
                                </label>
                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-[#E0D7CC]">
                                  <input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateRecipeItem(rIdx, 'quantity', Number(e.target.value))}
                                    placeholder="1"
                                    className="w-12 bg-transparent border-0 text-center text-xs font-black text-brand-brown-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <span className="text-[10px] font-extrabold uppercase text-brand-teal shrink-0">
                                    {item.unit}
                                  </span>
                                </div>
                              </div>

                              {/* Est Cost Badge & Remove Button */}
                              <div className="flex items-center gap-2 pt-3 shrink-0">
                                <div className="text-right">
                                  <span className="text-[8px] font-bold text-text-muted block leading-none">Est. Cost</span>
                                  <span className="text-xs font-black text-brand-brown-deep tabular-nums">
                                    {formatLKR(itemCostCents)}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecipeItem(rIdx)}
                                  className="p-1 text-text-muted hover:text-status-danger rounded-lg hover:bg-white transition-colors cursor-pointer"
                                  title="Remove Ingredient"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. CUSTOM MODIFIERS & SIZE VARIATIONS */}
                  <div className="space-y-2.5 pt-3 border-t border-[#EAE3DA]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                          <SlidersHorizontal className="w-4 h-4" />
                        </div>
                        <div>
                          <label className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block">
                            Custom Modifiers & Size Variations
                          </label>
                          <span className="text-[10px] text-text-muted">
                            Portion sizes, milk choices & add-on stock recipes
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {modifierGroups.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleImportTemplateModifier(e.target.value);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            className="px-2 py-1 bg-[#FAF7F2] border border-[#E0D7CC] rounded-xl text-xs font-bold text-brand-brown hover:bg-cream-100 cursor-pointer"
                          >
                            <option value="" disabled>
                              + Import Preset...
                            </option>
                            {modifierGroups.map((mg) => (
                              <option key={mg.id} value={mg.id}>
                                Import "{mg.name}"
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={handleAddProductModifierGroup}
                          className="px-2.5 py-1 bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Group
                        </button>
                      </div>
                    </div>

                    {/* Modifiers Group List */}
                    {editingProduct.customModifiers && editingProduct.customModifiers.length > 0 ? (
                      <div className="space-y-3">
                        {editingProduct.customModifiers.map((group, gIdx) => {
                          const isGroupCollapsed = collapsedGroups.has(group.id);

                          return (
                            <div
                              key={group.id || gIdx}
                              className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#E9E0D5] space-y-2.5 shadow-2xs"
                            >
                              {/* Group Header */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleGroupCollapse(group.id)}
                                    className="p-1 rounded-lg text-text-muted hover:text-brand-brown hover:bg-cream-100 transition-colors cursor-pointer shrink-0"
                                    title={isGroupCollapsed ? "Maximize Group" : "Minimize Group"}
                                  >
                                    {isGroupCollapsed ? (
                                      <ChevronRight className="w-4 h-4 text-brand-teal" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-brand-brown" />
                                    )}
                                  </button>

                                  <input
                                    type="text"
                                    value={group.name}
                                    onChange={(e) => {
                                      const updated = [...(editingProduct.customModifiers || [])];
                                      updated[gIdx] = { ...updated[gIdx], name: e.target.value };
                                      setEditingProduct({ ...editingProduct, customModifiers: updated });
                                    }}
                                    placeholder="Group Name (e.g. Size, Milk Type, Toppings)"
                                    className="flex-1 pb-1 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none min-w-0"
                                  />

                                  {isGroupCollapsed && (
                                    <span className="text-[10px] font-bold text-text-muted bg-white border border-[#E0D7CC] px-2 py-0.5 rounded-md shrink-0">
                                      {group.options.length} options
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <label className="flex items-center gap-1 text-[11px] font-bold text-text-secondary cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={group.required}
                                      onChange={(e) => {
                                        const updated = [...(editingProduct.customModifiers || [])];
                                        updated[gIdx] = { ...updated[gIdx], required: e.target.checked };
                                        setEditingProduct({ ...editingProduct, customModifiers: updated });
                                      }}
                                      className="rounded text-brand-teal"
                                    />
                                    <span>Required</span>
                                  </label>

                                  <label className="flex items-center gap-1 text-[11px] font-bold text-text-secondary cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={group.multiSelect}
                                      onChange={(e) => {
                                        const updated = [...(editingProduct.customModifiers || [])];
                                        updated[gIdx] = { ...updated[gIdx], multiSelect: e.target.checked };
                                        setEditingProduct({ ...editingProduct, customModifiers: updated });
                                      }}
                                      className="rounded text-brand-teal"
                                    />
                                    <span>Multi</span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProductModifierGroup(group.id)}
                                    className="p-1 text-text-muted hover:text-status-danger rounded-md transition-colors cursor-pointer"
                                    title="Delete Group"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Option Rows (Collapsible when group is expanded) */}
                              {!isGroupCollapsed && (
                                <div className="space-y-2">
                                  {group.options.map((opt, oIdx) => {
                                    const optionKey = opt.id || `${group.id}_${oIdx}`;
                                    const isOptionCollapsed = collapsedOptions.has(optionKey);

                                    const optionIngredients: RecipeItem[] =
                                      opt.ingredients && opt.ingredients.length > 0
                                        ? opt.ingredients
                                        : opt.ingredientId
                                        ? [
                                            {
                                              ingredientId: opt.ingredientId,
                                              ingredientName:
                                                ingredients.find((i) => i.id === opt.ingredientId)?.name || '',
                                              quantity: opt.ingredientQuantity || 1,
                                              unit: opt.ingredientUnit || '',
                                            },
                                          ]
                                        : [];

                                    return (
                                      <div
                                        key={opt.id || oIdx}
                                        className="bg-white p-2.5 rounded-2xl border border-[#EAE3DA] space-y-2 shadow-2xs hover:border-[#DFD6CB] transition-all"
                                      >
                                        {/* Top Row: Option Title, Price, Default Checkbox, Minimize/Maximize, Delete */}
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={opt.name}
                                            onChange={(e) =>
                                              handleUpdateProductOption(group.id, opt.id, 'name', e.target.value)
                                            }
                                            placeholder="Option Name (e.g. Regular 8oz, Extra Shot)"
                                            className="flex-1 pb-1 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] focus:border-brand-teal text-xs font-bold text-brand-brown-dark focus:outline-none rounded-none min-w-0"
                                          />

                                          <div className="flex items-center gap-1 bg-[#FAF7F2] px-2 py-0.5 rounded-xl border border-[#E2D8CC] shrink-0">
                                            <span className="text-[10px] font-bold text-text-muted">Rs.</span>
                                            <input
                                              type="number"
                                              min="0"
                                              step="1"
                                              value={centsToRupees(opt.priceCents || 0)}
                                              onChange={(e) =>
                                                handleUpdateProductOption(
                                                  group.id,
                                                  opt.id,
                                                  'priceCents',
                                                  rupeesToCents(Number(e.target.value))
                                                )
                                              }
                                              placeholder="0"
                                              className="w-12 bg-transparent border-0 text-xs font-black text-right tabular-nums text-brand-brown-deep focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                          </div>

                                          <label className="flex items-center gap-1 px-2 py-0.5 bg-[#FAF7F2] rounded-xl border border-[#E2D8CC] text-[10px] font-bold text-text-secondary cursor-pointer hover:bg-cream-50 shrink-0">
                                            <input
                                              type="checkbox"
                                              checked={opt.isDefault ?? false}
                                              onChange={(e) =>
                                                handleUpdateProductOption(
                                                  group.id,
                                                  opt.id,
                                                  'isDefault',
                                                  e.target.checked
                                                )
                                              }
                                              className="rounded text-brand-teal focus:ring-brand-teal"
                                            />
                                            <span>Default</span>
                                          </label>

                                          {/* Minimize / Maximize Option Stock Deduction Toggle */}
                                          <button
                                            type="button"
                                            onClick={() => toggleOptionCollapse(optionKey)}
                                            className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors flex items-center gap-1 shrink-0 cursor-pointer ${
                                              isOptionCollapsed
                                                ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/30 hover:bg-brand-teal/20'
                                                : 'bg-[#FAF7F2] text-brand-brown border-[#E2D8CC] hover:bg-cream-100'
                                            }`}
                                            title={isOptionCollapsed ? "Expand Stock Deduction Recipe" : "Minimize Stock Deduction"}
                                          >
                                            <Layers className="w-3 h-3" />
                                            <span>{optionIngredients.length}</span>
                                            {isOptionCollapsed ? (
                                              <ChevronDown className="w-3 h-3" />
                                            ) : (
                                              <ChevronUp className="w-3 h-3" />
                                            )}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleRemoveOptionFromProductGroup(group.id, opt.id)}
                                            className="p-1 text-text-muted hover:text-status-danger rounded-lg hover:bg-cream-50 transition-colors shrink-0 cursor-pointer"
                                            title="Remove Option"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        {/* Bottom Section: Row-by-Row Stock Deduction Recipe (Collapsible) */}
                                        {!isOptionCollapsed && (
                                          <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EAE3DA] space-y-1.5 animate-in fade-in duration-150">
                                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                                              <div
                                                onClick={() => toggleOptionCollapse(optionKey)}
                                                className="flex items-center gap-1.5 text-text-secondary cursor-pointer hover:text-brand-teal transition-colors select-none"
                                              >
                                                <Layers className="w-3.5 h-3.5 text-brand-teal" />
                                                <span className="text-[10px] font-extrabold uppercase tracking-wide">
                                                  Stock Deduction ({optionIngredients.length}):
                                                </span>
                                              </div>

                                              <div className="flex items-center gap-1.5">
                                                {productRecipeItems.length > 0 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleCopyBaseRecipeToOption(group.id, opt.id)}
                                                    className="px-2 py-0.5 rounded-lg bg-white hover:bg-cream-100 border border-[#E0D7CC] text-[10px] font-bold text-brand-brown flex items-center gap-1 hover:border-brand-teal transition-all cursor-pointer shadow-2xs"
                                                    title="Copy ingredients from Regular Base Recipe above"
                                                  >
                                                    <Copy className="w-3 h-3 text-brand-teal" />
                                                    <span>Copy Base Recipe</span>
                                                  </button>
                                                )}

                                                <button
                                                  type="button"
                                                  onClick={() => handleAddIngredientToProductOption(group.id, opt.id)}
                                                  className="text-[10px] font-bold text-brand-teal hover:text-brand-teal-dark flex items-center gap-1 hover:underline cursor-pointer"
                                                >
                                                  <Plus className="w-3 h-3" />
                                                  Add Ingredient
                                                </button>
                                              </div>
                                            </div>

                                            {optionIngredients.length === 0 ? (
                                              <div className="text-[10px] text-text-muted italic py-0.5">
                                                No stock deduction linked. Click{' '}
                                                <span className="font-bold text-brand-teal">"+ Add Ingredient"</span> or{' '}
                                                <span className="font-bold text-brand-brown">"Copy Base Recipe"</span>.
                                              </div>
                                            ) : (
                                              <div className="space-y-1">
                                                {optionIngredients.map((ingItem, ingIdx) => (
                                                  <div
                                                    key={ingIdx}
                                                    className="flex items-center gap-1.5 bg-white p-1 px-2 rounded-xl border border-[#E0D7CC]"
                                                  >
                                                    {/* Ingredient select */}
                                                    <select
                                                      value={ingItem.ingredientId}
                                                      onChange={(e) =>
                                                        handleUpdateProductOptionIngredient(
                                                          group.id,
                                                          opt.id,
                                                          ingIdx,
                                                          'ingredientId',
                                                          e.target.value
                                                        )
                                                      }
                                                      className="flex-1 bg-transparent border-0 text-xs font-bold text-brand-brown-dark cursor-pointer focus:outline-none truncate min-w-0"
                                                    >
                                                      {ingredients.map((i) => (
                                                        <option key={i.id} value={i.id}>
                                                          {i.name} ({i.unit})
                                                        </option>
                                                      ))}
                                                    </select>

                                                    {/* Quantity */}
                                                    <div className="flex items-center gap-1 bg-[#FAF7F2] px-1.5 py-0.5 rounded-lg border border-[#E0D7CC] shrink-0">
                                                      <span className="text-[9px] font-bold text-text-muted">Qty:</span>
                                                      <input
                                                        type="number"
                                                        step="0.001"
                                                        min="0.001"
                                                        value={ingItem.quantity}
                                                        onChange={(e) =>
                                                          handleUpdateProductOptionIngredient(
                                                            group.id,
                                                            opt.id,
                                                            ingIdx,
                                                            'quantity',
                                                            Number(e.target.value)
                                                          )
                                                        }
                                                        placeholder="Qty"
                                                        className="w-12 bg-transparent border-0 text-center text-xs font-black text-brand-brown-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                      />
                                                      <span className="text-[9px] font-extrabold uppercase text-brand-teal">
                                                        {ingItem.unit}
                                                      </span>
                                                    </div>

                                                    {/* Delete ingredient row */}
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleRemoveProductOptionIngredient(group.id, opt.id, ingIdx)
                                                      }
                                                      className="p-1 text-text-muted hover:text-status-danger rounded-lg shrink-0 cursor-pointer"
                                                      title="Remove Ingredient"
                                                    >
                                                      <X className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  <button
                                    type="button"
                                    onClick={() => handleAddOptionToProductGroup(group.id)}
                                    className="px-2.5 py-1 bg-white hover:bg-cream-100 border border-[#E0D7CC] rounded-xl text-[11px] font-bold text-brand-brown shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-brand-teal" />
                                    <span>Add Option</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-dashed border-[#E2D8CC] text-center space-y-1">
                        <div className="text-xs font-bold text-brand-brown-dark">
                          No Modifiers or Sizes Configured
                        </div>
                        <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                          Click <span className="font-bold text-brand-teal">"+ Add Group"</span> or import a preset above to configure size options (Small, Medium, Large) or add-ons (Milk, Syrups).
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. MIDDLE CARD: COMPACT PRODUCT DETAILS FORM (Col Span 3 / 25%)   */}
                {/* ================================================================= */}
                <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                        Product Details
                      </span>
                      <span className="text-[10px] text-text-muted leading-none">
                        Menu presentation & pricing
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                      Product Name <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingProduct.name || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      placeholder="e.g. Vanilla Caramel Cold Brew"
                      className="w-full pb-1 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark placeholder:text-text-muted/50 focus:outline-none focus:border-brand-teal transition-colors rounded-none"
                      required
                    />
                  </div>

                  {/* Combined Category & Prep Station on 1 Row */}
                  <div className="grid grid-cols-2 gap-2.5 shrink-0">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Category <span className="text-status-danger">*</span>
                      </label>
                      <select
                        value={editingProduct.categoryId}
                        onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                        className="w-full pb-1 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors rounded-none cursor-pointer truncate"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Prep Station
                      </label>
                      <select
                        value={editingProduct.preparationStationId || 'st_bar'}
                        onChange={(e) =>
                          setEditingProduct({ ...editingProduct, preparationStationId: e.target.value })
                        }
                        className="w-full pb-1 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal transition-colors rounded-none cursor-pointer truncate"
                      >
                        <option value="st_bar">Barista Bar</option>
                        <option value="st_kitchen">Main Kitchen</option>
                        <option value="st_bakery">Bakery & Pastry</option>
                      </select>
                    </div>
                  </div>

                  {/* Price & Stock Status on 1 Row */}
                  <div className="grid grid-cols-2 gap-2.5 items-end shrink-0">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Price (Rs.) <span className="text-status-danger">*</span>
                      </label>
                      <div className="flex items-center gap-1 border-b border-[#E2D8CC] focus-within:border-brand-teal transition-colors pb-1 pt-0.5">
                        <span className="text-xs font-bold text-text-muted">Rs.</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={centsToRupees(editingProduct.basePriceCents || 0)}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              basePriceCents: rupeesToCents(Number(e.target.value)),
                            })
                          }
                          className="w-full bg-transparent border-0 text-xs font-black text-brand-brown-deep tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Stock Status
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingProduct({ ...editingProduct, isSoldOut: !editingProduct.isSoldOut })
                        }
                        className={`w-full h-8 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          editingProduct.isSoldOut
                            ? 'bg-status-warning/20 text-status-warning border-status-warning/40'
                            : 'bg-status-success-bg text-status-success border-status-success/30'
                        }`}
                      >
                        {editingProduct.isSoldOut ? 'Sold Out' : 'Available'}
                      </button>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingProduct.description || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                      placeholder="Short product description..."
                      className="w-full pb-1 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] text-xs text-brand-brown-dark placeholder:text-text-muted/50 focus:outline-none focus:border-brand-teal transition-colors rounded-none"
                    />
                  </div>

                  {/* Responsive Product Image Dropzone (Flex-1 to fill all remaining vertical space) */}
                  <div className="flex-1 flex flex-col min-h-[140px] pt-1">
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1 shrink-0">
                      Product Image
                    </label>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = '';
                      }}
                    />

                    {isUploadingImage ? (
                      /* Uploading State */
                      <div className="relative flex-1 w-full h-full min-h-[130px] rounded-2xl border border-brand-teal/40 bg-teal-50/50 flex flex-col items-center justify-center p-4 text-center shadow-xs">
                        <Loader2 className="w-8 h-8 text-brand-teal animate-spin mb-2" />
                        <span className="text-xs font-black text-brand-teal">Uploading to Supabase Storage...</span>
                        <span className="text-[10px] text-text-muted mt-0.5">Generating permanent cloud image URL</span>
                      </div>
                    ) : editingProduct.image ? (
                      /* When Image Is Attached: Rich Preview Box with Overlay Actions */
                      <div className="relative group flex-1 w-full h-full min-h-[130px] rounded-2xl overflow-hidden border border-[#E2D8CC] bg-cream-100 flex items-center justify-center shadow-xs">
                        <img
                          src={editingProduct.image}
                          alt="Product"
                          className="w-full h-full object-cover"
                          onError={() => {
                            setEditingProduct({ ...editingProduct, image: '' });
                          }}
                        />
                        {/* Storage Indicator Badge */}
                        {editingProduct.image.includes('supabase.co/storage') && (
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600/90 backdrop-blur-xs text-white text-[9px] font-black shadow-xs flex items-center gap-1 z-10">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Supabase Storage</span>
                          </div>
                        )}

                        {/* Overlay Actions on Hover / Touch */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 backdrop-blur-2xs transition-all duration-200 flex items-center justify-center gap-2 p-2">
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="px-3 py-1.5 bg-white hover:bg-cream-50 text-brand-brown-dark rounded-xl text-[11px] font-extrabold shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-brand-teal" />
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const oldImg = editingProduct.image;
                              if (oldImg) {
                                supabaseStorageService.deleteProductImage(oldImg).catch((err) => {
                                  console.warn('Error deleting image from storage:', err);
                                });
                              }
                              setEditingProduct({ ...editingProduct, image: '' });
                            }}
                            className="px-3 py-1.5 bg-status-danger hover:bg-red-700 text-white rounded-xl text-[11px] font-extrabold shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>

                        {/* Attached Badge */}
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold group-hover:opacity-0 transition-opacity">
                          Image Attached
                        </div>
                      </div>
                    ) : (
                      /* When No Image: Spacious Responsive Dropzone with Faded Watermark Logo Filling Card */
                      <div
                        onClick={() => !isUploadingImage && imageInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file && !isUploadingImage) handleImageUpload(file);
                        }}
                        className="relative flex-1 w-full h-full min-h-[130px] p-4 rounded-2xl border-2 border-dashed border-[#D6C7B7] hover:border-brand-teal bg-[#FAF7F2] hover:bg-cream-50 transition-all duration-200 flex flex-col items-center justify-center text-center group cursor-pointer overflow-hidden shadow-2xs"
                      >
                        {/* Faded Watermark Logo in Background */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.14] group-hover:opacity-[0.24] group-hover:scale-105 transition-all duration-300 select-none">
                          <img
                            src="/logobg.webp"
                            alt="CafeMM Watermark"
                            className="w-32 h-32 object-contain filter grayscale max-h-[85%]"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>

                        {/* Foreground Action Button & Description */}
                        <div className="relative z-10 flex flex-col items-center justify-center space-y-1.5">
                          <div className="w-10 h-10 rounded-2xl bg-white shadow-xs border border-[#E0D7CC] group-hover:border-brand-teal flex items-center justify-center text-brand-teal group-hover:scale-110 transition-transform duration-200">
                            <Upload className="w-5 h-5 stroke-[2.2]" />
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-brand-brown-dark group-hover:text-brand-teal transition-colors block leading-tight">
                              Upload to Supabase Storage
                            </span>
                            <span className="text-[10px] text-text-muted block mt-1">
                              Click or drag & drop (PNG, JPG, WEBP)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 3. RIGHT CARD: DEDICATED MAIN LIVE PREVIEW (Col Span 3 / 25%)     */}
                {/* ================================================================= */}
                <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-3.5">
                  <div className="flex items-center justify-between shrink-0">
                    <span className="text-[11px] font-extrabold uppercase text-text-secondary tracking-wider">
                      Live Preview
                    </span>
                    <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-md">
                      POS Card
                    </span>
                  </div>

                  {/* Item Card Representation */}
                  <div className="rounded-2xl border border-[#E9E0D5] bg-[#FAF7F2] overflow-hidden shadow-xs shrink-0">
                    <div className="relative h-36 bg-cream-100 overflow-hidden flex items-center justify-center">
                      {editingProduct.image ? (
                        <img
                          src={editingProduct.image}
                          alt="Live Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-text-muted gap-1 p-3 text-center">
                          <Package className="w-6 h-6 opacity-30 text-brand-brown" />
                          <span className="text-[10px] font-bold">No image uploaded</span>
                        </div>
                      )}

                      {/* Category Badge */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-brand-brown-deep/85 text-white text-[9px] font-extrabold uppercase backdrop-blur-xs shadow-xs">
                        {categories.find((c) => c.id === editingProduct.categoryId)?.name || 'Category'}
                      </span>

                      {/* Sold Out Badge */}
                      {editingProduct.isSoldOut && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-status-warning text-white text-[9px] font-extrabold uppercase shadow-xs">
                          Sold Out
                        </span>
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <div>
                        <h4 className="font-extrabold text-xs text-brand-brown-dark truncate">
                          {editingProduct.name || 'Product Title'}
                        </h4>
                        <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                          {editingProduct.description || 'Product description will appear here...'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#EAE3DA] flex items-center justify-between">
                        <div>
                          <div className="text-[8px] uppercase font-bold text-text-secondary">Price</div>
                          <div className="font-black text-xs text-brand-brown-deep tabular-nums">
                            {formatLKR(editingProduct.basePriceCents || 0)}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${
                            editingProduct.isSoldOut
                              ? 'bg-status-warning/10 text-status-warning border-status-warning/30'
                              : 'bg-status-success-bg text-status-success border-status-success/30'
                          }`}
                        >
                          {editingProduct.isSoldOut ? 'Sold Out' : 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recipe and Food Cost Analysis Pill in preview */}
                  {productRecipeItems.length > 0 && (
                    <div className="p-2.5 bg-[#FAF7F2] rounded-2xl border border-[#E9E0D5] space-y-1.5 shrink-0">
                      <div className="text-[10px] font-bold text-brand-brown-dark flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <ChefHat className="w-3.5 h-3.5 text-brand-brown" />
                          <span>Recipe ({productRecipeItems.length} items)</span>
                        </div>
                        <span className="text-[9px] font-extrabold text-status-success bg-status-success-bg px-1.5 py-0.5 rounded-md">
                          +{profitMarginPercent}% Margin
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#EAE3DA]">
                        <span className="text-text-muted font-bold">Portion Cost:</span>
                        <span className="font-black text-brand-brown-deep tabular-nums">
                          {formatLKR(calculatedPortionCostCents)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Modifiers info pill in preview */}
                  {editingProduct.customModifiers && editingProduct.customModifiers.length > 0 && (
                    <div className="p-2.5 bg-[#FAF7F2] rounded-2xl border border-[#E9E0D5] space-y-1.5 shrink-0">
                      <div className="text-[10px] font-bold text-brand-brown-dark flex items-center gap-1">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-brand-teal" />
                        <span>Modifiers ({editingProduct.customModifiers.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {editingProduct.customModifiers.map((m, idx) => (
                          <span
                            key={m.id || idx}
                            className="px-1.5 py-0.5 bg-white border border-[#E0D7CC] rounded-md text-[9px] font-bold text-brand-brown truncate max-w-[120px]"
                          >
                            {m.name || 'Group'} ({m.options.length})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 6. CATEGORY ADD / EDIT MODAL                                              */}
      {/* ========================================================================= */}
      {editingCategory &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-lg flex flex-col max-h-[92vh]">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                <h3 className="font-extrabold text-base text-white drop-shadow-xs">
                  {editingCategory.id ? 'Edit Category' : 'New Menu Category'}
                </h3>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="px-4 py-2 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="category-form"
                    className="px-5 py-2 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95"
                  >
                    Save Category
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-y-auto">
                <form id="category-form" onSubmit={handleSaveCategory} className="p-6 space-y-5">
                  {/* Category Name */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">
                      Category Name <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingCategory.name || ''}
                      onChange={(e) => {
                        const newName = e.target.value;
                        const suggested = getSuggestedIconId(newName);
                        setEditingCategory((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            name: newName,
                            icon: suggested || prev.icon || 'Coffee',
                          };
                        });
                      }}
                      placeholder="e.g. Specialty Coffees, Bakery, Cold Drinks..."
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-sm font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none transition-colors"
                      required
                    />
                  </div>

                  {/* Icon Selection & Custom Upload Section */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase text-text-secondary">
                        Choose Icon or Upload
                      </label>
                      {editingCategory.name && getSuggestedIconId(editingCategory.name) && (
                        <span className="text-[10px] font-extrabold text-brand-teal bg-brand-teal-light px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse border border-brand-teal/20">
                          <Sparkles className="w-3 h-3" />
                          Suggested: {CATEGORY_ICON_PRESETS.find((p) => p.id === getSuggestedIconId(editingCategory.name))?.label}
                        </span>
                      )}
                    </div>

                    {/* Custom Upload Option */}
                    <div className="p-3 bg-[#FAF7F2] border border-[#E2D8CC] rounded-2xl flex items-center justify-between gap-3">
                      <input
                        ref={categoryIconInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCategoryIconUpload(file);
                          e.target.value = '';
                        }}
                      />

                      {editingCategory.image ? (
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img
                            src={editingCategory.image}
                            alt="Custom Icon"
                            className="w-10 h-10 object-cover rounded-xl border border-[#E2D8CC]"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-brand-brown-dark truncate block">
                              Custom Image Attached
                            </span>
                            <span className="text-[10px] text-text-muted">Used as category icon</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => categoryIconInputRef.current?.click()}
                            className="px-2.5 py-1 bg-white border border-[#E0D7CC] rounded-lg text-xs font-bold text-brand-teal hover:bg-cream-100 transition-colors"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategory({ ...editingCategory, image: '' })}
                            className="p-1.5 text-text-muted hover:text-status-danger rounded-lg transition-colors"
                            title="Remove image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-white border border-[#E0D7CC] flex items-center justify-center text-text-muted">
                              <Upload className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-brand-brown-dark block">Upload Custom Icon / Photo</span>
                              <span className="text-[10px] text-text-muted">PNG, JPG, WebP, SVG</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => categoryIconInputRef.current?.click()}
                            className="px-3 py-1.5 bg-white border border-[#E0D7CC] rounded-xl text-xs font-bold text-brand-brown hover:text-brand-teal hover:bg-cream-100 transition-all shadow-xs"
                          >
                            Upload File
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Preset Icons Grid with Smart Highlighting */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider">
                        Or select from presets:
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {CATEGORY_ICON_PRESETS.map((preset) => {
                          const IconComponent = preset.icon;
                          const isSelected =
                            !editingCategory.image &&
                            (editingCategory.icon === preset.id || (!editingCategory.icon && preset.id === 'Coffee'));
                          const isSuggested = getSuggestedIconId(editingCategory.name) === preset.id;

                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setEditingCategory({ ...editingCategory, icon: preset.id, image: '' })}
                              className={`relative p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group ${
                                isSelected
                                  ? 'bg-brand-teal text-white shadow-md shadow-brand-teal/20 ring-2 ring-brand-teal/30 scale-105'
                                  : isSuggested
                                  ? 'bg-brand-teal-light/60 text-brand-teal border-2 border-dashed border-brand-teal shadow-xs'
                                  : 'bg-cream-50/90 text-brand-brown hover:bg-cream-100 hover:text-brand-brown-dark border border-[#EAE3DA]'
                              }`}
                              title={preset.label}
                            >
                              {isSuggested && !isSelected && (
                                <span className="absolute -top-1.5 -right-1 px-1 py-0.2 rounded-md bg-brand-teal text-white text-[7px] font-black uppercase shadow-xs">
                                  Auto
                                </span>
                              )}
                              <IconComponent className="w-5 h-5 transition-transform group-hover:scale-110" />
                              <span className="text-[9px] font-bold truncate max-w-full text-center leading-tight">
                                {preset.label.split(' ')[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 7. MODIFIER PRESET ADD / EDIT MODAL                                       */}
      {/* ========================================================================= */}
      {editingGroup &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-xl sm:max-w-2xl flex flex-col max-h-[90vh]">
              {/* Separate Header Above Form: Title on left, Cancel & Save on right */}
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-extrabold text-base text-white drop-shadow-xs">
                  {editingGroup.id ? 'Edit Modifier Preset' : 'New Modifier Preset'}
                </h3>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="px-4 py-2 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="group-form"
                    className="px-5 py-2 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95"
                  >
                    Save Preset
                  </button>
                </div>
              </div>

              <div className="w-full bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] overflow-hidden flex flex-col flex-1">
                <form id="group-form" onSubmit={handleSaveGroup} className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-text-secondary block mb-1">Preset Group Name</label>
                    <input
                      type="text"
                      value={editingGroup.name}
                      onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                      placeholder="e.g. Milk Choices or Drink Sizes"
                      className="w-full pb-2 pt-1 bg-transparent border-0 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark focus:outline-none focus:border-brand-teal rounded-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E2D8CC] text-xs font-bold cursor-pointer hover:bg-cream-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={editingGroup.required}
                        onChange={(e) => setEditingGroup({ ...editingGroup, required: e.target.checked })}
                        className="rounded text-brand-teal focus:ring-brand-teal"
                      />
                      <span>Required Selection</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 bg-[#FAF7F2] rounded-xl border border-[#E2D8CC] text-xs font-bold cursor-pointer hover:bg-cream-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={editingGroup.multiSelect}
                        onChange={(e) => setEditingGroup({ ...editingGroup, multiSelect: e.target.checked })}
                        className="rounded text-brand-teal focus:ring-brand-teal"
                      />
                      <span>Multi-Select</span>
                    </label>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase text-text-secondary">Preset Options & Default Prices</label>
                      <button
                        type="button"
                        onClick={() => {
                          const newOpt: ModifierOption = {
                            id: `opt_${Date.now()}`,
                            name: 'New Option',
                            priceCents: 0,
                          };
                          setEditingGroup({
                            ...editingGroup,
                            options: [...editingGroup.options, newOpt],
                          });
                        }}
                        className="text-xs text-brand-teal font-extrabold flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Option
                      </button>
                    </div>

                    {editingGroup.options.map((opt, idx) => {
                      const optionKey = `preset_${opt.id || idx}`;
                      const isOptionCollapsed = collapsedOptions.has(optionKey);

                      const optionIngredients: RecipeItem[] =
                        opt.ingredients && opt.ingredients.length > 0
                          ? opt.ingredients
                          : opt.ingredientId
                          ? [
                              {
                                ingredientId: opt.ingredientId,
                                ingredientName:
                                  ingredients.find((i) => i.id === opt.ingredientId)?.name || '',
                                quantity: opt.ingredientQuantity || 1,
                                unit: opt.ingredientUnit || '',
                              },
                            ]
                          : [];

                      return (
                        <div
                          key={opt.id || idx}
                          className="bg-[#FAF7F2] p-3.5 rounded-2xl border border-[#EAE3DA] space-y-2.5 shadow-2xs hover:border-[#DFD6CB] transition-all"
                        >
                          {/* Top Row: Option Title, Price, Default Checkbox, Minimize/Maximize, Delete */}
                          <div className="flex items-center gap-2.5">
                            <input
                              type="text"
                              value={opt.name}
                              onChange={(e) => {
                                const updated = [...editingGroup.options];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setEditingGroup({ ...editingGroup, options: updated });
                              }}
                              placeholder="Option Name (e.g. Regular 8oz, Extra Shot)"
                              className="flex-1 pb-1 pt-0.5 bg-transparent border-0 border-b border-[#E2D8CC] focus:border-brand-teal text-xs font-bold text-brand-brown-dark focus:outline-none min-w-0"
                            />

                            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-[#E2D8CC] shrink-0">
                              <span className="text-[11px] font-bold text-text-muted">Rs.</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={centsToRupees(opt.priceCents || 0)}
                                onChange={(e) => {
                                  const updated = [...editingGroup.options];
                                  updated[idx] = {
                                    ...updated[idx],
                                    priceCents: rupeesToCents(Number(e.target.value)),
                                  };
                                  setEditingGroup({ ...editingGroup, options: updated });
                                }}
                                placeholder="0"
                                className="w-14 bg-transparent border-0 text-xs font-black text-right tabular-nums text-brand-brown-deep focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>

                            <label className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-xl border border-[#E2D8CC] text-[11px] font-bold text-text-secondary cursor-pointer hover:bg-cream-50 shrink-0">
                              <input
                                type="checkbox"
                                checked={opt.isDefault ?? false}
                                onChange={(e) => {
                                  const updated = [...editingGroup.options];
                                  updated[idx] = { ...updated[idx], isDefault: e.target.checked };
                                  setEditingGroup({ ...editingGroup, options: updated });
                                }}
                                className="rounded text-brand-teal focus:ring-brand-teal"
                              />
                              <span>Default</span>
                            </label>

                            {/* Minimize / Maximize Option Stock Deduction Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleOptionCollapse(optionKey)}
                              className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors flex items-center gap-1 shrink-0 cursor-pointer ${
                                isOptionCollapsed
                                  ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/30 hover:bg-brand-teal/20'
                                  : 'bg-white text-brand-brown border-[#E2D8CC] hover:bg-cream-100'
                              }`}
                              title={isOptionCollapsed ? "Expand Stock Deduction Recipe" : "Minimize Stock Deduction"}
                            >
                              <Layers className="w-3 h-3" />
                              <span>{optionIngredients.length}</span>
                              {isOptionCollapsed ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronUp className="w-3 h-3" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = editingGroup.options.filter((_, i) => i !== idx);
                                setEditingGroup({ ...editingGroup, options: updated });
                              }}
                              className="p-1.5 text-text-muted hover:text-status-danger rounded-xl hover:bg-white transition-colors shrink-0 cursor-pointer"
                              title="Remove Option"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Bottom Section: Row-by-Row Stock Deduction Recipe (Collapsible) */}
                          {!isOptionCollapsed && (
                            <div className="bg-white p-3 rounded-xl border border-[#EAE3DA] space-y-2 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between">
                                <div
                                  onClick={() => toggleOptionCollapse(optionKey)}
                                  className="flex items-center gap-1.5 text-text-secondary cursor-pointer hover:text-brand-teal transition-colors select-none"
                                >
                                  <Layers className="w-3.5 h-3.5 text-brand-teal" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-wide">
                                    Stock Deduction Recipe ({optionIngredients.length}):
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAddIngredientToPresetOption(idx)}
                                  className="text-[11px] font-bold text-brand-teal hover:text-brand-teal-dark flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Ingredient
                                </button>
                              </div>

                              {optionIngredients.length === 0 ? (
                                <div className="text-[11px] text-text-muted italic py-0.5">
                                  No stock deduction linked. Click <span className="font-bold text-brand-teal">"+ Add Ingredient"</span> to map raw ingredients consumed by this option.
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {optionIngredients.map((ingItem, ingIdx) => (
                                    <div
                                      key={ingIdx}
                                      className="flex items-center gap-2 bg-[#FAF7F2] p-1.5 px-2.5 rounded-xl border border-[#E0D7CC]"
                                    >
                                      {/* Ingredient select */}
                                      <select
                                        value={ingItem.ingredientId}
                                        onChange={(e) =>
                                          handleUpdatePresetOptionIngredient(
                                            idx,
                                            ingIdx,
                                            'ingredientId',
                                            e.target.value
                                          )
                                        }
                                        className="flex-1 bg-transparent border-0 text-xs font-bold text-brand-brown-dark cursor-pointer focus:outline-none truncate min-w-0"
                                      >
                                        {ingredients.map((i) => (
                                          <option key={i.id} value={i.id}>
                                            {i.name} ({i.unit})
                                          </option>
                                        ))}
                                      </select>

                                      {/* Quantity */}
                                      <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-[#E0D7CC] shrink-0">
                                        <span className="text-[10px] font-bold text-text-muted">Qty:</span>
                                        <input
                                          type="number"
                                          step="0.001"
                                          min="0.001"
                                          value={ingItem.quantity}
                                          onChange={(e) =>
                                            handleUpdatePresetOptionIngredient(
                                              idx,
                                              ingIdx,
                                              'quantity',
                                              Number(e.target.value)
                                            )
                                          }
                                          placeholder="Qty"
                                          className="w-14 bg-transparent border-0 text-center text-xs font-black text-brand-brown-dark focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="text-[10px] font-extrabold uppercase text-brand-teal">
                                          {ingItem.unit}
                                        </span>
                                      </div>

                                      {/* Delete ingredient row */}
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePresetOptionIngredient(idx, ingIdx)}
                                        className="p-1 text-text-muted hover:text-status-danger rounded-lg shrink-0 cursor-pointer"
                                        title="Remove Ingredient"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 5.1 PRODUCT INTERACTIVE VIEW & LIVE PRICING MODAL (3-CARD STUDIO LAYOUT) */}
      {/* ========================================================================= */}
      {viewingProduct &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1600px] h-[94vh] max-h-[94vh] flex flex-col">
              {/* Top Header Above 3-Card Grid: Title on Left, Close & Edit Product on Right */}
              <div className="flex items-center justify-between mb-2.5 px-1 shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs flex items-center gap-2">
                    <span>{viewingProduct.name}</span>
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block">
                    View Product • Product Studio
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setViewingProduct(null)}
                    className="px-4 py-1.5 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const prod = viewingProduct;
                      setViewingProduct(null);
                      handleRequestEditProduct(prod);
                    }}
                    className="px-5 py-1.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Product</span>
                  </button>
                </div>
              </div>

              {/* Main 3-Card Side-by-Side Responsive Grid Area */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-hidden min-h-0">
                {/* ================================================================= */}
                {/* 1. LEFT CARD: RECIPE & MODIFIERS (Col Span 6 / 50% width)         */}
                {/* ================================================================= */}
                <div className="lg:col-span-6 xl:col-span-6 2xl:col-span-6 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  {/* 1. REGULAR BASE RECIPE & INGREDIENT YIELD */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                          <ChefHat className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                            Regular Base Recipe & Yield
                          </span>
                          <span className="text-[10px] text-text-muted leading-none">
                            Raw ingredients consumed per standard serving
                          </span>
                        </div>
                      </div>

                      {/* Base Recipe Cost & Margin Pill */}
                      <div className="flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA]">
                        <span className="text-text-secondary">Cost:</span>
                        <span className="text-brand-brown-dark tabular-nums font-black">
                          {formatLKR(viewProductBaseCostCents)}
                        </span>
                        <span className="text-[#D6C7B7]">|</span>
                        <span className="text-status-success font-black">
                          +{viewProductRecipe && viewingProduct.basePriceCents > 0
                            ? (((viewingProduct.basePriceCents - viewProductBaseCostCents) / viewingProduct.basePriceCents) * 100).toFixed(1)
                            : '0.0'}% Margin
                        </span>
                      </div>
                    </div>

                    {/* Base Recipe Items List */}
                    {viewProductRecipe && viewProductRecipe.items.length > 0 ? (
                      <div className="space-y-1.5">
                        {viewProductRecipe.items.map((item, idx) => {
                          const ing = ingredients.find((i) => i.id === item.ingredientId);
                          const itemCost = Math.round((ing?.averageCostCents || 0) * item.quantity);

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 p-2.5 px-3 bg-[#FAF7F2] rounded-2xl border border-[#EAE3DA]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0" />
                                <span className="text-xs font-bold text-brand-brown-dark truncate">
                                  {ing?.name || item.ingredientName}
                                </span>
                                <span className="text-[10px] text-text-muted font-medium shrink-0">
                                  (@{formatLKR(ing?.averageCostCents || 0)}/{ing?.unit || item.unit})
                                </span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="px-2.5 py-0.5 bg-white rounded-xl border border-[#E0D7CC] text-xs font-black text-brand-brown-dark">
                                  {item.quantity}{' '}
                                  <span className="text-[10px] uppercase text-brand-teal">
                                    {item.unit || ing?.unit}
                                  </span>
                                </div>
                                <div className="text-right min-w-[70px]">
                                  <span className="text-[9px] uppercase font-bold text-text-muted block leading-none">
                                    Est. Cost
                                  </span>
                                  <span className="text-xs font-black text-brand-brown-deep tabular-nums">
                                    {formatLKR(itemCost)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-dashed border-[#D6C7B7] text-center space-y-1">
                        <span className="text-xs font-bold text-text-secondary block">
                          No Standard Base Recipe Configured
                        </span>
                        <span className="text-[10px] text-text-muted block">
                          Click "Edit Product" above to link raw inventory ingredients to this item.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 2. CUSTOM MODIFIERS & SIZE VARIATIONS */}
                  <div className="space-y-2.5 pt-2 border-t border-[#EAE3DA]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                          <SlidersHorizontal className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                            Custom Modifiers & Size Variations
                          </span>
                          <span className="text-[10px] text-text-muted leading-none">
                            Portion sizes, milk choices & add-on stock recipes
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-md">
                        Click options to test live price
                      </span>
                    </div>

                    {/* Modifier Groups & Interactive Option Chips */}
                    {viewingProduct.customModifiers && viewingProduct.customModifiers.length > 0 ? (
                      <div className="space-y-3">
                        {viewingProduct.customModifiers.map((group) => {
                          const selectedIds = selectedViewModifiers[group.id] || [];

                          const gridColsClass =
                            group.options.length === 1
                              ? 'grid-cols-1'
                              : group.options.length === 2
                              ? 'grid-cols-1 sm:grid-cols-2'
                              : group.options.length === 3
                              ? 'grid-cols-1 sm:grid-cols-3'
                              : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

                          return (
                            <div
                              key={group.id}
                              className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EAE3DA] space-y-2.5 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-brand-brown-dark">
                                    {group.name}
                                  </span>
                                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white border border-[#E0D7CC] text-text-secondary shadow-2xs">
                                    {group.required ? 'Required' : 'Optional'} • {group.multiSelect ? 'Multi-Select' : 'Single Choice'}
                                  </span>
                                </div>
                              </div>

                              {/* Option Chips Grid (Responsive 1/2/3 Columns) */}
                              <div className={`grid ${gridColsClass} gap-2`}>
                                {group.options.map((opt) => {
                                  const isSelected = selectedIds.includes(opt.id);
                                  const optionIngredients: RecipeItem[] =
                                    opt.ingredients && opt.ingredients.length > 0
                                      ? opt.ingredients
                                      : opt.ingredientId
                                      ? [
                                          {
                                            ingredientId: opt.ingredientId,
                                            ingredientName:
                                              ingredients.find((i) => i.id === opt.ingredientId)?.name || '',
                                            quantity: opt.ingredientQuantity || 1,
                                            unit: opt.ingredientUnit || '',
                                          },
                                        ]
                                      : [];

                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => handleToggleViewModifierOption(group, opt.id)}
                                      className={`p-2.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                        isSelected
                                          ? 'bg-teal-50/70 border-2 border-brand-teal text-brand-brown-dark shadow-xs ring-2 ring-brand-teal/15'
                                          : 'bg-white border border-[#E2D8CC] text-brand-brown-dark hover:border-brand-teal/40 hover:bg-cream-50/60 shadow-2xs'
                                      }`}
                                    >
                                      {/* Option Top: Radio Circle + Title + Price */}
                                      <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <div
                                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                              isSelected
                                                ? 'bg-brand-teal text-white shadow-2xs'
                                                : 'border-2 border-[#D6C7B7] bg-white'
                                            }`}
                                          >
                                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                          </div>
                                          <span className="text-xs font-black truncate text-brand-brown-dark">
                                            {opt.name}
                                          </span>
                                        </div>

                                        <span
                                          className={`text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg shrink-0 ${
                                            opt.priceCents > 0
                                              ? 'bg-white border border-[#E0D7CC] text-brand-brown-deep'
                                              : 'bg-status-success-bg border border-status-success/20 text-status-success'
                                          }`}
                                        >
                                          {opt.priceCents > 0 ? `+${formatLKR(opt.priceCents)}` : 'Free'}
                                        </span>
                                      </div>

                                      {/* Linked Stock Deduction Tags */}
                                      {optionIngredients.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-[#EAE3DA]/80">
                                          {optionIngredients.map((ingItem, iIdx) => (
                                            <span
                                              key={iIdx}
                                              className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-[#E2D8CC] text-text-secondary truncate max-w-full"
                                            >
                                              <span className="w-1 h-1 rounded-full bg-brand-teal shrink-0" />
                                              <span className="truncate">{ingItem.ingredientName || 'Item'}:</span>
                                              <span className="text-brand-brown font-black shrink-0">
                                                {ingItem.quantity} {ingItem.unit}
                                              </span>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-dashed border-[#D6C7B7] text-center space-y-1">
                        <span className="text-xs font-bold text-text-secondary block">
                          No Modifiers or Sizes Configured
                        </span>
                        <span className="text-[10px] text-text-muted block">
                          Click "Edit Product" to configure portion sizes (Small, Medium, Large) or add-ons.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. MIDDLE CARD: PRODUCT DETAILS (Col Span 3 / 25% width)          */}
                {/* ================================================================= */}
                <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE3DA] shrink-0">
                    <div className="w-7 h-7 rounded-xl bg-brand-brown/10 text-brand-brown flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block leading-tight">
                        Product Details
                      </span>
                      <span className="text-[10px] text-text-muted leading-none">
                        Menu presentation & pricing
                      </span>
                    </div>
                  </div>

                  {/* Product Name */}
                  <div className="shrink-0">
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                      Product Name
                    </label>
                    <div className="w-full pb-1 pt-0.5 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark">
                      {viewingProduct.name}
                    </div>
                  </div>

                  {/* Category & Prep Station */}
                  <div className="grid grid-cols-2 gap-2.5 shrink-0">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Category
                      </label>
                      <div className="w-full pb-1 pt-0.5 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark truncate">
                        {categories.find((c) => c.id === viewingProduct.categoryId)?.name || 'Category'}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Prep Station
                      </label>
                      <div className="w-full pb-1 pt-0.5 border-b border-[#E2D8CC] text-xs font-bold text-brand-brown-dark truncate">
                        {viewingProduct.preparationStationId === 'st_kitchen'
                          ? 'Main Kitchen'
                          : viewingProduct.preparationStationId === 'st_bakery'
                          ? 'Bakery & Pastry'
                          : 'Barista Bar'}
                      </div>
                    </div>
                  </div>

                  {/* Price & Stock Status */}
                  <div className="grid grid-cols-2 gap-2.5 items-end shrink-0">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Base Price
                      </label>
                      <div className="flex items-center gap-1 border-b border-[#E2D8CC] pb-1 pt-0.5">
                        <span className="text-xs font-bold text-text-muted">Rs.</span>
                        <span className="text-xs font-black text-brand-brown-deep tabular-nums">
                          {centsToRupees(viewingProduct.basePriceCents || 0)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Stock Status
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleSoldOut(viewingProduct.id);
                          setViewingProduct({
                            ...viewingProduct,
                            isSoldOut: !viewingProduct.isSoldOut,
                          });
                        }}
                        className={`w-full h-8 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                          viewingProduct.isSoldOut
                            ? 'bg-status-warning/20 text-status-warning border-status-warning/40'
                            : 'bg-status-success-bg text-status-success border-status-success/30'
                        }`}
                        title="Click to toggle Stock Status"
                      >
                        {viewingProduct.isSoldOut ? 'Sold Out' : 'Available'}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="shrink-0">
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                      Description
                    </label>
                    <div className="w-full pb-1 pt-0.5 border-b border-[#E2D8CC] text-xs text-brand-brown-dark line-clamp-2">
                      {viewingProduct.description || 'No description provided.'}
                    </div>
                  </div>

                  {/* Product Image Box */}
                  <div className="flex-1 flex flex-col min-h-[140px] pt-1">
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1 shrink-0">
                      Product Image
                    </label>
                    <div className="relative flex-1 w-full h-full min-h-[130px] rounded-2xl overflow-hidden border border-[#E2D8CC] bg-[#FAF7F2] flex items-center justify-center shadow-xs">
                      {viewingProduct.image ? (
                        <>
                          <img
                            src={viewingProduct.image}
                            alt={viewingProduct.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold">
                            Image Attached
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-text-muted gap-1.5 p-3 text-center">
                          <Package className="w-8 h-8 opacity-30 text-brand-brown" />
                          <span className="text-xs font-bold text-brand-brown-dark">No Image Uploaded</span>
                          <span className="text-[10px] text-text-muted">Standard placeholder active</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 3. RIGHT CARD: DEDICATED LIVE POS PREVIEW (Col Span 3 / 25% width)*/}
                {/* ================================================================= */}
                <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-3 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-3.5">
                  <div className="flex items-center justify-between shrink-0">
                    <span className="text-[11px] font-extrabold uppercase text-text-secondary tracking-wider">
                      Live Preview
                    </span>
                    <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-md">
                      POS Card
                    </span>
                  </div>

                  {/* Item Card Representation */}
                  <div className="rounded-2xl border border-[#E9E0D5] bg-[#FAF7F2] overflow-hidden shadow-xs shrink-0">
                    <div className="relative h-36 bg-cream-100 overflow-hidden flex items-center justify-center">
                      {viewingProduct.image ? (
                        <img
                          src={viewingProduct.image}
                          alt="Live Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-text-muted gap-1 p-3 text-center">
                          <Package className="w-6 h-6 opacity-30 text-brand-brown" />
                          <span className="text-[10px] font-bold">No image uploaded</span>
                        </div>
                      )}

                      {/* Category Badge */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-brand-brown-deep/85 text-white text-[9px] font-extrabold uppercase backdrop-blur-xs shadow-xs">
                        {categories.find((c) => c.id === viewingProduct.categoryId)?.name || 'Category'}
                      </span>

                      {/* Sold Out Badge */}
                      {viewingProduct.isSoldOut && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-status-warning text-white text-[9px] font-extrabold uppercase shadow-xs">
                          Sold Out
                        </span>
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <div>
                        <h4 className="font-extrabold text-xs text-brand-brown-dark truncate">
                          {viewingProduct.name || 'Product Title'}
                        </h4>
                        <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                          {viewingProduct.description || 'Product description will appear here...'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#EAE3DA] flex items-center justify-between">
                        <div>
                          <div className="text-[8px] uppercase font-bold text-text-secondary">
                            Selling Price {viewSelectedModifiersPriceCents > 0 && '(Customized)'}
                          </div>
                          <div className="font-black text-xs text-brand-brown-deep tabular-nums">
                            {formatLKR(totalCalculatedViewPriceCents)}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${
                            viewingProduct.isSoldOut
                              ? 'bg-status-warning/10 text-status-warning border-status-warning/30'
                              : 'bg-status-success-bg text-status-success border-status-success/30'
                          }`}
                        >
                          {viewingProduct.isSoldOut ? 'Sold Out' : 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recipe and Food Cost Analysis Pill in preview */}
                  <div className="p-2.5 bg-[#FAF7F2] rounded-2xl border border-[#E9E0D5] space-y-1.5 shrink-0">
                    <div className="text-[10px] font-bold text-brand-brown-dark flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <ChefHat className="w-3.5 h-3.5 text-brand-brown" />
                        <span>
                          Recipe ({viewProductRecipe?.items.length || 0} base
                          {viewSelectedModifierIngredients.length > 0 ? ` + ${viewSelectedModifierIngredients.length} mods` : ''})
                        </span>
                      </div>
                      <span className="text-[9px] font-extrabold text-status-success bg-status-success-bg px-1.5 py-0.5 rounded-md">
                        +{viewProfitMarginPercent}% Margin
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#EAE3DA]">
                      <span className="text-text-muted font-bold">Portion Cost:</span>
                      <span className="font-black text-brand-brown-deep tabular-nums">
                        {formatLKR(totalCalculatedViewCostCents)}
                      </span>
                    </div>
                  </div>

                  {/* Modifiers info pill in preview */}
                  {viewingProduct.customModifiers && viewingProduct.customModifiers.length > 0 && (
                    <div className="p-2.5 bg-[#FAF7F2] rounded-2xl border border-[#E9E0D5] space-y-1.5 shrink-0">
                      <div className="text-[10px] font-bold text-brand-brown-dark flex items-center gap-1">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-brand-teal" />
                        <span>Configured Modifiers ({viewingProduct.customModifiers.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {viewingProduct.customModifiers.map((m, idx) => (
                          <span
                            key={m.id || idx}
                            className="px-1.5 py-0.5 bg-white border border-[#E0D7CC] rounded-md text-[9px] font-bold text-brand-brown truncate max-w-[120px]"
                          >
                            {m.name || 'Group'} ({m.options.length})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
