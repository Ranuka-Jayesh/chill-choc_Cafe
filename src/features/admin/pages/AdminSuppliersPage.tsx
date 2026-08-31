import React, { useState, useEffect } from 'react';
import { catalogService } from '@/services/catalogService';
import { Supplier } from '@/types';
import { db } from '@/services/storage/db';
import { Building2, Plus, Edit2, Phone, Mail, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';

export const AdminSuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState(catalogService.getSuppliers());
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setSuppliers(catalogService.getSuppliers()));
    return unsub;
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier?.name) return;

    catalogService.saveSupplier({
      ...editingSupplier,
      name: editingSupplier.name,
    });

    toast.success('Supplier saved.');
    setEditingSupplier(null);
  };

  return (
    <div className="space-y-5 w-full pb-12 animate-in fade-in">
      <div className="flex items-center justify-end">
        <button
          onClick={() =>
            setEditingSupplier({
              name: '',
              contactPerson: '',
              phone: '',
              email: '',
              address: '',
              active: true,
            })
          }
          className="flex items-center gap-2 px-4 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs rounded-xl shadow-teal transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((sup) => (
          <div key={sup.id} className="bg-white p-5 rounded-3xl border border-border shadow-soft space-y-3 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cream-100 text-brand-brown flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-brand-brown-dark">{sup.name}</h3>
                  <p className="text-xs text-text-secondary font-medium">{sup.contactPerson}</p>
                </div>
              </div>
              <button onClick={() => setEditingSupplier(sup)} className="p-1.5 text-text-secondary hover:text-brand-teal">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-text-secondary pt-2 border-t border-cream-100">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-brand-teal" />
                <span>{sup.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-brand-orange" />
                <span>{sup.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-brand-brown" />
                <span>{sup.address || 'Colombo, Sri Lanka'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-elevated border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-cream-50 border-b border-border">
              <h3 className="font-extrabold text-sm text-brand-brown-dark">
                {editingSupplier.id ? 'Edit Supplier' : 'New Supplier'}
              </h3>
              <button onClick={() => setEditingSupplier(null)} className="p-1.5 text-text-secondary hover:bg-cream-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Company Name</label>
                <input
                  type="text"
                  value={editingSupplier.name || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Contact Person</label>
                <input
                  type="text"
                  value={editingSupplier.contactPerson || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, contactPerson: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Phone</label>
                  <input
                    type="text"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-text-secondary">Email</label>
                  <input
                    type="email"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                    className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Address</label>
                <input
                  type="text"
                  value={editingSupplier.address || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-extrabold text-xs shadow-teal"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
