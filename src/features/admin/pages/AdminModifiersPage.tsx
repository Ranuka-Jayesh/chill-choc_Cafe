import React, { useState, useEffect } from 'react';
import { catalogService } from '@/services/catalogService';
import { ModifierGroup, ModifierOption } from '@/types';
import { db } from '@/services/storage/db';
import { formatLKR, rupeesToCents, centsToRupees } from '@/utils/format';
import { Sliders, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export const AdminModifiersPage: React.FC = () => {
  const [modifierGroups, setModifierGroups] = useState(catalogService.getModifierGroups());
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => setModifierGroups(catalogService.getModifierGroups()));
    return unsub;
  }, []);

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup?.name) return;

    catalogService.saveModifierGroup(editingGroup);
    toast.success('Modifier group saved.');
    setEditingGroup(null);
  };

  const handleAddOption = () => {
    if (!editingGroup) return;
    const newOpt: ModifierOption = {
      id: `opt_${Date.now()}`,
      name: 'New Option',
      priceCents: 0,
    };
    setEditingGroup({
      ...editingGroup,
      options: [...editingGroup.options, newOpt],
    });
  };

  const handleRemoveOption = (optId: string) => {
    if (!editingGroup) return;
    setEditingGroup({
      ...editingGroup,
      options: editingGroup.options.filter((o) => o.id !== optId),
    });
  };

  return (
    <div className="space-y-5 w-full pb-12 animate-in fade-in">
      <div className="flex items-center justify-end">
        <button
          onClick={() =>
            setEditingGroup({
              id: `mod_${Date.now()}`,
              name: 'New Modifier Group',
              required: false,
              multiSelect: false,
              minSelections: 0,
              maxSelections: 1,
              options: [
                { id: `opt_${Date.now()}_1`, name: 'Option 1', priceCents: 0, isDefault: true },
                { id: `opt_${Date.now()}_2`, name: 'Option 2 (Extra)', priceCents: 15000 },
              ],
            })
          }
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs rounded-2xl shadow-teal"
        >
          <Plus className="w-4 h-4" />
          Create Modifier Group
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modifierGroups.map((group) => (
          <div key={group.id} className="bg-white p-6 rounded-3xl border border-border shadow-soft space-y-4 flex flex-col justify-between">
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

                <button
                  onClick={() => setEditingGroup(group)}
                  className="p-2 text-text-secondary hover:text-brand-teal hover:bg-cream-100 rounded-xl"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Options Pills */}
              <div className="space-y-1.5 pt-1">
                {group.options.map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between p-2.5 bg-cream-50 rounded-xl border border-border text-xs"
                  >
                    <span className="font-bold text-text-primary">
                      {opt.name} {opt.isDefault && <span className="text-[10px] text-brand-teal font-normal">(Default)</span>}
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

      {/* Edit Modifier Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-brown-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-elevated border border-border overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-cream-50 border-b border-border">
              <h3 className="font-extrabold text-sm text-brand-brown-dark">Edit Modifier Group</h3>
              <button onClick={() => setEditingGroup(null)} className="p-1.5 text-text-secondary hover:bg-cream-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-text-secondary">Group Name</label>
                <input
                  type="text"
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 bg-cream-50 border border-border rounded-xl text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 bg-cream-50 rounded-xl border border-border text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingGroup.required}
                    onChange={(e) => setEditingGroup({ ...editingGroup, required: e.target.checked })}
                    className="rounded text-brand-teal"
                  />
                  <span>Required Selection</span>
                </label>

                <label className="flex items-center gap-2 p-3 bg-cream-50 rounded-xl border border-border text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingGroup.multiSelect}
                    onChange={(e) => setEditingGroup({ ...editingGroup, multiSelect: e.target.checked })}
                    className="rounded text-brand-teal"
                  />
                  <span>Allow Multi-Select</span>
                </label>
              </div>

              {/* Options List */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-text-secondary">Options & Extra Charges (Rs.)</label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Option
                  </button>
                </div>

                <div className="space-y-2">
                  {editingGroup.options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2 p-2 bg-cream-50 rounded-xl border border-border">
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => {
                          const updated = [...editingGroup.options];
                          updated[idx].name = e.target.value;
                          setEditingGroup({ ...editingGroup, options: updated });
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-border rounded-lg text-xs font-bold"
                        placeholder="Option Name"
                        required
                      />
                      <div className="w-24">
                        <input
                          type="number"
                          min="0"
                          value={centsToRupees(opt.priceCents)}
                          onChange={(e) => {
                            const updated = [...editingGroup.options];
                            updated[idx].priceCents = rupeesToCents(Number(e.target.value));
                            setEditingGroup({ ...editingGroup, options: updated });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-border rounded-lg text-xs font-bold tabular-nums"
                          placeholder="Price"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(opt.id)}
                        className="p-1.5 text-text-secondary hover:text-status-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-extrabold text-xs shadow-teal"
                >
                  Save Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
