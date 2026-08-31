import React, { useState, useEffect } from 'react';
import { catalogService } from '@/services/catalogService';
import { Category } from '@/types';
import { db } from '@/services/storage/db';
import { Layers, Plus, Edit2, Check, X, Coffee, CupSoda, Cake, IceCream, UtensilsCrossed, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState(catalogService.getCategories());
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setCategories(catalogService.getCategories()));
    return unsub;
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name) return;

    catalogService.saveCategory({
      ...editingCategory,
      name: editingCategory.name,
      slug: editingCategory.slug || editingCategory.name.toLowerCase().replace(/\s+/g, '-'),
    });

    toast.success('Category saved successfully.');
    setEditingCategory(null);
  };

  return (
    <div className="space-y-5 w-full pb-12 animate-in fade-in">
      <div className="flex items-center justify-end">
        <button
          onClick={() =>
            setEditingCategory({
              name: '',
              slug: '',
              icon: 'Coffee',
              displayOrder: categories.length + 1,
              preparationStationId: 'st_bar',
              active: true,
            })
          }
          className="flex items-center gap-2 px-4 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs rounded-xl shadow-teal transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white p-5 rounded-3xl border border-border shadow-soft flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cream-100 text-brand-brown flex items-center justify-center font-bold">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-brand-brown-dark">{cat.name}</h3>
                <div className="text-[11px] text-text-secondary">Order #{cat.displayOrder} • {cat.slug}</div>
              </div>
            </div>

            <button
              onClick={() => setEditingCategory(cat)}
              className="p-2 text-text-secondary hover:text-brand-teal hover:bg-cream-100 rounded-xl"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-elevated border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-cream-50 border-b border-border">
              <h3 className="font-extrabold text-sm text-brand-brown-dark">
                {editingCategory.id ? 'Edit Category' : 'New Category'}
              </h3>
              <button onClick={() => setEditingCategory(null)} className="p-1.5 text-text-secondary hover:bg-cream-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Category Name</label>
                <input
                  type="text"
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="e.g. Specialty Coffees"
                  className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Display Order</label>
                <input
                  type="number"
                  value={editingCategory.displayOrder || 1}
                  onChange={(e) => setEditingCategory({ ...editingCategory, displayOrder: Number(e.target.value) })}
                  className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Preparation Station</label>
                <select
                  value={editingCategory.preparationStationId || 'st_bar'}
                  onChange={(e) => setEditingCategory({ ...editingCategory, preparationStationId: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                >
                  <option value="st_bar">Bar Station (Beverages)</option>
                  <option value="st_dessert">Dessert Station</option>
                  <option value="st_kitchen">Kitchen Station</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-extrabold text-xs shadow-teal"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
